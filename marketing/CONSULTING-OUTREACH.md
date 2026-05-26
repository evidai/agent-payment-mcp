# Consulting cold outreach — 2026-05-26

**Goal:** book 2-3 paid x402 / agent payment integration gigs in next 14 days.
**Withdraw line:** if 0 replies after 20 sends + 1 follow-up bump = stop, refocus on grant + product.

---

## Cold email template (3-sentence, English) — MPP-aware

After Stripe Sessions 2026 shipped Machine Payments Protocol (MPP), the pitch
is **NOT** "use us instead of Stripe" — it's "use us **alongside** Stripe / Tempo,
on Base/USDC, with the geo and KYA bundle Stripe can't ship."

```
Subject: x402 + MPP integration for {{company}}?

Hi {{first_name}},

I'm Hiroto — built lemoncake.xyz (FSA non-custodial cleared, 5 production MCPs on npm,
x402 facilitator live on Base, now MPP-compatible).

{{specific_observation_about_their_product}} — we ship a Stripe MPP-compatible Base/USDC
facilitator into your API in 2 weeks, $5k flat. ERC-2612 permit so your agents sign once
and get a 90-day spending cap; KYA bundle included; works alongside (not against) Stripe MPP.

15-min intro this week? Or just reply with "tell me more" — I'll send a 1-page scope.
https://lemoncake.xyz/consulting · https://lemoncake.xyz/pricing

— Hiroto
contact@aievid.com · @aievid · github.com/evidai
```

**Variant for Japanese targets** (shorter, more casual):

```
件名: {{company}} の API、x402 + MPP 統合のご相談

{{first_name}} 様

evidai の Hiroto です。lemoncake.xyz (FSA 非カストディ確認済 / npm に 5 つ MCP / x402 facilitator 本番稼働 / Stripe MPP 互換) を運営してます。

{{specific_observation}} — Stripe MPP 互換の Base/USDC facilitator を 2 週間 / $5k 固定で組み込めます。Stripe MPP と並走可、ERC-2612 permit で 90 日 spending cap、KYA bundle 同梱。**日本国内の USDC onramp を持つのは現状当社のみ** (Stripe Crypto Onramp は JP 非対応)。

15 分の intro お時間いただけますか。詳細: https://lemoncake.xyz/consulting · https://lemoncake.xyz/pricing

— Hiroto
contact@aievid.com
```

---

## Target list — 20 contacts (priority order)

### Tier S — already touched (warm re-engage)

Memory note: R1-R4 rounds already sent partnership pitches. These get a *different* pitch — "instead of partnership, want us to just build it for $5k?".

| # | Company | Contact path | Why now | Hook |
|---|---|---|---|---|
| 1 | **Modal Labs** | reply to R2 thread | Pay-per-call container exec is their bread; metering is an obvious gap | "Saw your function URL pricing — adding x402 lets serverless agents pay you directly without API keys" |
| 2 | **Pipedream** | reply to R2 thread | They monetize workflows; agent-paid workflows is upside | "Your workflow URLs are already HTTPS — x402 turns them into one-shot paid endpoints, zero API-key handoff" |
| 3 | **LangChain** | reply to R2 thread | They sell LangSmith ($/seat); $/call for tool authors is unsolved | "Tool authors in LangGraph have no monetization layer — x402 fixes that in one PR" |
| 4 | **LlamaIndex** | reply to R3 thread | Same gap, smaller user base but more crypto-friendly | "LlamaCloud retrieval is per-request priced — x402 lets agents pay you directly, skip the org-account model" |
| 5 | **Replicate** | reply to R3 thread | Per-prediction billing exists, but tied to user accounts; agent-paid would unlock new buyer class | "Your prediction billing is per-second; x402 wrapper lets agents top-up via USDC, no account creation" |

### Tier A — x402 / Coinbase orbit (cold)

