# 🟣 xstocks-mcp

> **MCP server to buy/sell tokenized US stocks ([xStocks](https://backed.fi/) by Backed Finance) on Solana, paying directly in USDC via [Jupiter DEX](https://jup.ag/). Daily USD cap guard built in. Dry-run by default — real-money swaps require explicit opt-in.**

[![npm version](https://img.shields.io/npm/v/xstocks-mcp)](https://www.npmjs.com/package/xstocks-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![FSA Q1–Q11](https://img.shields.io/badge/Japan_FSA-Q1--Q11_inquiry_completed-success)](https://lemoncake.xyz/security)
[![Non-custodial](https://img.shields.io/badge/architecture-non--custodial-blueviolet)](https://lemoncake.xyz/start/v2)
[![pricing](https://img.shields.io/badge/pricing-no_monthly_fee-fffd43)](https://lemoncake.xyz/pricing)

> 💰 **No monthly fee. Pay 5% only when your API earns. 3,000 calls free. MPP / Tempo interop.** [See pricing →](https://lemoncake.xyz/pricing)
>
> **Pro tier ($50/mo):** set `LEMONCAKE_STOCK_FEE_USD=0.005` to apply the Pro per-swap fee (default flat $0.10). The env var override is built-in; no code change required.

> 🍋 **Part of the LemonCake suite.** Japan FSA Q1–Q11 inquiry completed
> (2026-05): "ソフトウェアの開発・配布のみ" の SDK 配布モデルは
> 暗号資産・有価証券売買への利用があっても直ちに媒介と評価される
> 可能性は低いとの見解を受領済み。USDC はユーザー自身のウォレットから
> Jupiter DEX へ直接 swap され、LemonCake のアドレスを経由しません。
> See [LemonCake security posture](https://lemoncake.xyz/security).

```bash
npx -y xstocks-mcp
```

---

## What this is

You give your AI agent the ability to **buy real US stocks paying in USDC** — fully on-chain on Solana, via Backed's `xStocks` (1:1-backed regulated tokenized equities) routed through Jupiter DEX. A hard daily USD cap in `~/.xstocks/cap.json` survives MCP restarts and the agent literally cannot exceed it.

- ✅ **No broker account needed** — pure on-chain
- ✅ **No partnership / KYB wait** — Jupiter is public, xStocks are public mints
- ✅ **Production-ready today** (Solana mainnet)
- ✅ **Non-custodial**: your own Solana wallet signs the swap; LemonCake never holds USDC
- ✅ **Sibling MCPs**: works alongside `agent-payment-mcp` (USDC for APIs), `alpaca-guard-mcp` (Alpaca brokerage guard), `tokenized-stock-mcp` (Dinari dShares)

---

## Quickstart

### 1. Install

```json
{
  "mcpServers": {
    "xstocks": {
      "command": "npx",
      "args":    ["-y", "xstocks-mcp"],
      "env": {
        "SOLANA_WALLET_PRIVATE_KEY": "<<<your base58 private key (Phantom export) — OR keep empty for dry-run>>>",
        "XSTOCKS_ALLOW_LIVE":        "yes-i-understand",
        "SOLANA_RPC_URL":            "https://api.mainnet-beta.solana.com"
      }
    }
  }
}
```

Leave both `SOLANA_WALLET_PRIVATE_KEY` and `XSTOCKS_ALLOW_LIVE` unset → server stays in **dry-run mode** (all reads work, no swap is sent).

### 2. Fund your wallet

- **USDC** on Solana mainnet (mint `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`) — the amount you want to spend on stocks
- **~0.01 SOL (~$2)** for transaction gas

Best UX: use Phantom or Solflare, fund via Coinbase / Kraken / on-ramp service.

### 3. Set the daily cap

> Set my xstocks daily limit to $25.

→ Agent calls `guard_set_limit({ dailyLimitUsd: 25 })`. The first-ever default is $25 as a safety floor.

### 4. Let the agent trade

> Buy $5 of AAPL via xstocks.

→ Agent calls `guarded_buy_stock({ symbol: "AAPL", amountUsd: 5 })`. The guard preflights against your cap + Jupiter quote, and only if everything passes does the swap go live.

If the agent tries `amountUsd: 1000`:

```json
{
  "allowed": false,
  "status": "BUDGET_EXCEEDED",
  "hint": "This swap would cost ~$1000.00 but only $25.00 remains under today's $25.00 cap. ..."
}
```

---

## Tools

| Tool                  | Read-only? | Notes |
| --------------------- | :--------: | ----- |
| `setup`               | ✅ | Env state, mode (live / dry-run), cap status, fee policy |
| `wallet_status`       | ✅ | Public key, SOL balance (gas), USDC balance |
| `guard_status`        | ✅ | Daily limit / used / remaining / lifetime swaps / recent 10 |
| `guard_set_limit`     | ❌ | Set the daily USD cap |
| `find_xstock`         | ✅ | Resolve ticker → verified Backed mint (filters out pump.fun scams) |
| `get_quote`           | ✅ | Jupiter quote for USDC → xStock, with price-impact safety check |
| `guarded_buy_stock`   | ❌ | Preflight + Jupiter swap. Dry-run unless `XSTOCKS_ALLOW_LIVE=yes-i-understand` |

---

## Configuration

| Env var                       | Required | Default | Notes |
| ----------------------------- | :------: | ------- | ----- |
| `SOLANA_WALLET_PRIVATE_KEY`   | live only | —      | Base58 (Phantom/Solflare export) or `[u8;64]` JSON (Solana CLI keypair). 64 raw bytes. |
| `XSTOCKS_ALLOW_LIVE`          | live only | —      | Must literally be `yes-i-understand` |
| `SOLANA_RPC_URL`              | —        | `https://api.mainnet-beta.solana.com` | Use Helius / QuickNode for better reliability |
| `JUPITER_API_BASE`            | —        | `https://lite-api.jup.ag` | Override for higher rate limits |
| `XSTOCKS_LEDGER_DIR`          | —        | `~/.xstocks` | Where `cap.json` lives |
| `XSTOCKS_MAX_PRICE_IMPACT_PCT`| —        | `2`     | Refuse swaps where price impact exceeds this % |
| `LEMONCAKE_STOCK_FEE_USD`     | —        | `0.10`  | LemonCake fee per trade |

---

## How verification works

Jupiter's token search returns lots of imitators (pump.fun copycats, mislabeled tokens). To find the **real** Backed-issued xStock for a ticker, `find_xstock`:

1. Searches Jupiter for the ticker (e.g. `AAPLx`)
2. Filters to results where `tags` includes BOTH `"verified"` AND `"xstocks"`
3. Verifies the icon is hosted at `xstocks-metadata.backed.fi`
4. Confirms it's Token-2022 program (Backed uses Token-2022 for transfer hooks)

Result: only the real mint gets returned. Scams are silently dropped.

---

## Architecture

```
┌──────────────────────────────────────┐
│  Agent (Claude / Cursor / Cline)     │
└────────────┬─────────────────────────┘
             │ tool: guarded_buy_stock(symbol, amountUsd, slippageBps?)
             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  xstocks-mcp                                                          │
│                                                                       │
│  1. find_xstock — resolve ticker → real Backed mint                   │
│  2. ledger.preflight — check today's cap                              │
│  3. Jupiter /quote — get expected output + price impact               │
│  4. price-impact safety (XSTOCKS_MAX_PRICE_IMPACT_PCT)                │
│  5. (dry-run: STOP HERE) OR (live: Jupiter /swap → sign → send)       │
│  6. Record charge in local ledger + emit x402-shaped receipt          │
└──────────────────┬──────────────────┬─────────────────────────────────┘
                   │                  │
                   ▼                  ▼
┌──────────────────────┐   ┌──────────────────────────┐
│ Jupiter Aggregator   │   │  ~/.xstocks/cap.json     │
│ (DEX router on       │   │  daily-cap ledger        │
│  Solana mainnet)     │   │                          │
└──────────────────────┘   └──────────────────────────┘
```

---

## Pricing

| Component | $5 buy | $1,000 buy |
|---|---|---|
| Stock notional | $5.00 | $1,000.00 |
| Jupiter / pool spread | ~0% (built into AMM curve) | ~0.1-0.5% (depends on liquidity) |
| Solana network gas | ~$0.001 | ~$0.001 |
| LemonCake fee (flat) | $0.10 | $0.10 |
| **User pays** | **~$5.10** | **~$1,000.60** |

Industry-leading: lower than Dinari ($0.20 + 0.50%), much lower than Coinbase / Robinhood spreads.

---

## Sibling MCPs (same team, composable patterns)

| MCP | What it does |
|---|---|
| [agent-payment-mcp](https://www.npmjs.com/package/agent-payment-mcp) | USDC for any HTTP API (Tavily, Hunter, NTA, gBizINFO) |
| [alpaca-guard-mcp](https://www.npmjs.com/package/alpaca-guard-mcp) | Daily-cap guard for traditional Alpaca brokerage |
| [tokenized-stock-mcp](https://www.npmjs.com/package/tokenized-stock-mcp) | Dinari dShares (centralized, regulated US BD wrapper) |
| **xstocks-mcp** (this one) | **Fully on-chain Solana DEX path — no partnership, no KYB wait** |

Four different agent-spending vectors, **one consistent KYA-style cap model**.

---

## Status & roadmap

| Phase | Status | Notes |
| ----- | ------ | ----- |
| Phase A: local-ledger guard + Jupiter swap + dry-run default | ✅ this release | |
| Phase B: LemonCake-managed wallet (USDC charged to LemonCake → on-chain swap) | ⏳ | Replaces user-provided wallet with multi-tenant hot wallet |
| Phase C: Multi-source (xStocks + Backed bAssets + Ondo) | ⏳ | Provider abstraction |
| Phase D: Anthropic Connectors Directory submission | ⏳ | |

---

## License

MIT. Source at [github.com/evidai/lemon-cake/tree/main/xstocks-mcp](https://github.com/evidai/lemon-cake/tree/main/xstocks-mcp).

## Related

- [Backed Finance](https://backed.fi/) — the regulated issuer
- [Jupiter](https://jup.ag/) — the DEX aggregator we route through
- [xStocks Risk Disclosure (Kraken)](https://www.kraken.com/legal/xstocks)
- [LemonCake](https://lemoncake.xyz/start/v2) — interactive playground & docs
