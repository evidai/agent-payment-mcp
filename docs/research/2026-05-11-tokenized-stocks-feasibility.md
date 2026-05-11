# Tokenized stocks via LemonCake — feasibility research

**Author**: Claude (autonomous research session)
**Date**: 2026-05-11
**Status**: decision-ready
**Trigger**: user question "USDC でチャージしてそこから株売買できないか" (i.e. "can we let agents buy stocks paid from a LemonCake USDC wallet, not from the user's broker account?")

---

## TL;DR

| Question | Answer |
|---|---|
| Can users buy real US stocks paying directly with USDC, via LemonCake's MCP? | **Yes**, via tokenized-stock providers (Backed/xStocks or Dinari). Not via Alpaca. |
| Is Japan one of the allowed jurisdictions? | **Yes** — both providers exclude US/UK/EU/CA/AU but **not Japan**. |
| Does either provider have an official TypeScript SDK we can wrap? | **Dinari: yes** (`dinaricrypto/dinari-api-sdk-typescript`). Backed/xStocks: post-Kraken-acquisition, primarily through Kraken's exchange API and on-chain Solana SPL tokens. |
| Margin opportunity for LemonCake? | Dinari charges issuance fees (`$1 + 0.50%` on Ethereum, `$0.20 + 0.50%` on L2 with USDC). LemonCake can layer **+10-15%** on top transparently and still be cheaper than the typical broker spread. |
| Implementation effort for an MVP `tokenized-stock-mcp`? | **3-5 days** with Dinari (TS SDK + sandbox). 1-2 weeks with Backed/xStocks (Solana SPL + DEX swaps). |
| Recommendation | **Build `tokenized-stock-mcp` v0.1 against Dinari first.** Same daily-cap-guard pattern as alpaca-guard-mcp. Keep Backed/xStocks (Solana) as a v0.2 multi-provider expansion. |

---

## 1. Why this question matters strategically

Today's `alpaca-guard-mcp` v0.1.0 protects users from rogue agents but **doesn't make LemonCake the funding source**. Money still flows from the user's bank → Alpaca brokerage account. LemonCake gets zero $ revenue from each trade.

If we can put a **tokenized-stock MCP** on top of USDC + Pay Token, the flow becomes:

```
User USDC → LemonCake Pay Token (capped, scoped)
         → tokenized-stock-mcp call
         → Dinari (or Backed) swaps USDC for bAAPL/AAPLd
         → User wallet receives the stock token
         → LemonCake takes 10-15% margin on the issuance fee
```

This is the first product where LemonCake's USDC-wallet model **directly captures revenue per trade**, not just per API call.

## 2. Why Alpaca alone cannot do this

| Barrier | Detail |
|---|---|
| Alpaca onramp = USD only | Bank ACH / wire only. No crypto deposits. |
| Money Transmitter Licence (US) | LemonCake holding USDC and paying it to a brokerage on the user's behalf = MT business. ~50 state licences, $500k–$2M each. |
| Broker-Dealer / FINRA | LemonCake actually placing orders on the user's behalf = SEC-regulated broker-dealer. Series 7/24/27, FINRA approval, SIPC membership. |
| Time / cost | Years and millions to do legally. |

→ Direct USDC → Alpaca stock is regulatorily impractical for a small team.

## 3. The tokenized-stock route

Tokenized stock providers issue ERC-20/SPL tokens that are **1:1 backed by real shares held in regulated custody**. The legal vehicle is typically a Swiss SPV (Backed Finance via Liechtenstein FMA prospectus) or a US broker-dealer with on-chain wrapping (Dinari has a US broker-dealer subsidiary).

The key win for us: **the regulated entity is the issuer, not us**. We just integrate their API. Our LemonCake Pay Token wraps the call exactly the way `pay-per-call-mcp` wraps Tavily / Hunter / etc.

### 3.1 Backed Finance / xStocks

