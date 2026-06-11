import Link from "next/link";
import Image from "next/image";
import ContactButton from "../ContactButton";
import { LangSwitcher } from "@/components/LangSwitcher";
import {
  IconArrowRight, IconCard, IconBot, IconGear, IconTicket, IconLock, IconLink2,
  IconTag, IconRocket, IconMeter, IconKey, IconPayout, IconBadge, IconPlug,
  IconStop, IconSteps, IconFlask, IconClock,
  AboutStyles, AuroraBackdrop, FilmGrain, WaveDivider, OutlineWord, MarqueeStrip,
} from "../shared";
import { softwareAppJsonLd, breadcrumbJsonLd } from "../../lib/structured-data";

export const metadata = {
  title: "LemonCake — Monetize MCP Servers and APIs in 5 Minutes",
  description: "Monetize an MCP server or HTTP API in 5 minutes. Buyers prepay by card, agents call with spend-capped Pay Tokens, and sellers keep 97%. No crypto wallet, no per-call API keys. First 3,000 calls free, then 3%.",
  keywords: [
    "monetize MCP server",
    "monetize API",
    "AI agent payments",
    "usage-based billing",
    "Pay Token",
    "x402",
    "HTTP 402",
    "MCP middleware",
    "Stripe alternative for AI agents",
    "sub-cent micropayments",
    "API monetization",
    "agent payment infrastructure",
  ],
  // /en/about ルートは削除済み。EN 正規 URL は /about/en に統一。
  alternates: {
    canonical: "https://lemoncake.xyz/about/en",
    languages: {
      "ja-JP": "https://lemoncake.xyz/about",
      "en-US": "https://lemoncake.xyz/about/en",
    },
  },
  openGraph: {
    title: "LemonCake — Monetize MCP Servers and APIs in 5 Minutes",
    description: "Card-funded Pay Tokens for paid MCP servers and APIs. No crypto wallet, no per-call API keys. First 3,000 calls free, then 3%.",
    url: "https://lemoncake.xyz/about/en",
    siteName: "LemonCake",
    type: "article",
  },
  twitter: {
    card: "summary_large_image" as const,
    title: "LemonCake — Monetize MCP Servers and APIs in 5 Minutes",
    description: "Paste a URL, set a per-call price, share a buy link. Agents pay with spend-capped Pay Tokens; sellers keep 97%.",
  },
  robots: { index: true, follow: true },
};

// ── Additional structured data (AEO): breadcrumb + product summary come from
// app/lib/structured-data.ts (single source, shared with /demo). ──
const aboutBreadcrumbJsonLd = breadcrumbJsonLd([
  { name: "LemonCake", path: "/" },
  { name: "About", path: "/about/en" },
]);

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
        text: "No. Buyers pay with a card through Stripe and receive a spend-capped Pay Token. There is no blockchain wallet, no seed phrase, and no crypto onboarding for either side.",
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
        text: "Yes — it is drop-in middleware for any MCP server and works with any MCP SDK. The buyer-side MCP also ships free demo tools, so agents can try the payment flow before sellers connect a real API.",
      },
    },
  ],
};

// SVG icons + editorial components live in ../shared (shared with JA /about).

