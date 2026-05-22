# polymarket-guard-mcp — Polymarket Prediction Markets MCP Server

> Buy/sell positions on [Polymarket](https://polymarket.com) prediction markets, paying in USDC with per-call billing via [LemonCake](https://lemoncake.xyz). Read-only mode works with no credentials.

[![npm version](https://img.shields.io/npm/v/polymarket-guard-mcp)](https://www.npmjs.com/package/polymarket-guard-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP_Registry-listed-blue)](https://registry.modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

## Installation

```bash
npx polymarket-guard-mcp
```

Or add to your MCP client (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "polymarket": {
      "command": "npx",
      "args": ["-y", "polymarket-mcp"],
      "env": {
        "POLYMARKET_PRIVATE_KEY": "0x<your-polygon-private-key>",
        "LEMONCAKE_SELLER_KEY": "<your-lemoncake-seller-key>"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `POLYMARKET_PRIVATE_KEY` | For trading | Polygon wallet private key (0x-prefixed 32-byte hex). Required for positions, balance, and all trading tools. |
| `LEMONCAKE_SELLER_KEY` | Optional | LemonCake seller key. Absent = Demo Mode (charges logged, no real billing). |
| `LEMON_CAKE_PERMIT` | Optional | Client's ERC-2612 permit blob for non-custodial billing. Passed by the MCP client automatically when using LemonCake. |

## Demo Mode

- **Free/read tools** work with zero env vars — no key needed.
- **Account tools** (`get_positions`, `get_balance`, `get_trade_history`) require `POLYMARKET_PRIVATE_KEY`.
- **Trading tools** require `POLYMARKET_PRIVATE_KEY`.
- **LemonCake billing** is a no-op in Demo Mode if `LEMONCAKE_SELLER_KEY` is absent — all tools still execute, charges are logged to stderr only.

## Tools

### Free (no charge)

| Tool | Description |
|---|---|
| `list_markets` | List active Polymarket markets with prices and volume |
| `search_markets` | Search markets by keyword |
| `get_market` | Get full market details by condition ID or slug |
| `get_order_book` | Get live bid/ask order book for a market token |

### $0.05 per call

| Tool | Description |
|---|---|
| `get_positions` | Your current open positions (shares held, P&L) |
| `get_balance` | USDC balance and contract allowances |
| `get_trade_history` | Past trades with prices and timestamps |

### $0.10 per call

| Tool | Description |
|---|---|
| `place_market_order` | Buy/sell at market price (FOK with slippage tolerance) |
| `place_limit_order` | Place a GTC/FOK/IOC limit order at a specific price |
| `cancel_order` | Cancel an open limit order by ID |
| `redeem_positions` | Claim USDC winnings from resolved markets |

## Example Usage

```
# Find markets about the 2024 US election
search_markets(query="US election 2024")

# Get the order book for a specific outcome token
get_order_book(token_id="0x...")

# Check your current positions
get_positions()

# Buy 100 YES shares on a market (limit order at 0.65 = 65 cents/share)
place_limit_order(
  token_id="0x...",
  side="BUY",
  price=0.65,
  size=100
)

# Buy using market order with 2% slippage tolerance
place_market_order(
  token_id="0x...",
  side="BUY",
  amount=50  # $50 USDC
)

# Claim winnings after market resolves
redeem_positions(condition_id="0x...")
```

## Architecture

- **Market data**: Polymarket Gamma API (`gamma-api.polymarket.com`)
- **Trading**: Polymarket CLOB API (`clob.polymarket.com`) with L1 EIP-712 auth
- **Chain**: Polygon (chainId 137)
- **Token**: USDC on Polygon (6 decimals)
- **Billing**: LemonCake USDC pay-per-call (`@lemon-cake/mcp-sdk`)

### Authentication Note

Polymarket's CLOB API uses L1 auth: EIP-712 typed-data signatures over each request. This implementation includes the complete request structure. For full production signing (real orders), install `ethers` and integrate the `Wallet.signTypedData()` method — the current build uses a placeholder signature that will receive a 401 from the CLOB for authenticated endpoints.

Full signing integration:

```bash
npm install ethers
```

```typescript
import { ethers } from "ethers";
const wallet = new ethers.Wallet(process.env.POLYMARKET_PRIVATE_KEY!);
const sig = await wallet.signTypedData(domain, types, value);
```

## Pricing & Billing

| Action | Cost |
|---|---|
| Browsing markets | Free |
| Checking positions / balance | $0.05 USDC |
| Placing / cancelling orders | $0.10 USDC |
| Claiming winnings | $0.10 USDC |

Billing is handled by [LemonCake](https://lemoncake.xyz) — USDC pay-per-call infrastructure for MCP tools. No subscription, no monthly fees. You pay only when you call a tool.

## Related MCP Servers

- [alpaca-guard-mcp](https://www.npmjs.com/package/alpaca-guard-mcp) — Traditional stocks via Alpaca brokerage with daily USD cap
- [tokenized-stock-mcp](https://www.npmjs.com/package/tokenized-stock-mcp) — Tokenized US stocks (Dinari dShares) via USDC
- [xstocks-mcp](https://www.npmjs.com/package/xstocks-mcp) — On-chain tokenized stocks via Solana Jupiter DEX
- [pay-per-call-mcp](https://www.npmjs.com/package/pay-per-call-mcp) — USDC micropayments for any HTTP API

## License

MIT
