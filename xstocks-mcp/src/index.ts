/**
 * xstocks-mcp v0.1
 *
 * MCP server to buy/sell tokenized US stocks (xStocks by Backed) on Solana,
 * paying directly in USDC via Jupiter DEX. Hard daily USD cap guard.
 *
 * Architectural choices:
 *   - Pay Token pass-through: user's own Solana wallet signs the swap.
 *     LemonCake never custodies USDC. No money-transmitter exposure.
 *   - Flat $0.10/trade LemonCake fee (industry-normal wrapper pricing).
 *   - Dry-run by default. Real swaps require BOTH
 *       SOLANA_WALLET_PRIVATE_KEY (base58 or [u8;64] JSON)
 *       XSTOCKS_ALLOW_LIVE=yes-i-understand
 *     simultaneously. The agent has no override path.
 *
 * Sibling MCPs (same team, same daily-cap pattern):
 *   - agent-payment-mcp        — USDC for any HTTP API (Tavily / Hunter / NTA / ...)
 *   - alpaca-guard-mcp        — daily-cap guard for traditional Alpaca brokerage
 *   - tokenized-stock-mcp     — Dinari dShares (centralized, non-EVM)
 *   - xstocks-mcp (this one)  — fully on-chain Solana DEX path
 */

import { Server }              from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { findXStockBySymbol, USDC_MINT, buildSwapTransaction } from "./jupiter.js";
import {
  guardBuy, recordTrade,
  status as guardStatus, setDailyLimit as guardSetLimit,
} from "./guard.js";
import {
  liveMode, dryRunReason,
  getPublicKey, getSolBalance, getUsdcBalance, signAndSendSwap,
  hasFeePayerWallet, getFeePayerPublicKey,
  isEmbeddedWallet, hasEmbeddedWalletFile, embeddedWalletPath,
} from "./wallet.js";
import { FEE_USD } from "./margin.js";

// Injected by esbuild at build time (see build.mjs __VERSION__ define)
declare const __VERSION__: string;
const VERSION: string = (typeof __VERSION__ !== "undefined") ? __VERSION__ : "0.1.1";

const INSTRUCTIONS = [
  `xstocks-mcp v${VERSION} — Solana xStocks (USDC → AAPLx/TSLAx/SPYx/...) with a hard daily USD cap.`,
  ``,
  `Mode: ${liveMode() ? "🔴 LIVE (real-money swaps enabled)" : `🧪 DRY-RUN (${dryRunReason()})`}`,
  `Daily cap: ~/.xstocks/cap.json (set via guard_set_limit; default $25)`,
  `LemonCake fee: $${FEE_USD.toFixed(2)} per trade (flat).`,
  ``,
  `Read-only tools (find_xstock / get_quote / wallet_status / guard_status / setup) never spend.`,
  `Live trading requires SOLANA_WALLET_PRIVATE_KEY + XSTOCKS_ALLOW_LIVE=yes-i-understand simultaneously.`,
].join("\n");

const server = new Server(
  { name: "xstocks-mcp", version: VERSION },
  {
    capabilities: { tools: {}, logging: {} },
    instructions: INSTRUCTIONS,
  },
);

