# 🪙 tokenized-stock-mcp

> **MCP server to buy/sell tokenized US stocks (Dinari `dShares`) paying directly in USDC. Hard daily USD cap enforced server-side. Pay Token pass-through model — LemonCake never custodies your USDC. Sandbox is the default.**

[![npm version](https://img.shields.io/npm/v/tokenized-stock-mcp)](https://www.npmjs.com/package/tokenized-stock-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)

```bash
npx -y tokenized-stock-mcp
```

---

## What this is

You hand an AI agent the ability to **buy real US stocks paid in USDC** — tokenized 1:1 via [Dinari](https://dinari.com/dshares) — with a hard daily USD cap that the agent literally cannot override. Sibling to [`pay-per-call-mcp`](https://www.npmjs.com/package/pay-per-call-mcp) (API pay-per-call) and [`alpaca-guard-mcp`](https://www.npmjs.com/package/alpaca-guard-mcp) (traditional broker guard).

- **Pay Token pass-through model**: your wallet signs the buy; LemonCake does not custody your USDC. Cleaner regulatory profile, no money-transmitter exposure.
- **Flat $0.10 per trade** LemonCake fee. Industry-normal for wrapper/aggregator (Plaid / Stripe Connect / Lightspeed pricing band).
- **Sandbox default**. Real-money orders require explicit `TOKENIZED_STOCK_ALLOW_LIVE=yes-i-understand` opt-in.

---

## Quickstart

### 1. Install (Claude Desktop / Cursor / Cline)

```json
{
  "mcpServers": {
    "tokenized-stock": {
      "command": "npx",
      "args":    ["-y", "tokenized-stock-mcp"],
      "env": {
        "DINARI_API_KEY_ID":     "...",
        "DINARI_API_SECRET_KEY": "...",
        "DINARI_ACCOUNT_ID":     "...",
        "DINARI_ENTITY_ID":      "...",
        "DINARI_SANDBOX":        "true"
      }
    }
  }
}
```

Apply for Dinari partner access at [partners.dinari.com](https://partners.dinari.com). Sandbox access is typically granted on signup; live access requires KYB approval (~1-2 weeks). After signup you'll receive:
- **API key** (auth, treat like a password)
- **Account ID** (your trading account UUID)
- **Entity ID** (your KYB'd legal entity UUID)

All four credential values (API Key ID + API Secret Key + Account ID + Entity ID) are required to place orders. Without them, the MCP still loads and tools like `setup` / `list_supported_stocks` / `guard_set_limit` / `guard_status` work — you can inspect everything before going live.

### 2. Set your daily cap

> Set my tokenized-stock daily limit to $50.

→ Agent calls `guard_set_limit({ dailyLimitUsd: 50 })`. The first-ever default is **$25** as a safety floor.

### 3. Let the agent buy stocks

> Buy $20 of NVDA via tokenized-stock-mcp into wallet 0xabc...

→ Agent calls `guarded_buy_stock({ symbol: "NVDA.d", amountUsd: 20, recipientWallet: "0xabc..." })`. The guard preflights against your $50 cap, the order goes to Dinari, the NVDA dShare token lands in your wallet.

If the agent tries `amountUsd: 1000`:

```json
{
  "allowed": false,
  "status": "BUDGET_EXCEEDED",
  "hint": "This trade would cost ~$1000.00 but only $50.00 remains under today's $50.00 cap. Either (a) wait until tomorrow (UTC), (b) ask the human operator to call guard_set_limit to raise the cap, or (c) split into smaller buys. The agent cannot override this from inside a tool call."
}
```

---

## Tools

| Tool                   | Read-only? | Notes |
| ---------------------- | :--------: | ----- |
| `setup`                | ✅ | Env state, mode, current cap, fee policy, ledger location |
| `guard_status`         | ✅ | Daily limit / used / remaining / last 10 trades |
| `guard_set_limit`      | ❌ | Set the daily USD cap. Idempotent. |
| `list_supported_stocks` | ✅ | dShare tickers tradable on Dinari. Falls back to a 10-ticker sample without credentials. |
| `get_quote`            | ✅ | Latest bid/ask/mid for a dShare symbol |
| `guarded_buy_stock`    | ❌ | Buy a dShare for a USD amount; preflighted against the cap |
| `guarded_sell_stock`   | ❌ | Sell dShare quantity for USDC; preflighted on notional |

---

## Configuration

| Env var                       | Required | Default | Notes |
| ----------------------------- | :------: | ------- | ----- |
| `DINARI_API_KEY_ID`           | ✅       | —       | Public key identifier — from partners.dinari.com dashboard |
| `DINARI_API_SECRET_KEY`       | ✅       | —       | Auth secret — paired with `DINARI_API_KEY_ID` |
| `DINARI_ACCOUNT_ID`           | ✅ (orders) | —    | Trading account UUID issued at onboarding |
| `DINARI_ENTITY_ID`            | ✅ (orders) | —    | KYB'd legal entity UUID |
| `DINARI_SANDBOX`              | —        | `true`  | Set to `false` for real-money orders (still requires `TOKENIZED_STOCK_ALLOW_LIVE`) |
| `TOKENIZED_STOCK_ALLOW_LIVE`  | live only | —      | Must literally be `yes-i-understand` to enable real-money orders |
| `TOKENIZED_STOCK_LEDGER_DIR`  | —        | `~/.tokenized-stock` | Where `cap.json` lives. Useful for tests / multiple ledgers. |
| `LEMONCAKE_STOCK_FEE_USD`     | —        | `0.10`  | LemonCake fee per trade. Configurable. |

---

## Pricing

| Component                | Amount on $50 buy | Amount on $1,000 buy |
| ------------------------ | ----------------: | -------------------: |
| Stock notional           | $50.00            | $1,000.00            |
| Dinari issuance fee (L2 USDC: $0.20 + 0.50%) | $0.45 | $5.20 |
| LemonCake fee (flat)     | **$0.10**         | **$0.10**            |
| **Total user pays**      | **$50.55**        | **$1,005.30**        |
| Effective bps on notional (LemonCake) | 20 bps | 1 bp                |

Dinari's fees are paid to Dinari (the regulated issuer); LemonCake's $0.10 covers our daily-cap guard, ledger persistence, and the MCP integration. Industry-normal for wrapper services (Plaid: $0.30-$1/call, Stripe Connect: 0.25-0.75%).

See [the feasibility research doc](https://github.com/evidai/lemon-cake/blob/main/docs/research/2026-05-11-tokenized-stocks-feasibility.md) for the full pricing analysis.

---

## Architecture

```
┌──────────────────────────────────┐
│  Agent (Claude / Cursor / Cline) │
└────────────┬─────────────────────┘
             │ tool: guarded_buy_stock(symbol, amountUsd, recipientWallet)
             ▼
┌────────────────────────────────────────────────────────────────────┐
│  tokenized-stock-mcp                                                 │
│                                                                      │
│  1. Preflight against ~/.tokenized-stock/cap.json                    │
│  2. If !allowed → refuse with BUDGET_EXCEEDED (no Dinari call)       │
│  3. If allowed → POST Dinari /v1/orders (sandbox or live)            │
│  4. On success → record charge in ledger + emit x402 receipt         │
│  5. User's wallet receives the dShare (e.g. AAPL.d) token            │
└──────────────────┬──────────────────┬────────────────────────────────┘
                   │                  │
                   ▼                  ▼
┌──────────────────────┐   ┌──────────────────────────┐
│ Dinari REST (TS SDK) │   │  ~/.tokenized-stock/cap.json │
│ Swiss-regulated 1:1  │   │  { dailyLimitUsd,            │
│ stock issuance       │   │    todayUsedUsd, history[] } │
└──────────────────────┘   └──────────────────────────────┘
```

Read-only tools (`list_supported_stocks`, `get_quote`, `guard_status`) bypass the guard — they don't spend.

---

## Geographic availability

Dinari sells tokenized US equities to non-US residents. Supported jurisdictions include **Japan ✅**, most of Asia, LATAM, Africa. Excluded: US, UK, Canada, Australia, EU/EEA, and OFAC-sanctioned jurisdictions. Full restrictions: [Dinari's terms](https://dinari.com/legal).

---

## Status & roadmap

| Phase | Status | Notes |
| ----- | ------ | ----- |
| Phase A: local-ledger guard + Dinari sandbox | ✅ shipped v0.1.0 | This release |
| Phase B: LemonCake Pay Token preflight integration | ⏳ gated | [issue #4](https://github.com/evidai/lemon-cake/issues/4) — switch from local ledger to remote |
| Phase C: live trading default-on after partner KYB approval | ⏳ | Pending Dinari partner approval |
| Phase D: Multi-provider — add Backed/xStocks (Solana SPL) | ⏳ | v0.2 |
| Phase E: Listed on Anthropic Connectors Directory | ⏳ | Same submission flow as pay-per-call-mcp |

---

## License

MIT. Source at [github.com/evidai/lemon-cake/tree/main/tokenized-stock-mcp](https://github.com/evidai/lemon-cake/tree/main/tokenized-stock-mcp).

## Related

- [pay-per-call-mcp](https://www.npmjs.com/package/pay-per-call-mcp) — sibling: USDC for any HTTP API
- [alpaca-guard-mcp](https://www.npmjs.com/package/alpaca-guard-mcp) — sibling: daily-cap guard for traditional Alpaca trading
- [Dinari Finance](https://dinari.com/) — the upstream regulated issuer
- [LemonCake](https://www.lemoncake.xyz/start) — interactive playground & docs
- [Tokenized stocks feasibility research](https://github.com/evidai/lemon-cake/blob/main/docs/research/2026-05-11-tokenized-stocks-feasibility.md) — the doc that informed this implementation
