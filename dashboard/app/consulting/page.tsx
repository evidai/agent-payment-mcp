import Link from "next/link";
import type { Metadata } from "next";
import ContactButton from "../ContactButton";

// ── Metadata ────────────────────────────────────────────────────────────────
// Sales URL for cold outreach. Pitched at engineering leads at API companies
// (Modal / Cohere / Replicate / LangChain orbit) who want pay-per-call but
// don't want to build x402 facilitator from scratch.
//
// Pricing is intentionally fixed (no "contact us") — fixed quotes close 10x
// faster than hourly retainers at this stage.

export const metadata: Metadata = {
  title: "LemonCake Consulting — x402 / agent payment integration in 2 weeks",
  description: "We built the x402 facilitator and 5 production MCPs. Now we ship pay-per-call into your API. Fixed price, 2-week turnaround, written deliverables.",
  alternates: { canonical: "https://lemoncake.xyz/consulting" },
  openGraph: {
    title: "x402 + agent payment integration, done in 2 weeks",
    description: "Built the spec on day 1. Fixed $5k, 2-week sprint, your API speaks HTTP 402 by sprint end.",
    url: "https://lemoncake.xyz/consulting",
    type: "website",
  },
};

// ── Icons ───────────────────────────────────────────────────────────────────
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

// ── Service Tiers ───────────────────────────────────────────────────────────
const SERVICES = [
  {
    name:        "Pay-per-call audit",
    price:       "$2,000",
    duration:    "1 week",
    pitch:       "Find revenue leaks + risk in your current API monetization",
    deliverable: "Written report + 1h walkthrough call",
    bullets: [
      "Map every billable surface in your API today",
      "Identify metering leaks, churn risk, edge cases",
      "Concrete spec for adding x402 or per-call USDC",
      "Architecture diagram + 30-day implementation roadmap",
    ],
    cta:    "Book the audit",
    accent: "from-purple-500/15 to-purple-500/[0.02] border-purple-500/30",
    badge:  "text-purple-300 bg-purple-500/15 border-purple-500/30",
  },
  {
    name:        "x402 facilitator integration",
    price:       "$5,000",
    duration:    "2 weeks",
    pitch:       "Your API speaks HTTP 402 by sprint end. Production-ready.",
    deliverable: "Live x402 endpoint + middleware PR into your repo",
    bullets: [
      "Coinbase CDP-routed facilitator OR self-hosted Base node — your call",
      "ERC-2612 permit flow + 90-day hard cap per buyer",
      "Test suite (jest / vitest) covering settle / refund / replay-attack",
      "Public docs page draft + 30 days of post-launch fixes",
    ],
    cta:    "Get fixed quote in 24h",
    accent: "from-[#fffd43]/15 to-[#fffd43]/[0.02] border-[#fffd43]/30",
    badge:  "text-[#fffd43] bg-[#fffd43]/15 border-[#fffd43]/30",
    featured: true,
  },
  {
    name:        "Custom MCP build",
    price:       "$8,000",
    duration:    "3 weeks",
    pitch:       "We build, test, and publish an MCP for your API under your npm scope",
    deliverable: "npm package + Claude Desktop config example + LICENSE",
    bullets: [
      "MCP server scaffolded with your tool surface (TypeScript + zod)",
      "Built-in agent-payment-mcp integration (per-call USDC or flat fee)",
      "Hard-cap ledger so agents can't drain budget mid-loop",
      "Smithery / Glama / mcp.so listings handled",
    ],
    cta:    "Discuss your API",
    accent: "from-blue-500/15 to-blue-500/[0.02] border-blue-500/30",
    badge:  "text-blue-300 bg-blue-500/15 border-blue-500/30",
  },
];

