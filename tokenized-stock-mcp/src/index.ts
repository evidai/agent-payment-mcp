#!/usr/bin/env node
/**
 * tokenized-stock-mcp v0.1
 *
 * MCP server to buy/sell tokenized US stocks (Dinari dShares) paying in
 * USDC, with a hard daily USD cap baked in.
 *
 * - Pay Token pass-through model: the user funds the trade from their own
 *   wallet via the Dinari order flow; LemonCake does not custody USDC.
 * - LemonCake fee: flat $0.10 per trade (configurable via
 *   LEMONCAKE_STOCK_FEE_USD).
 * - Sandbox is the safe default. Live requires explicit
 *   TOKENIZED_STOCK_ALLOW_LIVE=yes-i-understand.
 *
 * See README.md for architecture + feasibility research at
 * docs/research/2026-05-11-tokenized-stocks-feasibility.md.
 */

import { Server }              from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";

import {
  hasCredentials, sandboxMode, liveAllowed, sandboxNote, credentialStatus,
  listSupportedStocks, getQuote, placeBuyOrder, placeSellOrder,
} from "./dinari.js";
import {
  guardBuy, guardSell, recordTradeCharge,
  status as guardStatus, setDailyLimit as guardSetLimit,
} from "./guard.js";
import { FEE_USD } from "./margin.js";

const requireFromHere = createRequire(import.meta.url);
const VERSION: string =
  (requireFromHere("../package.json") as { version: string }).version;

const INSTRUCTIONS = [
  `tokenized-stock-mcp v${VERSION} — tokenized US stocks (Dinari dShares) paid in USDC, with a daily USD cap.`,
  ``,
  `• ${sandboxNote()}`,
  `• Daily cap is enforced via ~/.tokenized-stock/cap.json. Use guard_status to inspect; guard_set_limit to change.`,
  `• LemonCake fee: $${FEE_USD.toFixed(2)} per trade (flat).`,
  `• Pay Token pass-through model: user wallet funds the trade directly; LemonCake never holds the USDC.`,
  ``,
  `Call \`setup\` first to see env state. Read-only tools (list_supported_stocks / get_quote / guard_status / get_orders) never spend.`,
].join("\n");

const server = new Server(
  { name: "tokenized-stock-mcp", version: VERSION },
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
      description: "Show tokenized-stock-mcp setup status: env vars, sandbox/live mode, current daily cap, LemonCake fee, and ledger location. Read-only.",
      annotations: { title: "Setup", readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "guard_status",
      description: "Return today's cap ledger: daily limit, used so far, remaining, lifetime trades, and last 10 trades. Read-only.",
      annotations: { title: "Guard status", readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "guard_set_limit",
      description: "Set the daily USD cap. The agent cannot override its own cap silently — calling this tool is logged. Operator typically sets this once before letting the agent trade.",
      annotations: { title: "Set daily cap", readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: {
        type: "object",
        required: ["dailyLimitUsd"],
        additionalProperties: false,
        properties: {
          dailyLimitUsd: { type: "number", description: "Non-negative USD value. Set 0 to disable trading entirely." },
        },
      },
    },
    {
      name:        "list_supported_stocks",
      description: "List tokenized US stocks tradable via Dinari. Without DINARI_API_KEY, returns a representative subset (10 high-confidence tickers) so the tool is useful for inspection. With credentials, fetches live from Dinari.",
      annotations: { title: "List supported stocks", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "get_quote",
      description: "Latest bid/ask/mid for a Dinari dShare symbol (e.g. AAPL.d). Requires DINARI_API_KEY for real quotes; returns null with hint otherwise.",
      annotations: { title: "Get quote", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol"],
        additionalProperties: false,
        properties: { symbol: { type: "string", description: "e.g. AAPL.d, MSFT.d, SPY.d" } },
      },
    },
    {
      name:        "guarded_buy_stock",
      description: [
        "Buy a tokenized US stock for a specified USD amount, paid in USDC via Dinari.",
        "Preflighted against today's daily cap — refuses with BUDGET_EXCEEDED if over.",
        "The user's wallet receives the dShare token; LemonCake never holds the USDC.",
        "",
        "Returns: { allowed, status, notionalUsd, fee, dinariOrder?, x402Receipt? }",
      ].join("\n"),
      annotations: { title: "Buy tokenized stock (guarded)", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol", "amountUsd", "recipientWallet"],
        additionalProperties: false,
        properties: {
          symbol:         { type: "string", description: "Dinari dShare symbol e.g. AAPL.d" },
          amountUsd:      { type: "number", description: "USD amount to spend (fractional shares auto-derived)" },
          recipientWallet: { type: "string", description: "Wallet address that will receive the dShare tokens" },
        },
      },
    },
    {
      name:        "guarded_sell_stock",
      description: "Sell a quantity of dShare tokens for USDC. Preflighted on notional against the daily cap.",
      annotations: { title: "Sell tokenized stock (guarded)", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol", "qty", "sourceWallet"],
        additionalProperties: false,
        properties: {
          symbol:       { type: "string", description: "Dinari dShare symbol e.g. AAPL.d" },
          qty:          { type: "number", description: "Quantity of dShare tokens to sell (supports fractional)" },
          sourceWallet: { type: "string", description: "Wallet address that holds the dShare tokens" },
        },
      },
    },
  ],
}));

