# agent-payment-mcp 🍋

**Stripe-style drop-in USDC billing for any HTTP API. Try in 5 seconds, zero signup.**

[![npm](https://img.shields.io/npm/v/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![downloads](https://img.shields.io/npm/dm/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![Glama score](https://glama.ai/mcp/servers/evidai/lemon-cake/badges/score.svg)](https://glama.ai/mcp/servers/evidai/lemon-cake)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-blue)](https://registry.modelcontextprotocol.io)
[![non-custodial](https://img.shields.io/badge/non--custodial-USDC_stays_in_your_wallet-success)](https://lemoncake.xyz/start/v2)
[![x402](https://img.shields.io/badge/x402-Bazaar_discoverable-blueviolet)](https://www.x402.org/)
[![FSA-confirmed](https://img.shields.io/badge/Japan_FSA-registration_not_required-blue)](https://lemoncake.xyz/security)
[![pricing](https://img.shields.io/badge/pricing-no_monthly_fee-fffd43)](https://lemoncake.xyz/pricing)
[![MPP-compatible](https://img.shields.io/badge/MPP_%2F_Tempo-interop-blueviolet)](https://lemoncake.xyz/pricing)

> 💰 **No monthly fee. Pay 3% only when your API earns. 3,000 calls free.** [See pricing →](https://lemoncake.xyz/pricing)

---

## ⚡ Try in 5 seconds

### Easiest — Glama Playground (no install)

👉 Hit **"Try in Browser"** at the top of this page. Demo Mode starts instantly, no env vars needed.

### Claude Desktop / Cursor / Cline

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (or your Cursor / Cline MCP config):

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
>
> or
>
> **"use lemon to get current weather in Akihabara"**

**Zero env vars. Zero signup. Zero credit card.** Demo Mode activates automatically.

---

## 🎁 8 free demo tools (real APIs, no auth)

All powered by real free upstreams. Useful enough that many users never need to upgrade.

| Tool | What it does | Upstream |
|---|---|---|
| 🔍 `demo_search` | Search Wikipedia (5 results + URLs) | en.wikipedia.org |
| 💱 `demo_fx` | Live FX rates (160+ currencies, USD base) | open.er-api.com |
| 🌐 `demo_translate` | Translate 80+ languages | MyMemory |
| 🌤 `demo_weather` | Current weather for any lat/lon | Open-Meteo |
| 📍 `demo_geocode` | Place name → coordinates | OpenStreetMap Nominatim |
| 🕐 `demo_time` | Current time + DST for any IANA timezone | worldtimeapi |
| 📖 `demo_dictionary` | English definitions / synonyms / phonetics | dictionaryapi.dev |
| 🔁 `demo_echo` | HTTP echo (request inspector) | httpbin.org |

Plus `check_tax` — **live Japanese 適格請求書 (T+13)** validation against 国税庁. No other LLM can do this without hallucinating.

Compose them: `demo_geocode` → `demo_weather` ("weather in Tokyo"), `demo_translate` → `demo_dictionary`, etc.

---

## 📊 vs Stripe (when you go live)

| | Stripe | **LemonCake** |
|---|---|---|
| **Min charge** | $0.30+ | **$0.001** (60× cheaper) |
| **Settlement** | 2–7 days | **2 seconds** (Base L2) |
| **Chargeback** | Possible | **Impossible** (USDC) |
| **Global** | Card-network dependent | **USDC works everywhere** |
| **Setup** | Stripe account + KYB | **One signature** (90 days) |
| **Custody** | Stripe holds | **You hold** (non-custodial) |
| **Reg burden** | PCI / chargeback ops | FSA Q11-confirmed exempt |

---

## 💳 Unlock paid services — when you need more

Need Serper (Google search) / Hunter.io (verified emails) / Tavily / Firecrawl / gBizINFO (JP corporate registry)? One 90-day signature unlocks all of them:

1. Open [**lemoncake.xyz/start/v2**](https://lemoncake.xyz/start/v2)
2. Google sign-in (Privy embedded wallet — keys stay on your device)
3. **Sign ONE ERC-2612 permit** — `$25/day cap, 90 days, gas-free`
4. Copy the `LEMON_CAKE_PERMIT` blob
5. Add to your MCP config:

```json
{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"],
      "env": { "LEMON_CAKE_PERMIT": "<paste the permit blob>" }
    }
  }
}
```

That's it. Every API call settles **directly from your wallet to the provider** on Base. LemonCake never touches your USDC.

---

## 🏪 Publish your own API (for sellers)

Want to **monetize your MCP / HTTP API**? Self-service registration at [**lemoncake.xyz/sellers**](https://lemoncake.xyz/sellers):

- 1-minute signup (name / email / Base wallet address — no KYC)
- Get a `serviceId` instantly
- **No monthly fee, 3% only when your API earns** (Launch Plan)
- Pricing: you set the price, LemonCake takes 3% Monetization fee on revenue
- USDC settles **directly to your wallet** on every call

Add billing in 3 lines:

```typescript
import { x402Hono } from "@lemon-cake/x402-server";

app.use("/api/search", x402Hono({
  serviceId:       "your-providerV2-id",
  pricePerCallUsd: 0.001,
  facilitator:     "both",  // Coinbase Bazaar + LemonCake metering
}));
```

Hybrid `facilitator: "both"` mode → settle through Coinbase CDP for **x402 Bazaar / AWS Bedrock AgentCore discoverability**, while LemonCake records the call for **freee/MF auto-journal + 適格請求書 + JPY off-ramp** (Pro plan).

---

## 🌍 Compliance — registration-exempt in 7 jurisdictions

The 2026-05-21 ruling from Japan's FSA Fintech Support Desk (Q11) confirmed that a pure non-custodial SDK model does **NOT** require the "electronic payment means management" registration.

Same architecture is exempt under:

| Jurisdiction | Basis |
|---|---|
| 🇯🇵 Japan | FSA Q11 — confirmed non-applicable |
| 🇺🇸 USA | FinCEN 2019 guidance §4.5 — non-custodial software ≠ MSB |
| 🇪🇺 EU | MiCA — non-CASP (non-custodial wallet software) |
| 🇬🇧 UK | FCA — Tech Service Provider |
| 🇸🇬 Singapore | MAS — DPT non-applicable |
| 🇨🇦 Canada | FINTRAC — non-custodial MSB exemption |
| 🇨🇭 Switzerland | FINMA — non-financial intermediary |

Full posture: [lemoncake.xyz/security](https://lemoncake.xyz/security).

---

## 🔌 The LemonCake family

| Package | Use |
|---|---|
| [`agent-payment-mcp`](https://www.npmjs.com/package/agent-payment-mcp) | **Main MCP** — pay-per-call any HTTP API (this one) |
| [`@lemon-cake/x402-server`](https://www.npmjs.com/package/@lemon-cake/x402-server) | HTTP 402 middleware for sellers (Express / Hono) |
| [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk) | SDK to monetize your own MCP server |
| [`xstocks-mcp`](https://www.npmjs.com/package/xstocks-mcp) | Buy tokenized US stocks (AAPLx, TSLAx, …) on Solana |
| [`alpaca-guard-mcp`](https://www.npmjs.com/package/alpaca-guard-mcp) | Alpaca paper / live trading with hard USD cap |
| [`tokenized-stock-mcp`](https://www.npmjs.com/package/tokenized-stock-mcp) | Dinari dShares in USDC |
| [`polymarket-guard-mcp`](https://www.npmjs.com/package/polymarket-guard-mcp) | Polymarket prediction markets |

---

## 🛡 Security

- **On-chain hard cap** — the daily $25 limit is enforced by the USDC contract itself. The agent literally cannot exceed it.
- **No private keys in the MCP server** — the permit blob is a scope-limited EIP-712 signature.
- **Auto-revoke on expiry** — permits self-destruct after 90 days.
- **Idempotency keys required** on paid calls (no double-charges on retries).
- Audited May 2026 by [@kleosr](https://github.com/kleosr). See [security advisories](https://github.com/evidai/agent-payment-mcp/security/advisories).

---

## Links

| | |
|---|---|
| **Try it (no signup)** | "Try in Browser" button above, or `npx -y agent-payment-mcp` |
| **Get a permit** (paid services) | [lemoncake.xyz/start/v2](https://lemoncake.xyz/start/v2) |
| **Publish your API** | [lemoncake.xyz/sellers](https://lemoncake.xyz/sellers) |
| **Source** | [github.com/evidai/agent-payment-mcp](https://github.com/evidai/agent-payment-mcp) |
| **MCP Registry** | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) |
| **Discord** | [#showcase in MCP Discord](https://discord.com/invite/model-context-protocol-1312302100125843476) |
| **License** | MIT |
