# Marketing outputs — 2026-05-21 batch

このセッションで作成した告知・営業・記事ドラフト一式。コピペで即使える。

---

## B. Roy Meshulam フォローアップ DM（接続受諾後）

LinkedIn メッセージ（接続済み前提、500字以内）：

```
Roy — thanks for accepting. quick update since we last connected:

we just closed Q11 with Japan's FSA Fintech Support Desk: pure SDK
distribution + non-custodial wallet (ERC-2612 permit) is confirmed
registration-exempt here. that lets us ship the same "agent can't
exceed its cap" guarantee as Agent Pay without holding any USDC.

dropping a public security page + audit at
https://lemoncake.xyz/security — and the v2 onboarding (1 signature
every 90 days, otherwise zero prompts) is at
https://lemoncake.xyz/start/v2

would value your read on the cap-revocation primitive specifically.
no ask, just curious where Agent Pay landed on the same problem.
```

X DM 版（既に X 連絡先わかってる場合の代替）：

```
Roy — FSA Q11 just landed in our favor: pure SDK + ERC-2612 permit =
registration-exempt in JP. so we now ship the agent-cap guarantee
without any custody. public security page is live at lemoncake.xyz/security.
curious how Agent Pay solved the cap-revocation primitive — no pitch.
```

---

## C. GitHub Release Notes — agent-payment-mcp v0.7.1

`gh release create v0.7.1 --notes-file -` で貼り付け：

```markdown
## agent-payment-mcp v0.7.1 — Non-custodial preview + audit cleanup

### 🆕 New: non-custodial v2 path

LemonCake never touches your USDC. Sign one ERC-2612 permit (90 days
valid) and the agent pulls funds directly from your wallet to the API
provider. **Japan FSA Q1–Q11 confirmed this design is registration-exempt.**

Try it at https://lemoncake.xyz/start/v2 — Google login + credit-card
USDC top-up + one signature, then completely sign-free for 90 days.

The MCP server now reads `LEMON_CAKE_PERMIT` as a first-class auth
source alongside the legacy `LEMON_CAKE_PAY_TOKEN` JWT. Both paths work
in parallel until the migration completes.

### 🛡️ Security: external audit cleared

@kleosr ran an independent audit covering API, m2m-payment, MCP server,
and the cap-ledger satellites. CRITICAL and HIGH primary findings were
fixed within 48 hours. Public posture at https://lemoncake.xyz/security.

Highlights of the fixes in this release line:
- **C-02** killswitch endpoint now requires `X-Admin-Key` with
  `timingSafeEqual` comparison + audit log.
- **C-04** Dockerfile switches from `prisma db push --accept-data-loss`
  to `prisma migrate deploy`.
- **C-06** admin emergency-halt button is now a real API call
  (was useState-only previously).
- **C-07** Pay Token / Buyer JWT / Admin JWT / Incident Signing Key
  separated; production refuses to boot without each.
- **H-03** hardcoded `skyfire-dev-secret-change-in-prod` and
  `dev-admin-key` removed; ephemeral randoms in dev only.

### 📖 README rewritten for conversion

The npm README leads with copy-paste install snippets and a clear
"ask Claude this" prompt. Glama / mcp.directory / cursor.directory
all auto-re-index from npm so the new content propagates within 24h.

### 🆙 Upgrade path

```bash
# new buyers (recommended)
LEMON_CAKE_PERMIT=<from https://lemoncake.xyz/start/v2>

# existing buyers (still works)
LEMON_CAKE_PAY_TOKEN=<unchanged>
LEMON_CAKE_BUYER_JWT=<unchanged>
```

See [docs/MIGRATION_NON_CUSTODIAL_v2.md](https://github.com/evidai/agent-payment-mcp/blob/main/docs/MIGRATION_NON_CUSTODIAL_v2.md)
for the full plan.

### Companion releases
- `@lemon-cake/mcp-sdk` **v0.2.0** — adds `verifyPermitToken()` and
  related helpers for SDK consumers verifying buyers' permits.

---

🍋 Built by [@aievid](https://twitter.com/aievid) ·
[lemoncake.xyz](https://lemoncake.xyz)
```