// ─── Tool list ────────────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name:        "setup",
      description: "Show xstocks-mcp setup state: mode, env vars, daily cap, ledger file, LemonCake fee. Read-only.",
      annotations: { title: "Setup", readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "wallet_status",
      description: "Return the configured Solana wallet's public key, SOL balance (for gas), and USDC balance. Read-only.",
      annotations: { title: "Wallet status", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "guard_status",
      description: "Daily cap ledger: limit / used / remaining / lifetime swaps / last 10 trades. Read-only.",
      annotations: { title: "Guard status", readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "guard_set_limit",
      description: "Set the daily USD cap. The agent cannot raise its own cap silently — calling this is logged.",
      annotations: { title: "Set daily cap", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {
        type: "object",
        required: ["dailyLimitUsd"],
        additionalProperties: false,
        properties: { dailyLimitUsd: { type: "number", description: "Non-negative USD. 0 disables trading." } },
      },
    },
    {
      name:        "find_xstock",
      description: "Look up a tokenized US stock by ticker (e.g. AAPL or AAPLx → returns the verified Backed-issued mint with current price + holder count). Read-only.",
      annotations: { title: "Find xStock", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol"],
        additionalProperties: false,
        properties: { symbol: { type: "string", description: "Ticker (case-insensitive); 'x' suffix optional" } },
      },
    },
    {
      name:        "get_quote",
      description: "Get a Jupiter swap quote for USDC → xStock at a given USD amount. Returns expected output token amount + price impact %. Does not execute.",
      annotations: { title: "Quote", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol", "amountUsd"],
        additionalProperties: false,
        properties: {
          symbol:      { type: "string" },
          amountUsd:   { type: "number", description: "USD amount to swap" },
          slippageBps: { type: "number", description: "Slippage tolerance in basis points (50 = 0.5%, default)" },
        },
      },
    },
    {
      name:        "guarded_buy_stock",
      description: [
        "Buy a tokenized US stock by swapping USDC → xStock on Jupiter, with a daily-cap preflight.",
        "Refuses with BUDGET_EXCEEDED if over today's cap. The agent has no override path.",
        "In DRY-RUN mode (default) returns the simulated quote + decision without sending the tx.",
        "In LIVE mode (SOLANA_WALLET_PRIVATE_KEY + XSTOCKS_ALLOW_LIVE=yes-i-understand) signs + sends.",
        "",
        "Returns: { allowed, status, notionalUsd, expectedOutAmount, priceImpactPct, txSig?, x402Receipt? }",
      ].join("\n"),
      annotations: { title: "Buy xStock (guarded)", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol", "amountUsd"],
        additionalProperties: false,
        properties: {
          symbol:      { type: "string", description: "Ticker e.g. AAPL or AAPLx" },
          amountUsd:   { type: "number", description: "USD amount to spend" },
          slippageBps: { type: "number", description: "Slippage tolerance in basis points (50 = 0.5%, default)" },
        },
      },
    },
  ],
}));

