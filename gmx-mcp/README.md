# gmx-mcp

> **MCP server for trading synthetic US stock perpetuals on GMX v2 (Arbitrum). Trade AAPL/TSLA/NVDA long or short with USDC collateral. Hard daily USD cap guard. Dry-run by default. Pay-per-call via LemonCake.**

[![npm version](https://img.shields.io/npm/v/gmx-mcp)](https://www.npmjs.com/package/gmx-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-compatible-blue)](https://modelcontextprotocol.io)
[![pricing](https://img.shields.io/badge/pricing-free_1k_tx%2Fmo-fffd43)](https://lemoncake.xyz/pricing)
[![MPP-compatible](https://img.shields.io/badge/MPP_%2F_Tempo-interop-blueviolet)](https://lemoncake.xyz/pricing)

> 💰 **Free up to 1,000 tx / month** on the LemonCake facilitator (gas sponsored). Stripe MPP / Tempo signed payments settle on Base/USDC. [See pricing →](https://lemoncake.xyz/pricing)

```bash
npx -y gmx-mcp
```

---

## What this is

You give an AI agent (Claude, Cursor, Cline) access to **synthetic US stock perpetual futures on GMX v2** — a decentralized derivatives DEX on Arbitrum. The agent can go long or short on AAPL, TSLA, NVDA, AMZN, GOOGL, MSFT, and META using USDC as collateral.

- **No broker, no custody.** User's own wallet signs transactions on-chain. GMX is a permissionless DeFi protocol.
- **Dry-run by default.** All `open_position` / `close_position` calls simulate and return a full breakdown (size, entry price, liquidation price, fees) without executing. Opt-in to live mode with `GMX_DRY_RUN=false`.
- **Hard daily USD cap.** Stored in `~/.gmx-mcp/cap.json`. The agent cannot override this cap from inside a tool call.
- **Flat $0.10/trade** LemonCake service fee (separate from GMX protocol fees and Arbitrum gas).
- **v0.1 scope:** Full price feed reads, simulation, and position reads via GMX subgraph. On-chain execution is v0.2 (see roadmap).

---

## Quickstart

### 1. Install (Claude Desktop / Cursor / Cline)

```json
{
  "mcpServers": {
    "gmx": {
      "command": "npx",
      "args":    ["-y", "gmx-mcp"],
      "env": {
        "GMX_WALLET_ADDRESS":    "0xYourArbitrumWallet",
        "GMX_WALLET_PRIVATE_KEY": "0xYourPrivateKey",
        "GMX_DRY_RUN":           "true",
        "GMX_MAX_POSITION_USD":  "500",
        "LEMONCAKE_SELLER_KEY":  "your-lemoncake-key"
      }
    }
  }
}
```

`GMX_WALLET_PRIVATE_KEY` and `GMX_DRY_RUN=false` are both required for live execution (v0.2 roadmap). For now, all trades simulate.

### 2. Set your daily cap

> Set my GMX daily position cap to $200.

Agent calls `guard_set_limit({ dailyLimitUsd: 200 })`. Default cap is $500.

### 3. Check markets and simulate a trade

> What's the current NVDA price on GMX? Simulate a $100 long at 3x leverage.

Agent calls `get_price({ symbol: "NVDA" })` (free), then `open_position({ symbol: "NVDA", direction: "long", collateral_usd: 100, leverage: 3 })`.

Example dry-run response:

```json
{
  "allowed": true,
  "status": "DRY_RUN_OK",
  "mode": "dry-run",
  "simulation": {
    "symbol": "NVDA",
    "direction": "long",
    "collateralUsd": 100,
    "leverage": 3,
    "sizeUsd": 300,
    "entryPriceUsd": 875.40,
    "liquidationPriceUsd": 621.53,
    "feesUsd": {
      "openFeeUsd": 0.21,
      "lemoncakeUsd": 0.10,
      "total": 0.31
    }
  },
  "hint": "Simulation passed. Set GMX_DRY_RUN=false + GMX_WALLET_PRIVATE_KEY to execute on-chain (v0.2 feature)."
}
```

---

## Tools

| Tool                | Cost         | Read-only? | Notes |
| ------------------- | :----------: | :--------: | ----- |
| `setup`             | Free         | Yes        | Env state, mode, cap, fee schedule, available markets |
| `guard_status`      | Free         | Yes        | Daily limit / used / remaining / last 10 trades |
| `guard_set_limit`   | Free         | No         | Set the daily USD cap (logged in ledger) |
| `list_markets`      | Free         | Yes        | All markets with current GMX oracle prices |
| `get_price`         | Free         | Yes        | Current price for one symbol |
| `get_market_info`   | Free         | Yes        | Open interest, spread, staleness for a market |
| `get_positions`     | $0.05/call   | Yes        | Open positions for a wallet (GMX subgraph) |
| `get_account_info`  | $0.05/call   | Yes        | USDC balance and account summary |
| `open_position`     | $0.10/call   | No         | Open long/short perp (dry-run by default) |
| `close_position`    | $0.10/call   | No         | Close an existing position (dry-run by default) |
| `get_pnl`           | $0.10/call   | Yes        | Unrealized P&L for all open positions |

---

## Configuration

| Env var                    | Required     | Default      | Notes |
| -------------------------- | :----------: | ------------ | ----- |
| `GMX_WALLET_PRIVATE_KEY`   | Live trades  | —            | Arbitrum EOA private key (0x...). Required for v0.2 on-chain execution. |
| `GMX_WALLET_ADDRESS`       | Positions    | —            | Public address for reading positions/balance. No private key needed. |
| `GMX_DRY_RUN`              | —            | `true`       | Set to `false` to enable live execution (requires v0.2 + private key). |
| `GMX_MAX_POSITION_USD`     | —            | `500`        | Hard cap per day across all positions. Overridable via `guard_set_limit`. |
| `LEMONCAKE_SELLER_KEY`     | —            | —            | LemonCake seller key. Demo mode if absent (fees tracked locally only). |
| `GMX_API_BASE`             | —            | `https://arbitrum-api.gmxinfra.io` | Override GMX stats API base URL. |
| `GMX_SUBGRAPH_URL`         | —            | GMX Satsuma  | Override GMX subgraph for position reads. |
| `GMX_LEDGER_DIR`           | —            | `~/.gmx-mcp` | Where `cap.json` lives. Useful for tests. |

---

## Fee breakdown

| Component             | $100 collateral, 3x long | Notes |
| --------------------- | -----------------------: | ----- |
| Collateral (USDC)     | $100.00                  | Stays in GMX vault as your margin |
| GMX open fee          | $0.21                    | 0.07% × $300 notional |
| GMX close fee         | $0.21                    | 0.07% × $300 notional (on close) |
| Funding rate          | variable                 | Paid continuously to counterside; see app.gmx.io |
| Arbitrum gas          | ~$0.01–0.05              | ETH for keeper execution |
| LemonCake fee         | **$0.10**                | Flat per tool call |
| **Total to open**     | **~$100.32**             | (plus ongoing funding) |

GMX charges 0.07% open + 0.07% close on notional size. LemonCake's $0.10 covers the daily-cap guard, simulation, and MCP integration.

---

## Supported markets

| Symbol | Name              | GMX Market Token |
| ------ | ----------------- | ---------------- |
| AAPL   | Apple Inc.        | `0xc683...F995` |
| TSLA   | Tesla Inc.        | `0xD953...7a41` |
| NVDA   | NVIDIA Corp.      | `0xe4E3...FB8`  |
| AMZN   | Amazon.com Inc.   | `0x2d34...9B`   |
| GOOGL  | Alphabet Inc.     | `0x1aCe...36a`  |
| MSFT   | Microsoft Corp.   | `0x6E24...7D2B` |
| META   | Meta Platforms    | `0x7Bc4...A5A5` |

All are synthetic markets — GMX uses Chainlink + keeper price feeds; no actual stock token is held. Positions are purely derivatives.

---

## Architecture

```
┌──────────────────────────────────┐
│  Agent (Claude / Cursor / Cline) │
└────────────┬─────────────────────┘
             │ tool: open_position(symbol, direction, collateral_usd, leverage)
             ▼
┌────────────────────────────────────────────────────────────────────┐
│  gmx-mcp v0.1                                                       │
│                                                                     │
│  1. Input validation (symbol, direction, leverage ≤ 100)           │
│  2. Preflight against ~/.gmx-mcp/cap.json                          │
│  3. Fetch GMX oracle price (arbitrum-api.gmxinfra.io)              │
│  4. Simulate: sizeUsd, liquidation price, fee breakdown            │
│  5. Record LemonCake fee in local ledger                           │
│  6. Return DRY_RUN_OK with full simulation (v0.1)                  │
│     OR execute via GMX v2 ExchangeRouter (v0.2 roadmap)            │
└──────────────────┬──────────────────┬─────────────────────────────┘
                   │                  │
                   ▼                  ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│ arbitrum-api.gmxinfra.io │  │ ~/.gmx-mcp/cap.json          │
│ GMX v2 price feeds       │  │ { dailyLimitUsd, todayUsed,  │
│ + open interest API      │  │   history[] }                │
└──────────────────────────┘  └──────────────────────────────┘
```

---

## Safety design

1. **Dry-run default.** `open_position` and `close_position` simulate unless `GMX_DRY_RUN=false` is explicitly set. The agent cannot override this in a single tool call.
2. **Cap guard.** All position opens are checked against `~/.gmx-mcp/cap.json` before any action. The agent sees `BUDGET_EXCEEDED` if over limit and gets a structured hint to ask the human operator.
3. **No custody.** LemonCake never holds your USDC. In live mode (v0.2), the user's own wallet signs the GMX transaction. LemonCake is a pass-through wrapper.
4. **Leverage warning.** The tool warns at >10x leverage and hard-limits at 100x (GMX protocol maximum for synthetics).

---

## Regulatory note (Japanese law)

**This is a gray-area product under Japanese financial regulation.** A formal inquiry (FSA 法令照会) covering this use case is pending as of 2026-05.

Key considerations:
- GMX is a DeFi protocol with no Japanese operator. Users interact directly with Arbitrum smart contracts.
- Synthetic stock perps may be classified under the Financial Instruments and Exchange Act (金融商品取引法) as derivatives trading.
- LemonCake's role is limited to a software service wrapper (not a financial intermediary or custodian).
- **This software is provided for informational and research purposes. It is not financial advice. Use at your own risk. Consult a licensed financial advisor in your jurisdiction before trading.**

Jurisdictions where GMX is not available: US persons are restricted by GMX's own terms of service.

---

## Status & roadmap

| Phase | Status | Notes |
| ----- | ------ | ----- |
| Phase A: price feeds + simulation + cap guard | ✅ v0.1 | This release |
| Phase B: LemonCake Pay Token remote preflight | ⏳ gated | Upstream endpoint needed |
| Phase C: on-chain execution via GMX v2 SDK | ⏳ v0.2 | GMX ExchangeRouter multicall integration |
| Phase D: position management (TP/SL orders) | ⏳ v0.3 | GMX order types |
| Phase E: Anthropic Connectors Directory listing | ⏳ | Same submission flow as sibling MCPs |

---

## License

MIT. Source at [github.com/evidai/lemon-cake/tree/main/gmx-mcp](https://github.com/evidai/lemon-cake/tree/main/gmx-mcp).

## Related

- [alpaca-guard-mcp](https://www.npmjs.com/package/alpaca-guard-mcp) — traditional Alpaca brokerage guard
- [tokenized-stock-mcp](https://www.npmjs.com/package/tokenized-stock-mcp) — Dinari dShares (ERC-20 tokenized stocks)
- [xstocks-mcp](https://www.npmjs.com/package/xstocks-mcp) — xStocks on Solana via Jupiter DEX
- [GMX v2 docs](https://docs.gmx.io) — protocol documentation
- [LemonCake](https://www.lemoncake.xyz/start) — interactive playground and pay-per-call docs
