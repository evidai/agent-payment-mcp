# agent-payment-mcp 🍋

**Give your AI agent a USDC wallet. Pay-per-call any API. Hard daily cap the agent can't override.**

[![npm](https://img.shields.io/npm/v/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![downloads](https://img.shields.io/npm/dm/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![Glama score](https://glama.ai/mcp/servers/evidai/lemon-cake/badges/score.svg)](https://glama.ai/mcp/servers/evidai/lemon-cake)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-blue)](https://registry.modelcontextprotocol.io)
[![FSA Q1–Q11](https://img.shields.io/badge/Japan_FSA-Q1--Q11_inquiry_completed-success)](https://lemoncake.xyz/start/v2)
[![Non-custodial v2](https://img.shields.io/badge/v2_non--custodial-preview-blueviolet)](https://lemoncake.xyz/start/v2)

> **🍋 v2 (non-custodial) is in preview.** The 2026-05-21 Japan FSA Fintech
> Support Desk ruling confirmed that LemonCake can operate **without
> electronic-payment-means-business registration** as long as we never touch
> user USDC. The new path uses ERC-2612 permit signatures (90-day, one click)
> instead of a LemonCake-issued JWT. Try it at
> [lemoncake.xyz/start/v2](https://lemoncake.xyz/start/v2). Legacy custody
> path below remains supported until migration completes.

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

That's it. **Demo Mode** runs with a mock $1.00 USDC balance against real Wikipedia, real FX rate, and real httpbin APIs. No credentials needed.

---

## 🆕 v2: Non-custodial mode (recommended, FSA-confirmed)

The new path keeps your USDC in **your own wallet**. LemonCake never sees,
holds, or moves your funds — confirmed registration-exempt by Japan's FSA
Fintech Support Desk (Q11, 2026-05-21).

How it works:

1. Visit [**lemoncake.xyz/start/v2**](https://lemoncake.xyz/start/v2)
2. Sign in with Google (Privy creates an embedded wallet — keys stay on your device)
3. Top up USDC via credit card (Stripe / Coinbase on-ramp)
4. **Sign one ERC-2612 permit** ("up to $25/day, valid 90 days") — one click
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

> ⚖️ **Why this matters legally.** The 2026-05-21 FSA reply (Q11) stated
> that if LemonCake never touches USDC and never operates the smart
> contract, the "electronic payment means management" registration is
> NOT required. The pure SDK distribution model is also confirmed NOT
> to constitute 媒介 (brokerage). See
> [docs/MIGRATION_NON_CUSTODIAL_v2.md](https://github.com/evidai/agent-payment-mcp/blob/main/docs/MIGRATION_NON_CUSTODIAL_v2.md)
> for the full migration plan.

---

## Unlock paid services (free signup) — legacy custody mode

> ℹ️ The legacy path below stays supported for backwards compatibility,
> but new buyers should use **v2 (non-custodial)** above.

Demo Mode is real but limited. To use **Serper (Google search), Hunter.io (verified emails), gBizINFO (JP corporate data), NTA invoice verification**, and more — get a free Pay Token:

1. Sign up at [**lemoncake.xyz/start**](https://lemoncake.xyz/start?utm_source=npm) (Google login, 30 sec)
2. Issue a Pay Token from the dashboard
3. Add it to the MCP config:

```json
{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"],
      "env": {
        "LEMON_CAKE_PAY_TOKEN": "eyJ...",
        "LEMON_CAKE_BUYER_JWT":  "eyJ..."
      }
    }
  }
}
```

USDC top-up minimum: $5. Per-call pricing: $0.005–$0.05 depending on service.

---

## Why "Pay Token"?

A Pay Token is a **scoped JWT spend credential**:

- 💰 **Hard daily cap** — agent literally cannot exceed it (enforced server-side, not in the JWT body the agent can see).
- 🔪 **Kill switch** — revoke any token instantly via dashboard. Already-issued tokens stop working in <1 second.
- 🎯 **Scope-limited** — token can be `ALL services` or a single service ID.
- 🧾 **x402-compatible receipts** — every charge produces a verifiable on-chain receipt.

This is the **opposite** of giving your agent an API key. Lost key = stolen wallet. Lost Pay Token = bounded loss + instant revoke.

---

## What an agent can do with it

```
Agent (Claude Desktop, Cursor, Cline, any MCP client)
  │
  ├─ list_services()          → browse LemonCake API marketplace
  ├─ check_balance()          → see remaining USDC
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

Buyer funds their USDC wallet → agent invokes your tool → LemonCake handles billing → you collect. No Stripe setup, no KYC on your side.

---

## Security

Audited May 2026 by [@kleosr](https://github.com/kleosr). All critical and high-severity findings fixed in v0.7+. See [GitHub Security Advisories](https://github.com/evidai/agent-payment-mcp/security/advisories) for details.

Built-in protections:
- Server-side hard spend cap (agent cannot raise from inside a tool call)
- Kill switch (instant token revocation)
- Timing-safe HMAC signature verification on all webhooks
- Idempotency keys required on paid calls (no double-charges on retries)
- Buyer suspension enforced in auth middleware

---

## Links

| | |
|---|---|
| **Dashboard** | [lemoncake.xyz/start](https://lemoncake.xyz/start?utm_source=npm) |
| **Docs** | [github.com/evidai/agent-payment-mcp](https://github.com/evidai/agent-payment-mcp) |
| **SDK for sellers** | [@lemon-cake/mcp-sdk](https://www.npmjs.com/package/@lemon-cake/mcp-sdk) |
| **MCP Registry** | [registry.modelcontextprotocol.io](https://registry.modelcontextprotocol.io) |
| **Discord** | [#showcase in MCP Discord](https://discord.com/invite/model-context-protocol-1312302100125843476) |
| **License** | MIT |

---

## Other LemonCake MCPs (Demo Mode all work the same way)

- [**alpaca-guard-mcp**](https://www.npmjs.com/package/alpaca-guard-mcp) — Alpaca paper trading with hard USD cap
- [**xstocks-mcp**](https://www.npmjs.com/package/xstocks-mcp) — Buy tokenized stocks (AAPLx, TSLAx, etc.) on Solana with USDC
- [**tokenized-stock-mcp**](https://www.npmjs.com/package/tokenized-stock-mcp) — Buy Dinari dShares with USDC

All built on [`@lemon-cake/mcp-sdk`](https://www.npmjs.com/package/@lemon-cake/mcp-sdk).
