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

- [ ] T-1003  HN karma farming to ≥30 (currently 1) by substantive comments on active threads (3-10 lines, no questions)  USER  ONGOING — only active user task
      acceptance: profile karma display ≥30; ≥1 comment with score ≥3

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

- [x] T-0000  v0.5.1 ship: x402-compatible interface (receipt + 402 parser + PAYMENT_PENDING) — issue #4 Phase A
- [x] /start LP x402-compatible badge + section
- [x] Glama listing description includes x402-compatible (354 bytes)
- [x] /start animated terminal demo in hero
- [x] v0.5.0 npm rename: pay-per-call-mcp + lemon-cake-mcp wrapper
- [x] Anthropic Directory bundle prep (manifest, /privacy, reviewer docs)

---

## Anti-Hallucination Notes

- HOT_WALLET balance is currently $0 (per [project_remaining_tasks.md](file:///Users/workoutsomehow/.claude/projects/-Users-workoutsomehow-adhunt-pro/memory/project_remaining_tasks.md)). Any task that assumes on-chain settlement availability must verify HOT balance via `cast balance 0x4c48...684f` before claiming readiness.
- Glama search rank is dominated by usage signals; recent-activity boosts decay quickly. Don't promise "search rank improved" without observing the analytics number changed.
- npm download counts are 70%+ bot inflation per 2026-05-07 analysis. Don't celebrate raw DL spikes.
