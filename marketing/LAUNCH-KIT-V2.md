# LemonCake v2 — Launch Kit (送れる状態)

**目的：buyer 0 / provider 1 / revenue $0 から脱出する。**

2026-05-22 v2 launch（非カストディ ERC-2612 permit + Privy embedded wallet）に
合わせて全 channel draft を刷新。既存の v1 draft（reddit-posts.md 等）は
custody base の説明で時代遅れ → このファイルが現役。

---

## 0. 送る順番（推奨：4 日に分散、UTM で計測）

| 日 | チャネル | 期待リーチ | 期待コンバージョン |
|---|---|---|---|
| **Day 1（木 or 金 23:00 JST = US 朝）** | r/ClaudeAI Reddit | 10K-30K view | 100-300 LP visit, 5-10 provider 登録 |
| **Day 2** | Anthropic Discord #show-and-tell | 1K-5K view | 30-100 LP visit, 1-5 登録 |
| **Day 3** | MCP 作者 20 人へ personalized DM | 20 reads | 5-10 返信、1-3 登録 |
| **Day 4** | Product Hunt 投稿 | 5K-20K view | 200-500 LP visit, 10-30 登録 |

各 channel を別 UTM で URL 配布 → `/admin/funnel` で 4 日後に効果比較。

---

## 1. r/ClaudeAI Reddit ポスト

**post URL:** https://www.reddit.com/r/ClaudeAI/submit

**Title:** I built a way to monetize your MCP server in 3 lines (USDC, non-custodial)

**Body（↓ ここから ↓ までを Reddit body にコピペ。fancy editor / "Markdown mode" ON で）：**

```
───── COPY FROM HERE ─────
Been seeing more people build MCP servers but nobody talks about monetization.
If you've made one and want users to pay for it, your options today are:

1. Stripe — works, but $0.30 fixed fee kills micro-pricing
2. API key + webhook gymnastics — fragile, manual
3. Throw it on a free tier and hope

I built [agent-payment-mcp](https://github.com/evidai/agent-payment-mcp) + [@lemon-cake/x402-server](https://www.npmjs.com/package/@lemon-cake/x402-server) to give a 4th option: per-call USDC on Base, non-custodial.

**For the MCP/API provider:**

    import { x402Middleware } from "@lemon-cake/x402-server";

    app.use("/api/search", x402Middleware({
      serviceId:       "your-id",   // from /sellers signup
      pricePerCallUsd: 0.005,
      facilitator:     "both",       // catalog in Coinbase Bazaar + LemonCake metering
    }));

Buyer signs one ERC-2612 permit (90 days, $25/day on-chain hard cap). USDC goes Buyer → Provider direct on Base. LemonCake never holds funds (FSA Q1-Q11 confirmed in Japan).

I take 0% per-call fee. Monetize via SaaS tier for Japan-specific features (freee accounting integration, qualified invoices, JPY off-ramp).

**Demo mode (no signup, no wallet):**

    {
      "mcpServers": {
        "lemon": {
          "command": "npx",
          "args": ["-y", "agent-payment-mcp"]
        }
      }
    }

Drop into Claude Desktop config, then ask Claude `lemon, list services` → hits real Wikipedia / Open-Meteo / exchangerate.host. See what an MCP-paid API call looks like before signing anything.

Provider signup: https://lemoncake.xyz/sellers?utm_source=reddit&utm_medium=post&utm_campaign=claudeai_launch
Buyer onboarding: https://lemoncake.xyz/start/v2?utm_source=reddit&utm_medium=post&utm_campaign=claudeai_launch

Happy to answer architecture questions. MIT-licensed, npm packages: `@lemon-cake/x402-server` + `@lemon-cake/mcp-sdk` + `agent-payment-mcp`.
───── COPY UP TO HERE ─────
```

**📝 重要：**
- 上の "COPY FROM HERE" と "COPY UP TO HERE" マーカーは **含めずに** body 貼付
- 4 space インデントの code block は **old Reddit でも new Reddit でも render される**（fenced ``` は old Reddit で壊れる）→ 上記は 4-space スタイル統一
- アカウントの karma 必要、新規アカは「Show me」と疑われやすい
- 投稿後 1-2 時間で質問返信つけて engagement 維持
- "I built" は OK、"check out my SaaS" は ban されやすい
- Tuesday-Thursday US 朝（JST 翌 0-2 AM）が一番伸びる

---

## 2. Anthropic Discord — #show-and-tell

**URL:** https://discord.gg/anthropic (Anthropic 公式、要 join。MCP 専用なら https://discord.gg/modelcontextprotocol)
**Channel:** #show-and-tell or #mcp-server-development

**Message（コピペ用、Discord で正しく描画される形）：**

```
**Pay-per-call USDC for MCP servers (non-custodial, 3 lines)**