// ─── Tool handlers ────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case "setup": {
        const st = await guardStatus();
        const creds = credentialStatus();
        return json({
          version: VERSION,
          mode:    sandboxMode() ? "sandbox" : (liveAllowed() ? "live (explicit opt-in)" : "live (BLOCKED — set TOKENIZED_STOCK_ALLOW_LIVE=yes-i-understand)"),
          envSet: {
            dinariApiKeyID:     creds.apiKeyID,
            dinariApiSecretKey: creds.apiSecretKey,
            dinariAccountId:    creds.accountId,
            dinariEntityId:     creds.entityId,
            allCredsReady:      creds.allReady,
            dinariSandbox:      sandboxMode() ? "true (safe default)" : "false (live mode requested)",
            allowLive:          liveAllowed(),
          },
          fee: {
            lemoncakePerTradeUsd: FEE_USD,
            policyNote:           "Flat $" + FEE_USD.toFixed(2) + " per trade. Configurable via LEMONCAKE_STOCK_FEE_USD env var.",
            dinariFeeNote:        "Dinari charges $1+0.50% on Ethereum or $0.20+0.50% on L2 (USDC). User pays both Dinari fee + LemonCake fee.",
          },
          guard: {
            dailyLimitUsd: st.dailyLimitUsd,
            todayUsedUsd:  st.todayUsedUsd,
            remainingUsd:  st.remainingUsd,
            ledgerFile:    st.ledgerFile,
          },
          docs:    "https://github.com/evidai/lemon-cake/tree/main/tokenized-stock-mcp",
          siblings: ["pay-per-call-mcp (USDC for any HTTP API)", "alpaca-guard-mcp (traditional broker guard)"],
        });
      }

      case "guard_status": {
        const st = await guardStatus();
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
        const limit = Number(args.dailyLimitUsd);
        const st = await guardSetLimit(limit);
        return json({
          dailyLimitUsd: st.dailyLimitUsd,
          todayUsedUsd:  st.todayUsedUsd,
          remainingUsd:  Math.max(0, st.dailyLimitUsd - st.todayUsedUsd),
          note:          "Limit applied to local ledger.",
        });
      }

      case "list_supported_stocks":
        return json({
          source:  hasCredentials() ? "dinari-live" : "sample-subset (set DINARI_API_KEY for full list)",
          tickers: await listSupportedStocks(),
        });

      case "get_quote": {
        const q = await getQuote(String(args.symbol));
        if (!q) {
          return json({
            symbol: String(args.symbol),
            quote:  null,
            hint:   "Quote unavailable. Either DINARI_API_KEY is not set or the symbol is not tradable. Try list_supported_stocks first.",
          });
        }
        return json({ symbol: q.symbol, quote: q });
      }

      case "guarded_buy_stock": {
        const symbol         = String(args.symbol);
        const amountUsd      = Number(args.amountUsd);
        const recipientWallet = String(args.recipientWallet);

        const decision = await guardBuy({ symbol, amountUsd, dinariFeeEstimateUsd: null });
        if (!decision.allowed) {
          return json({
            allowed:        false,
            status:         decision.reason,
            symbol,
            notionalUsd:    decision.notionalUsd,
            remainingUsd:   decision.remainingUsd,
            limitUsd:       decision.limitUsd,
            hint:           decision.hint,
            dinariOrder:    null,
            x402Receipt:    null,
          });
        }

        // Preflight passed. Now we need creds + a real Dinari order.
        if (!hasCredentials()) {
          return json({
            allowed:     false,
            status:      "NO_CREDENTIALS",
            symbol,
            notionalUsd: decision.notionalUsd,
            fee:         decision.fee,
            hint:        "Guard would have allowed this trade. DINARI_API_KEY is required to actually place the order. Apply at https://partners.dinari.com.",
          });
        }

        const order = await placeBuyOrder({ symbol, amountUsd, recipientWallet });
        await recordTradeCharge({
          notionalUsd: decision.notionalUsd,
          feeUsd:      FEE_USD,
          orderId:     order.id,
          symbol,
          side:        "buy",
        });

        return json({
          allowed:       true,
          status:        order.status,
          symbol,
          notionalUsd:   decision.notionalUsd,
          fee:           decision.fee,
          remainingUsd:  Math.max(0, decision.remainingUsd - decision.notionalUsd),
          limitUsd:      decision.limitUsd,
          dinariOrder:   order,
          x402Receipt: {
            scheme:           "tokenized-stock-local-ledger-v1",
            x402Compatible:   true,
            chain:            "off-chain (LemonCake daily cap) + Dinari on-chain settlement",
            asset:            "USDC",
            amount:           decision.fee.totalUserPaysUsd.toFixed(2),
            recipient:        `dinari:${symbol}`,
            paymentIntentId:  order.id,
            settledAt:        new Date().toISOString(),
            note:             "Tokenized stock purchase via Dinari. LemonCake fee $" + FEE_USD.toFixed(2) + " per trade.",
          },
        });
      }

      case "guarded_sell_stock": {
        const symbol       = String(args.symbol);
        const qty          = Number(args.qty);
        const sourceWallet = String(args.sourceWallet);

        const decision = await guardSell({ symbol, qty });
        if (!decision.allowed) {
          return json({
            allowed:       false,
            status:        decision.reason,
            symbol,
            notionalUsd:   decision.notionalUsd,
            remainingUsd:  decision.remainingUsd,
            limitUsd:      decision.limitUsd,
            hint:          decision.hint,
            dinariOrder:   null,
            x402Receipt:   null,
          });
        }
        if (!hasCredentials()) {
          return json({
            allowed:     false,
            status:      "NO_CREDENTIALS",
            symbol,
            notionalUsd: decision.notionalUsd,
            fee:         decision.fee,
            hint:        "Guard would have allowed this trade. DINARI_API_KEY required to place the order.",
          });
        }

        const order = await placeSellOrder({ symbol, qty, sourceWallet });
        await recordTradeCharge({
          notionalUsd: decision.notionalUsd,
          feeUsd:      FEE_USD,
          orderId:     order.id,
          symbol,
          side:        "sell",
        });
        return json({
          allowed:       true,
          status:        order.status,
          symbol,
          notionalUsd:   decision.notionalUsd,
          fee:           decision.fee,
          remainingUsd:  Math.max(0, decision.remainingUsd - decision.notionalUsd),
          limitUsd:      decision.limitUsd,
          dinariOrder:   order,
          x402Receipt: {
            scheme:           "tokenized-stock-local-ledger-v1",
            x402Compatible:   true,
            chain:            "off-chain (LemonCake daily cap) + Dinari on-chain settlement",
            asset:            "USDC",
            amount:           decision.fee.totalUserPaysUsd.toFixed(2),
            recipient:        `dinari:${symbol}`,
            paymentIntentId:  order.id,
            settledAt:        new Date().toISOString(),
            note:             "Tokenized stock sale via Dinari. LemonCake fee $" + FEE_USD.toFixed(2) + " per trade.",
          },
        });
      }

      default:
        return {
          content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      content: [{ type: "text" as const, text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

function json(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[tokenized-stock-mcp] v${VERSION} ready. mode=${sandboxMode() ? "sandbox" : (liveAllowed() ? "live(opt-in)" : "live(BLOCKED)")} creds=${hasCredentials() ? "set" : "MISSING"} fee=$${FEE_USD.toFixed(2)}/trade\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[tokenized-stock-mcp] fatal: ${err}\n`);
  process.exit(1);
});