// ── Page ──────────────────────────────────────────────────────────────────────
// Visual structure mirrors the JA /about overhaul (2026-06-11): floating logo
// hero, 3-step onboarding, animated money flow, prepaid-card showcase, wavy
// dividers, icon-based comparison table, colored safety rails, visible FAQ.
export default function AboutPageEn() {
  return (
    <div className="min-h-screen bg-[#06060a] text-white font-sans antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutBreadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }} />

      <AboutStyles />
      <AuroraBackdrop />
      <FilmGrain />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 bg-[#06060a]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
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
          <div className="flex items-center gap-2 sm:gap-3">
            <LangSwitcher current="en" basePath="/about" variant="dark" />
            <Link href="/app" className="hidden sm:inline text-[13px] text-white/50 hover:text-white/80 transition-colors">
              Dashboard
            </Link>
            <ContactButton className="text-[13px] font-semibold px-3 sm:px-4 py-1.5 bg-white text-[#06060a] rounded-lg hover:bg-white/90 transition-colors whitespace-nowrap">
              Contact
            </ContactButton>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="bg-[#fffd43] w-full overflow-hidden">
        <section className="relative max-w-6xl mx-auto px-6 pt-12 pb-10 md:pt-20 md:pb-16 min-h-[calc(100vh-64px)] flex items-center">
          {/* floating LemonCake logos — playful, decorative only */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {[
              { left: "3%",  top: "10%", size: 56, delay: "0s",   opacity: 0.85 },
              { left: "11%", top: "72%", size: 40, delay: "1.6s", opacity: 0.7 },
              { left: "45%", top: "6%",  size: 34, delay: "0.8s", opacity: 0.6 },
              { left: "30%", top: "88%", size: 30, delay: "2.4s", opacity: 0.55 },
              { left: "63%", top: "12%", size: 26, delay: "3.2s", opacity: 0.5 },
            ].map((l, i) => (
              <span key={i} className="lc-float absolute" style={{ left: l.left, top: l.top, opacity: l.opacity, animationDelay: l.delay }}>
                <Image src="/logo.png" alt="" width={l.size} height={l.size} className="drop-shadow-[0_6px_12px_rgba(26,15,0,0.25)]" style={{ width: l.size, height: "auto" }} />
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute -right-16 top-10 hidden md:block w-[52%] max-w-[600px]">
            <Image
              src="/hero-visual.webp"
              alt="LemonCake — AI agent payment infrastructure"
              width={2508}
              height={2508}
              priority
              sizes="(min-width: 768px) 600px, 360px"
              className="w-full h-auto drop-shadow-2xl"
            />
          </div>
          <div className="relative z-10 w-full md:max-w-[620px] text-left">
            <div className="inline-flex items-center gap-2 mb-5 flex-wrap">
              <span className="px-3 py-1 bg-[#1a0f00]/8 border border-[#1a0f00]/15 rounded-full text-[10.5px] md:text-[11px] font-mono text-[rgba(26,15,0,0.72)]">
                The safe monetization layer for MCP servers and APIs · Open core
              </span>
              <span className="px-2 py-1 bg-[#1a0f00] text-[#fffd43] rounded-full text-[10px] font-mono font-bold uppercase tracking-widest">
                Private Beta
              </span>
            </div>
            <h1 className="text-[34px] sm:text-5xl lg:text-6xl font-black tracking-tight text-[#1a0f00] mb-4 leading-[1.02]">
              Monetize MCP servers<br />
              <span className="text-black">and APIs in </span>
              <span className="inline-block bg-[#1a0f00] text-[#fffd43] px-3 py-0.5 rounded-xl -rotate-1">5 minutes</span>
              <span className="text-black">.</span>
            </h1>
            <p className="text-[15px] md:text-lg text-[rgba(26,15,0,0.76)] max-w-[560px] mb-3 leading-relaxed">
              <strong className="text-[#1a0f00]">Paste your URL, set a per-call price, and share a buy link.</strong>{" "}
              Buyers prepay by card; agents call with spend-capped Pay Tokens.
            </p>
            <p className="text-[12px] text-[rgba(26,15,0,0.62)] max-w-[560px] mb-7 leading-relaxed">
              <strong>Live today:</strong> x402 gateway / Stripe-backed Pay Token / spend caps / usage ledger. No crypto wallet. First 3,000 calls free, then 3%. Sellers keep 97%.
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a0f00] text-[#fffd43] font-bold rounded-lg hover:bg-[#1a0f00]/85 transition-colors text-sm"
              >
                Start for free <IconArrowRight />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#1a0f00] border border-[#1a0f00]/15 font-semibold rounded-lg hover:bg-white/90 transition-colors text-sm"
              >
                Watch the live demo →
              </Link>
            </div>
            <dl className="mt-8 grid grid-cols-3 max-w-[520px] border-y border-[rgba(26,15,0,0.14)] divide-x divide-[rgba(26,15,0,0.14)]">
              {[
                ["97%", "Seller keeps"],
                ["3,000", "Free calls"],
                ["0", "Crypto wallets"],
              ].map(([v, k]) => (
                <div key={k} className="py-3 px-3 first:pl-0">
                  <dt className="text-[22px] font-black leading-none text-[#1a0f00]">{v}</dt>
                  <dd className="mt-1 text-[10px] font-bold text-[rgba(26,15,0,0.56)]">{k}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-7 md:hidden">
              <Image
                src="/hero-visual.webp"
                alt="LemonCake — AI agent payment infrastructure"
                width={2508}
                height={2508}
                priority
                sizes="360px"
                className="mx-auto w-[78%] max-w-[300px] h-auto drop-shadow-2xl"
              />
            </div>
          </div>
        </section>

        {/* Code snippet — sits inside the yellow hero band as a "this is real" anchor */}
        <section className="max-w-5xl mx-auto px-6 pb-12 md:pb-16">
          <div className="rounded-lg bg-[#1a0f00] text-white p-4 md:p-5 shadow-xl border border-[#1a0f00]/20">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <div className="w-2 h-2 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[11px] font-mono text-white/40">tool-server.ts</span>
            </div>
            <pre className="font-mono text-[12px] md:text-[13px] leading-relaxed overflow-x-auto">
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

      <WaveDivider to="dark" />

      <MarqueeStrip />

      {/* ── 3 steps in 5 minutes ── */}
      <section className="lc-cv lc-stagger relative max-w-6xl mx-auto px-6 pt-20 pb-4">
        <OutlineWord>START</OutlineWord>
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Getting started</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          Just <span className="text-[#fffd43]">three things</span> to do.
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-12 max-w-xl mx-auto">
          You can start without writing code. Five minutes on the timer is plenty.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 md:gap-2 md:items-stretch">
          {[
            { n: "1", icon: IconLink2, time: "1 min", t: "Connect", d: (
              <>
                <span className="block mb-2">Already have an API / MCP? <b className="text-white">Just paste the URL</b> — zero code changes.</span>
                <span className="my-2 flex items-center gap-2 text-[10px] font-mono text-white/30"><span className="h-px flex-1 bg-white/10" />or build from scratch<span className="h-px flex-1 bg-white/10" /></span>
                <span className="flex items-center justify-center gap-2 rounded-lg border border-[#fffd43]/20 bg-black/40 px-2.5 py-1.5 font-mono text-[11.5px] text-[#fffd43]/90 whitespace-nowrap overflow-x-auto">
                  <span className="text-white/35 select-none">$</span> npx create-lemon-mcp
                </span>
              </>
            ) },
            { n: "2", icon: IconTag, time: "1 min", t: "Set a price", d: "Pick a per-call price with a slider. Sub-cent from $0.005 is fine. Change it anytime." },
            { n: "3", icon: IconRocket, time: "3 min", t: "Share the buy link", d: "Paste the generated buy link into your README or on X. Once a buyer prepays by card, you have revenue." },
          ].map(({ n, icon: StepIcon, time, t, d }, i) => (
            <div key={n} className="contents">
              <div className="lc-step lc-card relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:p-7 text-center">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#fffd43] px-3 py-0.5 text-[11px] font-black text-[#1a0f00]">STEP {n}</span>
                <div className="lc-step-emoji mx-auto mt-2 mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#fffd43]/25 bg-[#fffd43]/8 text-[#fffd43]" aria-hidden="true"><StepIcon className="w-8 h-8" /></div>
                <p className="mb-2 inline-flex items-center gap-1 font-mono text-[10px] text-[#fffd43]/70"><IconClock className="w-3 h-3" /> {time}</p>
                <h3 className="text-[17px] font-bold text-white mb-2">{t}</h3>
                <div className="text-[13px] text-white/55 leading-relaxed">{d}</div>
              </div>
              {i < 2 && (
                <div className="hidden md:flex items-center justify-center px-1 text-[#fffd43]/50 text-2xl font-black" aria-hidden="true">→</div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-[12px] text-white/40">
          <span className="font-black text-[#fffd43]">5 minutes</span> total. After that, agents come and pay on their own.
        </p>
      </section>

      {/* ── How it works — animated money flow ── */}
      <section id="how-it-works" className="lc-cv lc-stagger relative max-w-6xl mx-auto px-6 py-20 scroll-mt-20">
        <OutlineWord>FLOW</OutlineWord>
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">How it works</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          Watch every cent <span className="text-[#fffd43]">move.</span>
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-12 max-w-xl mx-auto">
          Buyer prepays → agent spends within the cap → 97% lands with you. That&apos;s the whole model.
        </p>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-10 space-y-8">
          {/* Lane 1 — prepay */}
          <div>
            <p className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-3">① Buyer prepays by card</p>
            <div className="flex items-center gap-3 md:gap-5">
              <div className="flex h-14 w-14 md:h-16 md:w-16 flex-none items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-white/70" aria-hidden="true"><IconCard className="w-7 h-7 md:w-8 md:h-8" /></div>
              <div className="relative h-8 flex-1 overflow-hidden" aria-hidden="true">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
                <span className="lc-coin absolute inset-0"><span className="lc-coin-dot absolute left-0 top-1/2 -mt-[5px] h-[10px] w-[10px] rounded-full bg-[#fffd43]" /></span>
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-[#06060a] px-2.5 py-0.5 font-mono text-[10px] text-white/55 whitespace-nowrap">prepay $5.00</span>
              </div>
              <div className="flex-none rounded-2xl border border-[#fffd43]/35 bg-[#fffd43]/10 px-3.5 py-2.5 md:px-5 md:py-3">
                <p className="flex items-center gap-1.5 text-[15px] md:text-[17px] font-black text-[#fffd43]"><IconTicket className="w-5 h-5" /> Pay Token</p>
                <p className="mt-0.5 font-mono text-[10px] text-white/55">cap $5.00 · 500 calls · expires</p>
              </div>
            </div>
          </div>

          {/* Lane 2 — autonomous usage (coins flow) */}
          <div>
            <p className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-3">② Agent pays per call</p>
            <div className="flex items-center gap-3 md:gap-5">
              <div className="flex h-14 w-14 md:h-16 md:w-16 flex-none items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-white/70" aria-hidden="true"><IconBot className="w-7 h-7 md:w-8 md:h-8" /></div>
              <div className="relative h-8 flex-1 overflow-hidden" aria-hidden="true">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
                {[0, 1, 2].map((i) => (
                  <span key={i} className="lc-coin absolute inset-0" style={{ animationDelay: `${i * 1.05}s` }}><span className="lc-coin-dot absolute left-0 top-1/2 -mt-[5px] h-[10px] w-[10px] rounded-full bg-[#fffd43]" /></span>
                ))}
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-[#06060a] px-2.5 py-0.5 font-mono text-[10px] text-white/55 whitespace-nowrap">$0.01 / call</span>
              </div>
              <div className="lc-pulse flex h-14 w-14 md:h-16 md:w-16 flex-none items-center justify-center rounded-2xl border border-[#fffd43]/40 bg-[#fffd43]/12" aria-hidden="true">
                <Image src="/logo.png" alt="" width={40} height={40} className="w-9 h-9 md:w-11 md:h-11 object-contain drop-shadow" />
              </div>
              <div className="relative hidden h-8 flex-1 overflow-hidden sm:block" aria-hidden="true">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
                <span className="lc-coin absolute inset-0" style={{ animationDelay: "0.6s" }}><span className="lc-coin-dot absolute left-0 top-1/2 -mt-[5px] h-[10px] w-[10px] rounded-full bg-emerald-400" style={{ boxShadow: "0 0 8px rgba(52,211,153,0.8)" }} /></span>
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-[#06060a] px-2.5 py-0.5 font-mono text-[10px] text-white/55 whitespace-nowrap">verify ✓ meter ✓ forward</span>
              </div>
              <div className="flex h-14 w-14 md:h-16 md:w-16 flex-none items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-white/70" aria-hidden="true"><IconGear className="w-7 h-7 md:w-8 md:h-8" /></div>
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-white/35">
              <span>Agent</span><span className="text-[#fffd43]/70">LemonCake Gateway</span><span>Your API</span>
            </div>
          </div>

          {/* Lane 3 — split & cap */}
          <div>
            <p className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-3">③ Revenue splits automatically. Spending stops when the budget does</p>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex h-10 overflow-hidden rounded-xl border border-white/10 text-[12px] font-black">
                <div className="lc-grow flex items-center justify-center bg-[#fffd43] text-[#1a0f00] whitespace-nowrap overflow-hidden" style={{ width: "85%" }}>97% to you (Stripe direct payout)</div>
                <div className="flex flex-1 items-center justify-center bg-white/10 text-white/60">3%</div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-center font-mono text-[11.5px] text-white/70 whitespace-nowrap">
                budget zero → <b className="lc-stamp inline-flex items-center gap-1 text-[#fffd43]"><IconLock className="w-3.5 h-3.5" /> auto-stop with 402</b>
              </div>
            </div>
          </div>

          {/* Ledger ticker — the demo's story, scrolling forever */}
          <div className="overflow-hidden rounded-xl border border-white/8 bg-black/40 py-2" aria-hidden="true">
            <div className="lc-ticker flex w-max gap-8 px-4 font-mono text-[11px] whitespace-nowrap">
              {[0, 1].map((dup) => (
                <div key={dup} className="flex gap-8">
                  {[
                    ["#17", "200 paid_call", "$0.01", "you +$0.0097"],
                    ["#18", "200 paid_call", "$0.01", "you +$0.0097"],
                    ["#19", "200 paid_call", "$0.01", "you +$0.0097"],
                    ["#20", "200 paid_call", "$0.01", "you +$0.0097"],
                  ].map(([n, s, c, y2]) => (
                    <span key={`${dup}-${n}`} className="text-white/45">
                      <span className="text-white/25">{n}</span> {s} <span className="text-[#fffd43]/80">{c}</span> → <span className="text-emerald-300/80">{y2}</span>
                    </span>
                  ))}
                  <span className="font-bold text-[#fffd43]">#21 402 cap_enforced — token spent, agent stopped</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-[12px] text-white/40 max-w-xl mx-auto leading-relaxed">
          You change one URL (or one SDK line). Pay Token verification, rate limiting, usage metering, and Stripe payouts — everything in the middle is handled by LemonCake.
        </p>
      </section>

      {/* ── Pay Token = capped prepaid card ── */}
      <section className="lc-cv lc-stagger max-w-6xl mx-auto px-6 py-24 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-10 items-center">
          {/* Copy */}
          <div>
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">What is a Pay Token?</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
              What you hand the agent is<br />
              <span className="text-[#fffd43]">a capped prepaid card.</span>
            </h2>
            <p className="text-[14px] text-white/50 leading-relaxed mb-8">
              Not a credit-card number, not an API key — a single-use Pay Token.
              The cap, expiry, and scope are baked into the card itself, and the
              moment it&apos;s exceeded everything stops with a <span className="font-mono text-[#fffd43]">402</span> — no exceptions.
            </p>
            <ul className="space-y-4">
              {[
                { t: "Hard cap", d: "A $5 card can never spend $5.01. No approvals, no monitoring required from you." },
                { t: "Expiry", d: "Expired cards revoke themselves. A forgotten card can never become an incident." },
                { t: "Scope", d: "Locked to the endpoint you specify. Worth nothing anywhere else." },
                { t: "Instant revoke", d: "One click in the dashboard. The very next call is rejected." },
              ].map(({ t, d }) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#fffd43]/15 border border-[#fffd43]/40 text-[#fffd43] text-[11px] font-black" aria-hidden="true">✓</span>
                  <p className="text-[13.5px] text-white/60 leading-relaxed"><b className="text-white">{t}</b> — {d}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* The card */}
          <div className="relative mx-auto w-full max-w-[440px] [perspective:1200px]">
            {/* glow behind */}
            <div className="pointer-events-none absolute inset-0 -m-10 rounded-full bg-[#fffd43]/[0.07] blur-3xl" aria-hidden="true" />
            <div className="lc-tilt relative aspect-[1.586/1] rounded-[22px] border border-[#fffd43]/25 bg-gradient-to-br from-[#1c1c26] via-[#101016] to-[#06060a] p-5 md:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(255,253,67,0.12)] overflow-hidden">
              {/* holo blob + grid texture */}
              <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,253,67,0.16),rgba(255,160,220,0.08),transparent_70%)]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "26px 26px" }} aria-hidden="true" />
              {/* shine sweep */}
              <div className="pointer-events-none absolute inset-y-0 w-1/3 lc-shine bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden="true" />

              {/* top row: chip + contactless + logo */}
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-11 rounded-md bg-gradient-to-br from-[#f5e36b] to-[#c8a93e] border border-[#fff7c2]/50 grid grid-cols-2 gap-[2px] p-[3px]" aria-hidden="true">
                    {[0,1,2,3].map(i => <span key={i} className="rounded-[2px] bg-[#a8862c]/60" />)}
                  </div>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/40 rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M8.5 8.5a5 5 0 0 1 0 7" /><path d="M5.7 5.7a9 9 0 0 1 0 12.6" /><path d="M11.3 11.3a1.2 1.2 0 0 1 0 1.4" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <Image src="/logo.png" alt="" width={30} height={30} className="w-7 h-7 md:w-8 md:h-8 object-contain drop-shadow" aria-hidden="true" />
                  <span className="font-mono text-[9px] md:text-[10px] font-bold tracking-[0.22em] text-[#fffd43]/80 uppercase">Pay Token</span>
                </div>
              </div>

              {/* number */}
              <p className="relative mt-5 md:mt-7 font-mono text-[17px] md:text-[21px] tracking-[0.14em] text-white/90">
                lc_pay <span className="text-white/35">••••</span> <span className="text-white/35">••••</span> 8f3a
              </p>

              {/* budget bar */}
              <div className="relative mt-4 md:mt-5">
                <div className="flex items-baseline justify-between font-mono text-[10px] text-white/45 mb-1.5">
                  <span>balance <b className="text-[#fffd43] text-[12px]">$3.18</b> / $5.00</span>
                  <span className="text-white/35">318 calls left</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="lc-grow h-full rounded-full bg-gradient-to-r from-[#fffd43] to-[#ffe066]" style={{ width: "64%" }} />
                </div>
              </div>

              {/* bottom row */}
              <div className="relative mt-4 md:mt-6 flex items-end justify-between font-mono text-[9.5px] md:text-[10.5px]">
                <div>
                  <p className="text-white/30 uppercase tracking-widest mb-0.5">Holder</p>
                  <p className="flex items-center gap-1 text-white/80"><IconBot className="w-3.5 h-3.5 text-white/60" /> research-agent-01</p>
                </div>
                <div>
                  <p className="text-white/30 uppercase tracking-widest mb-0.5">Scope</p>
                  <p className="text-[#fffd43]/85">/api/search only</p>
                </div>
                <div className="text-right">
                  <p className="text-white/30 uppercase tracking-widest mb-0.5">Exp</p>
                  <p className="text-white/80">07 / 26</p>
                </div>
              </div>
            </div>

            {/* floating status chips */}
            <div className="pointer-events-none absolute -right-2 -top-4 rounded-full border border-emerald-400/40 bg-[#06060a] px-3 py-1.5 font-mono text-[10px] text-emerald-300 shadow-lg" aria-hidden="true">
              ✓ verified · $0.01 charged
            </div>
            <div className="pointer-events-none absolute -left-2 -bottom-4 inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-[#06060a] px-3 py-1.5 font-mono text-[10px] text-red-300 shadow-lg" aria-hidden="true">
              <IconLock className="w-3 h-3" /> cap reached → 402
            </div>
          </div>
        </div>
      </section>

      {/* ── Why developers ── */}
      <section id="why-developers" className="lc-cv lc-stagger relative max-w-6xl mx-auto px-6 py-24">
        <OutlineWord>WHY</OutlineWord>
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
            { icon: IconMeter, t: "Usage-based billing", d: "Charge per tool call, per token, per outcome. Sub-cent micro-payments work natively — no minimum transaction size, no Stripe-style $0.30 floor." },
            { icon: IconBot, t: "AI agent payments", d: "Agents pay your endpoint directly with one-time spend caps. No human in the loop, no API-key sharing, no \"reset my credentials\" support tickets." },
            { icon: IconKey, t: "No API-key management", d: "Stop issuing, rotating, and revoking keys. Buyers authenticate once at install time; you never touch their secrets." },
            { icon: IconPayout, t: "Stripe-backed payout", d: "Buyers fund Pay Tokens by card. Sellers receive payouts through Stripe Connect Direct Charge; LemonCake never pools customer funds." },
            { icon: IconBadge, t: "Agent identity", d: "Every agent gets an ID, a budget, and a usage history. If one goes rogue, pause / revoke stops just that agent — even with balance remaining." },
            { icon: IconPlug, t: "MCP-native", d: "Drop-in middleware for any MCP server. Scaffold with npx create-lemon-mcp. Auto-listing on Glama + Smithery + mcp.so and more." },
          ].map(({ icon: CardIcon, t, d }) => (
            <div key={t} className="lc-card rounded-2xl bg-white/4 border border-white/8 p-6">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-[#fffd43]/20 bg-[#fffd43]/8 text-[#fffd43]" aria-hidden="true"><CardIcon className="w-5 h-5" /></div>
              <h3 className="text-[15px] font-bold text-white mb-2">{t}</h3>
              <p className="text-[13px] text-white/55 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Billing stack comparison ── */}
      <section className="lc-cv bg-white/[0.02] border-y border-white/8">
        <div className="lc-stagger relative max-w-5xl mx-auto px-6 py-20">
          <OutlineWord top="top-4">VS</OutlineWord>
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
                  <th scope="col" className="text-left py-3 px-3 text-[#fffd43] font-bold bg-[#fffd43]/[0.07] rounded-t-lg">
                    <span className="inline-flex items-center gap-1.5">
                      <Image src="/logo.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" aria-hidden="true" />
                      LemonCake
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["Meter + invoice + pay in one SDK", ["✗", "Pay only"],                ["△", "Meter + invoice (pay via Stripe)"], "Yes"],
                  ["AI agent as buyer",                ["✗", "Card-only"],               ["✗", "Org-billed only"],                  "Native"],
                  ["Sub-cent per call",                ["✗", "$0.30 effective floor"],   ["△", "Allowed, but Stripe-billed"],       "$0.005"],
                  ["MCP / agent middleware",           ["✗", "—"],                       ["✗", "—"],                                "Drop-in"],
                  ["No API-key management",            ["✗", "Keys still required"],     ["✗", "Keys still required"],              "Embedded auth"],
                  ["Free tier",                        ["△", "Stripe rates apply"],      ["△", "Enterprise tiers"],                 "First 3,000 calls free, then 3%"],
                  ["Open-source SDK",                  ["✗", "Closed"],                  ["✗", "Closed"],                           "MIT"],
                  ["Setup time",                       ["△", "Connect onboarding"],      ["✗", "Implementation engineer"],          "Paste a URL and publish"],
                ] as [string, [string, string], [string, string], string][]).map(([f, s, o, lc]) => (
                  <tr key={f} className="border-b border-white/5">
                    <td className="py-3 px-3 text-white/70 font-medium">{f}</td>
                    {[s, o].map(([mark, text], i) => (
                      <td key={i} className="py-3 px-3 text-white/40">
                        <span className={`mr-1.5 font-bold ${mark === "✗" ? "text-red-400/70" : "text-amber-300/70"}`} aria-hidden="true">{mark}</span>
                        {text}
                      </td>
                    ))}
                    <td className="py-3 px-3 text-white bg-[#fffd43]/[0.07]">
                      <span className="mr-1.5 font-bold text-[#fffd43]" aria-hidden="true">✓</span>
                      {lc}
                    </td>
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
      <section className="lc-cv max-w-5xl mx-auto px-6 py-16">
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
                { t: "14:15:02", reason: "token_revoked",        saved: "$0.04"  },
                { t: "14:11:30", reason: "spend_cap_exceeded",  saved: "$8.20"  },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-b-0">
                  <span className="text-white/40">{r.t}</span>
                  <span className="text-red-300/85">{r.reason}</span>
                  <span className="text-emerald-300/85 font-bold">−{r.saved}</span>
                </div>
              ))}
              <p className="mt-3 text-[10px] text-white/35 text-center">Sample data — see your live feed under Blocked requests in the dashboard.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Margin dashboard teaser (Q3 2026) ── */}
      <section className="lc-cv max-w-5xl mx-auto px-6 py-16">
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
      <section className="lc-cv max-w-5xl mx-auto px-6 py-20">
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

      {/* ── Safety rails (condensed) ── */}
      <section className="lc-cv max-w-5xl mx-auto px-6 py-16">
        <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-5 text-center">Safety rails</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="lc-card rounded-2xl border border-red-400/25 bg-gradient-to-br from-red-500/10 to-transparent p-6 text-center md:text-left">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 text-red-300" aria-hidden="true"><IconStop className="w-6 h-6" /></div>
            <h3 className="text-[14px] font-bold text-white mb-1.5">Kill switch</h3>
            <p className="text-[12.5px] text-white/55 leading-relaxed">One-click revoke on the dashboard, plus per-agent pause / revoke. Subsequent charges are rejected immediately.</p>
          </div>
          <div className="lc-card rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/10 to-transparent p-6 text-center md:text-left">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-300" aria-hidden="true"><IconSteps className="w-6 h-6" /></div>
            <h3 className="text-[14px] font-bold text-white mb-1.5">Tiered limits (KYA)</h3>
            <p className="text-[12.5px] text-white/55 leading-relaxed">$10/day default → $1k/day with Know-Your-Agent → $50k/day with full KYC.</p>
          </div>
          <div className="lc-card rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/10 to-transparent p-6 text-center md:text-left">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300" aria-hidden="true"><IconFlask className="w-6 h-6" /></div>
            <h3 className="text-[14px] font-bold text-white mb-1.5">Sandbox mode</h3>
            <p className="text-[12.5px] text-white/55 leading-relaxed">Issue test tokens that match production behavior without moving real funds. <a href="/demo" className="text-[#fffd43]/80 hover:text-[#fffd43] underline underline-offset-2">Live demo →</a></p>
          </div>
        </div>
      </section>

      {/* ── FAQ (rendered from the same source as faqJsonLd — visible content always matches) ── */}
      <section className="lc-cv lc-stagger relative max-w-3xl mx-auto px-6 py-20">
        <OutlineWord>FAQ</OutlineWord>
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">FAQ</p>
        <h2 className="flex items-center justify-center gap-2.5 text-center text-3xl md:text-4xl font-black text-white mb-10 leading-tight">
          Frequently asked questions
          <Image src="/logo.png" alt="" width={40} height={40} className="inline-block w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow" aria-hidden="true" />
        </h2>
        <div className="space-y-3">
          {faqJsonLd.mainEntity.map((q) => (
            <details key={q.name} className="lc-faq group rounded-2xl border border-white/10 bg-white/[0.03] open:border-[#fffd43]/30 open:bg-white/[0.05]">
              <summary className="flex items-center gap-3 px-5 py-4">
                <span className="lc-faq-chev flex-none text-[#fffd43] font-black" aria-hidden="true">›</span>
                <span className="text-[14.5px] font-bold text-white">{q.name}</span>
              </summary>
              <p className="px-5 pb-5 pl-[42px] text-[13.5px] text-white/60 leading-relaxed">{q.acceptedAnswer.text}</p>
            </details>
          ))}
        </div>
      </section>

      <WaveDivider to="yellow" />

      {/* ── Closing CTA ── */}
      <div className="bg-[#fffd43] w-full">
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          <span className="lc-float mx-auto mb-6 inline-block">
            <Image src="/logo.png" alt="LemonCake" width={88} height={88} className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] object-contain drop-shadow-[0_10px_24px_rgba(26,15,0,0.3)]" />
          </span>
          <p className="text-[11px] font-bold text-[#1a0f00]/55 uppercase tracking-widest mb-4">
            Launch Plan · Private Beta
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-[#1a0f00] mb-5 leading-tight">
            Let your AI agent<br />
            <span className="text-black">pay for any API.</span>
          </h2>
          <p className="text-[14px] md:text-[15px] text-[#1a0f00]/65 mb-8 max-w-xl mx-auto leading-relaxed">
            A spend-capped Pay Token your agent pays with — no crypto wallet, no per-call key.
            First 3,000 calls free, then 3%. Custody-free; you keep 97%.
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
                  { label: "Dashboard",    href: "/app" },
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
            <p className="text-[11px] text-white/20">Buyer Keys · Pay Tokens · Stripe Connect · x402</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
