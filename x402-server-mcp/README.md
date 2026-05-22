# @lemon-cake/x402-server

**Drop-in HTTP 402 Payment Required middleware. Pay-per-call your API in 3 lines.**

[![npm](https://img.shields.io/npm/v/@lemon-cake/x402-server)](https://www.npmjs.com/package/@lemon-cake/x402-server)
[![x402](https://img.shields.io/badge/x402-compatible-blueviolet)](https://www.x402.org/)
[![non-custodial](https://img.shields.io/badge/non--custodial-USDC_stays_in_wallets-success)](https://lemoncake.xyz)

---

## What

Drop this middleware in front of any API route. Unpaid requests get back
a **HTTP 402 Payment Required** with an [x402](https://www.x402.org/) `accepts[]`
manifest. Paid requests (carrying an `X-PAYMENT` header) are verified through
LemonCake's facilitator and forwarded to your handler.

You don't run a wallet. You don't hold USDC. The buyer's wallet pays your
provider wallet directly on Base — LemonCake just relays the signed
ERC-3009 `transferWithAuthorization`.

---

## Install

```bash
npm i @lemon-cake/x402-server
```

## Use — Express / Connect

```typescript
import express from "express";
import { x402Middleware } from "@lemon-cake/x402-server";

const app = express();

app.use("/api/search", x402Middleware({
  serviceId:       "your-provider-id",   // from lemoncake.xyz/sellers
  pricePerCallUsd: 0.001,
  description:     "Web search API",
}));

app.get("/api/search", (req, res) => {
  res.json({ results: [/* … */] });
});
```

## Use — Hono

```typescript
import { Hono } from "hono";
import { x402Hono } from "@lemon-cake/x402-server";

const app = new Hono();

app.use("/api/search", x402Hono({
  serviceId:       "your-provider-id",
  pricePerCallUsd: 0.001,
}));

app.get("/api/search", (c) => c.json({ results: [/* … */] }));
```

That's it. Restart the server and the route is monetized.

---

## How payments work

```
1. Client → GET /api/search
2. Server → 402 Payment Required
            { x402Version: 1, accepts: [{ network: "base-mainnet",
              asset: "USDC", payTo: "0x23e0...", maxAmountRequired: "1000" }]}
3. Client signs ERC-3009 transferWithAuthorization (EIP-712)
4. Client → GET /api/search   X-PAYMENT: <base64 of signed payload>
5. Server → calls LemonCake /api/x402/verify
6. LemonCake → on-chain transferWithAuthorization on Base USDC
7. Server → 200 OK + your API response
```

The buyer pays the facilitator address; LemonCake then forwards to your
provider wallet during settlement (built into the metering pipeline).

You as the provider:
- Never run a wallet on the server
- Never see private keys
- Never settle anything yourself
- Get USDC directly to your Base wallet (registered at `/sellers`)

---

## Options

| Field | Default | Description |
|---|---|---|
| `serviceId` | — | LemonCake provider ID (from `/sellers`) |
| `pricePerCallUsd` | 0.001 | Upper-bound price per call (USD) |
| `description` | — | Shown in the 402 body to the agent |
| `facilitatorUrl` | LemonCake prod | Override for self-hosting / staging |
| `resourceUrl` | derived from `req` | Override what URL appears in the 402 |

---

## Sister packages

- [`agent-payment-mcp`](https://www.npmjs.com/package/agent-payment-mcp) — Claude / Cursor / Cline MCP server (the buyer side)
- [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk) — SDK for adding payments to existing MCP servers
- [`xstocks-mcp`](https://www.npmjs.com/package/xstocks-mcp), [`alpaca-guard-mcp`](https://www.npmjs.com/package/alpaca-guard-mcp), [`tokenized-stock-mcp`](https://www.npmjs.com/package/tokenized-stock-mcp) — sample monetized MCPs

---

## License

MIT