Built `@lemon-cake/x402-server` — drop into any MCP/HTTP server, buyers pay USDC per call, money lands in your wallet direct. No fund custody.

Demo with zero signup, 30 seconds:
` ` ` json
{
  "mcpServers": {
    "lemon": {"command": "npx", "args": ["-y", "agent-payment-mcp"]}
  }
}
` ` `
Add to Claude Desktop config, then ask: `lemon, list services` → hits real Wikipedia / Open-Meteo / exchangerate.host.

Providers: <https://lemoncake.xyz/sellers?utm_source=discord&utm_medium=msg&utm_campaign=anthropic>
Buyers:    <https://lemoncake.xyz/start/v2?utm_source=discord&utm_medium=msg&utm_campaign=anthropic>

Architecture: ERC-2612 permit on Base, $25/day on-chain hard cap (USDC contract enforces). x402 spec compatible — catalogs in Coinbase Bazaar with `facilitator: "both"`.

🍋
```

⚠️ **コピペ時の注意**：
- 上の `` ` ` ` json `` と `` ` ` ` `` は backtick 3 つ（半角スペースは見やすさ用、貼る時は詰める）
- URL を `<>` で wrap してるのは Discord の auto-preview を抑制するため（message が clean に見える）
- ネストフェンス禁止：本文を ```markdown でくるまない（Discord は markdown フェンスを nest できず render 崩れる）

**📝 メモ：**
- Discord は短く。長い説明は GitHub link で。
- Demo mode を強調（barrier ゼロで試せる）
- emoji は最後の 🍋 1 個だけ
- 投稿後、誰か reply したら 1-2 時間以内に返信して engagement 維持

---

## 3. MCP 作者 20 人への DM テンプレート

**送り先：**`marketing/target-mcp-creators.md` 参照

**X DM / GitHub Issue / Email テンプレ：**

```
Hi {name},

I came across your {project_name} MCP on Glama — looks great.

Quick question: have you thought about charging per-call for it?
Stripe is overkill for $0.001-$0.05 calls, and most agent users
don't have credit cards set up.

I built @lemon-cake/x402-server which is a 3-line middleware that
lets MCP/API providers receive USDC per call. Buyer signs one permit
(non-custodial, 90 days), money lands in your Base wallet direct.

No fees from me on per-call, I monetize via SaaS for Japan-specific
features (freee/MoneyForward accounting, qualified invoices, JPY
off-ramp). Open source: github.com/evidai/agent-payment-mcp

Would you try it on {project_name}? If yes, takes ~5 min:
1. Sign up at https://lemoncake.xyz/sellers?utm_source=outreach&utm_medium=dm&utm_campaign=mcp_creators_w1
2. Drop in the middleware
3. Done — your MCP is now monetizable

If not interested, no worries — would love to hear what's blocking.
What would make you actually want this?

— hiroto / Evid AI (LemonCake)
```

**カスタマイズ要素：**
- `{name}` `{project_name}` を必ず差し替え（一斉送信感を避ける）
- 相手 repo の最近の commit / issue を 1 行触れると open 率上がる
- "Would you try it" の closed question で返信率 up

---

## 4. Product Hunt 投稿

**URL:** https://www.producthunt.com/posts/new

**Tagline:**
> Stripe for MCP servers — USDC per-call, non-custodial, 3 lines

**Description:**

```
LemonCake lets you charge per-call in USDC for your MCP/API server.

For providers: 3-line middleware, buyers pay direct to your wallet on Base.
LemonCake never holds funds (Japan FSA Q1-Q11 confirmed non-custodial).
0% per-call fee. SaaS tier ($69/mo) for accounting + qualified invoices.

For buyers (AI agent users): sign one ERC-2612 permit, get 90 days of
auto-paid API access with a $25/day on-chain hard cap. Claude / Cursor /
Cline supported via npm install agent-payment-mcp.

Demo mode works zero-signup — hits real Wikipedia / FX / weather APIs.

Built on x402 (Coinbase's HTTP 402 spec) — also indexes into the Bazaar
discovery layer.

Try: https://lemoncake.xyz/start/v2?utm_source=producthunt&utm_medium=launch&utm_campaign=ph_v2
```

**Comment script for first hour:** (founder reply pattern)

