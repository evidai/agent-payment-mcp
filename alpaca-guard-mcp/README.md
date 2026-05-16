# 🛡️ alpaca-guard-mcp

> **MCP server that wraps the [Alpaca trading API](https://alpaca.markets/) with a hard daily USD cap. The guard is enforced server-side from a local JSON ledger, so an over-eager AI agent literally cannot exceed it. Paper trading by default. Live trading blocked unless you explicitly opt in.**

[![npm version](https://img.shields.io/npm/v/alpaca-guard-mcp)](https://www.npmjs.com/package/alpaca-guard-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)

```bash
npx -y alpaca-guard-mcp
```

---

## 30-second pitch

[Alpaca's official MCP](https://github.com/alpacahq/alpaca-mcp-server) exposes the Alpaca trading API directly to LLMs. Powerful, but the single biggest objection from teams shipping agentic trading is:

> "What if the AI rage-buys $50k of meme stocks at 3am because the prompt got injected?"

Alpaca's MCP doesn't ship agent-level spending controls (correctly so — that's not Alpaca's job). `alpaca-guard-mcp` does:

- Preflight every order against a **daily USD cap** stored in `~/.alpaca-guard/cap.json`.
- Refuse the call (with a structured hint the LLM can read) if the trade would breach the cap.
- Record the charge on success; the cap survives across MCP server restarts and rolls over at UTC midnight.
- **Paper trading is the default.** Live trading is blocked unless the operator sets `ALPACA_GUARD_ALLOW_LIVE=yes-i-understand`.

There is no agent-side override. The cap is a circuit breaker, not a suggestion.

---

## Quickstart

### 1. Install (Claude Desktop / Cursor / Cline)

Add to your MCP client config (`claude_desktop_config.json` or equivalent):

```json
{
  "mcpServers": {
    "alpaca-guard": {
      "command": "npx",
      "args":    ["-y", "alpaca-guard-mcp"],
      "env": {
        "ALPACA_API_KEY":     "PK...",
        "ALPACA_SECRET_KEY":  "...",
        "ALPACA_PAPER_TRADE": "true"
      }
    }
  }
}
```

Restart your MCP client. The 🔨 tools icon should show `alpaca-guard-mcp` tools.

Free Alpaca paper-trading account: https://app.alpaca.markets/paper/dashboard/overview

### 2. Set your daily cap

In your MCP client, ask:

> Set my alpaca-guard daily limit to $50.

The agent will call `guard_set_limit({ dailyLimitUsd: 50 })`. The first-ever default is **$10** as a safety floor.

### 3. Let the agent trade — and watch it refuse the dumb ones

> Buy 1000 NVDA at limit $900.

The agent will call `guarded_place_order`. The guard will preflight: notional = 1000 × $900 = $900,000, remaining = $50, **refused with `BUDGET_EXCEEDED`**.

The hint the agent sees back:

```
This order would cost ~$900000.00 but only $50.00 remains under today's
$50.00 cap. Either (a) wait until tomorrow (UTC), (b) call guard_set_limit
to raise the cap (you decide, not the agent), or (c) split the order into
smaller qty. The agent cannot override this from inside a tool call.
```

---

## Tools

| Tool                   | Read-only? | Notes |
| ---------------------- | :--------: | ----- |
| `setup`                | ✅ | Env state, mode, current cap, ledger location |
| `guard_status`         | ✅ | Daily limit / used / remaining / recent 10 orders |
| `guard_set_limit`      | ❌ | Set the daily USD cap. Idempotent. |
| `get_account`          | ✅ | Alpaca account snapshot |
| `get_positions`        | ✅ | Current open positions |
| `get_latest_quote`     | ✅ | Bid / ask / mid for a symbol |
| `guarded_place_order`  | ❌ | Place an order; preflighted against the cap |
| `guarded_close_position` | ❌ | Close a position; preflighted on notional |

---

## Configuration

| Env var                       | Required | Default | Notes |
| ----------------------------- | :------: | ------- | ----- |
| `ALPACA_API_KEY`              | ✅       | —       | From Alpaca dashboard |
| `ALPACA_SECRET_KEY`           | ✅       | —       | From Alpaca dashboard |
| `ALPACA_PAPER_TRADE`          | —        | `true`  | Set to `false` for live trading (still requires `ALPACA_GUARD_ALLOW_LIVE`) |
| `ALPACA_GUARD_ALLOW_LIVE`     | live only | —      | Must literally be `yes-i-understand` to enable real-money orders |
| `ALPACA_GUARD_LEDGER_DIR`     | —        | `~/.alpaca-guard` | Where `cap.json` lives. Useful for tests / multiple ledgers. |
| `LEMON_CAKE_PAY_TOKEN`        | —        | —       | Currently unused (v0.1 local-ledger mode). Future: switch the guard to LemonCake's Pay Token preflight when the upstream API ships it. See [issue #4](https://github.com/evidai/lemon-cake/issues/4). |

---

## Worked example (end-to-end via stdio smoke test)

Without any Alpaca credentials, the guard still works for the preflight stage. From the test in this repo:

```bash
$ ALPACA_GUARD_LEDGER_DIR=/tmp/alpaca-guard-test \
  echo '{"jsonrpc":"2.0",...,"method":"tools/call","params":{"name":"guarded_place_order",
        "arguments":{"symbol":"NVDA","qty":1000,"side":"buy","type":"limit","limitPrice":900}}}' \
  | node dist/index.js
```

Returns:

```json
{
  "allowed":          false,
  "status":           "BUDGET_EXCEEDED",
  "tradeNotionalUsd": 900000,
  "remainingUsd":     10,
  "limitUsd":         10,
  "hint":             "This order would cost ~$900000.00 but only $10.00 remains ..."
}
```

That preflight ran before any Alpaca call — and would refuse the order **even on a paper account**. With paper credentials added and a sensible cap, the same `guarded_place_order` against a 1-share order at $25 will succeed and record `$25` against the daily ledger.

---

## How the guard is composed (architecture)

```
┌──────────────────────────────────┐
│  Agent (Claude / Cursor / Cline) │
└────────────┬─────────────────────┘
             │ tool: guarded_place_order(symbol, qty, side, type, limitPrice?, tif?)
             ▼
┌────────────────────────────────────────────────────────────────────┐
│  alpaca-guard-mcp                                                   │
│                                                                     │
│  1. Resolve effective price (limit_input OR get_latest_quote)       │
│  2. Preflight against ~/.alpaca-guard/cap.json                      │
│  3. If !allowed → refuse with BUDGET_EXCEEDED (no Alpaca call)      │
│  4. If allowed → forward to Alpaca REST /v2/orders                  │
│  5. On success → record charge in ledger (cap.json + history)       │
│  6. Return Alpaca order + x402-shaped receipt                       │
└──────────────────┬──────────────────┬──────────────────────────────┘
                   │                  │
                   ▼                  ▼
┌──────────────────────┐   ┌──────────────────────────┐
│ Alpaca REST          │   │  ~/.alpaca-guard/cap.json │
│ (paper or live)      │   │  { dailyLimitUsd,         │
└──────────────────────┘   │    todayUsedUsd,          │
                           │    history[] }            │
                           └──────────────────────────┘
```

Read-only tools (`get_account`, `get_positions`, `get_latest_quote`) bypass the guard — they don't spend.

---

## Why the cap is local-file rather than LemonCake API (today)

`alpaca-guard-mcp` is built by the same team as [agent-payment-mcp](https://www.npmjs.com/package/agent-payment-mcp) at [lemoncake.xyz](https://www.lemoncake.xyz/start). The eventual goal is for the guard to live on LemonCake's Pay Token preflight endpoint — same daily cap mechanic, but server-side and shared across MCP clients.

That endpoint doesn't exist yet (see [issue #4](https://github.com/evidai/lemon-cake/issues/4)). Until it does, the local ledger is the right shape: zero network dependency, survives restarts, simple to inspect.

When the LemonCake API ships, `LEMON_CAKE_PAY_TOKEN` will be honored: if set, the guard switches to remote preflight. The tool surface stays identical.

---

## Status & roadmap

| Phase | Status | Notes |
| ----- | ------ | ----- |
| Phase A: local-ledger guard + paper trading | ✅ shipped v0.1.0 | This release |
| Phase B: LemonCake Pay Token integration | ⏳ gated | [issue #4](https://github.com/evidai/lemon-cake/issues/4) |
| Phase C: KYA tier multi-cap (daily + weekly + per-symbol) | ⏳ | After Phase B |
| Phase D: Listed on Anthropic Connectors Directory | ⏳ | Same submission flow as agent-payment-mcp |

---

## License

MIT. Source at [github.com/evidai/lemon-cake/tree/main/alpaca-guard-mcp](https://github.com/evidai/lemon-cake/tree/main/alpaca-guard-mcp).

## Related

- [Alpaca MCP server v2](https://github.com/alpacahq/alpaca-mcp-server) — the upstream this guard wraps (logically; we talk directly to Alpaca REST so we don't depend on it at runtime)
- [agent-payment-mcp](https://www.npmjs.com/package/agent-payment-mcp) — sibling MCP from the same team, where Pay Tokens originate
- [LemonCake](https://www.lemoncake.xyz/start) — interactive playground & docs