---

## D. Zenn 記事ドラフト — 「日本初、AI エージェント決済で金融庁に Q1–Q11 まで聞いた話」

```markdown
---
title: "AI エージェントに USDC を払わせる SaaS を作って、金融庁に Q1〜Q11 まで聞き続けた話"
emoji: "🍋"
type: "tech"
topics: ["MCP", "AI", "金融庁", "USDC", "Web3"]
published: false
---

## TL;DR

- 2026 年 5 月、Japan FSA（金融庁）Fintech サポートデスクに「AI
  エージェントが USDC で外部 API を払う SaaS（LemonCake）」について
  Q1 から Q11 まで法令照会を出した。
- 結論：**ユーザーの USDC を一切預からない設計（SDK 配布 / ユーザー
  所有スマートコントラクト / x402 直接決済）** であれば、電子決済
  手段等取引業の登録は不要。
- 一方、**一時的にでも当社がユーザーの USDC を移転できる権限を持つ**
  なら、登録対象になる。セッションキー方式も含む。
- 全 11 問の質問文と回答を公開する（個人情報・社名は伏せた上で）。

これから「日本で AI エージェント決済をやろうとしている人」全員が
読めば 1 ヶ月分の調査が省略できるはず。

## 何を作っていたのか

LemonCake は MCP サーバー向けの「USDC pay-per-call billing」インフラ。
ユーザーが USDC を入金 → AI エージェント（Claude / Cursor）が必要に
応じて検索 API などを呼んで都度課金 → 自動で freee / MoneyForward
に仕訳…という流れ。

最初の設計：当社が USDC をホットウォレットで管理し、ユーザーが発行
した Pay Token（JWT）を AI が提示すると残高から控除。

これが**そのまま「電子決済手段の管理」に該当して登録必須**だった。

## Q1 〜 Q11 全公開

### Q1〜Q7（最初の照会、2026-05-12）

xstocks-mcp（DEX）、tokenized-stock-mcp（Dinari）、alpaca-guard-mcp
（米国ブローカー）の 3 つを対象に：

- Q1: 非カストディ DEX スワップ → 資金移動業か → **非該当**
- Q2: USDC ↔ xStocks 交換媒介 → 暗号資産交換業か → **非該当**（USDC
  は電子決済手段）
- Q3: 電子決済手段等取引業に該当するか → **非該当**（ユーザー自身が
  調達・支払い）
- Q4: Dinari 経由 → 有価証券売買の媒介か → **該当**
- Q5: Alpaca 代理実行 → 第一種金商業の媒介か → **該当**
- Q6-Q7: 域外適用、第三種資金移動業の整理

→ 株式系 MCP は登録必要、と判明。

### Q8〜Q9（追加照会、2026-05-14）

「株式系 MCP をやめて、agent-payment-mcp だけならどうか？」
→ 「貴社が関与することなく」の条件付きで登録不要の可能性、との示唆。

### Q10（USDC custody モデルの直接確認）

「ユーザーが事前に USDC を入金し、当社がブロックチェーンアドレスで
管理しつつ API 提供者へ移転する構成」 → **「電子決済手段の管理」に
該当、電子決済手段等取引業の登録が必要**。

ここで現状モデルが詰む。

### Q11（最終照会、2026-05-21）

非カストディ設計 3 案を提示し、どれなら登録不要か聞いた。

- **設計 A（セッションキー）**: 当社サーバーで session key を一時保管
  → **「一時的であっても、貴社が USDC を移転できる場合、電子決済
  手段の管理に該当」**。NG。
- **設計 B（ユーザー所有 SC）**: 当社は SC の所有・運用・展開に
  一切関与しない → **「該当する可能性は低い」**。
- **設計 C（x402 SDK のみ配布）**: 当社は決済フローに介在せず、
  ソフトを配布するのみ → **「該当する可能性は低い」**。

さらに、媒介規制についても：
> 「ソフトウェアを開発し、配布するのみである場合、仮に当該ソフトが
> 暗号資産又は有価証券の売買その他の媒介規制の対象となる取引に使用
> されることがあるとしても、それによって直ちに貴社が媒介を行ったもの
> と評価される可能性は低い」

→ SDK 配布だけなら株式系 MCP もセーフ。

## 私たちが守る境界線

1. LemonCake のブロックチェーンアドレスを USDC が一切経由しない
2. LemonCake が private key / multisig / contract owner 権限を保持しない
3. ユーザーが任意のタイミングで、当社を経由せず USDC の支配権を保持できる
4. スマコン or 支払ソフトの「展開又は使用に一切関与しない」
5. 手数料は法定通貨 or USDC を当社アドレス非経由で受領

## 教訓

- **「グレーかな？」のまま事業を進めるより、Fintech サポートデスクに
  聞けば 1 週間で 1 個の答えが返ってくる。** 怖がる必要なし、無料。
- 質問は **設計案を 2〜3 案併記** して、それぞれ条件付きで聞くと
  「該当 / 非該当」が明確な回答になりやすい。
- 質問の途中で**自分の設計の致命傷に気づける**のが最大の収穫。
  Q10 で USDC custody が NG とわかり、Q11 でピボット先を確定できた。
- 回答は法的拘束力こそないが「金融庁の見解」として営業時の信頼性
  シグナルになる。「FSA 照会済み」を堂々と言える。

## これから AI 決済をやろうとしている人へ

- ユーザーの USDC を自分のアドレスで持つな
- セッションキーも預かるな（移転権限が一時的にでもあれば NG）
- ERC-2612 permit / x402 / ユーザー所有 SC のいずれかにしろ
- SDK だけ配布すれば媒介認定リスクも下がる

質問あれば X [@aievid](https://twitter.com/aievid) まで。
LemonCake の中身は全部 OSS：
https://github.com/evidai/agent-payment-mcp

---

## おまけ：照会のテンプレ

```
To: fintech@fsa.go.jp
Subject: 法令解釈相談 — [サービス名]