| Dimension | Finding |
|---|---|
| Brand / product | Backed issues `bAAPL`, `bTSLA`, `bCSPX`, etc. (ERC-20). xStocks is the rebranded Solana SPL line — `AAPLx`, `TSLAx`, `MSTRx` etc. — with 55+ stocks/ETFs at launch. |
| Networks | Ethereum, Polygon, Base, Gnosis (legacy `b*`), **Solana** (xStocks line, primary now). |
| Backed by | 1:1 real shares held by regulated third-party custodians. Swiss legal framework. EU prospectus filed at Liechtenstein FMA. |
| Geographic restrictions | **Excluded**: US, UK, Canada, Australia, EU/EEA, Belgium, Iran/NK/Syria. **Allowed**: Japan ✅, most of Asia, LATAM, Africa. |
| Min order | $1 USD equivalent (fractional shares native). |
| Fees (retail via Kraken) | **No trading fees** when paying with USDG or USD. Spread bundled into asset price for other assets (USDC etc.). |
| API access | Two paths: (a) Kraken's exchange API (post-Backed acquisition — Kraken acquired Backed after $10B volume), (b) on-chain Solana SPL via Jupiter / Raydium DEX. **No official TS SDK** found in 2026-05 search. |
| LemonCake fit | Strong on the on-chain path (Solana SPL + DEX = composable). But the developer story is fragmented: Kraken API for instant buy, DEX for permissionless. |

### 3.2 Dinari / dShares