// ─── Handlers ─────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case "setup": {
        const st = await guardStatus();
        return json({
          version: VERSION,
          mode:    liveMode() ? "live (explicit opt-in)" : `dry-run (${dryRunReason()})`,
          wallet: isEmbeddedWallet()
            ? {
                mode:    "embedded (auto-generated)",
                file:    embeddedWalletPath(),
                exists:  hasEmbeddedWalletFile(),
                pubkey:  getPublicKey()?.toBase58() ?? "(will be generated on first use)",
                hint:    hasEmbeddedWalletFile()
                  ? "Wallet loaded from local file. Fund this address with USDC to start trading."
                  : "No wallet yet — one will be auto-generated on first guarded_buy_stock call.",
              }
            : {
                mode:   "explicit (SOLANA_WALLET_PRIVATE_KEY)",
                pubkey: getPublicKey()?.toBase58() ?? "✗ key parse error",
              },
          envSet: {
            xstocksAllowLive: liveMode(),
            solanaRpcUrl:     process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com (default)",
            jupiterApiBase:   process.env.JUPITER_API_BASE ?? "https://lite-api.jup.ag (default)",
            feePayerWallet:   hasFeePayerWallet()
              ? `✓ ${getFeePayerPublicKey()?.toBase58()} (LemonCake pays SOL gas — users need USDC only)`
              : "✗ not set — users must provide their own SOL for gas",
          },
          fee: {
            lemoncakePerTradeUsd: FEE_USD,
            policyNote:           `Flat $${FEE_USD.toFixed(2)} per trade (configurable via LEMONCAKE_STOCK_FEE_USD).`,
            jupiterFeeNote:       "Jupiter charges 0 protocol fee; price includes pool spread/AMM curve.",
          },
          guard: {
            dailyLimitUsd: st.dailyLimitUsd,
            todayUsedUsd:  st.todayUsedUsd,
            remainingUsd:  st.remainingUsd,
            ledgerFile:    st.ledgerFile,
          },
          docs:     "https://github.com/evidai/lemon-cake/tree/main/xstocks-mcp",
          siblings: [
            "agent-payment-mcp (USDC for any HTTP API)",
            "alpaca-guard-mcp (traditional Alpaca brokerage guard)",
            "tokenized-stock-mcp (Dinari dShares)",
          ],
        });
      }

      case "wallet_status": {
        const pk   = getPublicKey();
        const sol  = pk ? await getSolBalance()        : null;
        const usdc = pk ? await getUsdcBalance(USDC_MINT) : null;
        const gasReady = hasFeePayerWallet() || (typeof sol === "number" && sol >= 0.01);
        return json({
          walletMode:   isEmbeddedWallet() ? "embedded (auto-generated, stored locally)" : "explicit key",
          publicKey:    pk?.toBase58() ?? "(not yet generated)",
          solBalance:   sol,
          usdcBalance:  usdc,
          gasReady,
          feePayerMode: hasFeePayerWallet()
            ? `✓ LemonCake fee payer pays SOL gas — USDC only needed`
            : undefined,
          note: !gasReady
            ? "Set FEEPAYER_PRIVATE_KEY so LemonCake pays gas, or fund this address with ~0.01 SOL."
            : !usdc
              ? `Fund ${pk?.toBase58()} with USDC on Solana to start trading.`
              : undefined,
        });
      }

      case "guard_status": {
        const s = await guardStatus();
        return json({
          dailyLimitUsd:  s.dailyLimitUsd,
          todayDate:      s.todayDate,
          todayUsedUsd:   s.todayUsedUsd,
          remainingUsd:   s.remainingUsd,
          lifetimeOrders: s.lifetimeOrders,
          recentHistory:  s.history.slice(0, 10),
          ledgerFile:     s.ledgerFile,
        });
      }

      case "guard_set_limit": {
        const s = await guardSetLimit(Number(args.dailyLimitUsd));
        return json({
          dailyLimitUsd: s.dailyLimitUsd,
          todayUsedUsd:  s.todayUsedUsd,
          remainingUsd:  Math.max(0, s.dailyLimitUsd - s.todayUsedUsd),
        });
      }

      case "find_xstock": {
        const tok = await findXStockBySymbol(String(args.symbol));
        if (!tok) {
          return json({
            symbol: String(args.symbol),
            found:  false,
            hint:   "No verified xStock found. Try a major ticker (AAPL, TSLA, NVDA, SPY, COIN, MSTR).",
          });
        }
        return json({ found: true, ...tok });
      }

      case "get_quote": {
        const decision = await guardBuy({
          symbol:      String(args.symbol),
          amountUsd:   Number(args.amountUsd),
          slippageBps: args.slippageBps != null ? Number(args.slippageBps) : undefined,
        });
        if (!decision.allowed) {
          return json({ allowed: false, status: decision.reason, hint: decision.hint });
        }
        return json({
          symbol:            decision.token.symbol,
          mint:              decision.token.mint,
          amountUsd:         decision.notionalUsd,
          expectedOutAmount: decision.expectedOutAmount,
          priceImpactPct:    decision.priceImpactPct,
          slippageBps:       decision.quote.slippageBps,
          tokenPriceUsd:     decision.token.usdPrice,
          tokenLiquidityUsd: decision.token.liquidity,
        });
      }

      case "guarded_buy_stock": {
        const decision = await guardBuy({
          symbol:      String(args.symbol),
          amountUsd:   Number(args.amountUsd),
          slippageBps: args.slippageBps != null ? Number(args.slippageBps) : undefined,
        });
        if (!decision.allowed) {
          return json({
            allowed: false, status: decision.reason,
            symbol: String(args.symbol),
            notionalUsd: decision.notionalUsd,
            remainingUsd: decision.remainingUsd,
            limitUsd: decision.limitUsd,
            hint: decision.hint,
            txSig: null, x402Receipt: null,
          });
        }

        // Preflight passed. Now decide dry-run vs live.
        if (!liveMode()) {
          return json({
            allowed: true, status: "DRY_RUN_OK",
            mode: "dry-run",
            reason: dryRunReason(),
            symbol: decision.token.symbol,
            mint: decision.token.mint,
            notionalUsd: decision.notionalUsd,
            expectedOutAmount: decision.expectedOutAmount,
            priceImpactPct: decision.priceImpactPct,
            remainingUsd: decision.remainingUsd,
            limitUsd: decision.limitUsd,
            txSig: null,
            hint: "Quote + cap check passed. Set SOLANA_WALLET_PRIVATE_KEY + XSTOCKS_ALLOW_LIVE=yes-i-understand to sign and send for real.",
            x402Receipt: null,
          });
        }

        // LIVE: build, sign, send.
        const pk = getPublicKey();
        if (!pk) {
          return json({ allowed: false, status: "WALLET_LOAD_FAILED", hint: "Could not load Solana keypair from SOLANA_WALLET_PRIVATE_KEY." });
        }
        const feePayerPk = getFeePayerPublicKey();
        const { base64Tx, isLegacy } = await buildSwapTransaction({
          quote:            decision.quote,
          userPublicKey:    pk.toBase58(),
          feePayerPublicKey: feePayerPk?.toBase58(),
        });
        const txSig = await signAndSendSwap(base64Tx, isLegacy);
        await recordTrade({
          notionalUsd: decision.notionalUsd,
          feeUsd:      FEE_USD,
          txSig,
          symbol:      decision.token.symbol,
          side:        "buy",
        });

        return json({
          allowed:           true,
          status:            "SWAPPED",
          mode:              "live",
          symbol:            decision.token.symbol,
          mint:              decision.token.mint,
          notionalUsd:       decision.notionalUsd,
          expectedOutAmount: decision.expectedOutAmount,
          priceImpactPct:    decision.priceImpactPct,
          remainingUsd:      Math.max(0, decision.remainingUsd - decision.notionalUsd),
          limitUsd:          decision.limitUsd,
          txSig,
          solscanUrl:        `https://solscan.io/tx/${txSig}`,
          x402Receipt: {
            scheme:           "xstocks-jupiter-onchain-v1",
            x402Compatible:   true,
            chain:            "solana:mainnet",
            asset:            "USDC",
            amount:           decision.notionalUsd.toFixed(2),
            recipient:        decision.token.mint,
            paymentIntentId:  txSig,
            settledAt:        new Date().toISOString(),
            note:             `Jupiter DEX swap USDC → ${decision.token.symbol}. LemonCake fee $${FEE_USD.toFixed(2)} recorded in local ledger.`,
          },
        });
      }

      default:
        return { content: [{ type: "text" as const, text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
  }
});

function json(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[xstocks-mcp] v${VERSION} ready. mode=${liveMode() ? "live(opt-in)" : "dry-run"} fee=$${FEE_USD.toFixed(2)}/trade\n`
  );
  // Surface the web funnel — boot output is the single most reliable place
  // to convert npm installs into website visits. Production telemetry on
  // 2026-05-26 showed 200+ DL/day vs ~1.5 web views/day = 0.3% conversion.
  // Goal: bump to 5%+ by making the pricing URL impossible to miss.
  process.stderr.write(
    `[xstocks-mcp]   → Pro tier ($0.005/swap): set LEMONCAKE_STOCK_FEE_USD=0.005 (see https://lemoncake.xyz/pricing?utm_source=npm-boot&utm_medium=cli&utm_campaign=xstocks-mcp)\n`
  );
  process.stderr.write(
    `[xstocks-mcp]   → Free tier (1k tx/mo, gas sponsored): https://lemoncake.xyz/start/free?utm_source=npm-boot&utm_medium=cli&utm_campaign=xstocks-mcp\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[xstocks-mcp] fatal: ${err}\n`);
  process.exit(1);
});
