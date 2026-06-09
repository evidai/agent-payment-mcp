/**
 * paid-search-mcp — a remote (Streamable HTTP) MCP server with one paid tool.
 *
 * demo → prod is ONE env var, no code change:
 *   • LEMONCAKE_SELLER_KEY unset  → sandbox: the tool runs, nothing is charged
 *     (and `npm run demo:agent` shows the live 402 → mint → pay → cap flow).
 *   • LEMONCAKE_SELLER_KEY set    → production: `lc.charge()` meters every call
 *     against the buyer's prepaid Pay Token via the LemonCake fiat gateway.
 *
 * The SDK (@lemon-cake/mcp-sdk) auto-detects the mode from the env var, so the
 * same server file works in both. Buyers pay by card; no crypto.
 */
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";
import { mockSearch } from "./mockSearch.js";

const PORT = Number(process.env.PORT || 3000);
const PRICE = Number(process.env.PRICE_PER_CALL || 0.05);

// Reads LEMONCAKE_SELLER_KEY from env. Present → real billing; absent → demo.
const lc = createLemonCakeSDK();

function buildServer(): McpServer {
  const server = new McpServer({ name: "paid-search-mcp", version: "0.2.0" });
  server.tool(
    "paid_search",
    `Search the web. Priced at $${PRICE}/call via LemonCake.`,
    { query: z.string().describe("the search query") },
    // lc.charge wraps the handler: preflight (reserve) → run → settle (confirm
    // on success, refund on failure). In sandbox mode it just logs + runs.
    // The buyer's Pay Token is read from the MCP request _meta.payToken.
    lc.charge({ price: PRICE, toolName: "paid_search" })(async ({ query }: { query: string }) => ({
      content: [
        {
          type: "text",
          text: JSON.stringify({ query, results: mockSearch(query) }, null, 2),
        },
      ],
    })),
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
const green = (s: string) => `\x1b[32m\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;

app.listen(PORT, () => {
  const prod = !lc.isDemo;
  console.log("\n" + y("🍋 LemonCake Paid MCP") + "\n");
  console.log(`  Mode:       ${prod ? green("production") : y("sandbox")}`);
  console.log(`  Transport:  remote HTTP (Streamable)`);
  console.log(`  Tool:       paid_search`);
  console.log(`  Price:      $${PRICE.toFixed(2)} / call`);
  console.log(`  URL:        http://localhost:${PORT}/mcp\n`);
  if (prod) {
    console.log(`  Billing:    ${green("LIVE")} — each call charges the buyer's Pay Token via ${dim(lc.apiUrl + "/api/sdk")}`);
    console.log(dim(`  Seller key: set ✓   (buyers prepay by card; you keep 97%)\n`));
  } else {
    console.log(dim(`  Billing:    none — set LEMONCAKE_SELLER_KEY to charge for real (no code change).`));
    console.log(`  Try:        ${dim("npm run demo:agent")}   ${dim("# 402 → mint → paid call → cap, against the LemonCake sandbox")}\n`);
    console.log(dim("  Go live:    create an endpoint + Seller Key in LemonCake /app, then set LEMONCAKE_SELLER_KEY.\n"));
  }
});