| Dimension | Finding |
|---|---|
| Brand / product | `AAPLd`, `TSLAd`, `NVDAd`, etc. ERC-20 on Ethereum + L2s. 150+ US stocks including `SPY`, `MSTR`, `GOOGL`. |
| Networks | Ethereum mainnet, Arbitrum, Base, others. Recently launched **Dinari Financial Network** — a Layer 1 omni-chain orderbook on Avalanche subnet. |
| Backed by | 1:1 real shares. Dinari Inc. is a US broker-dealer subsidiary. |
| Geographic restrictions | **Excluded**: US (despite being US-based — sells only to non-US). Japan ✅ allowed. |
| Min order | No explicit minimum found in docs. |
| **Fees (the critical number)** | **Ethereum**: `$1 + 0.25%` if paying in USD+, `$1 + 0.50%` if USDC/USDT. **L2** (Arbitrum/Base): `$0.20 + 0.25%` USD+, `$0.20 + 0.50%` USDC/USDT. **Dividends**: 5% fee on distribution. Plus chain gas. |
| **API access** | ✅ **Official REST API** — `partners.dinari.com` for KYB onboarding + sandbox. ✅ **TypeScript SDK**: [`dinaricrypto/dinari-api-sdk-typescript`](https://github.com/dinaricrypto/dinari-api-sdk-typescript) on GitHub. Also Go / Java / Python. |
| Compliance model for partners | They handle KYC/KYB for retail end-user. Partner (us) provides the wallet UX. |
| LemonCake fit | **Very strong**. TS SDK = drop into pay-per-call-mcp's runtime. Per-trade fee is a known number we can layer margin on. Sandbox = we can develop without committing to live trading. |

### 3.3 Other / honourable mentions (not picked)

| Provider | Why not (now) |
|---|---|
| Ondo Finance | Treasuries-focused (`OUSG`, `USDY`), not equities. Worth revisiting if we add bond/treasury tokens later. |
| Securitize | Heavyweight enterprise issuance platform. Wrong scale. |
| Helio | Payments-focused, not asset issuance. |
| Robinhood (recent EU tokenized stock launch) | Closed ecosystem; no public partner API. |
| Superstate | Treasuries + private credit. Wrong asset class. |

## 4. The architecture if we build this

```
┌────────────────────────────────────┐
│  Agent (Claude / Cursor / Cline)    │
└──────────────────┬──────────────────┘
                   │ tool: tokenized_stock_buy(symbol="AAPLd", amountUsd=50)
                   ▼
┌──────────────────────────────────────────────────────────────┐
│  tokenized-stock-mcp (NEW)                                    │
│                                                               │
│  1. Resolve to Dinari "AAPLd" + current quote                  │
│  2. LemonCake Pay Token preflight (cap check, KYA tier)        │
│  3. Compute total: amountUsd + Dinari fee + LemonCake margin   │
│  4. POST /api/charges (Pay Token) for the total                │
│  5. POST Dinari /v1/orders (USDC paid from our pooled wallet)  │
│  6. Wait for tx confirmation → return Dinari order id +       │
│     x402-shaped receipt to the agent                          │
└──────────────────┬─────────────────┬───────────────────────────┘
                   │                 │
                   ▼                 ▼
┌──────────────────────────┐  ┌──────────────────────────────┐
│ Dinari REST + TS SDK     │  │  LemonCake API               │
│ (1:1 backed AAPLd issued)│  │  (Pay Token preflight + charge)│
└──────────────────────────┘  └──────────────────────────────┘
```

Note: the user's USDC pre-loaded to their LemonCake balance funds this — we never touch the user's bank or brokerage.

## 5. The economic model

For a $50 buy of `AAPLd` on Arbitrum (L2) paid via USDC:

| Component | Amount |
|---|---|
| Stock notional | $50.00 |
| Dinari issuance fee (`$0.20 + 0.50%`) | $0.45 |
| Arbitrum gas | ~$0.02 |
| LemonCake platform margin (proposed +10% over Dinari fee) | $0.05 |
| **User pays from Pay Token (USDC)** | **$50.52** |
| Of which LemonCake keeps | $0.05 |
| Of which Dinari/issuer keeps | $0.45 |
| To buy the actual share | $50.00 |

For a $1,000 buy:
| Component | Amount |
|---|---|
| Stock notional | $1,000.00 |
| Dinari fee | $5.20 |
| LemonCake margin (10%) | $0.52 |
| **User pays** | **$1,005.74** |
| LemonCake keeps | $0.52 |

Per-trade revenue is small but **agentic flow at scale** is where this works: an agent re-balancing daily across 50 portfolios at $1k notional each = $26 / day to LemonCake, all from infra we already have (Pay Token + the wrapper MCP).

## 6. Risks / open questions

| Risk | Severity | Mitigation |
|---|---|---|
| Dinari KYB process for LemonCake (partner) takes weeks | medium | Apply now, in parallel with sandbox dev |
| Japan FSA stance on tokenized US equities for retail | medium | Both Dinari and Backed list Japan as allowed; FSA's STO framework (under FIEA) governs but isn't a blocker for foreign-issued tokenized securities sold to JP residents. Worth a 税理士/弁護士 consult before live launch. |
| Dinari liquidity for thin-traded tickers | low-med | Stick to AAPL / NVDA / TSLA / SPY / QQQ for v0.1; avoid micro-caps |
| Dividend handling complexity | medium | Dinari distributes in USD+ stablecoin (1:1 swappable to USDC). Need to surface this to user via `get_position_dividends` tool |
| User's USDC custody | high | If LemonCake holds the USDC pre-load, we need wallet security disclosure. If user keeps their USDC and we just stream the auth, simpler. Pay Token model already handles this — same as today. |
| Kraken's Backed acquisition could reshape the market | low | Doesn't affect the Dinari path; their products are independent |
| Dinari's `5% dividend fee` is high | medium | Document clearly upfront; users seeking dividend yield should know to use direct broker instead |

## 7. Recommendation

**Build `tokenized-stock-mcp` v0.1 against Dinari**, NOT against Backed/xStocks first, for these specific reasons:

1. **Official TypeScript SDK exists** — drops into our existing TS stack with zero adapter layer
2. **Sandbox API available** — we can develop and demo end-to-end without putting real money at risk
3. **Per-trade fee is a published number** — `$0.20 + 0.50%` on L2 — making our margin transparent
4. **Same daily-cap-guard pattern as alpaca-guard-mcp** — the patterns compose; users who already trust alpaca-guard get tokenized-stock-guard for free
5. **Japan-allowed jurisdiction** — no regulatory blocker for our home market

Backed/xStocks remains a strong **v0.2 multi-provider** expansion target. The two products are complementary (Backed has different ticker coverage and the Solana liquidity story) and the wrapper interface stays the same.

## 8. Concrete next steps if approved

| Step | Owner | Cost |
|---|---|---|
| 1. Apply for Dinari partner KYB at partners.dinari.com | user | 30 min apply, 1-2 week review |
| 2. Add `dinari-api-sdk-typescript` to a new `tokenized-stock-mcp/` package | Claude | 1 hour scaffold |
| 3. Implement 4 tools: `setup`, `guard_status`, `get_quote`, `guarded_buy_stock` against Dinari sandbox | Claude | 1 day |
| 4. Reuse the local cap ledger from alpaca-guard-mcp for the daily USD limit | Claude | 1 hour (extract to shared module) |
| 5. Publish v0.1.0 in sandbox-only mode (refuses real orders without explicit `LIVE=yes-i-understand`) | Claude | 30 min npm publish |
| 6. Smoke test on Dinari sandbox + paper screenshot for marketing | user + Claude | 1 hour |
| 7. Once partner KYB approved → flip live, write Qiita article, X JP announcement | both | 2 hours |

**Critical path: Dinari KYB approval (1-2 weeks)**. Everything else can happen in parallel.

## 9. Open question for the user

Before we build this, two things to confirm:

a. **LemonCake's USDC custody model for the v0.1**: do we
   - (i) hold pooled USDC on LemonCake's hot wallet and pay Dinari from it (simpler UX, harder regulatorily)?
   - (ii) hand the user a Pay Token they directly use with Dinari via wallet signature (cleaner regulatorily, more setup steps for the user)?

b. **Margin policy**: 10% over Dinari's protocol fee (proposed) — or fixed `$0.50/trade` flat? The percentage scales with trade size; flat fee is friendlier for small trades.

These shape the contract layer between LemonCake API and Dinari and need to be decided before code lands.

---

## Appendix: sources

- [Backed Finance — main site](https://backed.fi/)
- [Backed Finance — xStocks announcement on Avalanche/Solana](https://backed.fi/news-updates/backeds-tokenized-coinbase-stock-and-s-p-500-launches-on-avalanche)
- [Backed Finance — issues first tokenized security on Base](https://backed.fi/news-updates/backed-issues-the-first-tokenized-security-on-base)
- [Kraken acquires Backed — official blog](https://blog.kraken.com/news/backed-acquisition)
- [Kraken — xStocks landing page](https://www.kraken.com/xstocks)
- [Kraken — xStocks FAQ + restricted countries](https://support.kraken.com/articles/xstocks-faq)
- [xStocks docs — legal & regulatory overview](https://docs.xstocks.fi/legal-and-compliance/legal-and-regulatory-overview)
- [Dinari — dShares product page](https://dinari.com/dshares)
- [Dinari — business pricing](https://dinari.com/business/pricing)
- [Dinari — fee structure docs](https://docs.dinari.com/docs/fees)
- [Dinari — quickstart docs](https://docs.dinari.com/docs/quickstart)
- [Dinari — TypeScript SDK on GitHub](https://github.com/dinaricrypto/dinari-api-sdk-typescript)
- [Dinari — B2B API + managed account services blog](https://dinari.com/blog/b2b-api-and-managed-account)
- [Dinari — Series A coverage (CoinDesk, May 2025)](https://www.coindesk.com/tech/2025/05/01/dinari-raises-usd12-7m-to-expand-tokenized-stock-access-for-non-u-s-investors)
- [Japan FSA — main site](https://www.fsa.go.jp/en/)
- [Japan crypto/STO regulation overview (Lexology)](https://www.lexology.com/library/detail.aspx?g=ffb1291c-b215-4437-8834-2aa8f8bce4dd)
- [DeFi: How US Equities have come on-chain (Lex.substack)](https://lex.substack.com/p/defi-how-us-equities-have-come-on)
