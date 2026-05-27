<div align="center">

# LemonCake

**The safe monetization layer for AI APIs.** `Private Beta · Open core`

> Turn any AI API into a paid API in minutes. No monthly fee — pay 5% only when your API earns.
> Start free with 3,000 API calls. Gateway, Pay Token, spend limits, metering, dashboard all included.
>
> *Not a payments company (Stripe owns it). Not a SaaS billing platform (Orb/Metronome own it). Not a wallet (Privy/Dynamic own it). LemonCake = the safe monetization layer for AI APIs.*

[![License: MIT (SDK)](https://img.shields.io/badge/license-MIT_(SDK)-green.svg)](LICENSE)
[![Open core](https://img.shields.io/badge/model-open--core-brightgreen.svg)](#-open-core-what-is-open-what-is-hosted)
[![MCP Compatible](https://img.shields.io/badge/MCP-compatible-blue.svg)](https://modelcontextprotocol.io)
[![npm: @lemon-cake/mcp-sdk](https://img.shields.io/npm/v/@lemon-cake/mcp-sdk?label=%40lemon-cake%2Fmcp-sdk)](https://www.npmjs.com/package/@lemon-cake/mcp-sdk)
[![npm: agent-payment-mcp](https://img.shields.io/npm/v/agent-payment-mcp?label=agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![FSA-confirmed](https://img.shields.io/badge/Japan_FSA-non--custodial-blue)](https://lemoncake.xyz/security)
[![Glama score](https://glama.ai/mcp/servers/evidai/lemon-cake/badges/score.svg)](https://glama.ai/mcp/servers/evidai/lemon-cake)

**[🚀 Quickstart](#-try-in-30-seconds-no-signup) · [🧩 Examples](./examples) · [💲 Pricing](https://lemoncake.xyz/pricing) · [📚 Docs](https://lemoncake.xyz/docs) · [📧 Contact](mailto:contact@aievid.com)**

</div>

---

## 🧱 Open core: what is open, what is hosted

LemonCake is **open-core** — same pattern as Supabase, Clerk, Resend. The SDK and integration surface are MIT-licensed and forkable. The hosted billing engine, dashboard, and compliance layer are run by us as a service.

| Layer | Status | Where |
|---|---|---|
| TypeScript SDK (`@lemon-cake/mcp-sdk`) | ✅ MIT | [npm](https://www.npmjs.com/package/@lemon-cake/mcp-sdk), [src](./lemoncake-mcp-sdk) |
| HTTP middleware (`@lemon-cake/x402-server`) | ✅ MIT | [src](./x402-server-mcp) |
| Buyer-side MCP (`agent-payment-mcp`) | ✅ MIT | [npm](https://www.npmjs.com/package/agent-payment-mcp), [src](./mcp-server) |
| Trade-stack MCPs (xstocks / gmx / alpaca-guard / tokenized-stock) | ✅ MIT | [examples in repo](#) |
| Starter templates | ✅ MIT | [examples/](./examples) |
| Docs site | ✅ Public | [lemoncake.xyz/docs](https://lemoncake.xyz/docs) |
| **Billing engine** (settlement, ledger, revenue routing) | 🔒 Hosted | lemoncake.xyz |
| **Dashboard** (analytics, abuse detection, payouts) | 🔒 Hosted | lemoncake.xyz |
| **Compliance** (tax, invoicing, jurisdiction reporting) | 🔒 Hosted | lemoncake.xyz |

If we ever shut down, your integration keeps working — the SDK is the only contract surface. The on-chain ledger is public anyway.

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

Restart Claude Desktop, then ask:

> **"use lemon to search Wikipedia for AI agents"**

Demo Mode runs against real Wikipedia, real FX rates, and real httpbin APIs. No credentials needed.

---

## 💳 Unlock paid services

To use Serper (Google search), Hunter.io, gBizINFO, and more:

1. Open [**lemoncake.xyz/start/v2**](https://lemoncake.xyz/start/v2)
2. Sign in with Google (Privy creates an embedded wallet — keys stay on your device)
3. Get USDC via Apple Pay / Coinbase / JPY bank transfer (built in)
4. **Sign one ERC-2612 permit** — "up to $25/day, valid 90 days". One click. No gas.
5. Copy the `LEMON_CAKE_PERMIT` blob into your MCP config:

```json
{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"],
      "env": {
        "LEMON_CAKE_PERMIT": "<paste the permit blob here>"
      }
    }
  }
}
```

After that, every API call settles **directly from your wallet to the API
provider** with no signing prompts for 90 days. LemonCake never holds your USDC.

---

## What is LemonCake?

LLM agents are getting powerful — but they still can't *pay for things* autonomously.

LemonCake solves this with **ERC-2612 permits**: a single 90-day signature that
lets an AI agent spend up to a daily cap from your wallet, directly to API
providers. The agent calls paid APIs through our MCP server, gets charged
per call in USDC, and stops automatically when the daily cap is reached.

```
You                    Agent                  Paid API
 │                       │                        │
 ├─ sign one permit ──▶  │                        │
 │   $25/day, 90 days    │                        │
 │                       ├─ call_service ───────▶ │
 │                       │   uses LEMON_CAKE_PERMIT
 │                       │                        │
 │                       │  ◀─ response + receipt ┤
 │                       │     on-chain transferFrom
```

Budget exhausted? Hard stop until tomorrow. Permit expired? Re-sign in one
click. No runaway agents, no stolen API keys, no platform middleman holding
your USDC.

---

## 🔌 Family of MCP packages

| Package | What it does |
|---|---|
| [`agent-payment-mcp`](https://www.npmjs.com/package/agent-payment-mcp) | Main entry — pay-per-call any HTTP API in the LemonCake marketplace |
| [`xstocks-mcp`](https://www.npmjs.com/package/xstocks-mcp) | Buy tokenized US stocks (AAPLx, TSLAx, …) on Solana with USDC |
| [`alpaca-guard-mcp`](https://www.npmjs.com/package/alpaca-guard-mcp) | Alpaca paper / live trading with hard daily USD cap |
| [`tokenized-stock-mcp`](https://www.npmjs.com/package/tokenized-stock-mcp) | Buy Dinari dShares with USDC |
| [`polymarket-guard-mcp`](https://www.npmjs.com/package/polymarket-guard-mcp) | Polymarket prediction markets with USDC |
| [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk) | SDK for sellers to monetize their own MCP servers |

---

## 🏗 Publish your API on LemonCake

Want to **monetize your MCP server**? Self-service registration at
[**lemoncake.xyz/sellers**](https://lemoncake.xyz/sellers):

- Enter your name, email, and Base wallet address
- Get a `serviceId` instantly
- Set your price per call (min $0.001)
- **First 1,000 calls / month are free** — Pattern 4 metering
- Above the free tier: $0.005/call default (you choose)
- USDC settles **directly to your wallet** — no platform middleman

Add billing in 3 lines:

```typescript
import { withPayment } from "@lemon-cake/mcp-sdk";

server.tool("my_premium_tool", withPayment({ price: 0.01 }, async (args) => {
  return { content: [{ type: "text", text: "result" }] };
}));
```

---

## ✨ Features

### For developers (buyers)

- ✅ **Non-custodial** — your USDC never leaves your wallet
- ✅ **One signature** — 90 days, hard daily cap, no gas
- ✅ **Demo Mode** — try without signup or credentials
- ✅ **Apple Pay / Coinbase / JPY onramp** built into `/start/v2`
- ✅ **No JWT issuance, no API key juggling** — drop the permit blob in, done

### For API providers (sellers)

- ✅ **Self-service registration** at `/sellers` — no sales call
- ✅ **USDC settles directly to your wallet** — chargeback-impossible
- ✅ **Free tier**: 1,000 calls/month free per buyer (acquisition incentive)
- ✅ **Stripe 60× cheaper** — $0.005/call vs. $0.30+ Stripe minimum
- ✅ **Global**: no clearing-bank or KYC friction; works in any country

### Infrastructure

- 🔧 Built on Base (USDC native, ~2-second blocks, $0.0001 gas)
- 🔧 Open-source MCP server (MIT license)
- 🔧 Audited (May 2026) — see [security advisories](https://github.com/evidai/agent-payment-mcp/security/advisories)
- 🔧 [JP FSA registration not required](https://lemoncake.xyz/security) — confirmed Q11 (2026-05-21)

---

## 🏗 Architecture

```
        ┌─────────────────────────────────────────────┐
        │  User wallet (Privy embedded / MetaMask)    │
        │                                             │
        │  ERC-2612 permit signature                  │
        │   ↳ spender = LemonCake marketplace addr    │
        │   ↳ value   = $25/day daily cap             │
        │   ↳ deadline= 90 days from now              │
        └────────────────────┬────────────────────────┘
                             │
                  LEMON_CAKE_PERMIT (one-time copy)
                             │
                             ▼
       ┌──────────────────────────────────────────────┐
       │  Claude / Cursor / Cline                     │
       │   ↳ MCP client                               │
       └────────────────────┬─────────────────────────┘
                             │  stdio
                             ▼
       ┌──────────────────────────────────────────────┐
       │  agent-payment-mcp (this repo)               │
       │   ↳ list_services()                          │
       │   ↳ call_service(serviceId, …)               │
       └────────────────────┬─────────────────────────┘
                             │  HTTPS
                             ▼
       ┌──────────────────────────────────────────────┐
       │  LemonCake charge API (Hono on Railway)      │
       │   ↳ POST /api/charges/permit                 │
       │   ↳ metering: 1000 free + $0.005/call paid   │
       └────────────────────┬─────────────────────────┘
                             │  permit() + transferFrom()
                             ▼
       ┌──────────────────────────────────────────────┐
       │  USDC contract on Base                       │
       │   ↳ user wallet ──→ provider wallet (direct) │
       └──────────────────────────────────────────────┘
```

LemonCake is the dotted middle box. It never holds USDC — every payment is
a direct on-chain `transferFrom(userWallet, providerWallet, amount)`.

---

## 🌍 Why this is registration-exempt

The 2026-05-21 reply from Japan's FSA Fintech Support Desk (Q11) confirmed
that a pure SDK distribution model where:

- LemonCake never touches user USDC
- LemonCake never operates the smart contract
- All payments settle directly user wallet → provider wallet

…does NOT require the "electronic payment means management" registration.

The same architecture is registration-exempt under 🇺🇸 FinCEN (2019 guidance §4.5),
🇪🇺 MiCA (non-CASP), 🇬🇧 FCA (Tech Service Provider), 🇸🇬 MAS (DPT non-applicable),
🇨🇦 FINTRAC, and 🇨🇭 FINMA. See [lemoncake.xyz/security](https://lemoncake.xyz/security).

---

## 🛡 Security

- **On-chain hard cap** — the daily cap is baked into the permit signature and enforced by the USDC contract itself. The MCP server cannot exceed it.
- **No private keys in the MCP server** — the permit blob is mathematically scope-limited.
- **Auto-revoke on expiry** — permits self-destruct after 90 days.
- **Idempotency keys required** on paid calls (no double-charges on retries).
- Audited May 2026 by [@kleosr](https://github.com/kleosr).

---

## 📄 License

MIT.
