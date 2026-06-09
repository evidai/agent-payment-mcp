# 🍋 Paid MCP

A paid MCP server scaffolded by [`create-lemon-mcp`](https://www.npmjs.com/package/create-lemon-mcp). Buyers pay by card, agents call with **spend-capped Pay Tokens**, **no crypto**.

**Sandbox by default. Go live by setting one env var — no code change.**

## Run it

```bash
npm install
npm run demo:agent   # see the live paid-call flow in ~10s (sandbox)
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

## demo → production (one env var)

The server wraps its tool with [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk):

```ts
const lc = createLemonCakeSDK();                       // reads LEMONCAKE_SELLER_KEY
server.tool("paid_search", desc, schema,
  lc.charge({ price: PRICE })(handler));               // preflight → run → settle
```

- **No `LEMONCAKE_SELLER_KEY`** → sandbox: the tool runs, nothing is charged.
- **`LEMONCAKE_SELLER_KEY=sk_live_…`** → production: every call meters the buyer's prepaid Pay Token via the LemonCake fiat gateway. You keep **97%** (first 3,000 calls free).

The buyer's Pay Token arrives in the MCP request `_meta.payToken` (or set `LEMONCAKE_PAY_TOKEN` for local testing).

## Make it real

1. **Swap the mock** in `src/mockSearch.ts` for a real search/scrape/data API (your key stays server-side).
2. **Create an endpoint + Seller Key** at [lemoncake.xyz/app](https://www.lemoncake.xyz/app): set this server's URL + a price, then issue a Seller Key.
3. **`LEMONCAKE_SELLER_KEY=sk_live_…`** in `.env`, then:
   ```bash
   npm run smoke   # verifies the production charge path end to end
   npm start
   ```

## What's here

```
src/
  server.ts       remote (Streamable HTTP) MCP server, one paid tool (lc.charge)
  mockSearch.ts   fixed demo results — swap for a real search API
  lemoncake.ts    sandbox client used by the demo (mint token, metered call)
  smoke.ts        production charge-path smoke test
examples/
  demo-agent.ts   the 402 → mint → pay → cap flow (sandbox)
```

MIT.
