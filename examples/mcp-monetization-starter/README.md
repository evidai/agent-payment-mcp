# mcp-monetization-starter

> **Minimal MCP server with usage billing via LemonCake.**
> One file, ~70 lines. Run with no env vars for demo mode, set `LEMONCAKE_SELLER_KEY` to accept card-funded Pay Tokens.

[![MIT](https://img.shields.io/badge/license-MIT-green)](../../LICENSE)
[![SDK](https://img.shields.io/badge/SDK-%40lemon--cake%2Fmcp--sdk-blueviolet)](https://www.npmjs.com/package/@lemon-cake/mcp-sdk)

---

## What this is

A working starting point for shipping an MCP server with per-call billing. Two demo tools (`search`, `summarize`) priced at $0.02 and $0.05 per call. Plug it into Claude Desktop / Cursor / Cline and it'll show up as a live MCP server with metering.

This is the example the LemonCake LP links to when it says "in one line of code." The "one line" is literally:

```ts
const wrapped = lc.charge({ price: 0.02 })(handler);
```

Everything else is standard MCP server boilerplate.

---

## Quick start (60 seconds)

```bash
git clone https://github.com/evidai/agent-payment-mcp
cd agent-payment-mcp/examples/mcp-monetization-starter
npm install
npm start
```

Without any env vars, you're in **demo mode** — charges are logged to stderr but no real funds move. Useful for local testing.

To go live:

```bash
# Get a seller key at https://lemoncake.xyz/start/free (no card required)
export LEMONCAKE_SELLER_KEY="lc_seller_..."
npm start
```

---

## Wire into Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "monetized-starter": {
      "command": "tsx",
      "args":    ["/absolute/path/to/examples/mcp-monetization-starter/src/index.ts"],
      "env": {
        "LEMONCAKE_SELLER_KEY": "lc_seller_..."
      }
    }
  }
}
```

Restart Claude Desktop. The two paid tools (`search`, `summarize`) appear in the tool list.

---

## What the SDK does

`lc.charge({ price: 0.02 })` returns a wrapper function. Applied to your tool handler, it:

1. **Pre-flights** the buyer's spend cap before running the handler. If the buyer has no budget or is rate-limited, the call is rejected with a clear error (no handler execution = no compute cost).
2. **Records the charge** as the handler returns. In live mode, buyers fund spend-capped Pay Tokens by card through LemonCake's Stripe-backed gateway.
3. **Surfaces failures cleanly** — payment failures produce structured MCP errors that the calling agent can introspect (insufficient budget vs. revoked token vs. network issue).

No API key management. No webhook handlers. No metering DB.

---

## Adapt for your use case

Replace the demo `search` and `summarize` handlers with whatever your MCP server actually does:

```ts
const tools = {
  embed_text: {
    schema:  { name: "embed_text", description: "...", inputSchema: { ... } },
    price:   0.001,  // sub-cent per call
    handler: async ({ text }: { text: string }) => {
      const vec = await openai.embeddings.create({ ... });
      return { content: [{ type: "text", text: JSON.stringify(vec.data[0].embedding) }] };
    },
  },
};
```

Sub-cent prices work natively because LemonCake meters usage behind a prepaid Pay Token instead of running a card transaction for every tool call.

---

## Pricing

- **No monthly fee**
- **First 3,000 calls free** for the seller account lifetime
- **Then 3% only when your API earns** — sellers keep 97%

See [lemoncake.xyz/pricing](https://lemoncake.xyz/pricing?utm_source=example&utm_medium=mcp-starter-readme).

---

## License

MIT. Fork it, modify it, ship it as your own. No attribution required.
