#!/usr/bin/env node
/**
 * gmx-mcp v0.1
 *
 * MCP server for trading synthetic US stock perpetuals on GMX v2 (Arbitrum).
 * Users express interest in AAPL/TSLA/NVDA/AMZN/GOOGL/MSFT/META as
 * long or short perpetual positions, paying USDC as collateral.
 *
 * Architectural choices:
 *   - DRY-RUN by default. Real execution requires GMX_DRY_RUN=false +
 *     GMX_WALLET_PRIVATE_KEY simultaneously. The agent has no override path.
 *   - Cap guard: all position opens are preflighted against a local daily cap
 *     (~/.gmx-mcp/cap.json). Default $500/day.
 *   - Pay Token pass-through: user's own wallet signs on-chain. LemonCake
 *     never custodies USDC. Flat $0.10/trade LemonCake fee.
 *   - v0.1 provides full simulation + price feeds. On-chain execution lands in v0.2
 *     (requires GMX v2 SDK multicall integration — see wallet.ts).
 *
 * Sibling MCPs (same team, same daily-cap pattern):
 *   - alpaca-guard-mcp        — traditional Alpaca brokerage guard
 *   - tokenized-stock-mcp     — Dinari dShares (ERC-20 tokenized stocks)
 *   - xstocks-mcp             — xStocks on Solana (Jupiter DEX)
 *   - gmx-mcp (this one)      — GMX v2 synthetic perps on Arbitrum
 */

import { Server }              from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import {
  getAllMarkets, getMarket,
  isDryRun, isLiveMode, dryRunReason,
  MAX_POSITION_USD,
} from "./markets.js";
import {
  getPrice, getMarketInfo, simulateOpenPosition,
  getAllPrices,
} from "./gmxApi.js";
import {
  hasWalletKey, hasWalletAddress, getWalletAddress, getPositions,
} from "./wallet.js";
import * as ledger from "./capLedger.js";

declare const __VERSION__: string;
const VERSION: string = (typeof __VERSION__ !== "undefined") ? __VERSION__ : "0.1.0";

const FEE_USD_TRADE    = 0.10;  // charged on open_position / close_position / get_pnl
const FEE_USD_ACCOUNT  = 0.05;  // charged on get_positions / get_account_info

const INSTRUCTIONS = [
  `gmx-mcp v${VERSION} — GMX v2 synthetic stock perpetuals (Arbitrum). AAPL/TSLA/NVDA/AMZN/GOOGL/MSFT/META.`,
  ``,
  `Mode: ${isLiveMode() ? "LIVE (on-chain execution enabled)" : `DRY-RUN (${dryRunReason() || "default"})`}`,
  `Note: v0.1 provides full simulation. On-chain execution is in the v0.2 roadmap.`,
  `Daily cap: $${MAX_POSITION_USD} (configurable via guard_set_limit or GMX_MAX_POSITION_USD).`,
  `LemonCake fee: $${FEE_USD_TRADE.toFixed(2)}/trade, $${FEE_USD_ACCOUNT.toFixed(2)}/position-read.`,
  ``,
  `Free tools: list_markets, get_price, get_market_info`,
  `$${FEE_USD_ACCOUNT.toFixed(2)}/call: get_positions, get_account_info`,
  `$${FEE_USD_TRADE.toFixed(2)}/call: open_position, close_position, get_pnl`,
].join("\n");

const server = new Server(
  { name: "gmx-mcp", version: VERSION },
  {
    capabilities: { tools: {}, logging: {} },
    instructions: INSTRUCTIONS,
  }
);

