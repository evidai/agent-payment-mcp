# agent-payment-mcp 🍋

**Give your AI agent a USDC wallet. Pay-per-call any API. One signature, 90 days, done.**

[![npm](https://img.shields.io/npm/v/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![downloads](https://img.shields.io/npm/dm/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![Glama score](https://glama.ai/mcp/servers/evidai/lemon-cake/badges/score.svg)](https://glama.ai/mcp/servers/evidai/lemon-cake)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-blue)](https://registry.modelcontextprotocol.io)
[![Non-custodial](https://img.shields.io/badge/non--custodial-USDC_stays_in_your_wallet-success)](https://lemoncake.xyz/start/v2)
[![FSA-confirmed](https://img.shields.io/badge/Japan_FSA-registration_not_required-blue)](https://lemoncake.xyz/security)

---

## ⚡ Try in 30 seconds — no signup, no API key

**1.** Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (or your Cursor / Cline MCP config):

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

**2.** Restart Claude Desktop.

**3.** Ask Claude:

> **"list the services available in lemon"**
>
> or
>
> **"use lemon to search Wikipedia for AI agents"**

That's it. **Demo Mode** runs against real Wikipedia, real FX rate, and real httpbin APIs. No credentials, no USDC, no signup.

---

## 💳 Unlock paid services — 90-second setup, no JWT, no API key

Demo Mode is fully functional but limited. To unlock **Serper (Google search), Hunter.io (verified emails), gBizINFO (JP corporate data)**, NTA invoice verification, and 20+ more:

1. Open [**lemoncake.xyz/start/v2**](https://lemoncake.xyz/start/v2?utm_source=npm)
2. Sign in with Google (Privy creates an embedded wallet — keys stay on your device)
3. Get USDC: Apple Pay / Google Pay / Coinbase / JPY bank transfer (built in, 30 sec)
4. **Sign one ERC-2612 permit** — "up to $25/day, valid 90 days". One click. No gas.
5. Copy the resulting `LEMON_CAKE_PERMIT` blob

Then your MCP config becomes:

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
provider** with no signing prompts for 90 days. LemonCake's address never
appears in the transaction path.

---

## Why ERC-2612 permit beats Pay Token JWT

We retired the old JWT-based "Pay Token" in v0.7. The current permit-based
flow is strictly better:

| | Old (Pay Token JWT) | **New (ERC-2612 permit)** |
|---|---|---|
| Signup | Required | Required only for paid services |
| Custody | LemonCake held your USDC | **You hold your USDC** |
| Signature count | Every top-up | **Once per 90 days** |
| Revoke | Dashboard → API call | Spend the daily cap, expire naturally, or revoke on-chain |
| FSA registration | Required | **Not required** (confirmed Q11) |
| Reach | Japan-friendly | Same |

Lost permit blob = bounded loss (≤ $25/day until you revoke or it expires).
The agent literally cannot spend more than the cap encoded in the on-chain
signature.

---

## What an agent can do with it

```
Agent (Claude Desktop, Cursor, Cline, any MCP client)
  │
  ├─ list_services()          → browse LemonCake API marketplace
  ├─ check_balance()          → see your USDC balance + permit expiry
  ├─ call_service(...)        → pay-per-call any HTTP API
  │   ├── demo_search         (Wikipedia, free)
  │   ├── demo_fx             (live FX rates, free)
  │   ├── demo_echo           (httpbin, free)
  │   ├── serper              (Google search, $0.005)
  │   ├── hunter              (verified emails, $0.05)
  │   ├── gbizinfo            (JP company registry, $0.01)
  │   ├── nta_invoice         (JP tax invoice verify, $0.005)
  │   └── …more added monthly
  └─ check_tax(taxid)         → verify a JP T-number (free)
```

---

## For developers building MCP servers

Want to **monetize your own MCP server**? Add USDC pay-per-call billing in 3 lines with [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk):

```typescript
import { withPayment } from "@lemon-cake/mcp-sdk";

server.tool("my_premium_tool", withPayment({ price: 0.01 }, async (args) => {
  // your existing tool logic
  return { content: [{ type: "text", text: "result" }] };
}));
```

Self-service registration at [**lemoncake.xyz/sellers**](https://lemoncake.xyz/sellers?utm_source=npm):

- Enter your name, email, and Base wallet address
- Get a `serviceId` instantly
- Set your price per call (min $0.001)
- **First 1,000 calls/month are free** — Pattern 4 metering
- Above the free tier: $0.005/call default (you choose)
- USDC settles **directly to your wallet** on every call

No Stripe setup, no KYC on your side, no platform middleman holding your revenue.

---

## Why this is FSA-compliant (and global-compliant)

The 2026-05-21 reply from Japan's FSA Fintech Support Desk (Q11) confirmed
that a pure SDK distribution model where:

- LemonCake never touches user USDC
- LemonCake never operates the smart contract
- All payments settle directly from user wallet → provider wallet

…does NOT require the "electronic payment means management" registration.

The same architecture is registration-exempt under:

| Jurisdiction | Reasoning |
|---|---|
| 🇺🇸 USA | FinCEN 2019 guidance §4.5 — non-custodial software is not a money services business |
| 🇪🇺 EU | MiCA — non-CASP (non-custodial wallet software) |
| 🇬🇧 UK | FCA — Tech Service Provider |
| 🇸🇬 Singapore | MAS — DPT non-applicable |
| 🇨🇦 Canada | FINTRAC — non-custodial MSB exemption |
| 🇨🇭 Switzerland | FINMA — non-financial intermediary |

See [lemoncake.xyz/security](https://lemoncake.xyz/security) for the full posture.

---

## Security

Audited May 2026 by [@kleosr](https://github.com/kleosr). All critical and
high-severity findings fixed in v0.7+. See
[GitHub Security Advisories](https://github.com/evidai/agent-payment-mcp/security/advisories)
for details.

Built-in protections:

- **On-chain hard cap** — agent cannot exceed the daily cap baked into the permit signature
- **No private keys in the MCP server** — permit signature is mathematically scope-limited
- **Auto-revoke on expiry** — permits self-destruct after 90 days
- Idempotency keys required on paid calls (no double-charges on retries)
- Real-time quota check on the metering API

---

## Links

| | |
|---|---|
| **Try it (no signup)** | Add the config above and ask Claude |
| **Unlock paid services** | [lemoncake.xyz/start/v2](https://lemoncake.xyz/start/v2?utm_source=npm) |
| **Publish your API** | [lemoncake.xyz/sellers](https://lemoncake.xyz/sellers?utm_source=npm) |
| **Source code** | [github.com/evidai/agent-payment-mcp](https://github.com/evidai/agent-payment-mcp) |
| **SDK for sellers** | [@lemon-cake/mcp-sdk](https://www.npmjs.com/package/@lemon-cake/mcp-sdk) |
| **MCP Registry** | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) |
| **Discord** | [#showcase in MCP Discord](https://discord.com/invite/model-context-protocol-1312302100125843476) |
| **License** | MIT |

---

## Other LemonCake MCPs (Demo Mode all work the same way)

- [**alpaca-guard-mcp**](https://www.npmjs.com/package/alpaca-guard-mcp) — Alpaca paper trading with hard USD cap
- [**xstocks-mcp**](https://www.npmjs.com/package/xstocks-mcp) — Buy tokenized stocks (AAPLx, TSLAx, etc.) on Solana with USDC
- [**tokenized-stock-mcp**](https://www.npmjs.com/package/tokenized-stock-mcp) — Buy Dinari dShares with USDC
- [**polymarket-guard-mcp**](https://www.npmjs.com/package/polymarket-guard-mcp) — Polymarket prediction markets with USDC

All built on [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk).
