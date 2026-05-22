# @lemon-cake/x402-server

**HTTP 402 middleware with hybrid facilitator routing. Get listed on Coinbase x402 Bazaar AND keep LemonCake's freee / invoicing / JPY off-ramp features.**

[![npm](https://img.shields.io/npm/v/@lemon-cake/x402-server)](https://www.npmjs.com/package/@lemon-cake/x402-server)
[![x402](https://img.shields.io/badge/x402-compatible-blueviolet)](https://www.x402.org/)
[![Bazaar discoverable](https://img.shields.io/badge/x402_Bazaar-discoverable-blue)](https://docs.cdp.coinbase.com/x402/bazaar)
[![non-custodial](https://img.shields.io/badge/non--custodial-USDC_stays_in_wallets-success)](https://lemoncake.xyz)

---

## What this is

Drop this middleware in front of any API route. Unpaid requests get back
a **HTTP 402 Payment Required**. Paid requests (carrying an `X-PAYMENT`
header) are verified through your chosen facilitator and forwarded.

Choose how payments flow:

| `facilitator` | What you get |
|---|---|
| `"lemoncake"` *(default)* | LemonCake verify/settle. Pro/Business plans unlock freee/MF auto-journal, qualified invoices (適格請求書), JPY off-ramp via Coincheck. |
| `"coinbase"` | Coinbase CDP verify/settle. First settled call auto-indexes your endpoint in the [x402 Bazaar](https://docs.cdp.coinbase.com/x402/bazaar) — discoverable by Coinbase Bazaar, AWS Bedrock AgentCore, and any x402-aware agent. |
| `"both"` | **Recommended.** Settle through CDP for global discovery AND post-record to LemonCake for metering / invoicing / JPY off-ramp. Pay once, get listed everywhere. |

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
  serviceId:       "your-providerV2-id",    // from lemoncake.xyz/sellers
  pricePerCallUsd: 0.001,
  facilitator:     "both",                  // Bazaar reach + LemonCake features
  bazaar: {
    name:        "Web Search API",
    description: "Real-time Google search results",
    category:    "search",
    tags:        ["search", "web"],
  },
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
  serviceId:       "your-providerV2-id",
  pricePerCallUsd: 0.001,
  facilitator:     "both",
}));

app.get("/api/search", (c) => c.json({ results: [/* … */] }));
```

That's it. Restart the server and the route is monetized.

---

## Get listed on x402 Bazaar (recommended)

Setting `facilitator: "coinbase"` or `"both"` makes your endpoint
auto-cataloged by Coinbase's Bazaar after the first successful settle.

The middleware automatically adds `extensions.discoverable: true` to the
402 response so the CDP facilitator catalogs your endpoint on the first
settle. After that, your service appears in:

- **[Coinbase x402 Bazaar](https://docs.cdp.coinbase.com/x402/bazaar)** — Coinbase's discovery layer
- **[AWS Bedrock AgentCore](https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments.html)** — AgentCore Payments uses the Coinbase Bazaar MCP server as its index
- **Any x402-aware agent** — including Cloudflare's, Coinbase's reference clients, and 22 Foundation members

If you also use `facilitator: "both"`, every CDP settle is mirrored to
LemonCake's metering DB for invoicing and JPY off-ramp.

---

## Options

| Field | Default | Description |
|---|---|---|
| `serviceId` | — | LemonCake provider ID (from `/sellers`) |
| `pricePerCallUsd` | 0.001 | Upper-bound price per call (USD) |
| `facilitator` | `"lemoncake"` | `"lemoncake"` / `"coinbase"` / `"both"` |
| `description` | — | Shown in the 402 body to the agent |
| `bazaar.name` | — | Display name shown in Bazaar listing |
| `bazaar.description` | — | Short description for search results |
| `bazaar.category` | — | Top-level category |
| `bazaar.tags` | — | Tags for facet search |
| `lemoncakeFacilitatorUrl` | LemonCake prod | Override for self-hosting / staging |
| `coinbaseFacilitatorUrl` | `https://api.cdp.coinbase.com/platform/v2/x402` | Override |
| `resourceUrl` | derived from `req` | Override what URL appears in the 402 |

---

## How the hybrid flow works

```
Buyer agent                Provider middleware               Facilitator(s)
     │                              │                                │
     ├── GET /api/search ──────────▶│                                │
     │                              │── build accepts ──────────────▶│ (no-op for "both";
     │                              │   (LemonCake + CDP)            │  just metadata)
     │                              │                                │
     │◀──── 402 + accepts[] ────────┤                                │
     │                              │                                │
     ├── sign ERC-3009 ─────────────│                                │
     │                              │                                │
     ├── GET /api/search           ─│                                │
     │   X-PAYMENT: <base64>        │                                │
     │                              ├─── verify+settle ─────────────▶│ Coinbase CDP
     │                              │◀─── ok + txHash ───────────────┤  (Bazaar catalog updates)
     │                              │                                │
     │                              ├─── record (fire-and-forget) ──▶│ LemonCake
     │                              │     metering DB                │  (freee / invoice)
     │                              │                                │
     │◀──── 200 + data ─────────────┤                                │
```

The buyer's signature is chain-level — any facilitator can submit it.
"both" mode picks Coinbase for the on-chain submit (so Bazaar updates),
then asynchronously notifies LemonCake so your provider still gets:

- Free tier (1,000 calls/mo) tracking
- Pro plan freee/MF auto-journal
- Pro plan qualified invoice (適格請求書) auto-issuance
- Business plan JPY off-ramp (USDC → Coincheck → bank)

---

## Sister packages

- [`agent-payment-mcp`](https://www.npmjs.com/package/agent-payment-mcp) — Claude / Cursor / Cline MCP server (buyer side)
- [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk) — SDK for adding payments to existing MCP servers
- [`xstocks-mcp`](https://www.npmjs.com/package/xstocks-mcp), [`alpaca-guard-mcp`](https://www.npmjs.com/package/alpaca-guard-mcp), [`tokenized-stock-mcp`](https://www.npmjs.com/package/tokenized-stock-mcp) — sample monetized MCPs

---

## License

MIT
