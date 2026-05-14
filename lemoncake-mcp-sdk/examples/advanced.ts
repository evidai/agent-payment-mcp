/**
 * @lemon-cake/mcp-sdk — Advanced example: all features
 *
 * Demonstrates:
 *   - Per-tool pricing
 *   - Free tier (first N calls free)
 *   - Rate limiting
 *   - Global middleware for all tools
 *   - Earnings query
 *   - Demo Mode (automatic when LEMONCAKE_SELLER_KEY is absent)
 *
 * Run: npx tsx examples/advanced.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createLemonCakeSDK } from "../src/index.js";
import type { MCPToolContext } from "../src/index.js";

// ── 1. Initialize SDK ──────────────────────────────────────────────────────
const lc = createLemonCakeSDK({
  sellerKey: process.env.LEMONCAKE_SELLER_KEY,  // omit → Demo Mode
  serviceId: process.env.LEMONCAKE_SERVICE_ID,
  apiUrl:    process.env.LEMONCAKE_API_URL,     // override for staging
});

if (lc.isDemo) {
  console.error("[advanced] Running in DEMO MODE — no real charges.");
} else {
  console.error("[advanced] LIVE MODE — real USDC charges enabled.");
}

// ── 2. Create MCP server ───────────────────────────────────────────────────
const server = new Server(
  { name: "advanced-paid-server", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── 3. Per-tool charge wrappers ────────────────────────────────────────────

// Basic tool: $0.05/call
const searchPatents = lc.charge({ price: 0.05, toolName: "search_patents" })(
  async (params: { query: string; limit?: number }) => {
    const results = [
      { id: "US11234567", title: `Patent matching: ${params.query}` },
    ];
    return {
      content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
    };
  }
);

// Tool with 10 free calls, then $0.01/call, max 30 calls/min
const getData = lc.charge({ price: 0.01, freeCalls: 10, rateLimit: 30, toolName: "get_data" })(
  async (params: { id: string }) => {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ id: params.id, data: "..." }) }],
    };
  }
);

// Premium tool: $0.50/call, rate limited to 5/min
const analyzeDocument = lc.charge({
  price: 0.50,
  rateLimit: 5,
  toolName: "analyze_document",
  x402Headers: true,
})(async (params: { url: string }) => {
  return {
    content: [{ type: "text" as const, text: `Analysis of ${params.url}: ...` }],
  };
});

// ── 4. Global middleware (alternative pattern) ─────────────────────────────
// Instead of wrapping each handler, you can use middleware to intercept all tools.
const mw = lc.middleware({
  defaultPrice: 0.01,
  perTool: {
    expensive_query: 0.25,
    cheap_ping: 0.001,
  },
  freeCalls: 5, // first 5 calls per token are free for all tools
  rateLimit: 60, // max 60 calls/min per token globally
});

// Handler that will be wrapped by middleware
async function expensiveQueryHandler(params: { query: string }) {
  return {
    content: [{ type: "text" as const, text: `Expensive result for: ${params.query}` }],
  };
}

// ── 5. Tool registry ──────────────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search_patents",
      description: "Search patent database — $0.05/call",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
          limit: { type: "number", default: 10 },
        },
      },
    },
    {
      name: "get_data",
      description: "Get data by ID — first 10 calls free, then $0.01/call",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
        },
      },
    },
    {
      name: "analyze_document",
      description: "Deep document analysis — $0.50/call, max 5/min",
      inputSchema: {
        type: "object",
        required: ["url"],
        properties: {
          url: { type: "string", format: "uri" },
        },
      },
    },
    {
      name: "expensive_query",
      description: "Expensive query (via middleware) — $0.25/call",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  const ctx = req.params as unknown as MCPToolContext;

  switch (name) {
    case "search_patents":
      return searchPatents(args, ctx);

    case "get_data":
      return getData(args, ctx);

    case "analyze_document":
      return analyzeDocument(args, ctx);

    case "expensive_query":
      // Using middleware pattern instead of per-tool charge wrapper
      return mw.intercept("expensive_query", expensiveQueryHandler, args, ctx);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// ── 6. Earnings check (on startup) ────────────────────────────────────────
async function logEarnings() {
  try {
    const earnings = await lc.getEarnings();
    console.error(
      `[advanced] Earnings — total: $${earnings.totalEarned} USDC | ` +
        `today: $${earnings.todayEarned} USDC | calls: ${earnings.callCount}`
    );
  } catch (err) {
    console.error("[advanced] Could not fetch earnings:", err);
  }
}

// ── 7. Start ───────────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
await logEarnings();
console.error("[advanced] Server ready.");
