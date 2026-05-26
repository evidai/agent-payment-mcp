# Consulting cold outreach — 2026-05-26

**Goal:** book 2-3 paid x402 / agent payment integration gigs in next 14 days.
**Withdraw line:** if 0 replies after 20 sends + 1 follow-up bump = stop, refocus on grant + product.

---

## Cold email template (3-sentence, English)

```
Subject: x402 facilitator for {{company}}?

Hi {{first_name}},

I'm Hiroto — built lemoncake.xyz (FSA non-custodial cleared, 5 production MCPs on npm, x402 facilitator live on Base).

{{specific_observation_about_their_product}} — adding x402-native pay-per-call would take ~2 weeks at $5k flat, ERC-2612 permit so users sign once and get a 90-day spending cap.

15-min intro this week? Or just reply with "tell me more" — I'll send a 1-page scope. https://lemoncake.xyz/consulting

— Hiroto
contact@aievid.com · @aievid · github.com/evidai
```

**Variant for Japanese targets** (shorter, more casual):

```
件名: {{company}} の API、x402 化のご相談

{{first_name}} 様

evidai の Hiroto です。lemoncake.xyz (FSA 非カストディ確認済 / npm に 5 つ MCP / x402 facilitator 本番稼働) を運営してます。

{{specific_observation}} — x402 化 (HTTP 402 ネイティブの pay-per-call) を 2 週間 / $5k 固定で組み込めます。ERC-2612 permit でユーザは 1 回署名で 90 日 spending cap、Stripe と並走可。

15 分の intro お時間いただけますか。詳細: https://lemoncake.xyz/consulting

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