| # | Company | Contact | Why now | Hook |
|---|---|---|---|---|
| 6 | **Coinbase Developer Platform** | x402 spec team, via Discord / Twitter | They own the spec; would benefit from independent facilitators | "Built an independent x402 facilitator on top of CDP — if you need a ref implementation or partner consultant, here's a track record" |
| 7 | **Coinbase Bazaar** team | same channel | Bazaar lists x402-paid APIs; integration consultant is natural fit | "Helping APIs ship x402 in 2 weeks — happy to refer Bazaar listings post-integration" |
| 8 | **Anthropic Developer Relations** | reply to Directory submission email | We submitted lemon-cake-0.5.0 to Anthropic Directory; warm thread | "Following up on Directory review — also offering paid integration for partners wanting MCP + x402 in their stack" |
| 9 | **OpenAI Operator team** | cold, via someone at OpenAI in network | Operator agents need spend caps; x402 is one path | Skip if no warm intro — too cold |
| 10 | **Anchorage / Fireblocks** API teams | LinkedIn cold | Custody side of x402 settlement; consulting buyer possible | "Building non-custodial facilitator on Base — interested in your settle / refund integration patterns" |

### Tier B — adjacent SaaS / agent infra (cold)

| # | Company | Contact | Hook |
|---|---|---|---|
| 11 | **Vercel AI team** | reply to R3 thread | "AI SDK has streaming costs but no per-call monetization — x402 fits cleanly" |
| 12 | **Cohere** | reply to R3 thread | "Embed API per-token is fine for orgs; for agents, x402 + ERC-2612 = zero account onboarding" |
| 13 | **HuggingFace Inference** | reply to R3 thread | "Inference Endpoints per-hour pricing leaves money on table for spike agents — x402 captures it" |
| 14 | **Trigger.dev** | cold via founders' Twitter | "Workflow-as-API platform; x402 per-trigger billing for agent buyers" |
| 15 | **Inngest** | cold via founder | "Same pitch — agent-paid event triggers" |

### Tier C — Japan-specific (warm, native language)

| # | Company | Contact | Hook |
|---|---|---|---|
| 16 | **JPYC 株式会社** | warm via Tokyo grant context | "新 JPYC + USDC のクロス決済 facilitator、補助金協業先として検討いただけませんか" |
| 17 | **Sakana AI** | cold via Twitter / contact | "AI agent の M2M 決済 layer、Sakana のエージェント製品に組み込みませんか" |
| 18 | **Preferred Networks** | cold via PR contact | "Plamo agent 群への決済 layer、コンサル枠でお手伝いできます" |
| 19 | **freee / MoneyForward** API teams | warm via Q2 2026 partnerships in progress | "AI agent 経由の自動仕訳、x402 + 既存連携で 2 週間でデモ可" |
| 20 | **メルカリ / Stripe Japan** | cold via Twitter | "JP 国内の agent 決済、補助金 + ライセンス path で唯一動いてる事例があります" |

---

## Execution sequence

**Day 1 (今日):**
- [x] /consulting LP live
- [ ] FleetView から /consulting deploy 確認 (Vercel 自動)
- [ ] Tier S 5 件のスレッド掘り起こし、reply 用 draft 作成 (cold ではなく既存スレに reply)

**Day 2 (明日):**
- [ ] Tier S 5 通送信 (午前)
- [ ] Tier A 5 通送信 (午後)
- [ ] Twitter DM Tier B-C の founder 5 名 (夜)

**Day 3-4:**
- [ ] Tier B 5 通送信
- [ ] Tier C JP 5 通送信 (日本語版テンプレ)
- [ ] LinkedIn 補完 (返事ない先に follow up)

**Day 7 (1 週間後):**
- [ ] 反応 0 の先に "just bumping" 1 行 follow-up
- [ ] 計測: 送信数 / 開封 / 返信 / intro 取れた数

**Day 14 (2 週間後):**
- [ ] 撤退判定
  - 返信率 < 10% (= 2 件未満) → 撤退、product 注力
  - 返信率 ≥ 10% かつ intro 1 件以上 → 継続、Tier 拡張

---

## ルール

1. **fixed price のみ提示**、hourly に逃げない (営業の核)
2. **「無料 PoC」「無料相談」は禁句** — 値段でフィルタしないと時間が溶ける
3. **3 sentence 厳守** — 5 行以上は読まれない
4. **specific observation 必須** — テンプレ感を消す唯一の方法
5. **24h 以内に返事 / 1 通 / 1 件 が KPI**、open rate は無視

---

## 計測場所

- 送信ログ: ~/.claude/scheduled-tasks/consulting-outreach-log.md (毎日追記)
- 返信トラッキング: Gmail label `consulting/outreach-2026-05`
- intro 件数: 週 1 で本ファイル末尾に集計

