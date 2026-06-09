# 🍋 create-lemon-mcp

> Scaffold a **paid MCP server** in one command. Buyers pay by card, agents call with spend-capped Pay Tokens, **no crypto**.

```bash
npx create-lemon-mcp my-paid-search
cd my-paid-search
npm install
npm run demo:agent
```

In ~10 seconds you see the LemonCake paid-call flow end to end — **402 → mint a sandbox Pay Token → pay per call → stop at the cap** — with no key, no card, no crypto.

```
1. call with no Pay Token  → 402 Payment Required
2. minted sandbox Pay Token → $0.20 budget (20 calls @ $0.01)
3. agent calls, paying each time:
   → call # 1  paid $0.01  remaining $0.19
   ...
4. 402 — budget gone → the agent stops.
```

`npm start` runs the generated paid MCP server (remote / Streamable HTTP) locally.

## demo → production is one env var

The generated server wraps its tool with [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk). Mode is decided by a single env var — **no code change**:

| `LEMONCAKE_SELLER_KEY` | Mode | What happens |
|---|---|---|
| unset | **sandbox** | the tool runs, nothing is charged (and `npm run demo:agent` shows the live paid-call flow) |
| `sk_live_…` | **production** | every call meters the buyer's prepaid Pay Token via the LemonCake fiat gateway; you keep **97%** |

**Go live in ~5 minutes:**

1. Create an endpoint + **Seller Key** in [LemonCake /app](https://www.lemoncake.xyz/app).
2. `LEMONCAKE_SELLER_KEY=sk_live_…` in `.env`.
3. `npm run smoke` to verify the charge path, then `npm start`.

Buyers prepay by card and call with a spend-capped Pay Token. No crypto.

## What you get

- A remote (Streamable HTTP) MCP server with a `paid_search` tool (mock results — swap for any real API).
- A working agent demo of the pay-per-call flow.
- Env-only go-live: sandbox to real billing without touching code.

[LemonCake](https://lemoncake.xyz) · MIT
