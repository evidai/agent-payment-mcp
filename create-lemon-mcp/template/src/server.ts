/**
 * paid-search-mcp — a remote (Streamable HTTP) MCP server with one paid tool.
 *
 * v0.1 is SANDBOX/DEMO:
 *   - `paid_search` returns mock results (no API key needed to run).
 *   - The LemonCake paid-call flow (mint → pay → cap) is shown by `npm run demo:agent`.
 *   - To meter THIS tool for real, register your endpoint in LemonCake /app for now.
 *     Env-only production billing for your own server lands in Phase 2.
 */
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { mockSearch } from "./mockSearch.js";

const PORT = Number(process.env.PORT || 3000);
const PRICE = Number(process.env.PRICE_PER_CALL || 0.05);

function buildServer(): McpServer {
  const server = new McpServer({ name: "paid-search-mcp", version: "0.1.0" });
  server.tool(
    "paid_search",
    `Search the web. Demo returns mock results. Priced at $${PRICE}/call via LemonCake.`,
    { query: z.string().describe("the search query") },
    async ({ query }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { query, results: mockSearch(query), _demo: "mock results; billing via the LemonCake gateway (sandbox)" },
            null,
            2,
          ),
        },
      ],
    }),
  );
  return server;
}

const app = express();
app.use(express.json());

// Stateless Streamable HTTP MCP endpoint.
app.post("/mcp", async (req, res) => {
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on("close", () => { void transport.close(); void server.close(); });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const y = (s: string) => `\x1b[93m\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

app.listen(PORT, () => {
  console.log("\n" + y("🍋 LemonCake Paid MCP — demo") + "\n");
  console.log(`  Mode:       ${y("sandbox")}`);
  console.log(`  Transport:  remote HTTP (Streamable)`);
  console.log(`  Tool:       paid_search`);
  console.log(`  Price:      $${PRICE.toFixed(2)} / call ${dim("(your price; demo doesn't charge real money)")}`);
  console.log(`  URL:        http://localhost:${PORT}/mcp\n`);
  console.log(`  Try:        ${dim("npm run demo:agent")}   ${dim("# 402 → mint → paid call → cap, against the LemonCake sandbox")}\n`);
  console.log(dim("  Production: register your endpoint in LemonCake /app for now."));
  console.log(dim("  Env-only production billing for your own server is coming in Phase 2.\n"));
});
