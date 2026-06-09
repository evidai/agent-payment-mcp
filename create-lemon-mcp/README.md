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

## Status

**v0.1 is sandbox-first.** It demonstrates the flow against the LemonCake sandbox — no real money. Production billing for *your own* endpoint (env-only go-live) is **Phase 2**. To take real payments today, register your endpoint in [LemonCake /app](https://lemoncake.xyz/app).

## What you get

- A remote (Streamable HTTP) MCP server with a `paid_search` tool (mock results — swap for any real API).
- A working agent demo of the pay-per-call flow.
- No keys, no card, no crypto to try it.

[LemonCake](https://lemoncake.xyz) · MIT
