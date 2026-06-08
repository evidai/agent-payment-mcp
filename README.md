<div align="center">

# 🍋 LemonCake

**The x402 payment rail for AI agents.** `Private Beta · Open core`

*Let your AI agent pay for any API, per call — spend-capped, no account, **no crypto**.*
*First 3,000 calls free (lifetime). Then 3% only when your API earns.*

[![License: MIT (SDK)](https://img.shields.io/badge/license-MIT_(SDK)-green.svg)](LICENSE)
[![Open core](https://img.shields.io/badge/model-open--core-brightgreen.svg)](#-open-core)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-blue.svg)](https://modelcontextprotocol.io)
[![x402 native](https://img.shields.io/badge/x402-native-blueviolet)](https://x402.org)
[![npm: agent-payment-mcp](https://img.shields.io/npm/v/agent-payment-mcp?label=agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![FSA-confirmed](https://img.shields.io/badge/Japan_FSA-registration_not_required-blue)](https://lemoncake.xyz/security)
[![Glama score](https://glama.ai/mcp/servers/evidai/lemon-cake/badges/score.svg)](https://glama.ai/mcp/servers/evidai/lemon-cake)

**[🚀 Quickstart](#-try-in-30-seconds) · [💲 Pricing](https://lemoncake.xyz/pricing) · [📚 Docs](https://lemoncake.xyz/docs) · [🌐 Live](https://lemoncake.xyz)**

<br>

<img src="https://raw.githubusercontent.com/evidai/agent-unleashed/main/demo.gif" alt="An AI agent pays for paid API calls on its own — spend-capped, no crypto" width="760">

<sub>☝️ A real AI agent buys API calls by itself ($0.01 each), stops at its cap, and the API owner earns — no human, no crypto. · <a href="https://github.com/evidai/agent-unleashed">demo source</a></sub>

</div>

---

## 🚀 Try in 30 seconds

No signup, no card — ships **8 free demo tools** (search · translate · weather · geocode · time · dictionary · fx · echo):

```bash
npx -y agent-payment-mcp
```

Or drop it into any MCP client:

```json
{ "mcpServers": { "lemon": { "command": "npx", "args": ["-y", "agent-payment-mcp"] } } }
```

Then ask your agent to run `list_demos` / `call_demo`. To call **paid** APIs, set `LC_PAY_TOKEN` (get one at [lemoncake.xyz/app](https://lemoncake.xyz/app)).

---

## What is LemonCake?

LemonCake is an **x402 payment rail** — a gateway that lets AI agents autonomously pay for any HTTP API with a hard-capped prepaid wallet. No blockchain wallet, no per-call key juggling, no human approving each request.

```mermaid
sequenceDiagram
    participant A as 🤖 AI Agent
    participant G as 🍋 LemonCake Gateway
    participant API as Your API
    A->>G: POST /g/:id (no token)
    G-->>A: 402 + accepts[] (price, mintUrl)
    A->>G: mint Pay Token (off-session, capped)
    A->>G: Bearer :jwt
    G->>API: forward (upstream key hidden)
    API-->>A: 200 + result
    Note over A,G: budget exhausted → 402 → agent self-funds → continues
```

**Sellers** register any HTTP API and set a price per call.
**Buyers / agents** prepay with a card → Pay Token issued automatically → agent calls the API within budget.
Budget exhausted → 402 challenge → agent self-funds → continues. No humans.

---

## 🧱 Open core

| Layer | Status | Where |
|---|---|---|
| Buyer-side MCP (`agent-payment-mcp`) | ✅ MIT | [npm](https://www.npmjs.com/package/agent-payment-mcp), [src](./mcp-server) |
| Seller SDK (`@lemon-cake/mcp-sdk`) | ✅ MIT | [npm](https://www.npmjs.com/package/@lemon-cake/mcp-sdk), [src](./lemoncake-mcp-sdk) |
| Starter templates | ✅ MIT | [examples/](./examples) |
| Docs site | ✅ Public | [lemoncake.xyz/docs](https://lemoncake.xyz/docs) |
| **Gateway + billing engine** | 🔒 Hosted | lemoncake.xyz |
| **Dashboard** (analytics, usage ledger) | 🔒 Hosted | lemoncake.xyz/app |

---

## 💳 How payment works

### For buyers (human or agent)

1. Open a **buy link** (`lemoncake.xyz/buy/<shortId>`)
2. Pay with a card → **Pay Token (JWT) issued automatically**
3. Pass `Authorization: Bearer <token>` to the gateway
4. Gateway verifies, meters, forwards to the real API
5. Budget exhausted → 402 challenge returned with payment instructions

### For agents (fully autonomous)

1. Issue a **Buyer Key** (`bk_...`) at [/app](https://lemoncake.xyz/app) → Pay Tokens pane
2. Save a card once at [/agent/fund](https://lemoncake.xyz/agent/fund)
3. Agent calls `POST /api/lc/agent/tokens` (Bearer bk_) → off-session card charge → JWT
4. Agent uses JWT to call gateway — **hard-capped, no human in the loop**

```json
// MCP config for agent with pre-issued Pay Token
{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"],
      "env": {
        "LC_PAY_TOKEN": "<jwt from Pay Token>"
      }
    }
  }
}
```

---

## 🏗 Publish your API on LemonCake (sellers)

Monetize any HTTP API or MCP server:

1. Sign in at [lemoncake.xyz/app](https://lemoncake.xyz/app)
2. **Add API** — paste your URL, set price per call (e.g. `$0.01`)
3. Share the **buy link** — buyers prepay, Pay Token issued automatically
4. **You keep 97%.** LemonCake takes 3% once at checkout (Stripe Connect Direct Charge). Never holds funds.

Add billing with the SDK (optional):

```typescript
import { withPayment } from "@lemon-cake/mcp-sdk";

server.tool("my_premium_tool", withPayment({ price: 0.01 }, async (args) => {
  return { content: [{ type: "text", text: "result" }] };
}));
```

Or route existing traffic through `https://lemoncake.xyz/g/<shortId>` — **no code changes required**.

---

## ✨ Features

### For agents / buyers
- ✅ **x402 native** — 402 challenge returns `accepts[]` with price + mintUrl
- ✅ **Hard-capped** — per-mint / daily / monthly limits, server-enforced
- ✅ **Off-session top-up** — agent self-funds via Buyer Key (`bk_...`), no prompts
- ✅ **Demo Mode** — 8 free tools, try without any setup

### For API providers / sellers
- ✅ **Gateway in minutes** — register any HTTP API, get a URL instantly
- ✅ **Custody-free** — Stripe Connect Direct Charge, 97% goes directly to seller
- ✅ **Usage ledger** — every call recorded, revenue visible in dashboard
- ✅ **Buy link** — share one URL, buyers self-serve

### Infrastructure
- 🔧 Stripe Connect Direct Charge (no custody)
- 🔧 x402 gateway with `WWW-Authenticate: Lemoncake-Prepaid`
- 🔧 EN / 日本語 / Español dashboard
- 🔧 [JP FSA: registration not required](https://lemoncake.xyz/security) (confirmed 2026-06)

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│  Buyer / Agent                                  │
│   ↳ prepays via card OR Buyer Key (bk_...)      │
│   ↳ receives Pay Token (signed JWT)             │
└──────────────────────┬──────────────────────────┘
                       │  Authorization: Bearer <jwt>
                       ▼
┌─────────────────────────────────────────────────┐
│  LemonCake Gateway  /g/<shortId>                │
│   ↳ verify JWT signature                        │
│   ↳ check budget + calls + rate limit           │
│   ↳ decrement spend, write to ledger            │
└──────────────────────┬──────────────────────────┘
                       │  HTTPS + upstream_auth (hidden)
                       ▼
┌─────────────────────────────────────────────────┐
│  Your API / MCP server (unchanged)              │
└─────────────────────────────────────────────────┘
```

LemonCake is the middle box. It never holds funds — money flows Stripe → seller via Direct Charge.

---

## 🌍 Compliance

Japan FSA Fintech Support Desk (2026-06) confirmed: no registration required.
Custody-free design (Stripe Connect Direct Charge, no pooled balance).

| Jurisdiction | Basis |
|---|---|
| 🇯🇵 Japan | FSA — registration not required |
| 🇺🇸 USA | FinCEN 2019 §4.5 — non-custodial software ≠ MSB |
| 🇪🇺 EU | MiCA — non-CASP |
| 🇬🇧 UK | FCA — Tech Service Provider |
| 🇸🇬 Singapore | MAS — DPT non-applicable |
| 🇨🇦 Canada | FINTRAC — non-custodial exemption |
| 🇨🇭 Switzerland | FINMA — non-financial intermediary |

See [lemoncake.xyz/security](https://lemoncake.xyz/security)

---

## 🔌 Package family

| Package | What it does |
|---|---|
| [`agent-payment-mcp`](https://www.npmjs.com/package/agent-payment-mcp) | Main entry — x402 gateway + agent payment rail |
| [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk) | SDK for sellers to monetize their MCP servers |
| [`xstocks-mcp`](https://www.npmjs.com/package/xstocks-mcp) | Buy tokenized US stocks on Solana |
| [`alpaca-guard-mcp`](https://www.npmjs.com/package/alpaca-guard-mcp) | Alpaca paper / live trading with hard daily cap |
| [`tokenized-stock-mcp`](https://www.npmjs.com/package/tokenized-stock-mcp) | Dinari dShares |

---

## 🛡 Security

- **Server-side hard caps** — per-mint / daily / monthly, cannot be exceeded
- **Pay Token = signed JWT** — HS256, verified on every gateway call
- **upstream_auth never exposed** — seller's real API key hidden from buyers
- **RLS on all DB tables** — Supabase row-level security enabled
- **Stripe Connect Direct Charge** — LemonCake never holds funds
