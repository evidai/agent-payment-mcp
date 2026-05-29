import Link from "next/link";
import Image from "next/image";
import ContactButton from "../ContactButton";
import { LangSwitcher } from "@/components/LangSwitcher";

export const metadata = {
  title: "LemonCake — Turn any AI API into a paid API (open core, private beta)",
  description: "Usage-based billing for AI APIs and MCP servers. No monthly fee — pay 3% only when your API earns, free for your first 3,000 calls. Sub-cent metering, spend-limited Pay Tokens, embedded wallet, abuse prevention. Open core, MIT SDK. Works where Stripe Connect doesn't.",
  // /en/about ルートは削除済み。EN 正規 URL は /about/en に統一。
  alternates: {
    canonical: "https://lemoncake.xyz/about/en",
    languages: {
      "ja-JP": "https://lemoncake.xyz/about",
      "en-US": "https://lemoncake.xyz/about/en",
    },
  },
  openGraph: {
    title: "LemonCake — Turn any AI API into a paid API",
    description: "Usage-based billing for AI APIs and MCP servers. Pay 3% only when your API earns. Sub-cent metering, spend-limited Pay Tokens, embedded wallet. Open core, MIT.",
    url: "https://lemoncake.xyz/about/en",
    type: "article",
  },
};

// ── FAQPage JSON-LD (AEO/AIO: quotable Q&A for AI search engines, mirrors JP /about) ──
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is LemonCake?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LemonCake is a usage-based billing and monetization layer for AI APIs and MCP servers. You add one URL prefix (or a one-line SDK call) and your endpoint becomes a paid API — metering, Pay Token verification, rate limiting, abuse prevention, and payout all handled for you. It's open core: the SDK is MIT-licensed, the billing engine is hosted.",
      },
    },
    {
      "@type": "Question",
      name: "How much does LemonCake cost?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "There is no monthly fee. Your first 3,000 API calls are free — a one-time allowance per seller account, not a monthly reset. After that, you pay 3% only when your AI API actually earns — 97% goes to you. Gateway, Pay Token issuance, spend limits, and usage metering are all included.",
      },
    },
    {
      "@type": "Question",
      name: "How is LemonCake different from Stripe, Orb, or Metronome?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stripe is built for a human swiping a card, with a ~$0.30 effective floor that breaks sub-cent pricing. Orb and Metronome meter and invoice but still settle through Stripe. LemonCake collapses meter + invoice + pay into one SDK and treats the AI agent as a first-class buyer, so you can charge $0.005 per call to a non-human caller.",
      },
    },
    {
      "@type": "Question",
      name: "What is a Pay Token?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A Pay Token is a spend-limited credential a buyer hands to your API. It carries a hard spending cap, expiry, and scope. The gateway checks it on every call, so a runaway or abusive agent hits the cap and is blocked before your API — or your cloud bill — ever sees the request.",
      },
    },
    {
      "@type": "Question",
      name: "Can AI agents pay my API directly?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Agents pay your endpoint directly with one-time spend caps — no human in the loop, no API-key sharing, and no \"reset my credentials\" support tickets. This is the AI-native use case LemonCake is built for.",
      },
    },
    {
      "@type": "Question",
      name: "Do my buyers need a crypto wallet?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. We embed a wallet at signup. Buyers sign in with email and never touch the underlying mechanics. Settlement uses USDC under the hood, but neither you nor your buyers have to learn crypto to use LemonCake.",
      },
    },
    {
      "@type": "Question",
      name: "Is LemonCake open source?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "It's open core, like Supabase, Clerk, and Resend. The SDK (@lemon-cake/mcp-sdk, @lemon-cake/x402-server, agent-payment-mcp) and all MCP adapters are MIT-licensed on npm and GitHub. The hosted billing engine, dashboard, compliance, and abuse detection run as a service. If we vanish, your integration keeps working.",
      },
    },
    {
      "@type": "Question",
      name: "Does LemonCake work with MCP servers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — it's drop-in middleware for any MCP server, and works with any MCP SDK. Servers are auto-listed on Bazaar, Glama, Smithery, mcp.so, and the Claude Code Plugins Directory. It also works in countries where Stripe Connect doesn't, such as Japan, Indonesia, and Argentina.",
      },
    },
  ],
};

