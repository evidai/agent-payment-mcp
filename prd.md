# LemonCake — PRD / Atomic Task Backlog

> Bootstrapped 2026-05-10 from observed state (memory + git + open issues).
> Source of truth: this file. Update task status here on every iteration.

## Format

```
- [ ] T-NNNN  <one-line title>  <CLAUDE | USER>  <BLOCKED-ON | READY>
      acceptance: <verifiable command or criterion>
```

Status legend:
- `[ ]` open · `[x]` complete · `[~]` in-progress (only one at a time)

---

## Sprint backlog (Claude-executable now)

- [x] T-0001  Audit and rewrite stale `lemon-cake-mcp` references in root README to `pay-per-call-mcp`  CLAUDE  DONE 2026-05-10
      result: 5 stale → 0 stale + 1 intentional wrapper-notice line; pay-per-call-mcp now appears 5×

- [x] T-0002  Add `*.mcpb` to `mcp-server/.gitignore` so build artifacts stay untracked  CLAUDE  DONE 2026-05-10
      result: `git check-ignore mcp-server/lemon-cake-0.5.0.mcpb` exits 0; .gitignore minimal (root handles node_modules/dist/)

- [x] T-0003  Add Node-native unit tests for `parseX402Challenge` covering all 3 detection paths and the negative case  CLAUDE  DONE 2026-05-10
      result: 11/11 tests pass via `npm test`; x402 utils extracted to `src/x402.ts`; `index.ts` imports from `./x402.js`; live server smoke-test still emits canonical x402Receipt

---

## User-blocked (cannot start without input)

- [ ] T-1001  Clarify intent of three new untracked freee scripts (`api/scripts/freee-{demo,extract-from-db,reauth}.ts`): commit, gitignore, or delete  USER
      acceptance: user replies "commit" / "ignore" / "delete"; Claude executes accordingly

- [~] T-1002  Anthropic Directory submission — SUBMITTED 2026-05-08; awaiting review (~5/22)  WAITING
      status: form already submitted with bundle lemon-cake-0.5.0.mcpb; not actionable until review result lands

- [ ] T-1003  HN karma farming to ≥30 (currently 1, account `hiroto_lemon` 8 days old) by **3-10 line substantive** comments (experience + numbers + open question, NOT 1-line questions)  USER  ONGOING
      diagnostic 2026-05-13: NOT shadow-banned (all 7 comments visible publicly); cause is 100% comment-format. 7/7 comments were 1-line questions/wishes — known anti-pattern.
      playbook: `feedback_hn_comment_quality.md` memory file. Pre-flight checklist before any HN comment.
      acceptance: profile karma ≥30; ≥1 comment with score ≥3

- [ ] T-1005  Show HN投稿 ready-to-post draft (kept in conversation 2026-05-13)  USER  GATED on T-1003
      title: "Show HN: 4 MCP servers so AI agents can't blow your budget"
      url:   https://www.lemoncake.xyz/start
      body:  4-MCP-family + honest "820 view 0 buyer" narrative + playground hook
      trigger: karma ≥30 (T-1003) OR user wants to try with karma 1 (risky)
      best time: Tue or Wed 22:30-23:30 JST = US morning peak. 6-8h on-call needed after submit.

### User-actionable

- [x] T-1004  www.lemoncake.xyz auto-deploy fixed  CLAUDE  DONE 2026-05-10
      result: lemon-cake project (separate from dashboard project) auto-deploys from main; broke on da74996 because twitter-image.tsx re-exported route-segment-config keys (uncommitted local fix only worked when I pushed via vercel --prod to dashboard). Fixed in 7d47785 — declares config locally instead. www.lemoncake.xyz/start/opengraph-image now returns 200; /about contains "30 秒で試す" twice.

### Waiting on external responses (no Claude or User action possible)

- [~] WAIT-1  freee app re-application result (submitted 2026-05-09)
- [~] WAIT-2  MoneyForward partnership reply
- [~] WAIT-3  Partnership outreach R1 (5社, sent 5/9) replies — soft-bump scheduled 5/14
- [~] WAIT-4  Partnership outreach R2 (4社 AI infra: CrewAI/Modal/Pipedream/LangChain, sent 5/10) replies — soft-bump scheduled 5/15

---

## Trigger-gated (do NOT propose until trigger fires)

