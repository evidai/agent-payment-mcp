# agent-payment-mcp 🍋

**Give your AI agent a USDC wallet. Pay-per-call any API. Hard daily cap the agent can't override.**

[![npm](https://img.shields.io/npm/v/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![downloads](https://img.shields.io/npm/dm/agent-payment-mcp)](https://www.npmjs.com/package/agent-payment-mcp)
[![Glama score](https://glama.ai/mcp/servers/evidai/lemon-cake/badges/score.svg)](https://glama.ai/mcp/servers/evidai/lemon-cake)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-blue)](https://registry.modelcontextprotocol.io)

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

## Unlock paid services (free signup)

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