```
Hey everyone — solo founder here. Two years ago I tried to build "PayPal for AI
agents" and over-engineered the hell out of it (KYC, fiat rails, the works).
Then x402 dropped and I realized: just sign one permit, let the agent pay
per-call in USDC. So LemonCake v2 is the rewrite — 1/10 the code, actually
non-custodial.

Happy to answer anything about architecture, FSA stance, or why this isn't
just "another crypto thing".
```

**注意：**
- Tuesday-Thursday launch best（US 火-木）
- 8:00 PT までに submit
- hunter（推薦人）いれば boost 効くが、なくても OK

---

## 5. TLDR AI / Ben's Bites pitch（newsletter）

**TLDR AI:** https://tldr.tech/contact （submission form）
**Ben's Bites:** https://www.bensbites.com/p/about （tip form）

**Pitch（共通）：**

```
Subject: Stripe for MCP servers (USDC per-call, non-custodial)

Hi,

I'm Hiroto from LemonCake — building per-call USDC billing for AI agent APIs.

3-line middleware ($lemon-cake/x402-server) on the provider side, one ERC-2612
permit on the buyer side. USDC moves Buyer → Provider direct, we never touch
funds. Japan FSA confirmed non-custodial (Q1-Q11 inquiry done).

Open source, MIT. 5 npm packages, 7 supported countries regulatory-green.

Demo mode works with zero signup:
  npx -y agent-payment-mcp → ask Claude `list_services` → 8 free real APIs

LP: https://lemoncake.xyz/start/v2?utm_source=newsletter&utm_medium=email&utm_campaign={publisher}

Would this be a fit for {publisher_name}? Happy to do a deeper write-up
if useful.

— Hiroto / contact@aievid.com
```

**注意：**
- 採用率 5-10% 程度、ダメ元
- 1 publisher 1 メール、複数送るな
- 「open source」「demo mode no signup」を上に置く（読者が試せる）

---

## 6. UTM URL バンドル（コピペ用）

各 channel から流入を `/admin/funnel` で計測するため、URL は必ず UTM 付きで配布：

### LP（/start/v2 = Buyer 用 / /sellers = Provider 用）

```
# Reddit r/ClaudeAI
Buyer:    https://lemoncake.xyz/start/v2?utm_source=reddit&utm_medium=post&utm_campaign=claudeai_launch
Provider: https://lemoncake.xyz/sellers?utm_source=reddit&utm_medium=post&utm_campaign=claudeai_launch

# Anthropic Discord
Buyer:    https://lemoncake.xyz/start/v2?utm_source=discord&utm_medium=msg&utm_campaign=anthropic
Provider: https://lemoncake.xyz/sellers?utm_source=discord&utm_medium=msg&utm_campaign=anthropic

# MCP creators DM (週次バッチ)
Provider: https://lemoncake.xyz/sellers?utm_source=outreach&utm_medium=dm&utm_campaign=mcp_creators_w1

# Product Hunt
Buyer:    https://lemoncake.xyz/start/v2?utm_source=producthunt&utm_medium=launch&utm_campaign=ph_v2
Provider: https://lemoncake.xyz/sellers?utm_source=producthunt&utm_medium=launch&utm_campaign=ph_v2

# Newsletter
Buyer:    https://lemoncake.xyz/start/v2?utm_source=newsletter&utm_medium=email&utm_campaign=tldrai
```

→ deploy 後、`/admin/funnel` の「UTM キャンペーン」テーブルで内訳が見える。

---

## 7. 送信後 7 日のフォローアップ

| Day | アクション |
|---|---|
| D+1 | `/admin/funnel` でその channel の流入確認、コメント返信 |
| D+3 | bounced（返信無し）の DM に 1 度だけ bump（"any feedback?"） |
| D+7 | 集計：channel ごとの provider 登録数を比較、効いてる方を倍がけ |

**stop loss:**
- どの channel も 7 日で 5 provider 登録未満 → メッセージング再考
- 全 channel 計で revenue $0 のまま 14 日 → 商品仮説を見直す（pricing? target?）

---

## ❌ やらない（時間泥棒）

- ~~Zenn 記事~~ — 日本人 dev 向け、buyer は海外もいるのでターゲット狭い
- ~~LinkedIn 投稿~~ — エンタープライズ感、indie dev が見ない
- ~~Twitter (X) で毎日投稿~~ — algorithm が follower 必要、cold start 困難
- ~~B2B 法人セールス~~ — Stripe 取らない単価、enterprise との fit 悪い

---

## 別添ファイル

- `marketing/target-mcp-creators.md` — DM 送り先 20 名のリスト
- `marketing/launch-checklist.md` — 各 channel の send-day チェックリスト