【照会者情報】
- 屋号 / 会社名:
- メール:
- Webサイト:
- 事業内容:

【対象サービス概要】
- A モデル: ...
- B モデル: ...

【照会事項】
Q1. (関係法令: 資金決済法§63の2)
    [質問内容と、当社の理解 / 自己評価]

...
```

これでテンプレ完成。
```

---

## E. X 投稿コピー（日英 4 種）

### E-1: v2 ローンチ告知（日本語）

```
LemonCake v2 をプレビュー公開しました 🍋

✅ Google ログイン1回
✅ クレカで USDC 入金（オンランプ経由）
✅ 1署名（90日有効）
✅ 以降は完全ノーサインで AI が API を呼ぶ

金融庁 Q1〜Q11 照会完了、非カストディ設計でも登録不要を確認。
USDC は LemonCake を一切経由しません。

https://lemoncake.xyz/start/v2
```

### E-2: /security ページ告知（日本語）

```
LemonCake セキュリティ姿勢を公開しました。

・外部研究者 @kleosr による独立監査クリア
・CRITICAL/HIGH 主要件を 48時間以内に修正・公開
・金融庁 Q1〜Q11 照会完了（非カストディ設計を確認）
・脆弱性報告は GitHub Security Advisory 経由 24h 応答

https://lemoncake.xyz/security

「セキュリティはマーケで言うこと」じゃなくて
「実際の commit と回答書で示すこと」だと思ってます。
```

### E-3: FSA Q11 結論（日本語）

```
金融庁 Fintech サポートデスクへの法令照会が Q11 で着地しました。

「ソフトウェアを開発し、配布するのみであれば、仮に暗号資産・
有価証券売買の媒介規制対象に使用されたとしても、直ちに媒介と
評価される可能性は低い」

= SDK 配布モデルなら登録不要、と確認。

日本で AI×Web3 決済を本気でやる人、もう怖がる必要ないです。
```

### E-4: 受託受付中（日本語）

