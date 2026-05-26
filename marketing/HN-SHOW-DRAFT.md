# HN Show HN draft — 2026-05-27 night submission

**Goal:** vulnerability post that converts HN sympathy + curiosity into Free tier signups + consulting inquiries.
**Karma:** 5 (below the "safe Show HN" line of 10). Vulnerability framing mitigates this risk.

---

## Submission timing

**Target: 2026-05-27 (Wed) 23:30-01:30 JST = PT Tue 07:30-09:30**
- HN peak traffic: PT Tue-Thu 8-10 AM.
- Account is karma 5 → submit at start of peak (PT 08:00) so initial votes can lift it before insta-flag risk.
- If front page gain ≥ 5 points in first 30 min → it's catching. If 0 after 30 min → reschedule for Wed.

---

## Title candidates (ranked, primary first)

**Primary (A1):**
```
Show HN: 1,271 npm downloads, 11 website visits, 0 paying users
```
- 64 chars, single-axis, data-forward
- The "11" is the hook — wildly low ratio, HN devs will want the diagnosis
- No product name in title (force click for context)

**Backup options (rank order if A1 stalls):**

A2:
```
Show HN: My MCP server hit 1k npm downloads. 0 humans visited the site.
```
- Slightly more dramatic framing of same data

A3:
```
Show HN: Solo founder, 5 MCP servers shipped, $0 revenue. The funnel.
```
- "$0 revenue" is the strongest emotional hook; risk is HN may read it as begging

A4:
```
Show HN: Most "npm downloads" are bots. Here's the funnel under the badge.
```
- Insight-first framing, less self-focused, may underperform if no specifics

A5:
```
Show HN: I shipped 5 MCP servers in 6 weeks. Here's what didn't work.
```
- More about journey than data; safer but less punch

---

## Body (primary, ~470 words)

```
I've been building LemonCake — a non-custodial USDC payment facilitator for AI agents (x402 + MPP-compatible) — for the last 6 weeks. 5 MCP servers shipped to npm. 1,271 downloads on the main package over the last 7 days.

Then I checked the funnel.

LP unique visitors / 7 days: 3 (one of them is me)
Demo runs / 7 days: 5
Subscriptions: 0
Permit charges: 0
Revenue: $0

The crucial number is 0.9% — that's the conversion from npm install to lemoncake.xyz visit. The expected baseline for an MCP server with a clear CTA in its boot output is 5-15%. We're 1-2 orders of magnitude low.

The reason: most of those "downloads" are crawler/indexer traffic, not humans. npm registry mirrors, Glama and Smithery and mcp.so scrapers, CI cache rebuilds. The "1,271 downloads" badge is real but the human signal underneath is single-digit.

A few things I've changed in the last 48 hours after seeing this:

1. Added stderr boot CTAs to all 5 MCP servers pointing to /pricing and a free tier. Most MCP servers I see don't do this — they boot silently, no URL. Conversion target: 5%.

2. Pivoted positioning. Stripe shipped MPP at Sessions 2026 last week. I rewrote the LP to "MPP-compatible facilitator on Base/USDC with native JP onramp" instead of "Stripe for MCP". You can't beat Stripe at being Stripe; you can be the geo + chain layer Stripe can't ship (Stripe Crypto Onramp doesn't serve Japan).

3. Pivoted revenue. Pure product can't survive on 0 buyers — I added a /consulting page with fixed-price 2-week sprints ($2k audit, $5k integration, $8k custom MCP). Cold-email outreach to 20 targets starts tomorrow.

4. Plugin Directory submission. Anthropic launched Claude Code Plugins Directory on May 22 — payments category is empty. Submitted yesterday.

What I'd love feedback on:

- If you've shipped an MCP server (or any npm dev tool), what was your conversion from install to product page? I want to know whether 0.9% is normal or anomalous.
- For the agent-payment crowd (Skyfire, Crossmint, Catena Labs folks): is the "run alongside Stripe MPP" framing defensible long-term, or is Stripe going to absorb the whole layer?
- For solo founders: when did you call it on a product that wasn't converting? Any heuristic that worked?

Links:
- Free tier (1k tx/mo, gas sponsored): https://lemoncake.xyz/pricing?utm_source=hn&utm_medium=social&utm_campaign=show-hn-2026-05-27
- GitHub: https://github.com/evidai/agent-payment-mcp
- The migration guides + transparent comparison vs Coinbase x402, Crossmint, Stripe MPP are live too.
```

---

## Anticipated HN comments + reply drafts

