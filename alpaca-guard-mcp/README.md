# 🛡️ alpaca-guard-mcp

> **MCP server that wraps the official [Alpaca MCP server](https://github.com/alpacahq/alpaca-mcp-server) with a [LemonCake Pay Token](https://lemoncake.xyz/start) spending guard. Pre-flight every order against a hard USDC cap; refuse anything that would exceed it.**

**Status**: design + scaffolding only. Implementation gated on positive signal from Alpaca team (LinkedIn DM to Satoshi Ido + email to Claudiu Tiganetea outbound 2026-05-11). Do not publish to npm yet.

---

## Why

Alpaca's MCP v2 exposes the trading API directly to LLMs. Powerful, but the biggest objection from teams shipping agentic trading is one specific failure mode:

> "What if the AI rage-buys $50k of meme stocks at 3am because the prompt got injected?"

Alpaca's MCP doesn't ship agent-level spending controls (correctly so — that's not Alpaca's job). LemonCake's Pay Token model *is* purpose-built for this:

- A Pay Token is a JWT with `limitUsdc` baked in.
- The limit is enforced server-side at LemonCake — the agent literally cannot exceed it.
- KYA (Know-Your-Agent) tier limits add daily / weekly / per-service caps on top.
- Idempotency keys prevent double-debit on retries.

`alpaca-guard-mcp` is the bridge: it presents an Alpaca-shaped tool surface to the agent, intercepts the write operations, runs a pre-flight check against the Pay Token's remaining balance, and only forwards to Alpaca if the trade fits.

---

## Architecture

```
┌────────────────────────┐
│  Agent (Claude / Cursor) │
└────────────┬───────────┘
             │  tool call: guarded_place_order(symbol="TSLA", qty=10, …)
             ▼
┌────────────────────────────────────────────────────────────────┐
│                    alpaca-guard-mcp                              │
│                                                                  │
│  1. Resolve trade USD value (price * qty * direction)            │
│  2. POST LemonCake /api/pay-tokens/<id>/preflight                │
│       → returns { allowed, remainingUsdc, dailyUsedUsdc, ... }   │
│  3. If !allowed → return { status: BUDGET_EXCEEDED, hint, ... }  │
│     (never touches Alpaca)                                        │
│  4. If allowed → forward to Alpaca MCP                           │
│  5. On Alpaca success → POST LemonCake /charges                  │
│       (idempotent against the Alpaca order_id)                    │
│  6. Return Alpaca's response + x402-compatible receipt           │
└────────────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────┐    ┌────────────────────────┐
│   Alpaca MCP server    │    │   LemonCake API        │
│   (alpacahq/...)       │    │   (preflight + charge) │
└────────────────────────┘    └────────────────────────┘
```

Key design choice: **alpaca-guard-mcp does NOT replace Alpaca MCP**. It composes with it. Read-only tools (positions, market data, account) pass through unchanged. Only write/spend tools get the pre-flight guard.

---

## Tool surface (planned)

### Guarded (pre-flight check before forwarding to Alpaca)

| Tool                       | Notes                                                          |
| -------------------------- | -------------------------------------------------------------- |
| `guarded_place_order`      | The big one. Computes notional, pre-flights, charges on fill.  |
| `guarded_close_position`   | Notional from current price + qty. Refuse if would re-buy > cap. |

### Pass-through to Alpaca (read-only, no spend)

| Tool                  | Notes                          |
| --------------------- | ------------------------------ |
| `get_account`         | Account info (balance, equity) |
| `get_positions`       | Current positions              |
| `get_orders`          | Open + historical orders       |
| `get_market_data`     | Bars / quotes / trades         |
| `cancel_order`        | Refunds the Pay Token charge if order was unfilled |

### LemonCake-specific

| Tool                  | Notes                                                 |
| --------------------- | ----------------------------------------------------- |
| `get_pay_token_status` | Current limit / used / remaining USDC / KYA tier      |
| `setup`               | First-run guide; explains BYOK + Pay Token requirement |

---

## Configuration

`alpaca-guard-mcp` requires both an Alpaca key (BYOK, like Alpaca's own MCP) AND a LemonCake Pay Token:

```json
{
  "mcpServers": {
    "alpaca-guard": {
      "command": "npx",
      "args": ["-y", "alpaca-guard-mcp"],
      "env": {
        "ALPACA_API_KEY":         "PK...",
        "ALPACA_SECRET_KEY":      "...",
        "ALPACA_PAPER_TRADE":     "true",
        "LEMON_CAKE_PAY_TOKEN":   "eyJhbGci..."
      }
    }
  }
}
```

Note: the user still brings their own Alpaca key. We don't hold it. We just enforce the spending cap on top.

---

## Worked example

Pay Token: `limitUsdc=$1000`, `used=$847`.

Agent calls `guarded_place_order(symbol="NVDA", qty=5, side="buy", type="market")`.

1. We resolve current NVDA market price via `get_market_data` (cheap, ~10ms).
2. Notional = 5 × $920 = $4,600.
3. Pre-flight: `$4,600 > $1,000 - $847 = $153 remaining`. **Refuse.**

Response to the agent:

```json
{
  "status": "BUDGET_EXCEEDED",
  "tradeNotionalUsdc": "4600.00",
  "remainingUsdc":     "153.00",
  "dailyUsedUsdc":     "847.00",
  "hint": "This order would cost ~$4600 USD; only $153 remains under the current Pay Token's limit. Either (a) close existing positions to free up cap, (b) split the order into smaller qty, or (c) ask the user to issue a larger Pay Token. Do NOT bypass this — there is no override path from the agent side.",
  "x402Receipt": null
}
```

Note the explicit "**there is no override path from the agent side**" — written for the LLM to read and avoid reasoning its way around the guard.

If approved, the order is forwarded to Alpaca, the order ID is used as the `idempotencyKey` for the LemonCake charge, and the response includes a real `x402Receipt`.

---

## Why this is interesting beyond Alpaca

This pattern (`guard-mcp` style wrapper) generalises to any MCP that touches a real-world spending action: payments APIs (Stripe), cloud (AWS), agent compute (E2B), email (Resend), etc. `alpaca-guard-mcp` is the first concrete proof.

If Alpaca-side adoption goes well, expect:

- `aws-guard-mcp` — pre-flight against monthly AWS spend cap
- `stripe-guard-mcp` — pre-flight against per-transaction cap
- `sendgrid-guard-mcp` — daily volume cap

---

## Status & roadmap

| Phase | Status | Notes |
| ----- | ------ | ----- |
| Design doc          | ✅ this file | |
| Scaffolding         | ✅ src/* skeletons | |
| BD outreach to Alpaca | ✅ sent 2026-05-11 (Gmail draft id `r349959950295789582`, LinkedIn DM to Satoshi Ido) | |
| Implementation      | ⏳ gated on Alpaca response or +5 day no-reply (whichever first) | |
| First publish to npm | ⏳ after impl + manual smoke test on paper trading account | |
| Listed on Glama / awesome-mcp | ⏳ after at least one external user reports it works | |

If Alpaca returns positive signal → fast-track impl (3-5 days).
If +5 day silence → ship anyway as MIT under our org, mention in the next Qiita/Zenn article.

---

## License

MIT (planned). Source code lives at `adhunt-pro/alpaca-guard-mcp/`.

## Related

- [Alpaca MCP server v2](https://github.com/alpacahq/alpaca-mcp-server) — the upstream we wrap
- [pay-per-call-mcp](https://www.npmjs.com/package/pay-per-call-mcp) — the LemonCake MCP that defines Pay Tokens
- [LemonCake /start](https://www.lemoncake.xyz/start) — interactive playground & docs
- [GitHub issue #4](https://github.com/evidai/lemon-cake/issues/4) — Phase B (on-chain x402 auto-pay) which this server foreshadows