---

## 既存 marketing tasks の処遇

Day 4 launch (X / Reddit / Discord) 5 本 はそのまま走らせる but **CTA を /trade → /consulting も併記** に変えた方がリードが拾える可能性あり。判断は別途。

---

## Tier S — 5 件の cold email draft (即送信可、specific observation 入り)

それぞれ既存 R2-R3 で touch 済みの thread に **reply** する形 (新規メールではなく)。
件名はそのまま継続でも OK、もし返事なかった thread が古ければ件名を「Re: ... + MPP migration?」に変えると最近性が出る。

### 1. Modal Labs — Modal Sandbox MCP の決済 hook

```
Subject: Re: Modal + agent payment — now MPP-aware

Hi Erik / Akshat,

Quick follow-up on my earlier note about Modal × agent payments. Stripe Sessions
2026 shipped MPP last week, which changes the conversation: instead of "should
we add an agent billing layer," it's now "which facilitator do we route MPP-signed
calls through."

Modal's serverless function URLs are already HTTPS endpoints — the cleanest place
in the entire agent stack to bolt x402 + MPP. Two-week sprint, $5k flat, drop-in
middleware that accepts MPP-signed payments and settles them on Base/USDC.
Includes a /pricing + /docs page draft so your users see it the moment it lands.

Open to a 15-min intro this week? Happy to send the 1-page scope first.

— Hiroto
contact@aievid.com · github.com/evidai
https://lemoncake.xyz/consulting · https://lemoncake.xyz/pricing
```

### 2. Pipedream — workflow URL の monetization

```
Subject: Re: Pipedream + per-trigger agent payment

Hi Tod / Dylan,

Following up on the partnership note from a couple weeks back — wanted to flag
that the calculus changed after Stripe Sessions 2026 (MPP shipped, Tempo mainnet).

Pipedream workflow URLs are basically already the "atomic billable unit" for agent
commerce — a public HTTPS endpoint, one canonical action per trigger. The 2-week
$5k integration we're offering now ships MPP-compatible x402 alongside your
existing Stripe Connect, so paid workflow URLs can be invoked by MPP-signed
agents *or* card-paying humans, no fork.

Worth a 15-min call? I can pre-share the integration diagram.

— Hiroto
contact@aievid.com · github.com/evidai
https://lemoncake.xyz/consulting · https://lemoncake.xyz/pricing
```

### 3. LangChain — LangGraph tool monetization

```
Subject: Re: LangChain — tool author monetization for LangGraph

Hi Harrison / team,

Earlier note from me was about LangSmith × agent commerce. The interesting
update: MPP just landed, which finally gives tool authors a portable signing
spec — but no one in the LangGraph ecosystem can settle MPP payments today.

We could ship a LangChain-native `lc.tools.paid()` decorator that wraps any
tool with an MPP-compatible x402 facilitator. Tool author defines a price,
agent's wallet auto-charges per call, settled on Base/USDC with hard cap from
ERC-2612 permit. Two-week build, $5k flat — could be a LangChain-shipped
integration if there's interest.

Worth a 15-min? Happy to lead with a working PoC video first if that's easier.

— Hiroto
contact@aievid.com · github.com/evidai
https://lemoncake.xyz/consulting · https://lemoncake.xyz/pricing
```

### 4. LlamaIndex — LlamaCloud retrieval pricing

```
Subject: Re: LlamaCloud × agent-paid retrieval

Hi Jerry / team,

Quick MPP-driven follow-up. LlamaCloud retrieval is priced per-request today,
billed to a LlamaCloud org account. Post-MPP, an interesting unlock: each
retrieval call can be paid directly by the agent's wallet, no org account
required, no API-key handoff.

2-week, $5k flat integration: MPP-compatible x402 facilitator on top of your
existing retrieval endpoints. Agents top up via USDC on Base, ERC-2612 permit
caps daily spend, LlamaCloud takes a take rate without invoicing seats.
Includes the docs page.

15-min to walk through? I can share the architecture sketch beforehand.

— Hiroto
contact@aievid.com · github.com/evidai
https://lemoncake.xyz/consulting · https://lemoncake.xyz/pricing
```

### 5. Replicate — per-prediction agent billing