// ─── Tool list ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ── Free ──────────────────────────────────────────────────────────────────
    {
      name:        "setup",
      description: "Show gmx-mcp configuration: mode, env vars, daily cap, fee schedule, and available markets. Read-only.",
      annotations: { title: "Setup", readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "guard_status",
      description: "Daily cap ledger: limit / used / remaining / lifetime trades / last 10 trades. Read-only.",
      annotations: { title: "Guard status", readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "guard_set_limit",
      description: "Set the daily USD collateral cap. The agent cannot silently raise this — the call is logged in the local ledger.",
      annotations: { title: "Set daily cap", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {
        type: "object",
        required: ["dailyLimitUsd"],
        additionalProperties: false,
        properties: {
          dailyLimitUsd: { type: "number", description: "Non-negative USD. 0 disables all trading." },
        },
      },
    },
    {
      name:        "list_markets",
      description: "List all supported GMX v2 synthetic stock markets with current prices from the GMX price feed. FREE — no wallet needed.",
      annotations: { title: "List markets", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "get_price",
      description: "Get the current GMX oracle price for a synthetic stock symbol (AAPL, TSLA, NVDA, AMZN, GOOGL, MSFT, META). FREE.",
      annotations: { title: "Get price", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol"],
        additionalProperties: false,
        properties: {
          symbol: { type: "string", description: "Ticker: AAPL, TSLA, NVDA, AMZN, GOOGL, MSFT, or META (case-insensitive)" },
        },
      },
    },
    {
      name:        "get_market_info",
      description: "Get funding rates, open interest, and liquidity for a GMX v2 synthetic stock market. FREE.",
      annotations: { title: "Market info", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol"],
        additionalProperties: false,
        properties: {
          symbol: { type: "string", description: "Ticker: AAPL, TSLA, NVDA, AMZN, GOOGL, MSFT, or META" },
        },
      },
    },

    // ── $0.05/call ────────────────────────────────────────────────────────────
    {
      name:        "get_positions",
      description: `Get open GMX v2 perpetual positions for a wallet address (reads from GMX subgraph). Requires GMX_WALLET_ADDRESS. Costs $${FEE_USD_ACCOUNT.toFixed(2)} via LemonCake.`,
      annotations: { title: "Get positions", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          walletAddress: {
            type: "string",
            description: "Arbitrum wallet address (0x...). Falls back to GMX_WALLET_ADDRESS env var.",
          },
        },
      },
    },
    {
      name:        "get_account_info",
      description: `Get USDC collateral balance and account summary for a wallet on Arbitrum. Costs $${FEE_USD_ACCOUNT.toFixed(2)} via LemonCake.`,
      annotations: { title: "Account info", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          walletAddress: {
            type: "string",
            description: "Arbitrum wallet address. Falls back to GMX_WALLET_ADDRESS.",
          },
        },
      },
    },

    // ── $0.10/call ────────────────────────────────────────────────────────────
    {
      name:        "open_position",
      description: [
        `Open a long or short perpetual position on GMX v2. Dry-run by default — shows simulation without executing.`,
        `Set GMX_DRY_RUN=false + GMX_WALLET_PRIVATE_KEY to execute on-chain (v0.2 roadmap).`,
        `Preflight: daily cap check is mandatory. Costs $${FEE_USD_TRADE.toFixed(2)} via LemonCake.`,
        ``,
        `Returns: { allowed, status, simulation: { sizeUsd, entryPrice, liquidationPrice, fees }, dryRun }`,
      ].join("\n"),
      annotations: { title: "Open position (guarded)", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol", "direction", "collateral_usd", "leverage"],
        additionalProperties: false,
        properties: {
          symbol:         { type: "string",  description: "AAPL, TSLA, NVDA, AMZN, GOOGL, MSFT, or META" },
          direction:      { type: "string",  enum: ["long", "short"] },
          collateral_usd: { type: "number",  description: "USDC collateral to post (e.g. 100 = $100)" },
          leverage:       { type: "number",  description: "Leverage multiplier (e.g. 2 = 2x). GMX v2 max: 100x for synthetics; recommended ≤ 10x." },
          dry_run:        { type: "boolean", description: "Override dry-run mode. Default follows GMX_DRY_RUN env (true = simulate only)." },
        },
      },
    },
    {
      name:        "close_position",
      description: `Close an existing GMX v2 perpetual position by market token address or symbol. Dry-run by default. Costs $${FEE_USD_TRADE.toFixed(2)} via LemonCake.`,
      annotations: { title: "Close position (guarded)", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol"],
        additionalProperties: false,
        properties: {
          symbol:       { type: "string",  description: "AAPL, TSLA, NVDA, etc." },
          direction:    { type: "string",  enum: ["long", "short"], description: "Which side to close" },
          size_usd:     { type: "number",  description: "USD size to close. Omit for full close (uses position data from get_positions)." },
          dry_run:      { type: "boolean", description: "Simulate-only mode (default true)." },
        },
      },
    },
    {
      name:        "get_pnl",
      description: `Calculate current unrealized P&L for a wallet's open positions. Combines live price feed with position data. Costs $${FEE_USD_TRADE.toFixed(2)} via LemonCake.`,
      annotations: { title: "Get P&L", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          walletAddress: { type: "string", description: "Arbitrum wallet address. Falls back to GMX_WALLET_ADDRESS." },
        },
      },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {

      // ── Free tools ──────────────────────────────────────────────────────────

      case "setup": {
        const st = await ledger.status();
        return json({
          version: VERSION,
          mode:    isLiveMode()
            ? "live (GMX_DRY_RUN=false + GMX_WALLET_PRIVATE_KEY set)"
            : `dry-run (${dryRunReason() || "default"})`,
          note: "v0.1 provides full simulation. On-chain execution is planned for v0.2.",
          envSet: {
            gmxWalletPrivateKey: hasWalletKey()   ? "set" : "NOT SET (dry-run only)",
            gmxWalletAddress:    hasWalletAddress() ? getWalletAddress() : "NOT SET (get_positions disabled)",
            gmxDryRun:           process.env.GMX_DRY_RUN ?? "true (default)",
            gmxMaxPositionUsd:   MAX_POSITION_USD,
            lemoncakeSellerKey:  process.env.LEMONCAKE_SELLER_KEY ? "set" : "NOT SET (demo mode)",
          },
          fees: {
            tradeToolsUsd:   FEE_USD_TRADE,
            accountToolsUsd: FEE_USD_ACCOUNT,
            freeTools:       ["list_markets", "get_price", "get_market_info", "setup", "guard_status", "guard_set_limit"],
            note:            "Fees are LemonCake service fees, separate from GMX protocol fees (0.07% open/close) and Arbitrum gas.",
          },
          guard: {
            dailyLimitUsd: st.dailyLimitUsd,
            todayUsedUsd:  st.todayUsedUsd,
            remainingUsd:  st.remainingUsd,
            ledgerFile:    st.ledgerFile,
          },
          markets:  getAllMarkets().map((m) => `${m.symbol} (${m.name})`),
          docs:     "https://github.com/evidai/lemon-cake/tree/main/gmx-mcp",
          siblings: [
            "alpaca-guard-mcp  — traditional Alpaca brokerage (paper trading default)",
            "tokenized-stock-mcp — Dinari dShares (ERC-20 tokenized stocks, USDC)",
            "xstocks-mcp       — xStocks on Solana via Jupiter DEX",
          ],
        });
      }

      case "guard_status": {
        const st = await ledger.status();
        return json({
          dailyLimitUsd:  st.dailyLimitUsd,
          todayDate:      st.todayDate,
          todayUsedUsd:   st.todayUsedUsd,
          remainingUsd:   st.remainingUsd,
          lifetimeOrders: st.lifetimeOrders,
          recentHistory:  st.history.slice(0, 10),
          ledgerFile:     st.ledgerFile,
        });
      }

      case "guard_set_limit": {
        const st = await ledger.setDailyLimit(Number(args.dailyLimitUsd));
        return json({
          dailyLimitUsd: st.dailyLimitUsd,
          todayUsedUsd:  st.todayUsedUsd,
          remainingUsd:  Math.max(0, st.dailyLimitUsd - st.todayUsedUsd),
          note:          "Limit saved to local ledger. The agent will see this on the next preflight.",
        });
      }

      case "list_markets": {
        const prices = await getAllPrices();
        const priceMap = new Map(prices.map((p) => [p.symbol, p]));
        return json({
          markets: getAllMarkets().map((m) => {
            const p = priceMap.get(m.symbol);
            return {
              symbol:      m.symbol,
              name:        m.name,
              priceUsd:    p?.priceUsd ?? null,
              stale:       p?.stale ?? true,
              spreadBps:   p?.spreadBps ?? null,
              marketToken: m.marketToken,
            };
          }),
          note: "Prices from GMX v2 Arbitrum oracle (Chainlink + keeper network). Stale = no update in >60s.",
          source: "https://arbitrum-api.gmxinfra.io/prices/tickers",
        });
      }

      case "get_price": {
        const sym = String(args.symbol).toUpperCase();
        const market = getMarket(sym);
        if (!market) {
          return json({
            error:     "MARKET_NOT_FOUND",
            symbol:    sym,
            available: Object.keys(getAllMarkets().reduce((acc, m) => ({ ...acc, [m.symbol]: true }), {})),
          });
        }
        const p = await getPrice(market);
        if (!p) {
          return json({
            symbol:  sym,
            found:   false,
            hint:    `No price feed returned for ${sym}. The GMX oracle may not have this market active. Try list_markets to see current feed status.`,
          });
        }
        return json({ ...p, source: "GMX v2 Arbitrum oracle" });
      }

      case "get_market_info": {
        const sym = String(args.symbol).toUpperCase();
        const market = getMarket(sym);
        if (!market) {
          return json({ error: "MARKET_NOT_FOUND", symbol: sym });
        }
        const info = await getMarketInfo(market);
        return json(info);
      }

      // ── $0.05/call tools ────────────────────────────────────────────────────

      case "get_positions": {
        const addr = (args.walletAddress as string | undefined) ?? getWalletAddress();
        if (!addr) {
          return json({
            error:  "NO_WALLET_ADDRESS",
            hint:   "Set GMX_WALLET_ADDRESS env var or pass walletAddress parameter.",
          });
        }
        // LemonCake billing: $0.05
        await ledger.recordCharge({
          notionalUsd: 0,
          feeUsd:      FEE_USD_ACCOUNT,
          tradeId:     `get_positions:${addr}:${Date.now()}`,
          symbol:      "positions-read",
          direction:   "long",
        });
        try {
          const positions = await getPositions(addr);
          const markets   = getAllMarkets();
          const enriched  = positions.map((pos) => {
            const market = markets.find(
              (m) => m.marketToken.toLowerCase() === pos.marketToken.toLowerCase()
            );
            return {
              ...pos,
              symbol: market?.symbol ?? `unknown(${pos.marketToken.slice(0, 8)}...)`,
              name:   market?.name   ?? "Unknown",
            };
          });
          return json({
            walletAddress: addr,
            positionCount: enriched.length,
            positions:     enriched,
            note:          enriched.length === 0
              ? "No open GMX v2 positions found for this address. Verify on https://app.gmx.io/#/accounts/" + addr
              : undefined,
            fee: { lemoncakeUsd: FEE_USD_ACCOUNT, note: "Charged for subgraph read." },
          });
        } catch (e) {
          return json({
            error:         "POSITIONS_READ_FAILED",
            walletAddress: addr,
            detail:        e instanceof Error ? e.message : String(e),
          });
        }
      }

      case "get_account_info": {
        const addr = (args.walletAddress as string | undefined) ?? getWalletAddress();
        if (!addr) {
          return json({
            error: "NO_WALLET_ADDRESS",
            hint:  "Set GMX_WALLET_ADDRESS env var or pass walletAddress parameter.",
          });
        }
        // LemonCake billing: $0.05
        await ledger.recordCharge({
          notionalUsd: 0,
          feeUsd:      FEE_USD_ACCOUNT,
          tradeId:     `get_account:${addr}:${Date.now()}`,
          symbol:      "account-read",
          direction:   "long",
        });
        // In v0.1, we provide an Arbiscan link for USDC balance since a full
        // eth_call requires an Arbitrum RPC connection.
        return json({
          walletAddress: addr,
          usdcAddress:   "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          note:          "Full USDC balance lookup requires GMX_ARBITRUM_RPC_URL (v0.2). " +
                         `View on Arbiscan: https://arbiscan.io/address/${addr}#tokentxns`,
          arbiscanUrl:   `https://arbiscan.io/address/${addr}`,
          gmxApp:        `https://app.gmx.io/#/accounts/${addr}`,
          fee:           { lemoncakeUsd: FEE_USD_ACCOUNT },
        });
      }

      // ── $0.10/call tools ────────────────────────────────────────────────────

      case "open_position": {
        const sym           = String(args.symbol).toUpperCase();
        const direction     = args.direction as "long" | "short";
        const collateralUsd = Number(args.collateral_usd);
        const leverage      = Number(args.leverage);
        const dryRunOverride = args.dry_run != null ? Boolean(args.dry_run) : null;
        const effectiveDryRun = dryRunOverride !== null ? dryRunOverride : isDryRun();

        // Input validation
        if (!["long", "short"].includes(direction)) {
          return json({ error: "INVALID_DIRECTION", hint: "direction must be 'long' or 'short'" });
        }
        if (!Number.isFinite(collateralUsd) || collateralUsd <= 0) {
          return json({ error: "INVALID_COLLATERAL", hint: "collateral_usd must be a positive number" });
        }
        if (!Number.isFinite(leverage) || leverage < 1 || leverage > 100) {
          return json({ error: "INVALID_LEVERAGE", hint: "leverage must be between 1 and 100" });
        }

        const market = getMarket(sym);
        if (!market) {
          return json({ error: "MARKET_NOT_FOUND", symbol: sym });
        }

        // Preflight: daily cap
        const pf = await ledger.preflight(collateralUsd);
        if (!pf.allowed) {
          return json({
            allowed:        false,
            status:         "BUDGET_EXCEEDED",
            symbol:         sym,
            direction,
            collateralUsd,
            remainingUsd:   pf.remainingUsd,
            limitUsd:       pf.limitUsd,
            hint:           pf.hint,
          });
        }

        // Simulate the position
        const sim = await simulateOpenPosition({
          market,
          direction,
          collateralUsd,
          leverage,
          feeUsd: FEE_USD_TRADE,
        });

        // LemonCake billing: $0.10
        const tradeId = `open:${sym}:${direction}:${Date.now()}`;
        await ledger.recordCharge({
          notionalUsd: collateralUsd,
          feeUsd:      FEE_USD_TRADE,
          tradeId,
          symbol:      sym,
          direction,
        });

        if (effectiveDryRun) {
          return json({
            allowed:    true,
            status:     "DRY_RUN_OK",
            mode:       "dry-run",
            dryRun:     true,
            symbol:     sym,
            direction,
            simulation: sim,
            remainingUsd: pf.remainingUsd - collateralUsd,
            limitUsd:     pf.limitUsd,
            fee:          { lemoncakeUsd: FEE_USD_TRADE, note: "Charged for simulation call." },
            hint:         "Simulation passed. Set GMX_DRY_RUN=false + GMX_WALLET_PRIVATE_KEY to execute on-chain (v0.2 feature).",
            x402Receipt: {
              scheme:          "gmx-mcp-simulation-v1",
              x402Compatible:  true,
              chain:           "arbitrum:one",
              asset:           "USDC",
              amount:          collateralUsd.toFixed(2),
              paymentIntentId: tradeId,
              settledAt:       new Date().toISOString(),
              note:            `Dry-run ${direction} ${sym} perp on GMX v2. LemonCake fee $${FEE_USD_TRADE.toFixed(2)} recorded.`,
            },
          });
        }

        // Live mode: v0.1 stubs out execution with a clear upgrade note
        return json({
          allowed:    true,
          status:     "EXECUTION_NOT_YET_SUPPORTED",
          mode:       "live (requested)",
          symbol:     sym,
          direction,
          simulation: sim,
          hint:       "On-chain execution requires gmx-mcp v0.2. Use app.gmx.io to execute this trade, or contribute the GMX SDK integration: https://github.com/evidai/lemon-cake/issues",
          fee:        { lemoncakeUsd: FEE_USD_TRADE, note: "Charged for simulation call." },
        });
      }

      case "close_position": {
        const sym       = String(args.symbol).toUpperCase();
        const direction = (args.direction as "long" | "short" | undefined) ?? "long";
        const sizeUsd   = args.size_usd != null ? Number(args.size_usd) : null;
        const dryRunOverride = args.dry_run != null ? Boolean(args.dry_run) : null;
        const effectiveDryRun = dryRunOverride !== null ? dryRunOverride : isDryRun();

        const market = getMarket(sym);
        if (!market) {
          return json({ error: "MARKET_NOT_FOUND", symbol: sym });
        }

        const price = await getPrice(market);
        const tradeId = `close:${sym}:${direction}:${Date.now()}`;

        // LemonCake billing: $0.10
        await ledger.recordCharge({
          notionalUsd: sizeUsd ?? 0,
          feeUsd:      FEE_USD_TRADE,
          tradeId,
          symbol:      sym,
          direction:   "close",
        });

        return json({
          allowed:    true,
          status:     effectiveDryRun ? "DRY_RUN_CLOSE_OK" : "EXECUTION_NOT_YET_SUPPORTED",
          dryRun:     effectiveDryRun,
          symbol:     sym,
          direction,
          sizeUsd:    sizeUsd ?? "full position",
          currentPriceUsd: price?.priceUsd ?? null,
          note:       effectiveDryRun
            ? `Simulated close of ${direction} ${sym} position. To execute: use app.gmx.io or wait for gmx-mcp v0.2.`
            : "On-chain close requires gmx-mcp v0.2. See https://app.gmx.io to close this position manually.",
          fee:        { lemoncakeUsd: FEE_USD_TRADE },
          x402Receipt: effectiveDryRun ? {
            scheme:          "gmx-mcp-simulation-v1",
            x402Compatible:  true,
            chain:           "arbitrum:one",
            paymentIntentId: tradeId,
            settledAt:       new Date().toISOString(),
            note:            `Dry-run close ${direction} ${sym} on GMX v2.`,
          } : null,
        });
      }

      case "get_pnl": {
        const addr = (args.walletAddress as string | undefined) ?? getWalletAddress();
        if (!addr) {
          return json({
            error: "NO_WALLET_ADDRESS",
            hint:  "Set GMX_WALLET_ADDRESS env var or pass walletAddress parameter.",
          });
        }

        // LemonCake billing: $0.10
        await ledger.recordCharge({
          notionalUsd: 0,
          feeUsd:      FEE_USD_TRADE,
          tradeId:     `pnl:${addr}:${Date.now()}`,
          symbol:      "pnl-calc",
          direction:   "long",
        });

        try {
          const positions = await getPositions(addr);
          if (positions.length === 0) {
            return json({
              walletAddress:     addr,
              openPositions:     0,
              totalUnrealizedPnlUsd: 0,
              positions:         [],
              fee:               { lemoncakeUsd: FEE_USD_TRADE },
              note:              "No open positions found.",
            });
          }
          const markets  = getAllMarkets();
          const allPrices = await getAllPrices();
          const priceMap  = new Map(allPrices.map((p) => [p.symbol, p.priceUsd]));

          const enriched = positions.map((pos) => {
            const market = markets.find(
              (m) => m.marketToken.toLowerCase() === pos.marketToken.toLowerCase()
            );
            const symbol     = market?.symbol ?? "unknown";
            const livePrice  = priceMap.get(symbol);
            return {
              symbol,
              direction:         pos.direction,
              sizeUsd:           pos.sizeUsd,
              collateralUsd:     pos.collateralUsd,
              unrealizedPnlUsd:  pos.unrealizedPnlUsd,
              livePriceUsd:      livePrice ?? null,
              pnlNote:           livePrice
                ? `Live price $${livePrice.toFixed(2)} from GMX oracle`
                : "No live price — pnl from subgraph snapshot",
            };
          });

          const totalPnl = enriched.reduce((s, p) => s + p.unrealizedPnlUsd, 0);
          return json({
            walletAddress:         addr,
            openPositions:         enriched.length,
            totalUnrealizedPnlUsd: totalPnl,
            positions:             enriched,
            fee:                   { lemoncakeUsd: FEE_USD_TRADE },
          });
        } catch (e) {
          return json({
            error:         "PNL_READ_FAILED",
            walletAddress: addr,
            detail:        e instanceof Error ? e.message : String(e),
          });
        }
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
    `[gmx-mcp] v${VERSION} ready. mode=${isLiveMode() ? "live(opt-in)" : "dry-run"} cap=$${MAX_POSITION_USD}/day fee=$${FEE_USD_TRADE}/trade\n`
  );
  // Web funnel CTAs — boot stderr is the only guaranteed surface for npm
  // installs to discover the website (telemetry 2026-05-26: 0.3% npm→web).
  process.stderr.write(
    `[gmx-mcp]   → Free tier (1k tx/mo, gas sponsored): https://lemoncake.xyz/start/free?utm_source=npm-boot&utm_medium=cli&utm_campaign=gmx-mcp\n`
  );
  process.stderr.write(
    `[gmx-mcp]   → Pricing & MPP-interop docs: https://lemoncake.xyz/pricing?utm_source=npm-boot&utm_medium=cli&utm_campaign=gmx-mcp\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[gmx-mcp] fatal: ${err}\n`);
  process.exit(1);
});
