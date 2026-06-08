/**
 * mcp-monetization-starter
 *
 * Minimum-viable MCP server with usage billing via LemonCake.
 *
 * Run with no env vars → demo mode (charges logged to console, no real money).
 * Set LEMONCAKE_SELLER_KEY → live mode (card-funded Pay Tokens).
 *
 * Boot:
 *   npm install && npm start
 *
 * Wire into Claude Desktop / Cursor / Cline (~/.claude/claude_desktop_config.json):
 *   {
 *     "mcpServers": {
 *       "monetized-starter": {
 *         "command": "tsx",
 *         "args":    ["/abs/path/to/examples/mcp-monetization-starter/src/index.ts"]
 *       }
 *     }
 *   }
 */

import { Server }              from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createLemonCakeSDK }   from "@lemon-cake/mcp-sdk";

// 1) Create the LemonCake SDK. Demo mode if no LEMONCAKE_SELLER_KEY is set.
const lc = createLemonCakeSDK();

// 2) Define your paid tools. The `price` is USD per call.
const tools = {
  search: {
    schema: {
      name:        "search",
      description: "Search a (fake) knowledge base. Costs $0.02 per call.",
      inputSchema: {
        type:       "object",
        properties: { query: { type: "string", description: "Query text" } },
        required:   ["query"],
      },
    },
    price:   0.02,
    handler: async ({ query }: { query: string }) => ({
      content: [{ type: "text", text: `Pretending to search for: ${query}` }],
    }),
  },
  summarize: {
    schema: {
      name:        "summarize",
      description: "Summarize text. Costs $0.05 per call.",
      inputSchema: {
        type:       "object",
        properties: { text: { type: "string", description: "Text to summarize" } },
        required:   ["text"],
      },
    },
    price:   0.05,
    handler: async ({ text }: { text: string }) => ({
      content: [{ type: "text", text: `Summary of ${text.length} chars: …` }],
    }),
  },
} as const;

// 3) Wire up the MCP server with LemonCake charging in front of each tool.
const server = new Server(
  { name: "mcp-monetization-starter", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: Object.values(tools).map((t) => t.schema),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const tool = tools[name as keyof typeof tools];
  if (!tool) {
    return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
  }

  // The charge wrapper: pre-flights with the LemonCake API, blocks if budget
  // is exhausted, otherwise records the charge and runs the handler.
  const wrapped = lc.charge({ price: tool.price })(tool.handler as any);
  return await wrapped(req.params.arguments ?? {});
});

await server.connect(new StdioServerTransport());

process.stderr.write(
  `[mcp-monetization-starter] ready — ${Object.keys(tools).length} paid tools registered\n` +
  `  • https://lemoncake.xyz/start/free?utm_source=example&utm_medium=mcp-starter\n`,
);
