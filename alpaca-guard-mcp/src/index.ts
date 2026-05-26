#!/usr/bin/env node
/**
 * alpaca-guard-mcp v0.1
 *
 * MCP server that wraps the Alpaca trading API with a hard daily USD cap.
 * The cap lives in a local JSON file (~/.alpaca-guard/cap.json) so an
 * over-eager AI agent literally cannot blow past it across restarts.
 *
 * Paper trading is the default. Live trading is blocked unless the user
 * explicitly sets ALPACA_GUARD_ALLOW_LIVE=yes-i-understand.
 *
 * See README.md for architecture, motivation, and the LemonCake Pay Token
 * integration plan (gated on the upstream API).
 */

import { Server }              from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";

import {
  hasCredentials, paperMode, liveAllowed,
  getAccount, getPositions, getLatestQuote,
  placeOrder, closePosition,
} from "./alpaca.js";
import { guardOrder, recordOrderCharge, guardStatus, guardSetLimit } from "./guard.js";
import * as payToken from "./payToken.js";

const requireFromHere = createRequire(import.meta.url);
const VERSION: string =
  (requireFromHere("../package.json") as { version: string }).version;

const INSTRUCTIONS = [
  `alpaca-guard-mcp v${VERSION} — Alpaca trading wrapped in a hard daily USD cap.`,
  ``,
  `• ${paperMode() ? "🧪 PAPER TRADING (safe default)" : (liveAllowed() ? "🔴 LIVE TRADING ENABLED" : "⚠️ Live mode requested but ALPACA_GUARD_ALLOW_LIVE not set — orders will refuse")}`,
  `• Daily cap is enforced via ~/.alpaca-guard/cap.json. Use guard_status to inspect; guard_set_limit to change.`,
  `• ${payToken.note()}`,
  ``,
  `Call \`setup\` first to see env state. Read-only tools (get_account / get_positions / get_latest_quote) never spend.`,
].join("\n");

