# 🍋 LemonCake — agent-payment-mcp

**Let your AI agent pay for any API — capped, no account.**

Give your agent a spend-capped prepaid wallet and it pays for paid APIs on its own.
Discover → pay → pass through. No per-call key, no human in the loop, and it can't exceed your cap.
First 3,000 calls free, then 3%. Seller gets 97%. LemonCake never holds your funds.

[![npm](https://img.shields.io/npm/v/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![downloads](https://img.shields.io/npm/dm/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![Glama score](https://img.shields.io/badge/Glama_score-AAB-success)](https://glama.ai/mcp/servers/evidai/lemon-cake)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-blue)](https://registry.modelcontextprotocol.io)
[![x402](https://img.shields.io/badge/x402-native-blueviolet)](https://x402.org)
[![FSA-confirmed](https://img.shields.io/badge/Japan_FSA-registration_not_required-blue)](https://lemoncake.xyz/security)
[![pricing](https://img.shields.io/badge/pricing-3%2C000_calls_free-fffd43)](https://lemoncake.xyz/pricing)

> 💰 **No monthly fee. First 3,000 calls free (lifetime). Then 3% only when your API earns.**
> [See pricing →](https://lemoncake.xyz/pricing)

---

## ⚡ Try in 30 seconds — no signup

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (or Cursor / Cline):

```json
{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"]
    }
  }
}
```

Restart, then ask:
> **"use lemon to translate 'Hello, agent payments' to Japanese"**

**Zero env vars. Zero signup. Zero credit card.** Demo Mode activates automatically.

---

## 🎁 8 free demo tools (real APIs, no auth)

| Tool | What it does | Upstream |
|---|---|---|
| 🔍 `demo_search` | Search Wikipedia (5 results + URLs) | en.wikipedia.org |
| 💱 `demo_fx` | Live FX rates (160+ currencies) | open.er-api.com |
| 🌐 `demo_translate` | Translate 80+ languages | MyMemory |
| 🌤 `demo_weather` | Current weather for any lat/lon | Open-Meteo |
| 📍 `demo_geocode` | Place name → coordinates | OpenStreetMap Nominatim |
| 🕐 `demo_time` | Current time + DST for any IANA timezone | worldtimeapi |
| 📖 `demo_dictionary` | English definitions / synonyms | dictionaryapi.dev |
| 🔁 `demo_echo` | HTTP echo (request inspector) | httpbin.org |

---

## 💳 How agents pay for APIs (x402 autonomous payment)

LemonCake speaks [x402](https://x402.org) — the HTTP 402 payment protocol for AI agents.

```
Agent → POST /g/<endpoint>
         ↓
  402 + accepts[] { pricePerCall, buyUrl, mintUrl }
         ↓
  Agent mints a Pay Token (off-session, capped wallet)
         ↓
  Bearer <jwt> → gateway → your API
```

1. **Seller** registers any HTTP API at [lemoncake.xyz/app](https://lemoncake.xyz/app) and sets a price per call
2. **Buyer** prepays via card → Pay Token (JWT) issued automatically
3. **Agent** passes `Authorization: Bearer <token>` — gateway verifies, meters, forwards
4. **Budget exhausted** → gateway returns `402 + accepts[]` so agents can self-fund

---

## 🤖 Agent autonomous top-up (Agent Funding API)

For fully autonomous operation with no human per-session:

1. Issue a **Buyer Key** (`bk_...`) in the Pay Tokens pane at [/app](https://lemoncake.xyz/app)
2. Save a card once at [/agent/fund](https://lemoncake.xyz/agent/fund)
3. Agent uses `bk_` to mint/top-up Pay Tokens off-session — **hard-capped per your limits**

```
Agent → POST /api/lc/agent/tokens (Bearer bk_...)
         → off-session card charge → Pay Token issued
         → Bearer <jwt> → gateway → pass through
```

Caps enforced server-side: per-mint / daily / monthly. Cannot overspend.

---

## 🏪 Publish your own API (for sellers)

Monetize any HTTP API or MCP server in minutes:

1. Sign in at [lemoncake.xyz/app](https://lemoncake.xyz/app)
2. **Add API** → paste your URL, set price per call
3. Share the buy link — buyers prepay with a card, Pay Token issued automatically
4. **You keep 97%.** LemonCake takes 3% once at checkout. Never holds funds (Stripe Connect Direct Charge).

```typescript
// Your tool code is unchanged — LemonCake sits in front as a gateway
class MyTool extends MCPTool {
  // existing logic — no SDK required
}
// Route traffic through: https://lemoncake.xyz/g/<shortId>
```

---

## 🌍 Compliance — registration not required in 7 jurisdictions

Japan FSA Fintech Support Desk (2026-06) confirmed: no electronic payment means management registration required.
LemonCake never holds funds (Stripe Connect Direct Charge, custody-free).

| Jurisdiction | Basis |
|---|---|
| 🇯🇵 Japan | FSA confirmed — registration not required |
| 🇺🇸 USA | FinCEN 2019 §4.5 — non-custodial software ≠ MSB |
| 🇪🇺 EU | MiCA — non-CASP |
| 🇬🇧 UK | FCA — Tech Service Provider |
| 🇸🇬 Singapore | MAS — DPT non-applicable |
| 🇨🇦 Canada | FINTRAC — non-custodial exemption |
| 🇨🇭 Switzerland | FINMA — non-financial intermediary |

Full posture: [lemoncake.xyz/security](https://lemoncake.xyz/security)

---

## 🔌 The LemonCake family

| Package | Use |
|---|---|
| [`agent-payment-mcp`](https://www.npmjs.com/package/agent-payment-mcp) | **Main MCP** — x402 gateway + agent payment rail (this one) |
| [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk) | SDK to monetize your own MCP server |
| [`xstocks-mcp`](https://www.npmjs.com/package/xstocks-mcp) | Buy tokenized US stocks on Solana |
| [`alpaca-guard-mcp`](https://www.npmjs.com/package/alpaca-guard-mcp) | Alpaca paper / live trading with hard USD cap |
| [`tokenized-stock-mcp`](https://www.npmjs.com/package/tokenized-stock-mcp) | Dinari dShares |

---

## 🛡 Security

- **Server-side hard caps** — per-mint / daily / monthly limits enforced on the server. Cannot be exceeded.
- **Pay Token = JWT** — signed HS256, verified on every gateway call. Not a blockchain asset.
- **No private keys in the MCP server** — Buyer Key (`bk_`) has hashed secret, PM reference only (no raw card data).
- **Stripe Connect Direct Charge** — funds go seller-direct. LemonCake never holds customer funds.
- **RLS on all DB tables**, `upstream_auth` never returned in API responses.

---

## Links

| | |
|---|---|
| **Try demo** | `npx -y agent-payment-mcp` or [lemoncake.xyz/demo](https://lemoncake.xyz/demo) |
| **Seller dashboard** | [lemoncake.xyz/app](https://lemoncake.xyz/app) |
| **Agent card setup** | [lemoncake.xyz/agent/fund](https://lemoncake.xyz/agent/fund) |
| **Docs** | [lemoncake.xyz/docs](https://lemoncake.xyz/docs) |
| **Source** | [github.com/evidai/agent-payment-mcp](https://github.com/evidai/agent-payment-mcp) |
| **MCP Registry** | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) |
| **License** | MIT |