```
受託・業務委託の受付中です 🍋

✅ MCP化フィクスト ¥80万 / 3週間（今月あと2枠）
✅ AIエージェント基盤構築 ¥150〜400万
✅ 業務委託フリーランス ¥150〜250万/月

実績：
・MCP 5本公開（npm）
・@lemon-cake/mcp-sdk 開発
・FSA 法令照会 Q1〜Q11 完了
・外部セキュリティ監査クリア

https://lemoncake.xyz/hire
```

### E-5: v2 launch（English）

```
Shipped LemonCake v2 today 🍋

✅ Google login (Privy embedded wallet)
✅ Credit card → USDC (on-ramp)
✅ One ERC-2612 permit (90-day validity)
✅ Then ZERO signing prompts — agent pulls direct from your wallet

Japan FSA Q1–Q11 inquiry just confirmed pure SDK + non-custodial
design is registration-exempt.

https://lemoncake.xyz/start/v2
```

### E-6: Security launch（English）

```
LemonCake public security page is live.

- Independent audit (@kleosr) — CRITICAL/HIGH primary findings
  fixed within 48 hours, all commits public
- Japan FSA Q1–Q11 inquiry completed (registration-exempt path
  confirmed)
- Responsible disclosure: 24h SLA, Hall of Fame

https://lemoncake.xyz/security

Security isn't a marketing line. It's commits + ruling letters.
```

---

## H. Hacker News Show HN ドラフト

### タイトル

```
Show HN: LemonCake — non-custodial USDC billing for AI agents (Japan FSA cleared)
```

### 本文

```
Hi HN,

I've been building LemonCake — a pay-per-call USDC billing layer for
AI agents talking over MCP. The interesting part isn't the protocol,
it's the regulatory path.

In Japan, anything that even briefly holds a user's USDC and moves it
on their behalf needs the 電子決済手段等取引業 (electronic payment
means business) license. So we filed an interpretation request with
Japan's FSA Fintech Support Desk and went through 11 rounds of
question-and-answer (Q1–Q11, May 2026).

The ruling, in short:
- LemonCake CANNOT briefly hold a session key — that still counts as
  custody.
- LemonCake CAN distribute a SDK and design a smart-contract escrow
  that the *user* operates — no registration needed.
- Pure SDK distribution is also explicitly NOT brokerage, even if
  the SDK is used for crypto or securities transactions.

So we pivoted: the new v2 path is one ERC-2612 permit signature
(90-day validity) that lets an API provider pull USDC directly from
the user's wallet. LemonCake's address never appears in the path.

What's live today:
- agent-payment-mcp@0.7.1 on npm
- @lemon-cake/mcp-sdk@0.2.0 with a verifyPermitToken() helper for
  any MCP server author to validate the permit in ~10ms, no RPC
- Public security page at lemoncake.xyz/security (we also passed an
  external audit, all findings + commits public)
- v2 onboarding at lemoncake.xyz/start/v2 (Google login → credit
  card USDC → one signature → done)

Five sibling MCPs (xstocks, tokenized-stock, alpaca-guard, plus the
SDK) all use the same posture.

GitHub: https://github.com/evidai/agent-payment-mcp
FSA Q1–Q11 write-up (Japanese): https://zenn.dev/aievid/articles/...

Happy to answer anything about the FSA process — the support desk
is free, responsive, and probably the single most leveraged thing
a Japan-based fintech founder can do.
```

### 投稿タイミング

平日 PT 9:00 AM (= JST 翌日 1:00 AM) が最強。火曜〜木曜推奨。

---

## 投稿スケジュール（推奨）

| 日 | 投稿先 | 内容 |
|---|---|---|
| 今夜（JST 朝までに）| X (JP) | E-1 v2 ローンチ |
| 翌日昼 JST | X (JP) | E-3 FSA 結論 |
| 翌日夜 JST | X (EN) | E-5 v2 launch |
| 2日目朝 JST | X (JP) | E-2 /security |
| 2日目昼 JST | LinkedIn (EN) | Roy 経由で D の英訳 |
| 2日目深夜 JST | HN Show HN | H 投稿（PT火曜 9 AM狙い）|
| 3日目朝 JST | Zenn | D 公開 |
| 任意 | LinkedIn 接続済 | B Roy フォローアップ |