const server = new Server(
  { name: "alpaca-guard-mcp", version: VERSION },
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
      description: "Show alpaca-guard-mcp setup status: env vars, paper/live mode, current daily cap, and ledger file location. Read-only.",
      annotations: { title: "Setup", readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "guard_status",
      description: "Return today's spend ledger: daily limit, used so far, remaining, lifetime order count, and recent 10 orders. Read-only.",
      annotations: { title: "Guard status", readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "guard_set_limit",
      description: "Set the daily USD cap. The agent cannot raise its own cap silently — calling this tool is logged in the ledger. Typical use: human operator runs this once to set the daily limit (default $10) before letting the agent loose.",
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
      name:        "get_account",
      description: "Alpaca account snapshot (buying power, cash, equity, portfolio value, PDT flag). Read-only.",
      annotations: { title: "Account", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "get_positions",
      description: "Current open positions on Alpaca (symbol, qty, avg entry price, current price, unrealized P&L). Read-only.",
      annotations: { title: "Positions", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "get_latest_quote",
      description: "Latest bid/ask/mid quote for a given symbol from Alpaca's market-data API. Read-only.",
      annotations: { title: "Latest quote", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol"],
        additionalProperties: false,
        properties: { symbol: { type: "string", description: "e.g. AAPL, TSLA" } },
      },
    },
    {
      name:        "guarded_place_order",
      description: [
        "Place an order on Alpaca, but ONLY if the trade's notional USD value fits within today's remaining cap.",
        "Pre-flight is mandatory: agent cannot override. If notional > remaining, returns BUDGET_EXCEEDED with a structured hint.",
        "On success the charge is recorded to the local ledger so the cap survives MCP restarts.",
        "",
        "Returns: { allowed, status, tradeNotionalUsd, remainingUsd, limitUsd, alpacaOrder?, x402Receipt? }",
      ].join("\n"),
      annotations: { title: "Place order (guarded)", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol", "qty", "side"],
        additionalProperties: false,
        properties: {
          symbol:     { type: "string",  description: "Ticker e.g. AAPL" },
          qty:        { type: "number",  description: "Quantity in shares" },
          side:       { type: "string",  enum: ["buy", "sell"] },
          type:       { type: "string",  enum: ["market", "limit"], default: "market" },
          limitPrice: { type: "number",  description: "Required if type=limit" },
          tif:        { type: "string",  enum: ["day", "gtc", "ioc", "fok"], default: "day" },
        },
      },
    },
    {
      name:        "guarded_close_position",
      description: "Close a position on Alpaca. Pre-flighted against the daily cap: if closing requires re-opening exposure (short close → re-buy) that exceeds the cap, refuses.",
      annotations: { title: "Close position (guarded)", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol"],
        additionalProperties: false,
        properties: {
          symbol: { type: "string", description: "Ticker of the position to close" },
          qty:    { type: "number", description: "Optional — partial close. If omitted, closes the full position." },
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
        return json({
          version: VERSION,
          mode:    paperMode() ? "paper" : (liveAllowed() ? "live (explicit opt-in)" : "live (BLOCKED — set ALPACA_GUARD_ALLOW_LIVE=yes-i-understand to enable)"),
          envSet: {
            alpacaApiKey:    hasCredentials() ? "✓" : "✗ NOT SET — get a free paper key at https://app.alpaca.markets/paper/dashboard/overview",
            alpacaSecretKey: process.env.ALPACA_SECRET_KEY ? "✓" : "✗ NOT SET",
            alpacaPaperTrade: paperMode() ? "true (safe default)" : "false (live mode requested)",
            allowLive:       liveAllowed(),
            payTokenNote:    payToken.note(),
          },
          guard: {
            dailyLimitUsd: st.dailyLimitUsd,
            todayUsedUsd:  st.todayUsedUsd,
            remainingUsd:  st.remainingUsd,
            ledgerFile:    st.ledgerFile,
          },
          docs: "https://github.com/evidai/lemon-cake/tree/main/alpaca-guard-mcp",
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
          note:          "Limit applied to local ledger. The agent will see this on the next preflight.",
        });
      }

      case "get_account":
        if (!hasCredentials()) return credentialError();
        return json(await getAccount());

      case "get_positions":
        if (!hasCredentials()) return credentialError();
        return json(await getPositions());

      case "get_latest_quote":
        if (!hasCredentials()) return credentialError();
        return json(await getLatestQuote(String(args.symbol)));

      case "guarded_place_order": {
        // Preflight FIRST so the agent sees BUDGET_EXCEEDED even before Alpaca
        // creds are set up — useful for testing the guard end-to-end with
        // limit_price (no quote fetch needed).
        const decision = await guardOrder({
          symbol:     String(args.symbol),
          qty:        Number(args.qty),
          side:       args.side as "buy" | "sell",
          limitPrice: args.limitPrice == null ? null : Number(args.limitPrice),
        });
        if (!decision.allowed) {
          return json({
            allowed:          false,
            status:           decision.reason,
            tradeNotionalUsd: decision.tradeNotionalUsd,
            remainingUsd:     decision.remainingUsd,
            limitUsd:         decision.limitUsd,
            hint:             decision.hint,
            alpacaOrder:      null,
            x402Receipt:      null,
          });
        }

        // Preflight passed; now we actually need Alpaca creds to place the order.
        if (!hasCredentials()) return credentialError();

        const order = await placeOrder({
          symbol:     String(args.symbol),
          qty:        Number(args.qty),
          side:       args.side as "buy" | "sell",
          type:       (args.type as "market" | "limit") ?? "market",
          limitPrice: args.limitPrice == null ? undefined : Number(args.limitPrice),
          tif:        (args.tif as "day" | "gtc" | "ioc" | "fok") ?? "day",
        });

        await recordOrderCharge({
          notionalUsd: decision.tradeNotionalUsd,
          orderId:     order.id,
          symbol:      order.symbol,
          side:        order.side,
        });

        return json({
          allowed:          true,
          status:           "PLACED",
          tradeNotionalUsd: decision.tradeNotionalUsd,
          priceSource:      decision.priceSource,
          effectivePriceUsd: decision.effectivePriceUsd,
          remainingUsd:     Math.max(0, decision.remainingUsd - decision.tradeNotionalUsd),
          limitUsd:         decision.limitUsd,
          alpacaOrder:      order,
          x402Receipt: {
            scheme:           "alpaca-guard-local-ledger-v1",
            x402Compatible:   true,
            chain:            "off-chain (alpaca-guard local ledger)",
            asset:            "USD",
            amount:           decision.tradeNotionalUsd.toFixed(2),
            recipient:        `alpaca:${order.symbol}`,
            paymentIntentId:  order.id,
            settledAt:        new Date().toISOString(),
            note:             "Alpaca paper-trade (or live) order, charged against the local daily cap. Same shape as agent-payment-mcp's receipt.",
          },
        });
      }

      case "guarded_close_position": {
        if (!hasCredentials()) return credentialError();
        // Closing reduces exposure, but on a short the broker buys to cover — we
        // pre-flight against current notional in either direction to be safe.
        const symbol = String(args.symbol);
        const qtyArg = args.qty == null ? null : Number(args.qty);

        const q = await getLatestQuote(symbol).catch(() => null);
        if (!q || !q.mid) {
          return json({
            allowed:          false,
            status:           "PRICE_LOOKUP_FAILED",
            tradeNotionalUsd: 0,
            hint:             `No quote for ${symbol}; refusing to close blind.`,
          });
        }
        const qty = qtyArg ?? 0;  // qty=null = full close; can't preflight without position size
        const notional = Math.abs(q.mid * (qty || 1));

        const decision = await guardOrder({
          symbol,
          qty:        qty || 1,
          side:       "sell",
          limitPrice: q.mid,
        });
        if (!decision.allowed) {
          return json({
            allowed:          false,
            status:           decision.reason,
            tradeNotionalUsd: notional,
            remainingUsd:     decision.remainingUsd,
            limitUsd:         decision.limitUsd,
            hint:             decision.hint,
            alpacaResponse:   null,
          });
        }

        const result = await closePosition(symbol, qtyArg == null ? undefined : qtyArg);
        await recordOrderCharge({
          notionalUsd: decision.tradeNotionalUsd,
          orderId:     `close:${symbol}:${Date.now()}`,
          symbol,
          side:        "sell",
        });
        return json({
          allowed:          true,
          status:           "CLOSED",
          tradeNotionalUsd: decision.tradeNotionalUsd,
          remainingUsd:     Math.max(0, decision.remainingUsd - decision.tradeNotionalUsd),
          alpacaResponse:   result,
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

function credentialError() {
  return json({
    error:  "ALPACA_API_KEY / ALPACA_SECRET_KEY not set",
    howTo: [
      "1. Visit https://app.alpaca.markets/paper/dashboard/overview",
      "2. Create a free paper trading account",
      "3. Generate API keys from the dashboard",
      "4. Add ALPACA_API_KEY and ALPACA_SECRET_KEY to your MCP client config",
    ],
  });
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(
    `[alpaca-guard-mcp] v${VERSION} ready. mode=${paperMode() ? "paper" : (liveAllowed() ? "live(opt-in)" : "live(BLOCKED)")} creds=${hasCredentials() ? "set" : "MISSING"}\n`
  );
  // Web funnel CTAs — boot stderr is the most reliable npm→web bridge.
  process.stderr.write(
    `[alpaca-guard-mcp]   → Free tier (1k tx/mo, gas sponsored): https://lemoncake.xyz/start/free?utm_source=npm-boot&utm_medium=cli&utm_campaign=alpaca-guard-mcp\n`
  );
  process.stderr.write(
    `[alpaca-guard-mcp]   → Pricing & MPP interop: https://lemoncake.xyz/pricing?utm_source=npm-boot&utm_medium=cli&utm_campaign=alpaca-guard-mcp\n`
  );
}

main().catch((err) => {
  process.stderr.write(`[alpaca-guard-mcp] fatal: ${err}\n`);
  process.exit(1);
});
