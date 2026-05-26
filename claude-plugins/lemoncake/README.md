# LemonCake — Claude Code plugin

**Non-custodial USDC pay-per-call for AI agents.** Bundles five production MCP
servers behind one Claude Code plugin install: an x402 + MPP-compatible
facilitator, plus four trade-stack tools.

[![pricing](https://img.shields.io/badge/pricing-free_1k_tx%2Fmo-fffd43)](https://lemoncake.xyz/pricing?utm_source=claude-plugin-readme)
[![MPP-compatible](https://img.shields.io/badge/MPP_%2F_Tempo-interop-blueviolet)](https://lemoncake.xyz/pricing?utm_source=claude-plugin-readme)
[![FSA-confirmed](https://img.shields.io/badge/Japan_FSA-non--custodial-blue)](https://lemoncake.xyz/security)
[![non-custodial](https://img.shields.io/badge/architecture-non--custodial-success)](https://lemoncake.xyz/start/v2)

---

## What you get on install

| MCP server | What it does |
|---|---|
| `agent-payment-mcp` | x402 facilitator client. ERC-2612 permit signing, MPP-signed payment settle on Base/USDC. 8 demo APIs work without env config. |
| `xstocks-mcp`       | Buy/sell tokenized US stocks (AAPLx/TSLAx/SPYx) on Solana via Jupiter DEX. Hard daily USD cap. |
| `tokenized-stock-mcp` | Buy/sell Dinari `dShares` tokenized US stocks. Non-custodial — your wallet, not ours. |
| `alpaca-guard-mcp`  | Alpaca trading API wrapped with hard daily USD cap. Paper trading by default. |
| `gmx-mcp`           | GMX v2 perpetuals on Arbitrum. AAPL/TSLA/NVDA long-or-short with USDC collateral. |

## Why this plugin exists

After Stripe Sessions 2026 shipped MPP (Machine Payments Protocol), every AI
agent stack needs a per-call settlement layer. LemonCake is the
**non-custodial** Base/USDC facilitator that **accepts MPP-signed payments
alongside x402** — so Claude Code agents pay APIs directly without:

- handing API keys to the agent
- relying on a custodian to hold the wallet
- giving up control of the spending cap

The first 1,000 settled tx/month are **free** (gas sponsored). $0.005/tx
after. The only x402 facilitator that natively supports Japan onramp (Stripe
Crypto Onramp is JP-blocked).

## Quickstart

```bash
# Install the plugin
/plugin install @claude-community/lemoncake

# Or test locally before submitting changes
claude --plugin-dir ./claude-plugins/lemoncake
```

Once enabled, Claude has 5 sets of tools available — all run via `npx` so no
local install step. Demo mode boots without any env vars.

## Free tier (no card)

```
→ https://lemoncake.xyz/start/free
```

3 fields, manual provision within 24h while inbound is small. Upgrade to Pro
when you cross 1k tx/mo (auto-routed, no surprise rate limit).

## Pro tier ($50/mo + $0.005/tx)

Sign one ERC-2612 permit at `lemoncake.xyz/start/v2`, paste the resulting
blob as `LEMON_CAKE_PERMIT` in your env. 90-day spending cap on-chain.

## Documentation

- [Pricing & MPP interop](https://lemoncake.xyz/pricing)
- [Migrate from Coinbase x402](https://lemoncake.xyz/docs/migrate-from-coinbase)
- [Migrate from Crossmint](https://lemoncake.xyz/docs/migrate-from-crossmint)
- [Stripe MPP coexistence](https://lemoncake.xyz/docs/migrate-from-stripe-mpp)
- [Quickstart](https://lemoncake.xyz/docs/quickstart)
- [Security (FSA non-custodial)](https://lemoncake.xyz/security)

## Support

- Email: `contact@aievid.com`
- GitHub issues: <https://github.com/evidai/agent-payment-mcp/issues>
- Consulting (paid integration): <https://lemoncake.xyz/consulting>

## License

MIT — both the plugin and the underlying MCP servers.