```
Subject: Re: Replicate × agent-paid predictions

Hi Ben / team,

Earlier note was about R3 partnership exploration. The MPP launch reshapes
the question — Replicate predictions are already per-second billed, the
missing piece is letting an agent pay for predictions without inheriting
its operator's API key.

2-week $5k flat: MPP-compatible x402 wrapper that lets an agent's wallet pay
per prediction directly. ERC-2612 permit handles daily caps, Base/USDC for
settlement. Net effect: a new buyer class (autonomous agents) using Replicate
without onboarding into org accounts. Includes the integration PR.

Open to a quick 15-min call?

— Hiroto
contact@aievid.com · github.com/evidai
https://lemoncake.xyz/consulting · https://lemoncake.xyz/pricing
```

---

## 送信前チェックリスト (Tier S)

- [ ] 全 5 通、過去 thread の subject line をコピーして "Re:" 付ける (新規 thread だと bury される)
- [ ] 各社の最近の release を 1 行だけ specific observation に差し込む (LinkedIn / Twitter で 2 分確認)
- [ ] /pricing が live になってることを確認 (https://lemoncake.xyz/pricing が 200)
- [ ] 送信は 1 時間スパンで分散 (Gmail spam フィルタ回避)
- [ ] 各送信後、Gmail label `consulting/outreach-2026-05` を付与

---

## Tier A — 5 件の cold email draft (x402 / Coinbase 周辺、新規 cold)

Tier S とは違い **新規 cold**。R2-R3 thread はないので件名から作る。
全件 MPP-aware かつ「Coinbase / x402 spec への deference」を見せて、敵対しない pitch。
warm intro があれば優先 (Anthropic Directory は提出済 thread を follow up できる)。

### 6. Coinbase Developer Platform (x402 spec team)

接触経路: x402 spec の GitHub issue / Coinbase Dev Discord / Twitter (@CoinbaseDev) — メールより public channel の方が見られる確率高い。

```
Subject: x402 facilitator implementer — partnership / reference impl?

Hi x402 team,

I'm Hiroto (evidai) — built an independent x402 facilitator on top of CDP
(now live at lemoncake.xyz, 5 production MCPs already paying through it).
After Stripe Sessions 2026 dropped MPP, I refit the facilitator to settle
MPP-signed payments on Base/USDC — keeping x402 as the gateway spec.

Two things you might find interesting:
  1. Reference implementation: we're MIT-licensing the permit/facilitator
     kit later this month. Happy to flag the PR if the spec docs want a
     non-Coinbase impl to link.
  2. Edge cases we hit: JP onramp (Stripe Crypto Onramp doesn't serve
     Japan, so we built a parallel JPY → USDC → Base flow). Worth a
     spec note if Bazaar wants JP-buyer-reachable APIs.

Open to a 15-min call if either is useful. Otherwise feel free to
ignore — just wanted to surface it.

— Hiroto
contact@aievid.com · github.com/evidai · https://lemoncake.xyz/pricing
```

### 7. Coinbase Bazaar team

```
Subject: x402 / Bazaar listing — partner consultant for new entrants?

Hi Bazaar team,

I'm Hiroto — run a Bazaar-listed x402 facilitator (lemoncake.xyz) and
have shipped 5 production MCPs that route paid calls through it.

I get inbound from teams who want to list on Bazaar but don't have the
in-house bandwidth to wire up x402 + MPP. We're offering a fixed-price
($5k / 2-week) integration package — would Bazaar want us as a referral
partner for new applicants? No cost to Coinbase; we'd just take the
direct contract and ensure they end up Bazaar-listed at the end.

15-min if there's mutual interest, otherwise no worries.

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

### 8. Anthropic Developer Relations (Directory submission follow-up)

接触経路: 既に Anthropic Directory submission の thread あり (memo 参照: project_anthropic_directory_submission)。そこに reply.

```
Subject: Re: LemonCake Directory submission — also offering MCP+x402 integration help

Hi {{reviewer name from existing thread}},

Quick update on lemon-cake-0.5.0 (Directory submission, week of 5/8) —
also wanted to flag: post-Stripe-Sessions-2026, we're now MPP-compatible
and offering paid integration help to partners who want MCP + x402 in
their stack. Fixed price, $5k / 2 weeks, written deliverable.

If any Directory-listed partners ask about agent payment integration on
the side, happy to be the referral. We've already touched Modal,
Pipedream, LangChain, LlamaIndex with that pitch — happy to share early
signal if helpful for your partner sales.

Otherwise no follow-up needed, just keeping the thread useful.

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

### 9. Anchorage Digital — agent-payment custody settle

接触経路: LinkedIn cold (個別 employee) or contact form。

```
Subject: x402 facilitator + institutional custody settle — pattern question

Hi Anchorage team,

I'm Hiroto (evidai) — built a non-custodial x402 facilitator on Base
(lemoncake.xyz). Settling 5 production MCPs through it, $0.005/tx public
pricing, MPP-compatible.

I get the question often: "what if the buyer is a regulated fund that
needs Anchorage custody for the USDC?" The settle pattern between
non-custodial agent permit and qualified custody isn't documented
anywhere I've found.

Would Anchorage be open to a 30-min call to compare notes? I'm not
selling — genuinely trying to figure out whether there's a clean way
for permit-based agent payments to settle out of Anchorage-held USDC
without breaking either side's compliance posture.

— Hiroto
contact@aievid.com · github.com/evidai
```

### 10. Fireblocks — same pattern, institutional rail

```
Subject: ERC-2612 permit + Fireblocks-held USDC settlement — feasibility

Hi Fireblocks team,

I'm Hiroto, run lemoncake.xyz (x402 facilitator on Base, MPP-compatible,
non-custodial). 5 production MCPs paying through it today.

Hypothetical: agent operator wants to hand the agent a 90-day ERC-2612
permit, but the underlying USDC lives in a Fireblocks vault. Today my
facilitator can't settle out of a Fireblocks-custodied wallet because
the permit signing flow assumes EOA control of the spend key.

Is there a known integration pattern for ERC-2612 permits signed via
Fireblocks policy engine? If not, would 30 min on a call be useful — I
can describe what builders are asking for from our side, you can tell
me if it's already on roadmap or off the table.

— Hiroto
contact@aievid.com · github.com/evidai
```

---

## 送信前チェックリスト (Tier A)

- [ ] Tier S → 1 週間後の **Tue 2026-06-02 〜 Wed 06-03** に送る (Tier S の返事を待ってから判断)
- [ ] Coinbase 2 件は Twitter / Discord 経由を試して反応見てから email、最初から email でもいい
- [ ] Anthropic は **Directory thread に reply**、新規 cold ではない
- [ ] Anchorage / Fireblocks は LinkedIn 経由が反応高い (cold メールは spam フィルタ通りにくい)
- [ ] /pricing と /consulting URL が両方 200 で生きてること確認
- [ ] 返事 1 件でも来たら Tier B / C は止めて intro 確保に全力 (時間配分間違えない)

---

## Tier B — 5 件の cold email draft (SaaS / AI infra、cold)

Tier S と Tier A の反応見て、まだ余地あれば Tue 2026-06-09 〜 Wed 06-10 で送る。
全て **新規 cold**。R3 で touch 済みも一部あるが、改めて consulting offer として送る。

### 11. Vercel AI team

接触: vercel.com/contact、Twitter (@vercel), LinkedIn (Lee Robinson / Guillermo Rauch にはまず DM)。

```
Subject: AI SDK × per-call agent payment — integration consultant available

Hi Vercel AI team (Lee / Guillermo),

I'm Hiroto (evidai) — built lemoncake.xyz, the x402 facilitator that's
now MPP-compatible. Watching the AI SDK ship streaming + tool calling
into the default Next.js setup.

The piece that AI SDK doesn't have today is monetization for tool authors.
Most SDK users hand-roll their own metering or skip it entirely. We could
ship a Vercel-native `paid()` wrapper that turns any tool into a per-call
USDC endpoint, gas-sponsored up to 1k tx/mo, MPP-signed.

2-week / $5k integration if Vercel wants this as a partner ship; happy to
also just be on the bench for AI SDK users who ask about pay-per-call.

15-min call worth booking?

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

### 12. Cohere

```
Subject: Cohere API × agent-paid embeds — consultant proposal

Hi Cohere team,

I'm Hiroto, lemoncake.xyz (x402 facilitator, MPP-compatible, FSA-cleared).

Cohere Embed v3 priced per-token is fine for orgs, but agents-as-buyers
can't easily onboard without inheriting a Cohere org account + API key.
We could wrap Cohere endpoints with an MPP-compatible x402 facilitator
so an agent's wallet pays per-call directly — no API key sharing, no
seat-based pricing.

2-week / $5k. Includes the wrapped endpoints, docs, and an example
LangChain / LlamaIndex integration. Could be a Cohere-shipped paid SDK
or just a partner-listed third-party — your call.

Worth a 15-min?

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

### 13. HuggingFace Inference team

```
Subject: HF Inference Endpoints × agent-paid inference

Hi HF Inference team,

Hiroto here, run lemoncake.xyz (x402 + MPP facilitator).

Inference Endpoints today bill per-hour, which leaves money on the table
for spike-y agent traffic (1k calls in a minute, then nothing for an
hour). x402 + ERC-2612 permit captures that pattern cleanly — agent
pre-authorizes spend cap, pays per call as it makes them.

2-week / $5k to wrap your Inference Endpoints API with an x402 + MPP
facilitator layer. Listing on HF Hub as an optional addon. Includes the
docs PR.

Worth a 15-min?

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

### 14. Trigger.dev

```
Subject: Trigger.dev × per-job agent payment

Hi Trigger.dev team (Eric / Matt),

I'm Hiroto — built lemoncake.xyz, an MPP-compatible x402 facilitator
that 5 production MCPs route paid calls through today.

Trigger.dev jobs are basically the perfect "agent-paid event" primitive
— atomic, deterministic, idempotent. We could add an `agentPayments`
trigger option that requires an MPP-signed payment to enter the job
queue. Builders charge per execution, agents pay in USDC, you get a
metering surface to upsell.

2-week / $5k. Could be Trigger.dev-shipped or partner-listed.

15-min call?

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

### 15. Inngest

```
Subject: Inngest × per-event agent payment monetization

Hi Inngest team (Dan / Tony),

I'm Hiroto, lemoncake.xyz facilitator (x402 + MPP on Base).

Inngest customers ship event-driven workflows — most of which could be
sold per-trigger to AI agents that don't have humans in the loop. We
could wrap Inngest function URLs with x402 / MPP middleware so agents
pay per event. Free 1k tx/mo, $0.005/tx after.

2-week / $5k for the integration + docs.

15-min if there's interest?

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

---

## Tier C — 5 件 (Japan-specific、日本語ネイティブ)

JP 規制 + JP onramp が **構造的 wedge** なので、ここは英語版 cold より「日本の AI agent 決済を解決できる唯一の事業者」という positioning で強気に。
東京補助金結果出る前から signaling 始めてよい。

### 16. JPYC 株式会社 (warm)

接触経路: 既に Tokyo grant 関連で warm (project_tokyo_jpyc_grant_2026)、岡部氏 X DM ルートあり。岡部氏に DM、または info@ にメール。

```
件名: JPYC × USDC クロス決済 facilitator のご提案

岡部 様

evidai の Hiroto です。lemoncake.xyz (FSA 非カストディ確認済、x402 + MPP 互換 facilitator) を運営しています。東京都ステーブルコイン補助金で JPYC 連携を主軸に申請中、本件で改めてご相談です。

ご提案: JPYC を Polygon 上 ERC-2612 permit と組み合わせて「JPY 建て agent 決済」の唯一の事業者になりたい、貴社の新規制対応版 JPYC (Polygon 0xE7C3D8C9...) と当社 facilitator を統合する PoC を 2 週間 $5k で着手可能です。具体的には:

1. permit 署名 → JPYC 自動チャージ → 海外 API 決済時に USDC へリアルタイム swap
2. 補助金採択時は協業先として申請文書に明記、JPYC の認知度向上に寄与
3. 海外 AI agent が JPY 建てで日本の API 提供者へ支払う唯一の経路

15 分の意見交換のお時間いただけますか。

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

### 17. Sakana AI

接触: Sakana AI contact form、X (@SakanaAILabs)、David Ha LinkedIn。

```
件名: Sakana エージェント製品向け M2M 決済 layer

Sakana AI 様

evidai の Hiroto と申します。AI agent 向けの M2M 決済 infra (lemoncake.xyz, FSA 非カストディ確認済) を運営しています。

Sakana の自律エージェント研究を SaaS 化する際、M2M 決済層をフルスクラッチで作るのはコストが見合わないはず。x402 + Stripe MPP 互換の facilitator を 2 週間 / $5k で組み込めます。日本国内向けには JPYC、海外向けには USDC で受領、ERC-2612 permit で daily cap を on-chain で保証。

Sakana の研究成果を商用化する際の「決済 plumbing」を担うパートナーとしてご検討いただけませんか。15 分お時間いただけると幸いです。

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

### 18. Preferred Networks (PFN)

接触: PFN PR / info@、Plamo / pfgen 関連の担当者 LinkedIn。

```
件名: Plamo エージェント向け USDC / JPYC 決済 layer のご提案

Preferred Networks 様

evidai の Hiroto です。lemoncake.xyz (非カストディ x402 + MPP facilitator) を運営、5 つの本番 MCP を npm に出しています。

Plamo を agent 化して外部 API を呼ばせる際、M2M 決済 layer は不可欠です。当社 facilitator を 2 週間 / $5k で Plamo の inference / agent パイプラインに組み込めます。FSA 非カストディ確認済 + 東京都補助金申請中なので、日本企業との連携が compliance 上スムーズです。

15 分の意見交換、もしくは技術担当者へ転送いただくだけでも助かります。

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

### 19. freee / MoneyForward API team (warm)

接触: 既存 partnership thread あり (memory: project_directory_reviews_pending の freee 再申請関連)。担当者に reply。

```
件名: Re: freee API × AI agent 自動仕訳の有償 PoC

freee 担当 様 (もしくは MoneyForward 担当 様)

lemoncake.xyz の Hiroto です。Stripe Sessions 2026 で MPP がリリースされたことで状況が変わりました。

具体的には: AI agent が freee API を経由して自動仕訳する際、agent からの認証を OAuth ではなく MPP-signed permit に切り替えると、(a) 1 ユーザのアカウントを agent と共有する必要が消える、(b) 認可 scope が permit に lock される、(c) freee 側に新たな「agent buyer」というカテゴリの新規ユーザが流入する。

2 週間 / $5k で「freee × agent-payment-mcp」の PoC を組めます。partnership 文脈とは別に有償でやらせていただけませんか。

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

### 20. メルカリ Crypto / Stripe Japan (cold but warm-adjacent)

接触: メルカリ HR / Crypto 担当の LinkedIn、Stripe Japan は Twitter (@StripeJapan) か日本オフィス info@stripe.com.

```
件名: 日本市場での AI agent 決済 — Stripe MPP との並走モデル

メルカリ Crypto 様 (もしくは Stripe Japan 様)

evidai の Hiroto です。lemoncake.xyz で x402 + Stripe MPP 互換の facilitator を運営しています。

Stripe MPP は globally に強いプロトコルですが、Stripe Crypto Onramp は日本未対応のため、JP 国内 USDC × Base の動線は構造的に空白です。当社は FSA 非カストディ確認済 + 東京都ステーブルコイン補助金申請中で、ここを担う唯一の事業者になり得ます。

ご提案: 日本国内の AI agent 決済需要を Stripe MPP signed → LemonCake facilitator → Base/USDC で settle する協業モデル。2 週間 / $5k で技術 PoC、その後 partnership 締結も視野。

メルカリ Crypto としては既存ユーザの USDC 利用パターン拡張、Stripe Japan としては MPP の JP geo 補完。どちらの文脈でも 15 分のお時間いただけると幸いです。

— Hiroto
contact@aievid.com · https://lemoncake.xyz/consulting
```

---

## 送信前チェックリスト (Tier B/C)

- [ ] Tier A → 1 週間後の **Tue 2026-06-09 〜 Wed 06-10** に送る (Tier A の反応見て判断)
- [ ] Tier B は全て **新規 cold**、件名は specific observation を盛り込む
- [ ] Tier C は warm 経路 (JPYC 岡部氏 / freee の既存 thread) を優先、cold は最後
- [ ] 日本語 cold email は spam フィルタに引っかかりにくいが、過度に丁寧すぎても刺さらない (上記 template は中庸狙い)
- [ ] /pricing と /consulting URL の状態確認、特に JP からのアクセスで /about (JP) に強制リダイレクトされないか
- [ ] **Tier A まで合計 10 通送信して返事 0 だったら Tier B/C 着手前に pitch を再検討する** (テンプレが効いてない可能性)