// ── SVG Icons ────────────────────────────────────────────────────────────────
const IconArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AboutPageEn() {
  return (
    <div className="min-h-screen bg-[#06060a] text-white font-sans antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 bg-[#06060a]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="LemonCake" width={28} height={28} className="w-7 h-7 rounded-lg object-cover" />
              <span className="font-bold text-[15px] text-white">LemonCake</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              {[
                { label: "Docs",         href: "/docs" },
                { label: "Pricing",      href: "/pricing" },
                { label: "How it works", href: "#how-it-works" },
                { label: "Consulting",   href: "/consulting" },
              ].map(({ label, href }) => (
                <a key={label} href={href} className="text-[13px] text-white/50 hover:text-white/90 transition-colors">{label}</a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher current="en" basePath="/about" variant="dark" />
            <Link href="/app" className="text-[13px] text-white/50 hover:text-white/80 transition-colors">
              Dashboard
            </Link>
            <ContactButton className="text-[13px] font-semibold px-4 py-1.5 bg-white text-[#06060a] rounded-lg hover:bg-white/90 transition-colors">
              Contact
            </ContactButton>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      {/*
       * Repositioned 2026-05-27 from crypto-first to developer-billing-first.
       * The previous hero ("Per-call USDC for AI agents · On Base · ERC-2612")
       * tested poorly: 624 npm DL → 0 buyers, 1,271 DL → 3 site visits. The
       * crypto framing scared away the actual ICP (MCP server devs who want
       * monetization but don't want to learn Base / permits to install).
       * USDC and non-custodial stay in /docs and /pricing comparison — they're
       * differentiators once a dev decides to evaluate, but not what makes
       * them click.
       */}
      <div className="bg-[#fffd43] w-full">
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-16 md:pt-24 md:pb-20 flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* Image — top on mobile, right on desktop (mirrors JP /about hero) */}
          <div className="w-full max-w-[380px] md:max-w-none md:w-[460px] flex-shrink-0 order-1 md:order-2">
            <Image
              src="/hero-visual.png"
              alt="LemonCake — AI agent payment infrastructure"
              width={2508}
              height={2508}
              priority
              sizes="(min-width: 768px) 460px, 380px"
              className="w-full h-auto drop-shadow-2xl"
            />
          </div>
          {/* Text — bottom on mobile, left on desktop */}
          <div className="flex-1 text-center md:text-left order-2 md:order-1">
            <div className="inline-flex items-center gap-2 mb-5 flex-wrap justify-center md:justify-start">
              <span className="px-3 py-1 bg-[#1a0f00]/8 border border-[#1a0f00]/15 rounded-full text-[11px] font-mono text-[#1a0f00]/70">
                The safe monetization layer for AI APIs · Open core
              </span>
              <span className="px-2 py-1 bg-[#1a0f00] text-[#fffd43] rounded-full text-[10px] font-mono font-bold uppercase tracking-widest">
                Private Beta
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-[#1a0f00] mb-4 leading-[1.08]">
              Turn any AI API into a<br />
              <span className="text-black">
                paid API in minutes.
              </span>
            </h1>
            <p className="text-base md:text-lg text-[#1a0f00]/60 max-w-xl mb-3 leading-relaxed mx-auto md:mx-0">
              <strong className="text-[#1a0f00]">No monthly fee. Pay 3% only when your AI API earns.</strong><br />
              Start free — your first 3,000 calls, with gateway, Pay Token, spend limits, and metering all included.
            </p>
            <p className="text-[12px] text-[#1a0f00]/45 max-w-xl mb-8 leading-relaxed mx-auto md:mx-0">
              <strong>Currently shipping:</strong> SDK (lc.charge, lc.protect) — MIT, on npm today.<br />
              <strong>Q3 2026:</strong> hosted gateway, Pay Token issuance, margin dashboard. Design partners get early access.
            </p>
            <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a0f00] text-white font-semibold rounded-xl hover:bg-[#1a0f00]/80 transition-colors text-sm"
              >
                Start building <IconArrowRight />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#1a0f00] border border-[#1a0f00]/15 font-semibold rounded-xl hover:bg-white/90 transition-colors text-sm"
              >
                View docs →
              </Link>
            </div>
            <p className="mt-6 text-[11px] text-[#1a0f00]/40 font-mono">
              Used by xstocks-mcp · gmx-mcp · alpaca-guard-mcp · tokenized-stock-mcp · agent-payment-mcp
            </p>
          </div>
        </section>

        {/* Code snippet — sits inside the yellow hero band as a "this is real" anchor */}
        <section className="max-w-3xl mx-auto px-6 pb-16">
          <div className="rounded-2xl bg-[#1a0f00] text-white p-6 shadow-xl">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[11px] font-mono text-white/40">tool-server.ts</span>
            </div>
            <pre className="font-mono text-[13px] leading-relaxed overflow-x-auto">
              <code>
                <span className="text-[#c8b800]">{"import"}</span>{" { createLemonCakeSDK } "}<span className="text-[#c8b800]">{"from"}</span> <span className="text-[#7bc97a]">{`"@lemon-cake/mcp-sdk"`}</span>;{"\n\n"}
                <span className="text-[#c8b800]">const</span>{" lc = "}<span className="text-white">createLemonCakeSDK</span>{"();"}{" "}<span className="text-white/40">{"// demo mode without env vars"}</span>{"\n\n"}
                <span className="text-white/50">{"// HTTP route — one line."}</span>{"\n"}
                {"app.use("}<span className="text-white">lc.protect</span>{"("}<span className="text-[#7bc97a]">{`"/api/search"`}</span>{", { cost: "}<span className="text-[#febc2e]">{"0.02"}</span>{" }));"}{"\n\n"}
                <span className="text-white/50">{"// Or an MCP tool — same idea."}</span>{"\n"}
                {"server.tool("}<span className="text-[#7bc97a]">{`"search"`}</span>{", "}<span className="text-white">lc.charge</span>{"({ price: "}<span className="text-[#febc2e]">{"0.02"}</span>{" }), handler);"}
              </code>
            </pre>
          </div>
          <p className="mt-4 text-center text-[12px] text-[#1a0f00]/50">
            Drop-in MCP middleware. Works with any MCP SDK. Free for your first 3,000 calls.
          </p>
        </section>
      </div>

      {/* ── API Monetization Flow visualization ── */}
      {/*
       * Stripe/Vercel-style "here's what the product does" diagram.
       * Sits directly after the hero so visitors who don't read code
       * still get the mental model in < 5 seconds.
       *
       * 4 cards with arrows between: Your API → Gateway → Paid Access → Revenue.
       * Each card has a short verb-noun caption — no jargon, no crypto words.
       */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20 scroll-mt-20">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">How it works</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-12 leading-tight">
          Four boxes between you<br />
          <span className="text-[#fffd43]">and per-call revenue.</span>
        </h2>

        <div className="relative">
          {/* Desktop: horizontal flow with arrows */}
          <div className="hidden md:flex items-center justify-between gap-3">
            {[
              { num: "1", title: "Your API",     sub: "Anything HTTP",       tone: "bg-white/4 border-white/10" },
              { num: "2", title: "Gateway",      sub: "We add a URL prefix",  tone: "bg-[#fffd43]/10 border-[#fffd43]/30" },
              { num: "3", title: "Paid access",   sub: "Buyer pays via Pay Token", tone: "bg-[#fffd43]/10 border-[#fffd43]/30" },
              { num: "4", title: "Revenue",      sub: "97% to you, 3% to us", tone: "bg-emerald-500/10 border-emerald-500/30" },
            ].map((step, i, arr) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className={`flex-1 rounded-2xl border p-5 text-center ${step.tone}`}>
                  <div className="text-[10px] font-mono text-white/40 mb-1">STEP {step.num}</div>
                  <div className="text-[16px] font-bold text-white">{step.title}</div>
                  <div className="text-[12px] text-white/55 mt-1.5">{step.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="px-2 text-white/30 text-xl font-thin" aria-hidden="true">→</div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile: stacked vertical */}
          <div className="md:hidden flex flex-col gap-3">
            {[
              { num: "1", title: "Your API",     sub: "Anything HTTP" },
              { num: "2", title: "Gateway",      sub: "We add a URL prefix" },
              { num: "3", title: "Paid access",   sub: "Buyer pays via Pay Token" },
              { num: "4", title: "Revenue",      sub: "97% to you, 3% to us" },
            ].map((step, i, arr) => (
              <div key={step.num}>
                <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                  <div className="text-[10px] font-mono text-white/40">STEP {step.num}</div>
                  <div className="text-[15px] font-bold text-white mt-1">{step.title}</div>
                  <div className="text-[12px] text-white/55 mt-1">{step.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="text-center py-1 text-white/30 text-lg" aria-hidden="true">↓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-[12px] text-white/40 max-w-xl mx-auto leading-relaxed">
          You change one URL. We do gateway routing, Pay Token verification, rate limiting, usage metering, and settle the 97% to your wallet.
        </p>
      </section>

      {/* ── Why developers ── */}
      {/*
       * 6-card benefits grid replacing the old crypto-feature-set. Each card is
       * a concrete dev pain ("API key management gone") rather than a crypto
       * primitive ("ERC-2612 permit"). Order matters: lead with the most
       * universal pain (usage billing), end with the MCP-specific differentiator.
       */}
      <section id="why-developers" className="max-w-6xl mx-auto px-6 py-24">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Why developers use LemonCake</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          Built for the things<br />
          <span className="text-[#fffd43]">payment infra makes annoying.</span>
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-16 max-w-xl mx-auto">
          Six things you stop worrying about after wiring up LemonCake.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { t: "Usage-based billing", d: "Charge per tool call, per token, per outcome. Sub-cent micro-payments work natively — no minimum transaction size, no Stripe-style $0.30 floor." },
            { t: "AI agent payments",   d: "Agents pay your endpoint directly with one-time spend caps. No human in the loop, no API-key sharing, no \"reset my credentials\" support tickets." },
            { t: "No API-key management", d: "Stop issuing, rotating, and revoking keys. Buyers authenticate once at install time; you never touch their secrets." },
            { t: "Global by default",   d: "Works in countries where Stripe Connect doesn't. Japan, Indonesia, Argentina — supported on day one." },
            { t: "Embedded wallet",     d: "Your buyers don't need a crypto wallet. We embed one at signup; they sign in with email and forget the underlying mechanics." },
            { t: "MCP-native",          d: "Drop-in middleware for any MCP server. Auto-listing on Bazaar + Glama + Smithery + mcp.so + Claude Code Plugins Directory." },
          ].map(({ t, d }) => (
            <div key={t} className="rounded-2xl bg-white/4 border border-white/8 p-6">
              <h3 className="text-[15px] font-bold text-white mb-2">{t}</h3>
              <p className="text-[13px] text-white/55 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Billing stack comparison ── */}
      {/*
       * Reframed 2026-05-27 from "vs Stripe" to "vs the billing-as-a-service
       * trio" (Orb / Metronome / Stripe). The honest landscape: Orb and
       * Metronome handle metering + invoicing but defer payment execution
       * to Stripe (and Stripe doesn't natively meter). LemonCake collapses
       * meter + pay + auth into one SDK *and* treats the AI agent as a
       * first-class buyer. That's the AI-native angle.
       */}
      <section className="bg-white/[0.02] border-y border-white/8">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">The billing stack today</p>
          <h2 className="text-center text-3xl font-black text-white mb-4 leading-tight">
            Stripe is for humans. Orb &amp; Metronome are for SaaS.<br />
            <span className="text-[#fffd43]">LemonCake is for AI.</span>
          </h2>
          <p className="text-center text-[13px] text-white/45 mb-10 max-w-2xl mx-auto">
            Existing billing infra assumes a human swipes a card and an org renews a seat. AI APIs charge sub-cent per call to a non-human caller. Different shape — different stack.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th scope="col" className="text-left py-3 px-3 text-white/50 font-semibold"></th>
                  <th scope="col" className="text-left py-3 px-3 text-white/60 font-semibold">Stripe</th>
                  <th scope="col" className="text-left py-3 px-3 text-white/60 font-semibold">Orb / Metronome</th>
                  <th scope="col" className="text-left py-3 px-3 text-[#fffd43] font-bold">LemonCake</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Meter + invoice + pay in one SDK", "Pay only",                   "Meter + invoice (pay via Stripe)", "Yes"],
                  ["AI agent as buyer",                "Card-only",                  "Org-billed only",                  "Native"],
                  ["Sub-cent per call",                "$0.30 effective floor",      "Allowed, but Stripe-billed",       "$0.005"],
                  ["MCP / agent middleware",           "—",                          "—",                                "Drop-in"],
                  ["No API-key management",            "Keys still required",        "Keys still required",              "Embedded auth"],
                  ["Free tier",                        "Stripe rates apply",         "Enterprise tiers",                 "1k tx / mo, gas covered"],
                  ["Open-source SDK",                  "Closed",                     "Closed",                           "MIT"],
                  ["Setup time",                       "Connect onboarding",         "Implementation engineer",          "One env var"],
                ].map(([f, s, o, lc]) => (
                  <tr key={f} className="border-b border-white/5">
                    <td className="py-3 px-3 text-white/70 font-medium">{f}</td>
                    <td className="py-3 px-3 text-white/40">{s}</td>
                    <td className="py-3 px-3 text-white/40">{o}</td>
                    <td className="py-3 px-3 text-white">{lc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-[11px] text-white/30 text-center font-mono">
            We don&apos;t replace Stripe for human checkout. We&apos;re the stack you want when the buyer is an AI agent.
          </p>
        </div>
      </section>

      {/* ── Abuse Prevention Log ── */}
      {/*
       * Differentiator visualization — LemonCake doesn't just bill,
       * it actively blocks runaway / abusive callers. This card mocks
       * what the live dashboard's "Blocked requests" feed looks like.
       * Critical for the enterprise pitch (insurance value) but also
       * resonates with indie devs who've been burned by a bad agent
       * loop.
       */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-red-500/10 to-red-500/[0.02] border border-red-500/25 p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-[11px] font-semibold text-red-300 uppercase tracking-widest mb-3">Not just billing — abuse prevention</p>
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
                We block runaway agents.<br />
                <span className="text-red-300">Before they cost you anything.</span>
              </h2>
              <p className="text-[14px] text-white/55 leading-relaxed">
                Pay Token spend caps + rate limits are checked at the gateway. A misbehaving agent in an infinite loop hits the wall instantly — your API never sees the request, your AWS bill never moves. The blocked-request feed in your dashboard shows you what we caught.
              </p>
            </div>
            {/* mock log */}
            <div className="rounded-2xl bg-black/40 border border-white/10 p-4 font-mono text-[11.5px] text-white/70">
              <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">Blocked request feed (sample)</div>
              {[
                { t: "14:21:08", reason: "spend_cap_exceeded",  saved: "$12.40" },
                { t: "14:19:55", reason: "rate_limit_exceeded", saved: "$0.78"  },
                { t: "14:15:02", reason: "permit_revoked",       saved: "$0.04"  },
                { t: "14:11:30", reason: "spend_cap_exceeded",  saved: "$8.20"  },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-b-0">
                  <span className="text-white/40">{r.t}</span>
                  <span className="text-red-300/85">{r.reason}</span>
                  <span className="text-emerald-300/85 font-bold">−{r.saved}</span>
                </div>
              ))}
              <p className="mt-3 text-[10px] text-white/35 text-center">Sample data — live feed lands Q3 2026.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Margin dashboard teaser ── */}
      {/*
       * Q3 2026 roadmap signal — Amberflo holds the margin-visibility
       * angle in this market, and the research doc explicitly flagged it
       * as one of the differentiated values to claim. This teaser exists
       * so Pro-tier evaluators know it's coming without committing us to
       * a specific ship date or feature set. The CTA is a mailto that
       * drops into Hiroto's inbox as an "early access" signup.
       */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02] border border-amber-500/25 p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest mb-3">Coming Q3 2026 · Early access</p>
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
                Margin dashboard.
              </h2>
              <p className="text-[14px] text-white/55 leading-relaxed max-w-xl">
                AI cost vs. revenue per agent, per endpoint, per token. Catch margin leaks before they compound. The metric Stripe / Orb / Metronome don&apos;t natively show — because their buyers don&apos;t have $0.50 of OpenAI cost behind every $0.05 of revenue. Yours do.
              </p>
            </div>
            <a
              href="mailto:contact@aievid.com?subject=Margin%20dashboard%20early%20access&body=Hi%20Hiroto%2C%0A%0AI%27d%20like%20to%20be%20notified%20when%20the%20margin%20dashboard%20ships.%0A%0AStack%20%2F%20use%20case%3A%20%5B1-2%20lines%5D%0A%0AThanks%2C%0A%5Bname%5D"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-400 text-amber-950 font-bold rounded-xl hover:bg-amber-300 transition-colors text-[13px] whitespace-nowrap"
            >
              Join early access →
            </a>
          </div>
        </div>
      </section>

      {/* ── Open core ── */}
      {/*
       * Open-core is the explicit corporate stance now (2026-05-27).
       * Same pattern as Supabase / Clerk / Resend: SDK and integration
       * surface are MIT, hosted billing engine + dashboard + compliance
       * stay closed. The reason this layout exists: AI infra devs need
       * to see what's open *and* what's not, because pure-OSS billing
       * companies are abandonware-suspect and pure-SaaS billing
       * companies are lock-in-suspect. Open-core threads the needle.
       */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.02] border border-emerald-500/20 p-10 md:p-12">
          <div className="text-center mb-10">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest mb-4">Open core, like Supabase &amp; Clerk</p>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
              Fork the SDK.<br />
              <span className="text-emerald-400">Let us host the boring stuff.</span>
            </h2>
            <p className="text-[14px] text-white/55 leading-relaxed max-w-2xl mx-auto">
              Pure-OSS billing infra dies the moment funding does. Pure-SaaS billing infra is lock-in by design. Open core is the only honest middle: MIT-licensed SDK + hosted execution. If we vanish, your integration keeps working.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* OPEN side */}
            <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2 py-0.5 uppercase tracking-widest">Open · MIT</span>
              </div>
              <h3 className="text-[15px] font-bold text-white mb-3">What you can fork</h3>
              <ul className="space-y-2 text-[12.5px] text-white/60 font-mono">
                {[
                  "@lemon-cake/mcp-sdk",
                  "@lemon-cake/x402-server",
                  "agent-payment-mcp",
                  "examples/* (starter templates)",
                  "MCP adapters (Claude / Cursor / LangChain)",
                  "All docs and migration guides",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">●</span> {line}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center gap-2">
                <a href="https://github.com/evidai/agent-payment-mcp" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300 hover:text-emerald-200 transition-colors">
                  GitHub →
                </a>
                <span className="text-white/20">·</span>
                <a href="https://www.npmjs.com/package/@lemon-cake/mcp-sdk" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300 hover:text-emerald-200 transition-colors">
                  npm →
                </a>
              </div>
            </div>
            {/* CLOSED side */}
            <div className="rounded-2xl bg-white/4 border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-white/60 bg-white/8 border border-white/15 rounded-full px-2 py-0.5 uppercase tracking-widest">Hosted</span>
              </div>
              <h3 className="text-[15px] font-bold text-white mb-3">What we run as a service</h3>
              <ul className="space-y-2 text-[12.5px] text-white/55 font-mono">
                {[
                  "Billing engine (settlement, ledger)",
                  "Revenue routing & payout logic",
                  "Dashboard (analytics, payouts, abuse)",
                  "Compliance (tax, invoicing, reporting)",
                  "Fraud / abuse detection",
                  "Hosted gateway & uptime SLA",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="text-white/40 mt-0.5">●</span> {line}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <Link href="/pricing" className="inline-flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white transition-colors">
                  See pricing →
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-6 text-[11px] text-white/30 text-center font-mono">
            MIT · Supabase / Clerk / Resend pattern · 5 production MCPs published
          </p>
        </div>
      </section>

      {/*
       * 2026-05-27: removed the old "Integrations" section that touted
       * agent-payment-mcp + eliza-plugin-lemoncake. Both still exist on
       * npm, but the new positioning ("AI API Gatekeeper for sellers")
       * doesn't lead with "MCP for agents to use" — it leads with
       * "SDK for sellers to monetize". The MCP server is now a
       * demonstration of the SDK, not the headline.
       */}

      {/* ── Safety rails (condensed) ── */}
      {/*
       * The old "Three safety rails" 3-card grid (Kill Switch / KYA /
       * Sandbox) was conceptually duplicated by the new Why-developers
       * grid. Condensed to a single inline strip — the info is still
       * here for evaluators who want it, just no longer occupying its
       * own section's worth of real estate.
       */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-2xl bg-white/4 border border-white/8 p-6 md:p-8">
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4 text-center">Safety rails</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-center md:text-left">
            <div>
              <h3 className="text-[14px] font-bold text-white mb-1.5">Kill switch</h3>
              <p className="text-[12.5px] text-white/55 leading-relaxed">One-click revoke on the dashboard. Subsequent charges return 422 atomically.</p>
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-white mb-1.5">Tiered limits (KYA)</h3>
              <p className="text-[12.5px] text-white/55 leading-relaxed">$10/day default → $1k/day with Know-Your-Agent → $50k/day with full KYC.</p>
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-white mb-1.5">Sandbox mode</h3>
              <p className="text-[12.5px] text-white/55 leading-relaxed">Issue test tokens that match production behavior but never move real USDC.</p>
            </div>
          </div>
        </div>
      </section>

      {/*
       * 2026-05-27: cut sections from old positioning (Quickstart that
       * mirrored /docs/quickstart, Mission "give your agent a safe wallet"
       * narrative, Buyer/Seller 2-column, The Infrastructure whyItems
       * grid, Philosophy "raw steel" narrative, generic Contact CTA).
       * All of those were written for the agent-wallet positioning we've
       * since pivoted away from. Replaced with a single Launch Plan CTA
       * that closes the page cleanly.
       */}

      {/* ── Closing CTA ── */}
      <div className="bg-[#fffd43] w-full">
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          <p className="text-[11px] font-bold text-[#1a0f00]/55 uppercase tracking-widest mb-4">
            Launch Plan · Private Beta
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-[#1a0f00] mb-5 leading-tight">
            Turn your AI API into<br />
            <span className="text-black">a paid API today.</span>
          </h2>
          <p className="text-[14px] md:text-[15px] text-[#1a0f00]/65 mb-8 max-w-xl mx-auto leading-relaxed">
            No monthly fee. Pay 3% only when your API earns.
            Start free — your first 3,000 calls, with gateway, Pay Token, spend limits, and metering all included.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-7 py-3 bg-[#1a0f00] text-[#fffd43] font-bold rounded-xl hover:bg-[#1a0f00]/85 transition-colors text-sm"
            >
              Start for free <IconArrowRight />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3 bg-white text-[#1a0f00] border border-[#1a0f00]/15 font-semibold rounded-xl hover:bg-white/90 transition-colors text-sm"
            >
              See full pricing →
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-7 py-3 bg-transparent text-[#1a0f00]/65 font-semibold hover:text-[#1a0f00] transition-colors text-sm"
            >
              View docs →
            </Link>
          </div>
          <p className="mt-6 text-[11px] text-[#1a0f00]/40 font-mono">
            No credit card. Manual onboarding (~24h) during Private Beta.
          </p>
        </section>
      </div>


      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Image src="/logo.png" alt="LemonCake" width={24} height={24} className="w-6 h-6 rounded-md object-cover" />
                <span className="font-bold text-[13px] text-white">LemonCake</span>
              </div>
              <p className="text-[12px] text-white/30 leading-relaxed">M2M Payment Infrastructure<br />for AI Agents</p>
            </div>
            {/* Product */}
            <div>
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-3">Product</p>
              <ul className="flex flex-col gap-2">
                {[
                  { label: "Dashboard",    href: "/login" },
                  { label: "MCP server",   href: "https://www.npmjs.com/package/agent-payment-mcp" },
                  { label: "Eliza plugin", href: "https://www.npmjs.com/package/eliza-plugin-lemoncake" },
                  { label: "Documentation", href: "https://lemoncake.xyz/docs" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-[12px] text-white/40 hover:text-white/70 transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
            {/* Use Cases */}
            <div>
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-3">Use Cases</p>
              <ul className="flex flex-col gap-2">
                {["Agent payments", "M2M transactions", "API marketplace", "Micro-payments"].map(item => (
                  <li key={item}><span className="text-[12px] text-white/40">{item}</span></li>
                ))}
              </ul>
            </div>
            {/* Legal */}
            <div>
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-3">Legal</p>
              <ul className="flex flex-col gap-2">
                {["Terms of Service", "Privacy Policy", "Contact"].map(item => (
                  <li key={item}><span className="text-[12px] text-white/40">{item}</span></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/8 pt-6 flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-[11px] text-white/20">© 2026 LemonCake. All rights reserved.</p>
            <p className="text-[11px] text-white/20">KYA/KYC tier auth · ERC-2612 permit · Base · USDC · x402</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