// ── Page ────────────────────────────────────────────────────────────────────
export default function ConsultingPage() {
  return (
    <div className="min-h-screen bg-[#06060a] text-white font-sans antialiased">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 bg-[#06060a]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-[15px] text-white">LemonCake</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/trade" className="text-[13px] text-white/50 hover:text-white/80 transition-colors">Trade stack</Link>
            <Link href="/about/en" className="text-[13px] text-white/50 hover:text-white/80 transition-colors">About</Link>
            <ContactButton className="text-[13px] font-semibold px-4 py-1.5 bg-white text-[#06060a] rounded-lg hover:bg-white/90 transition-colors">
              Talk to us
            </ContactButton>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-block px-3 py-1 mb-6 bg-[#fffd43]/10 border border-[#fffd43]/25 rounded-full text-[11px] font-mono text-[#fffd43]/80">
          For API companies adding agent commerce
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-6 leading-[1.05]">
          x402 + agent payment<br />
          <span className="text-[#fffd43]">shipped in 2 weeks.</span>
        </h1>
        <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed">
          We built the x402 facilitator and 5 production MCPs that AI agents pay with today.
          Now we drop the same plumbing into your API — fixed quote, fixed timeline, written deliverables.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <a
            href="mailto:contact@aievid.com?subject=x402%20consulting%20%E2%80%94%20%5Byour%20company%5D&body=Hi%20Hiroto%2C%0A%0A%5B1-2%20lines%20about%20your%20API%20%2F%20agent%20use%20case%5D%0A%0AInterested%20in%20the%20%5Baudit%20%2F%20integration%20%2F%20custom%20MCP%5D%20track.%0A%0AThanks%2C%0A%5Bname%5D"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#fffd43] text-[#1a0f00] font-semibold rounded-xl hover:bg-[#fffd43]/90 transition-colors text-sm"
          >
            Get fixed quote in 24h <IconArrow />
          </a>
          <Link
            href="#services"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/8 text-white border border-white/15 font-semibold rounded-xl hover:bg-white/12 transition-colors text-sm"
          >
            See pricing →
          </Link>
        </div>
        <p className="mt-6 text-[11px] text-white/30 font-mono">
          Fixed price · No SOW negotiation · No hourly opacity
        </p>
      </section>

      {/* ── Credibility row ── */}
      <section className="border-y border-white/8 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-6">Why us</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-3xl font-black text-white">5</p>
              <p className="text-[11px] text-white/40 mt-1">production MCPs on npm</p>
            </div>
            <div>
              <p className="text-3xl font-black text-white">FSA</p>
              <p className="text-[11px] text-white/40 mt-1">non-custodial confirmed</p>
            </div>
            <div>
              <p className="text-3xl font-black text-white">x402</p>
              <p className="text-[11px] text-white/40 mt-1">native facilitator live</p>
            </div>
            <div>
              <p className="text-3xl font-black text-white">ERC-2612</p>
              <p className="text-[11px] text-white/40 mt-1">permit flow in production</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Services ── */}
      <section id="services" className="max-w-6xl mx-auto px-6 py-24">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Services</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          Three tracks. All fixed price.
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-14 max-w-xl mx-auto">
          Pick the one that matches your stage. We send a written quote within 24h of intro call.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {SERVICES.map((s) => (
            <div
              key={s.name}
              className={`relative rounded-3xl bg-gradient-to-br ${s.accent} border p-7 flex flex-col`}
            >
              {s.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#fffd43] text-[#1a0f00] text-[10px] font-black uppercase tracking-widest rounded-full">
                  Most popular
                </div>
              )}
              <span className={`inline-block self-start text-[10px] font-semibold uppercase tracking-widest border rounded-full px-2 py-0.5 ${s.badge}`}>
                {s.duration}
              </span>
              <h3 className="text-xl font-black text-white mt-4 mb-1.5">{s.name}</h3>
              <p className="text-[13px] text-white/55 leading-relaxed mb-5">{s.pitch}</p>
              <div className="flex items-baseline gap-2 mb-5">
                <span className="text-4xl font-black text-white">{s.price}</span>
                <span className="text-[12px] text-white/40">flat</span>
              </div>
              <ul className="flex flex-col gap-2.5 mb-6">
                {s.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-[12.5px] text-white/55 leading-relaxed">
                    <span className="text-[#fffd43] mt-0.5"><IconCheck /></span>
                    {b}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-4 border-t border-white/8">
                <p className="text-[11px] text-white/40 mb-3">
                  <span className="font-semibold text-white/60">Deliverable: </span>
                  {s.deliverable}
                </p>
                <a
                  href={`mailto:contact@aievid.com?subject=${encodeURIComponent(`${s.name} — [your company]`)}&body=${encodeURIComponent("Hi Hiroto,\n\nInterested in the " + s.name + " track.\n\nQuick context on our API:\n- \n- \n\nThanks,\n[name]")}`}
                  className="block w-full text-center px-4 py-2.5 bg-white/8 text-white border border-white/15 rounded-xl hover:bg-white/12 transition-colors text-[13px] font-semibold"
                >
                  {s.cta} →
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-white/[0.02] border-y border-white/8">
        <div className="max-w-4xl mx-auto px-6 py-20">
          <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">How it works</p>
          <h2 className="text-center text-3xl font-black text-white mb-12 leading-tight">From intro to launch in ≤ 18 days</h2>
          <ol className="flex flex-col gap-4">
            {[
              { n: "1", t: "30-min intro call", b: "Free. We listen, you talk. If it's not a fit, we tell you on the call." },
              { n: "2", t: "Fixed written quote in 24h", b: "Scope, deliverable, timeline, price. No SOW back-and-forth." },
              { n: "3", t: "50% upfront, sprint kicks off", b: "Daily Slack / email updates. You see every commit." },
              { n: "4", t: "Launch + 30 days of support", b: "We don't disappear. Bugs in the deliverable get fixed free for 30 days." },
            ].map(({ n, t, b }) => (
              <li key={n} className="flex gap-5 rounded-2xl bg-white/4 border border-white/8 p-5">
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#fffd43] text-[#1a0f00] font-black text-base flex items-center justify-center">{n}</div>
                <div>
                  <h3 className="text-[15px] font-bold text-white mb-1">{t}</h3>
                  <p className="text-[13px] text-white/50 leading-relaxed">{b}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 py-24">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">FAQ</p>
        <h2 className="text-center text-3xl font-black text-white mb-12 leading-tight">Things we get asked</h2>
        <div className="flex flex-col gap-5">
          {[
            {
              q: "Why fixed price, not hourly?",
              a: "Hourly creates the wrong incentive — slower = more money. Fixed price means we lose money if we drag. You get a faster ship.",
            },
            {
              q: "Who owns the code?",
              a: "You do. Day one. We open-source nothing without your sign-off. No client logos on this site until you say so.",
            },
            {
              q: "What if my API isn't ready for x402?",
              a: "Start with the audit ($2k). 80% of the time we find the integration is simpler than expected. The audit fee credits toward integration if you continue.",
            },
            {
              q: "Do you take equity?",
              a: "Not at this stage. Cash only. Keeps incentives clean for both sides.",
            },
            {
              q: "Can you work with our existing payments stack (Stripe, etc.)?",
              a: "Yes — x402 sits next to Stripe, not in place of it. Card buyers stay on Stripe, agent buyers route through the facilitator.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-2xl bg-white/4 border border-white/8 p-6">
              <p className="text-[15px] font-bold text-white mb-2">{q}</p>
              <p className="text-[13px] text-white/55 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="px-6 pb-24">
        <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-[#fffd43]/10 to-transparent border border-[#fffd43]/25 p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
            Stop quoting 6-month roadmaps.<br />
            <span className="text-[#fffd43]">Ship the agent commerce layer in 2 weeks.</span>
          </h2>
          <p className="text-[14px] text-white/55 mb-8 max-w-xl mx-auto">
            One email gets you a 30-min intro and a fixed written quote inside 24h.
          </p>
          <a
            href="mailto:contact@aievid.com?subject=x402%20consulting%20intro&body=Hi%20Hiroto%2C%0A%0A%5B1-2%20lines%20about%20your%20API%20%2F%20agent%20use%20case%5D%0A%0AThanks%2C%0A%5Bname%5D"
            className="inline-flex items-center gap-2 px-7 py-3 bg-[#fffd43] text-[#1a0f00] font-bold rounded-xl hover:bg-[#fffd43]/90 transition-colors text-sm"
          >
            Email contact@aievid.com <IconArrow />
          </a>
          <p className="mt-4 text-[11px] text-white/30 font-mono">
            Or reply to any cold email you got from us — same inbox.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-white/30">© 2026 evidai · LemonCake consulting</p>
          <div className="flex items-center gap-5 text-[11px] text-white/30">
            <Link href="/about/en" className="hover:text-white/60 transition-colors">Product</Link>
            <Link href="/trade" className="hover:text-white/60 transition-colors">Trade stack</Link>
            <a href="mailto:contact@aievid.com" className="hover:text-white/60 transition-colors">contact@aievid.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
