# agent-payment-mcp — AI Agent Payment MCP Server

> **Give your AI agent a wallet.** Pay-per-call USDC micropayments for any HTTP API — directly from Claude Desktop, Cursor, Cline, or any MCP client. No human approval per call. Kill switch included.

[![npm version](https://img.shields.io/npm/v/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![npm downloads](https://img.shields.io/npm/dm/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-blue)](https://registry.modelcontextprotocol.io)
[![Listed on Glama](https://glama.ai/mcp/servers/evidai/lemon-cake/badges/score.svg)](https://glama.ai/mcp/servers/evidai/lemon-cake)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/node/v/agent-payment-mcp)](https://nodejs.org)

---

## Try in 30 seconds (Demo Mode — no signup)

```json
{
  "mcpServers": {
    "pay-per-call": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"]
    }
  }
}
```

Leave `LEMON_CAKE_BUYER_JWT` unset → **Demo Mode** activates automatically. Calls hit real Wikipedia, httpbin, and live FX rate APIs with no charges.

> 💡 Or click **"Try in Browser"** on [Glama](https://glama.ai/mcp/servers/evidai/lemon-cake) → leave both env fields empty → click **Start Inspector**.

---

## What it does

`agent-payment-mcp` lets an AI agent **discover, pay for, and call premium HTTP APIs** using USDC — with no human approval per call.

```
Agent (Claude / Cursor / Cline)
  │
  ├─ list_services()          → browse LemonCake API marketplace
  ├─ call_service(serviceId)  → invoke paid API, USDC deducted automatically
  ├─ check_balance()          → current USDC balance + spend limits
  ├─ setup()                  → onboarding guide if credentials missing
  ├─ check_tax(regNum)        → 国税庁 invoice number validation (Japan)
  └─ get_service_stats()      → usage + revenue analytics
```

### Safety mechanisms
- **Kill switch** — halts all charges instantly (atomic, one-call revocation)
- **Spend caps** — session/daily USD ceiling the agent cannot exceed
- **Pay Token (JWT)** — scoped, short-lived spend credential; no raw wallet key exposed to the agent
- **Idempotency** — `idempotencyKey` parameter makes retries safe; no double-charges

---

## Live mode (real USDC)

1. Sign up at [lemoncake.xyz](https://lemoncake.xyz)
2. Top up with USDC (min $5) or JPYC
3. Copy your **Buyer JWT** from the dashboard

```json
{
  "mcpServers": {
    "pay-per-call": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"],
      "env": {
        "LEMON_CAKE_BUYER_JWT": "eyJhbGci..."
      }
    }
  }
}
```

---

## Tools reference

### `setup`
Returns onboarding instructions if credentials are missing.

**Input:** none  
**Output:**
```json
{ "status": "ok", "mode": "demo", "message": "Set LEMON_CAKE_BUYER_JWT to enable live payments." }
```

---

### `list_services`
Browse the LemonCake API marketplace.

**Input:** `{ "limit": 20 }`

**Output:**
```json
{
  "services": [
    { "id": "serper", "name": "Serper — Google Search", "priceUsdc": "0.005" }
  ]
}
```

---

### `call_service`
Invoke a paid API. USDC is deducted from your balance automatically.

**Input:**
```json
{
  "serviceId": "serper",
  "path": "/search",
  "method": "POST",
  "body": { "q": "AI agent payments" },
  "idempotencyKey": "req-abc-001"
}
```

**Output (success):**
```json
{
  "status": 200,
  "chargeId": "ch_abc123",
  "amountUsdc": "0.005",
  "response": { "organic": ["..."] },
  "x402Receipt": {
    "scheme": "lemoncake-pay-token-v1",
    "x402Compatible": true,
    "amount": "0.005",
    "asset": "USDC",
    "settledAt": "2026-05-09T14:50:11.019Z"
  }
}
```

**Output (budget exceeded):**
```json
{ "error": "BUDGET_EXCEEDED", "remaining": "0.00", "limit": "5.00" }
```

---

### `check_balance`
Returns current USDC balance and KYA tier limits.

**Output:**
```json
{
  "balanceUsdc": "4.995",
  "kyaTier": "standard",
  "dailyLimitUsdc": "50.00",
  "sessionSpentUsdc": "0.005"
}
```

---

### `check_tax`
Validates a Japanese qualified-invoice (適格請求書) registration number against the 国税庁 API.

**Input:** `{ "registrationNumber": "T1234567890123", "amountJpy": 10000 }`

**Output:**
```json
{ "valid": true, "businessName": "株式会社Example", "registrationDate": "2023-10-01" }
```

---

### `get_service_stats`
Returns aggregated usage data for all services.

**Output:**
```json
{
  "totalCalls": 142,
  "totalSpentUsdc": "0.71",
  "byService": [{ "serviceId": "serper", "calls": 80, "spentUsdc": "0.40" }]
}
```

---

## Available services

| Service | ID | Price | Demo |
|---|---|---|---|
| Serper — Google Search | `serper` | $0.005/call | ✅ |
| Hunter.io — Email finder | `hunter` | $0.005/call | ✅ |
| Open Exchange Rates | `openexchangerates` | $0.002/call | ✅ |
| Jina Reader — Web scraper | `jina` | $0.002/call | ✅ |
| 国税庁 Invoice API | `ntax` | $0.002/call | ✅ |
| gBizINFO — 法人情報 | `gbizinfo` | $0.003/call | ✅ |
| IPinfo — Geolocation | `ipinfo` | $0.003/call | ✅ |
| Firecrawl — Scraping | `firecrawl` | $0.005/call | ✅ |
| Slack — Human-in-the-loop | `slack` | $0.005/call | ✅ |
| TRUSTDOCK — eKYC | `trustdock` | $0.05/call | ✅ |

Full marketplace: [lemoncake.xyz/services](https://lemoncake.xyz/services)

---

## x402 compatibility (since v0.5.1)

This server speaks the [x402](https://www.x402.org/) protocol. Agent code written for on-chain x402 works unmodified:

- `call_service` returns `x402Receipt` on every successful charge
- Upstream `402` challenges are parsed (`WWW-Authenticate`, `X-402-*` headers, body `x402` field)
- `PAYMENT_PENDING` semantics with `retryAfterMs` + `idempotencyKey` for async settlement

---

## Environment variables

| Variable | Required | Description |
|---|:---:|---|
| `LEMON_CAKE_BUYER_JWT` | ✅ live | Buyer JWT from [dashboard → API Keys](https://lemoncake.xyz/dashboard) |
| `LEMON_CAKE_PAY_TOKEN` | — | Pre-issued Pay Token JWT (alternative) |
| `LEMON_CAKE_API_URL` | — | API endpoint override (default: `https://api.lemoncake.xyz`) |

Leave both JWT vars unset → **Demo Mode** (no charges, real demo APIs).

---

## Tested MCP clients

| Client | Status |
|---|:---:|
| Claude Desktop (macOS / Windows) | ✅ |
| Cursor | ✅ |
| Cline (VS Code) | ✅ |
| Claude Code CLI | ✅ |
| Continue.dev | ✅ |
| Any MCP 1.10+ stdio client | ✅ |

---

## For MCP server developers

Add pay-per-call billing to your own MCP server in 3 lines:

```bash
npm install @lemon-cake/mcp-sdk
```

```typescript
import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";
const lc = createLemonCakeSDK({ sellerKey: process.env.LEMONCAKE_SELLER_KEY });

execute: lc.charge({ price: 0.05 })(async (args) => myHandler(args))
```

Demo Mode activates automatically when `LEMONCAKE_SELLER_KEY` is absent.

---

## Sibling MCPs

| Package | What it does |
|---|---|
| [xstocks-mcp](https://www.npmjs.com/package/xstocks-mcp) | Buy tokenized US stocks (xStocks) on Solana via Jupiter DEX |
| [alpaca-guard-mcp](https://www.npmjs.com/package/alpaca-guard-mcp) | Alpaca brokerage with hard daily USD cap guard |
| [polymarket-guard-mcp](https://www.npmjs.com/package/polymarket-guard-mcp) | Polymarket prediction markets with USDC billing |

---

## Local development

```bash
git clone https://github.com/evidai/agent-payment-mcp.git
cd agent-payment-mcp/mcp-server
npm install && npm run build && npm start
```

---

## License

MIT © [LemonCake](https://lemoncake.xyz) · contact@aievid.com
