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

**Primary (A1) — vulnerability-first:**
```
Show HN: 1,271 npm downloads, 11 website visits, 0 paying users
```
- 64 chars, single-axis, data-forward
- The "11" is the hook — wildly low ratio, HN devs will want the diagnosis
- No product name in title (force click for context)
- Body now leads with the Gatekeeper repositioning + the negative-result data

**Alternative (A1b) — product-first, if vulnerability frame feels too dramatic on the morning of:**
```
Show HN: LemonCake – Turn any AI API into a paid API in minutes
```
- 64 chars
- Direct product pitch using the new tagline
- Less likely to flag but also less likely to break out

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

## Body (primary, ~470 words, AI-native billing framing)

```
I've been building LemonCake — an AI API Gatekeeper — for the last 6 weeks. Tagline: "Turn any AI API into a paid API in minutes." The thesis sharpened a few times before landing here, so let me name the corners we explicitly didn't take:

- We're not a payments company. Stripe / Tempo own that.
- We're not a SaaS billing platform. Orb / Metronome / Lago own that.
- We're not an MCP marketplace. The supply-demand chicken/egg kills that.
- We're not a wallet. Privy / Dynamic / Crossmint own that.

What we are is the **permission + metering layer that sits between an AI agent and your API endpoints**. The agent gets a spend-limited Pay Token (JSON, $5 cap, 1h expiry, allowed_api, rate-limit). The gateway (a URL rewrite *or* one line of SDK code) verifies, throttles, charges. Operator never hands out API keys or wallet private keys.

Open core, Supabase / Clerk pattern: SDK + examples + Pay Token spec are MIT; the hosted gateway + dashboard + compliance + margin viz stay closed.

5 MCP servers shipped to npm. 1,271 downloads on the main package over the last 7 days.

Then I checked the funnel.

LP unique visitors / 7 days: 3 (one of them is me)
Demo runs / 7 days: 5
Paying customers: 0
Revenue: $0

The crucial number is 0.9% — that's the conversion from npm install to lemoncake.xyz visit. Expected baseline for an MCP server with a clear CTA in its boot output is 5-15%. We're 1-2 orders of magnitude low.

The reason: most of those "downloads" are crawler/indexer traffic, not humans. npm registry mirrors, Glama and Smithery and mcp.so scrapers, CI cache rebuilds. The "1,271 downloads" badge is real but the human signal underneath is single-digit.

A few things I've changed in the last 48 hours after seeing this:

1. Added stderr boot CTAs to all 5 MCP servers pointing to /pricing and a free tier. Most MCP servers I've installed don't do this — they boot silently, no URL. Conversion target: 5%.

2. Repositioned the LP. The old hero led with the implementation ("non-custodial USDC on Base, ERC-2612 permits"). It scared away the actual ICP — AI infra devs who need billing but don't want a crypto stack as the headline. New hero: "AI-native usage billing. In one line of code." Compared against Orb / Metronome / Stripe directly. USDC is still the settlement primitive; it's just not how I sell the product anymore.

3. Added consulting. Pure product can't survive on 0 buyers — I put up a /consulting page with fixed-price 2-week sprints ($2k audit, $5k integration, $8k custom MCP build). Cold-email outreach to 20 targets starts tomorrow.

4. Plugin Directory submission. Anthropic launched Claude Code Plugins Directory on May 22 — payments category is empty. Submitted yesterday.

What I'd love feedback on:

- If you've shipped an MCP server or any npm dev tool: what was your conversion from install to product page? I want to know whether 0.9% is normal or anomalous.
- For folks who've built or used billing layers (Lago, Orb, m3ter, Paid.ai, Metronome): is the AI-agent-as-buyer case actually a new market or just SaaS metering in a different hat?
- For solo founders: when did you call it on a product that wasn't converting? Any heuristic that worked?

Links:
- Launch Plan (no monthly fee, 3,000 calls free, 5% only when your API earns): https://lemoncake.xyz/pricing?utm_source=hn&utm_medium=social&utm_campaign=show-hn-2026-05-27
- GitHub: https://github.com/evidai/agent-payment-mcp
- The docs page is built around code snippets, not crypto primitives — if you're allergic to web3-feel landing pages, this one tries hard not to be that.
```

---

## Anticipated HN comments + reply drafts

Reply fast (< 30 min) → more upvotes → front page lift. Have these ready in a text file before submitting.

### Q: "Aren't you just rebuilding Stripe? Why would anyone use this?"

> Honest answer: we're not trying to replace Stripe. Three places Stripe is the wrong primitive for our buyers: (1) sub-cent per-call (Stripe's effective floor is ~$0.30 after fees), (2) the buyer is an AI agent that doesn't have a credit card and shouldn't share its operator's API key, (3) the seller is in a country Stripe Connect doesn't serve (Japan, Indonesia, Argentina, etc). When all three of those apply, we're a better fit. When none apply, Stripe wins and we don't pretend otherwise.

### Q: "Why use crypto under the hood at all? What's wrong with a normal merchant account?"

> Honest answer: nothing's wrong with merchant accounts. For card-paying humans you should use Stripe. We use USDC under the hood because (1) it lets us issue an on-chain spend cap that an agent literally cannot bypass — that's the only mechanism we trust for agents that run unattended, (2) settlement is global by default (no Stripe Connect onboarding per country), and (3) sub-cent per-call works without rounding errors. From the developer's POV: they call `lc.charge({ price: 0.02 })` and never think about USDC. That's the point.

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