Reply fast (< 30 min) → more upvotes → front page lift. Have these ready in a text file before submitting.

### Q: "Aren't you just rebuilding Stripe? Why would anyone use this?"

> Honest answer: at the protocol level, Stripe MPP > LemonCake on most axes. The two places I'm not redundant: (1) Stripe Crypto Onramp doesn't serve Japan, and I do — JPY → USDC → Base entirely on-chain. (2) MPP-signed payments need a settlement facilitator on each network; we're an alternative on Base/USDC. Our positioning is explicitly "run alongside Stripe MPP," not "instead of."

### Q: "Why ERC-2612 permits instead of just a session key / passkey?"

> Permits give an explicit, on-chain hard cap that the agent literally cannot exceed — the spender contract is the only `transferFrom` caller, USDC's permit math enforces it. Session keys / passkeys are app-layer; if the agent infra has a bug, you're trusting the app to enforce the limit. We needed FSA non-custodial classification, and on-chain hard caps were the cleanest path there.

### Q: "What's stopping me from forking this in a weekend?"

> Nothing. The protocol is x402 (Coinbase-published spec). I'd actually be flattered. The 6 weeks weren't on the facilitator code itself — they were on the JP regulatory inquiry (FSA Q1-Q11), Anthropic Directory submission, Glama/Smithery/mcp.so listings, the MCP catalog, and the funnel discovery I'm posting about. The code is the easy part.

### Q: "1,271 downloads in 7 days is good. Why are you complaining?"

> Because 0 of those installs resulted in a paying user. DL is vanity if conversion is 0. The post is about admitting that publicly and showing what I'm doing about it. Happy to be wrong if anyone has counter-evidence that 100 DL/day is leading signal at 6 weeks.

### Q: "Have you tried just posting to r/LocalLLaMA / Twitter / etc?"

> Yes — UTM data shows zero referrer traffic from those channels (byUtm = []). That's why I'm posting here. HN is the first cohort where the funnel will actually be measurable.

### Q (hostile): "This reads like a thinly veiled ad."

> Fair. The honest framing: I'm a solo founder, I have real numbers showing I'm failing, and I'm posting them in public because I want feedback and because HN's culture rewards admitting it. If you bounce off the product link, the data is still real and you can ignore the rest.

---

## URL UTM scheme

Every link in the post + replies uses:
```
?utm_source=hn&utm_medium=social&utm_campaign=show-hn-2026-05-27
```

Daily-funnel-snapshot will surface `byUtm: [{utm_source: "hn", ...}]` the morning after.

---

## Submission day checklist

**At T-2h (PT 06:00 / JST 22:00):**
- [ ] Read the body once more, kill any corporate-speak
- [ ] Copy the primary title + body into a text editor (NOT the HN form — paste at the last moment)
- [ ] Confirm `https://lemoncake.xyz/pricing?utm_source=hn...` returns 200 with valid OG image
- [ ] Open Slack — daily-funnel-snapshot baseline is the previous run; we'll compare tomorrow morning
- [ ] Have anticipated-comments file ready in another tab

**At T-0 (PT 08:00 / JST 24:00):**
- [ ] news.ycombinator.com → submit → paste title + body
- [ ] Submit
- [ ] **Do NOT upvote your own story** (HN auto-flags it)
- [ ] Tweet from @aievid linking the HN URL: "just posted on HN: [title] — would value your read" (this is allowed, drives initial votes)

**At T+15 min:**
- [ ] If 0-1 points: it's not catching. Reply to one comment to bump it. If still 0 at T+30, accept the result and don't game it.
- [ ] If 3+ points: it's working. Spend the next 2 hours reply-bombing every comment.

**At T+2h:**
- [ ] Check daily-funnel-snapshot will fire next morning — confirm baseline diff captures HN traffic

**At T+24h:**
- [ ] Final review: points, comments, GA byUtm, /pricing impressions, /start/free signups

---

## Withdraw / lessons

If story dies (< 5 pts after 1 hour):
- Don't resubmit same title (HN dupe detection)
- Wait 1 week, retry with a sharper hook based on what didn't land
- The post itself remains valuable — link it from /about/en footer + cold-email signatures as "honest writeup of our funnel"

If story takes off (> 100 pts):
- Cancel marketing/scheduled tasks for the week (Day-4 launch tasks) — let HN traffic peak naturally first
- Watch /start/free signups; respond to every one personally within 4h
- Be ready for the inevitable journalist DM (TechCrunch / The Information often pick up Show HN > 200 pts)