- [ ] T-2001  Phase B of issue #4: on-chain auto-pay for upstream x402 challenges from Pay Token USDC balance  CLAUDE  GATED
      trigger: (a) buyer count ≥1 OR (b) external dev mentions x402 OR (c) Cloudflare/Anthropic ships x402 ref impl
      acceptance: detected x402Challenge → automated USDC transfer to recipient → response served to agent without manual escalation

- [ ] T-2002  Bump partnership outreach with soft follow-up emails on 5/14  CLAUDE  GATED
      trigger: date == 2026-05-14 AND no replies received from initial round
      acceptance: 5 follow-up emails sent (Rootly / Specter / Marqeta / Trust Wallet / Valtech)

- [ ] T-2003  Surface 2027-horizon roadmap features as next-step suggestions (Cobo Pacts, SEP-1865, ZKP audit, swarm economy)  CLAUDE  GATED
      trigger: buyer count ≥5 AND ≥1 customer asks for a specific feature by name

---

## Done (most recent first)

### 2026-05-13
- [x] HN コメントクオリティ playbook を memory + routine 両方に反映 (`feedback_hn_comment_quality.md`, xhn-engagement-opportunity-scan SKILL, show-hn-launch-monitor SKILL)
- [x] Show HN ready-to-post draft 用意（user の karma ≥30 達成後即投稿可能な状態）
- [x] hiroto_lemon HN account 診断: NOT shadow-banned、全コメント可視、原因 100% comment quality

### 2026-05-11
- [x] **xstocks-mcp** v0.1.0 公開 — 第4兄弟 MCP、Solana on-chain DEX 経由（Jupiter）、broker 不要・partnership 不要
- [x] **tokenized-stock-mcp** v0.1.3 公開 — 第3兄弟、Dinari dShares + flat $0.10/trade、Pay Token pass-through
- [x] **alpaca-guard-mcp** v0.1.0 公開 — 第2兄弟、daily USD cap, paper trading default, fail-CLOSED preflight
- [x] Dinari パートナー Sandbox onboard 完了 (Slack 招待依頼送信、KYB 残)
- [x] Alpaca BD outreach 送信 (Claudiu Gmail + Satoshi Ido LinkedIn draft、伝説ラジオ JP-context hook)
- [x] R4 partnership outreach (indie MCP devs 4社 Gmail 送信、1 X DM 残)
- [x] tokenized-stocks feasibility 研究 doc 作成 (Backed/xStocks vs Dinari 比較、推奨は Dinari first)

### 2026-05-10
- [x] T-1004 www.lemoncake.xyz auto-deploy fixed (twitter-image re-export bug → 7d47785)
- [x] /start playground telemetry 追加 (PlaygroundLog DB + admin/telemetry UI)
- [x] /start に OG image (Next.js Image Response API) + sitemap + JSON-LD 追加
- [x] /start LP に Hero CTA 追加 (/about hero に「30 秒で試す」)
- [x] T-0001/0002/0003 完了 (README rename audit, .mcpb gitignore, x402 parser unit tests)
- [x] prd.md / progress.txt bootstrap (自律 protocol session)

### 2026-05-09 以前
- [x] T-0000  v0.5.1 ship: x402-compatible interface (receipt + 402 parser + PAYMENT_PENDING) — issue #4 Phase A
- [x] /start LP x402-compatible badge + section
- [x] Glama listing description includes x402-compatible (354 bytes)
- [x] /start animated terminal demo in hero
- [x] v0.5.0 npm rename: pay-per-call-mcp + lemon-cake-mcp wrapper
- [x] Anthropic Directory bundle prep (manifest, /privacy, reviewer docs)
- [x] Partnership outreach R1-R3 (14社 cold email)

---

## Anti-Hallucination Notes

- HOT_WALLET balance is currently $0 (per [project_remaining_tasks.md](file:///Users/workoutsomehow/.claude/projects/-Users-workoutsomehow-adhunt-pro/memory/project_remaining_tasks.md)). Any task that assumes on-chain settlement availability must verify HOT balance via `cast balance 0x4c48...684f` before claiming readiness.
- Glama search rank is dominated by usage signals; recent-activity boosts decay quickly. Don't promise "search rank improved" without observing the analytics number changed.
- npm download counts are 70%+ bot inflation per 2026-05-07 analysis. Don't celebrate raw DL spikes.
