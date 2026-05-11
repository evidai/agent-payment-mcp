#!/usr/bin/env node
/**
 * alpaca-guard-mcp — design + scaffolding phase (v0.0.1-design)
 *
 * MCP server that wraps Alpaca's MCP tools with a LemonCake Pay Token
 * spending guard. See README.md for architecture, motivation, and the
 * outreach status with the Alpaca team.
 *
 * This file is INTENTIONALLY a stub:
 *   - Tool list is final (won't change between design + impl phases).
 *   - Handlers all return the same "design phase, refusing on purpose"
 *     payload so the server is safe to install and inspect.
 *   - The actual Alpaca proxying + Pay Token charge will land once
 *     either (a) Alpaca team responds positively or (b) +5 day silence
 *     window expires (whichever comes first).
 */

import { Server }              from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createRequire } from "node:module";

import { guardOrder } from "./guard.js";
import { status as payTokenStatus } from "./payToken.js";

const requireFromHere = createRequire(import.meta.url);
const VERSION: string =
  (requireFromHere("../package.json") as { version: string }).version;

const DESIGN_NOTICE =
  "🛡️ alpaca-guard-mcp is in DESIGN PHASE (v0.0.1-design). All write tools refuse by default; " +
  "implementation lands after the Alpaca BD outreach (sent 2026-05-11) returns signal. " +
  "Read-only tools also stub-respond. Track at github.com/evidai/lemon-cake/tree/main/alpaca-guard-mcp.";

const server = new Server(
  { name: "alpaca-guard-mcp", version: VERSION },
  {
    capabilities: { tools: {}, logging: {} },
    instructions: DESIGN_NOTICE,
  },
);

// ── Tool list (frozen surface; safe to publish) ──────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name:        "setup",
      description: "Show alpaca-guard-mcp setup status: which env vars are set, current design-phase notice, and links to docs / outreach status.",
      annotations: { title: "Setup", readOnlyHint: true, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "get_pay_token_status",
      description: "Return the current LemonCake Pay Token state (configured? remaining USDC? daily used? KYA tier?). Read-only, never spends.",
      annotations: { title: "Pay Token status", readOnlyHint: true, idempotentHint: true, openWorldHint: true },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name:        "guarded_place_order",
      description: [
        "Place an order on Alpaca, but ONLY if the trade's notional USDC value fits within the",
        "current Pay Token's remaining cap. Refuses with a structured BUDGET_EXCEEDED response if not.",
        "There is no agent-side override — this is the whole point of the guard.",
        "",
        "PRECONDITIONS:",
        "  • LEMON_CAKE_PAY_TOKEN must be set (Pay Token JWT issued at lemoncake.xyz/dashboard/tokens).",
        "  • ALPACA_API_KEY + ALPACA_SECRET_KEY must be set (your own — we do not hold them).",
        "",
        "Returns: { allowed, status, tradeNotionalUsdc, remainingUsdc, dailyUsedUsdc, hint?, alpacaResponse? }",
      ].join("\n"),
      annotations: { title: "Place order (guarded)", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol", "qty", "side"],
        additionalProperties: false,
        properties: {
          symbol:     { type: "string",  description: "Ticker e.g. AAPL, BTC/USD" },
          qty:        { type: "number",  description: "Quantity (shares for stocks, units for crypto)" },
          side:       { type: "string",  enum: ["buy", "sell"] },
          type:       { type: "string",  enum: ["market", "limit"], default: "market" },
          limitPrice: { type: "number",  description: "Required if type=limit" },
          tif:        { type: "string",  enum: ["day", "gtc", "ioc", "fok"], default: "day" },
        },
      },
    },
    {
      name:        "guarded_close_position",
      description: "Close a position on Alpaca. Pre-flighted: if closing would re-open exposure (margin) that exceeds Pay Token cap, refuses.",
      annotations: { title: "Close position (guarded)", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["symbol"],
        additionalProperties: false,
        properties: {
          symbol:     { type: "string", description: "Ticker of the position to close" },
          qty:        { type: "number", description: "Optional — partial close. If omitted, closes the full position." },
        },
      },
    },
  ],
}));

// ── Tool handlers (all stub-refusing during design phase) ────────────────
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  switch (name) {
    case "setup":
      return json({
        version:        VERSION,
        phase:          "design",
        notice:         DESIGN_NOTICE,
        envSet: {
          alpacaApiKey:  !!process.env.ALPACA_API_KEY,
          alpacaSecret:  !!process.env.ALPACA_SECRET_KEY,
          alpacaPaper:   process.env.ALPACA_PAPER_TRADE !== "false",
          payToken:      !!process.env.LEMON_CAKE_PAY_TOKEN,
        },
        docs:           "https://github.com/evidai/lemon-cake/tree/main/alpaca-guard-mcp",
        outreachStatus: "Alpaca BD email sent 2026-05-11 (Claudiu @ Alpaca + LinkedIn DM to Satoshi Ido). +5d silence window expires 2026-05-16.",
      });

    case "get_pay_token_status":
      return json(await payTokenStatus());

    case "guarded_place_order": {
      const decision = await guardOrder({
        symbol:              String(args.symbol),
        qty:                 Number(args.qty),
        side:                args.side as "buy" | "sell",
        limitPrice:          args.limitPrice == null ? null : Number(args.limitPrice),
        // Stub price resolver: returns null so the guard refuses on PRICE_LOOKUP_FAILED.
        // Real impl will hit Alpaca's market-data API.
        resolveCurrentPrice: async () => null,
      });
      return json({
        ...decision,
        status:         decision.allowed ? "DESIGN_PHASE_REFUSED" : decision.reason,
        alpacaResponse: null,
        designNotice:   DESIGN_NOTICE,
      });
    }

    case "guarded_close_position":
      return json({
        allowed:      false,
        status:       "DESIGN_PHASE_REFUSED",
        designNotice: DESIGN_NOTICE,
      });

    default:
      return {
        content: [{ type: "text" as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
});

function json(obj: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }],
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr boot banner — matches pay-per-call-mcp pattern
  process.stderr.write(`[alpaca-guard-mcp] v${VERSION} (DESIGN PHASE) ready. ${DESIGN_NOTICE}\n`);
}

main().catch((err) => {
  process.stderr.write(`[alpaca-guard-mcp] fatal: ${err}\n`);
  process.exit(1);
});
