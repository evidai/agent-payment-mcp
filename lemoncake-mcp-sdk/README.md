# @lemon-cake/mcp-sdk

**Seller-side SDK for paid MCP tools and HTTP APIs.** Add per-call billing + spend caps in one line. Buyers pay by card; agents call with budget-limited Pay Tokens. **No crypto wallet required.** MIT — the open core of [LemonCake](https://lemoncake.xyz).

[![npm](https://img.shields.io/npm/v/@lemon-cake/mcp-sdk)](https://www.npmjs.com/package/@lemon-cake/mcp-sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![Open core](https://img.shields.io/badge/model-open--core-brightgreen.svg)](https://lemoncake.xyz)
[![No crypto](https://img.shields.io/badge/payments-fiat_·_no--crypto-blue)](https://lemoncake.xyz/security)

> **v1.0.0** is the fiat seller SDK. Production billing settles through LemonCake's
> card-funded gateway (`/api/sdk/preflight` + `/api/sdk/charge`) — no USDC, no wallet.

## What you get

- **Card-funded Pay Tokens** — the buyer prepays by card; the SDK debits that prepaid balance per call. You never touch a card or a wallet.
- **Budget + call caps** — every token carries a hard spend cap, a max-call count, and an expiry. An agent physically cannot overspend.
- **`lc.charge()`** for MCP tool handlers; **`lc.protect()`** for HTTP routes.
- **Safe-by-default settlement** — reserve → run → confirm. A tool that fails is never charged; a charge is never double-counted.
- **Demo mode** — with no seller key the SDK runs your handler and logs what *would* have been charged, so you can build before going live.

## MCP — `lc.charge()`

```typescript
import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";

const lc = createLemonCakeSDK();               // reads LEMONCAKE_SELLER_KEY from env

server.tool("search", "Search the web", { query: z.string() },
  lc.charge({ price: 0.02 })(async ({ query }) => {
    return { content: [{ type: "text", text: await myActualSearch(query) }] };
  }),
);
```

`lc.charge()` wraps your handler: **preflight** (validate the buyer's Pay Token + reserve the charge) → run your tool → **confirm** on success / **refund** on failure. The buyer's Pay Token is read from the MCP request `_meta.payToken` (or `LEMONCAKE_PAY_TOKEN`).

## HTTP — `lc.protect()`

```typescript
import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";

const lc = createLemonCakeSDK();

app.use(lc.protect("/api/search", { cost: 0.02 }));

app.get("/api/search", async (req, res) => {
  res.json(await myActualSearch(req.query.q));
});
```

Express / Connect / Polka-compatible. The Pay Token is read from `Authorization: Bearer …`, `X-LemonCake-Pay-Token`, or `?payToken=…`. The charge is confirmed once the response flushes (and cancelled on a 4xx/5xx).

## Demo → production (one env var)

| `LEMONCAKE_SELLER_KEY` | Mode | Behaviour |
|---|---|---|
| unset | **demo** | runs your handler, logs the would-be charge, no network |
| `sk_live_…` | **production** | meters the buyer's prepaid Pay Token via the fiat gateway; you keep **97%** (first 3,000 calls free) |

No code change between the two — just set the env var.

## Quick start

The fastest path is the scaffolder, which wires `lc.charge()` for you:

```bash
npx create-lemon-mcp my-paid-mcp
cd my-paid-mcp && npm install
npm run demo:agent      # see the paid-call flow in sandbox (no key)
```

To go live:

1. Create an endpoint + **Seller Key** in [LemonCake /app](https://www.lemoncake.xyz/app).
2. Put `LEMONCAKE_SELLER_KEY=sk_live_…` in your env.
3. `npm run smoke`, then `npm start`.

> One key is bound to one endpoint. Buyers prepay by card on your buy link → agents receive a spend-capped Pay Token → your tool charges it per call.

## Configuration

```typescript
createLemonCakeSDK({
  sellerKey,        // default: process.env.LEMONCAKE_SELLER_KEY
  apiUrl,           // default: https://www.lemoncake.xyz
  defaultPayToken,  // fallback Pay Token for local testing
});
```

`lc.charge({ price, freeCalls?, rateLimit?, toolName? })` — `price` is used for local free-tier/rate-limit accounting; the actual charge is the endpoint's price configured in /app (server-authoritative).

## Legacy note

Versions **before 1.0.0** used the legacy Railway/USDC backend (`api.lemoncake.xyz`). They remain on npm for existing users. Use **v1.0.0+** for the fiat / no-crypto seller SDK.

## License

MIT.
