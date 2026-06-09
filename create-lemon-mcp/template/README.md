# 🍋 Paid MCP (sandbox demo)

A paid MCP server scaffolded by [`create-lemon-mcp`](https://www.npmjs.com/package/create-lemon-mcp). Buyers pay by card, agents call with **spend-capped Pay Tokens**, **no crypto**.

> **v0.1 is sandbox/demo.** It runs entirely against the LemonCake sandbox — no key, no card, no real money. Production billing for *your own* server (env-only go-live) lands in **Phase 2**. For real payments today, register your endpoint in [LemonCake /app](https://lemoncake.xyz/app).

## Run it

```bash
npm install
npm run demo:agent   # see the paid-call flow in ~10s
npm start            # run the paid MCP server (remote HTTP) at http://localhost:3000/mcp
```

`npm run demo:agent` does the real LemonCake sandbox flow:

```
1. call with no Pay Token  → 402 Payment Required
2. minted sandbox Pay Token → $0.20 budget (20 calls @ $0.01)
3. agent calls, paying each time:
   → call # 1  paid $0.01  remaining $0.19
   ...
4. 402 — budget gone → the agent stops. it physically can't overspend.
```

## What's here

```
src/
  server.ts       remote (Streamable HTTP) MCP server, one paid tool
  mockSearch.ts   fixed demo results — swap for a real search API
  lemoncake.ts    sandbox client (mint token, metered call)
examples/
  demo-agent.ts   the 402 → mint → pay → cap flow
```

## Make it real

1. **Swap the mock** in `src/mockSearch.ts` for a real search/scrape/data API (your key stays server-side).
2. **Register your endpoint** at [lemoncake.xyz/app](https://lemoncake.xyz/app): paste this server's public URL, set a price, share the buy link. Buyers prepay by card → agents get a Pay Token → you keep **97%** (first 3,000 calls free).

## Roadmap

- **v0.1 (now):** sandbox demo — experience the paid-call flow with zero setup.
- **Phase 2:** env-only production billing for your own server (`LEMONCAKE_SELLER_KEY`), so demo → prod is a one-line change.

MIT.
