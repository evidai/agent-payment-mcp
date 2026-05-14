/**
 * @lemon-cake/mcp-sdk — Minimum viable example
 *
 * Run: npx tsx examples/basic.ts
 * (Set LEMONCAKE_SELLER_KEY to enable real billing; omit for Demo Mode)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createLemonCakeSDK } from "../src/index.js";

// ── Step 1: create SDK ─────────────────────────────────────────────────────
const lc = createLemonCakeSDK({
  sellerKey: process.env.LEMONCAKE_SELLER_KEY,
  serviceId: process.env.LEMONCAKE_SERVICE_ID,
});

console.error(`[example] Demo mode: ${lc.isDemo}`);

// ── Step 2: create MCP server ──────────────────────────────────────────────
const server = new Server(
  { name: "my-paid-mcp-server", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

// ── Step 3: define tool with billing ──────────────────────────────────────
// 3 lines: wrap your handler with lc.charge()
const searchHandler = lc.charge({ price: 0.05 })(async (params: { query: string }) => {
  // Your real tool logic here
  const result = `Search results for: "${params.query}"`;
  return {
    content: [{ type: "text" as const, text: result }],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "search",
      description: "Search for information ($0.05/call)",
      inputSchema: {
        type: "object",
        required: ["query"],
        properties: {
          query: { type: "string", description: "Search query" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "search") {
    return searchHandler(req.params.arguments ?? {}, req.params as never);
  }
  throw new Error(`Unknown tool: ${req.params.name}`);
});

// ── Step 4: start ──────────────────────────────────────────────────────────
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("[example] Server ready.");
