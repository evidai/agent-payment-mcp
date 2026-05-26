import Link from "next/link";
import type { Metadata } from "next";
import ContactButton from "../about/ContactButton";

// ── Metadata ────────────────────────────────────────────────────────────────
// Public, transparent pricing — replaces the prior "contact sales" enterprise-only
// posture. Borrowing Crossmint's transparent-pricing playbook (published numbers)
// and Coinbase x402's free-tier funnel (1k tx/month). The competitive wedge is
// the JP onramp + MPP/Tempo interoperability (we don't fight Stripe MPP, we run
// next to it on Base/USDC, and we cover the only geo Stripe Onramp can't).

export const metadata: Metadata = {
  title: "Pricing — LemonCake facilitator (free up to 1k tx/mo)",
  description: "MPP-compatible Base/USDC facilitator for AI agents. 1,000 tx/month free, gas sponsored. $0.005/tx after. Native JP onramp included. Non-custodial.",
  alternates: { canonical: "https://lemoncake.xyz/pricing" },
  openGraph: {
    title: "LemonCake pricing — free up to 1k tx/mo, $0.005/tx after",
    description: "MPP-compatible facilitator on Base. JP onramp built in. Non-custodial by design.",
    url: "https://lemoncake.xyz/pricing",
    type: "website",
  },
};

// ── Icons ───────────────────────────────────────────────────────────────────
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconCross = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0 opacity-40">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

// ── Tiers ───────────────────────────────────────────────────────────────────
const TIERS = [
  {
    name:     "Free",
    blurb:    "Ship, test, validate. No card required.",
    price:    "$0",
    suffix:   "/ month",
    cta:      "Start free",
    href:     "/start/free",
    features: [
      "1,000 settled tx / month included",
      "Gas sponsored by us (you pay 0 ETH)",
      "MPP / Tempo interop out of the box",
      "Auto-listed on Coinbase Bazaar",
      "ERC-2612 permit + 90-day hard cap",
      "Community Slack support",
    ],
    accent: "from-white/4 to-white/[0.01] border-white/10",
    badge:  "text-white/50 bg-white/5 border-white/10",
  },
  {
    name:     "Pro",
    blurb:    "Production-grade. Pay for what you use.",
    price:    "$50",
    suffix:   "/ month + $0.005 / tx",
    cta:      "Get started",
    href:     "/start/v2?plan=pro",
    features: [
      "Everything in Free",
      "Outcome-based billing (charge per completed task)",
      "KYA Tier 1 verification included",
      "$0.005 / tx after 1k free (Crossmint −90%, Stripe ≈ same)",
      "Email + Slack response in 24h",
      "30-day invoice net",
    ],
    accent: "from-[#fffd43]/15 to-[#fffd43]/[0.02] border-[#fffd43]/30",
    badge:  "text-[#fffd43] bg-[#fffd43]/15 border-[#fffd43]/30",
    featured: true,
  },
  {
    name:     "Enterprise",
    blurb:    "Custom KYA bundle + SLA. Single contract.",
    price:    "From $500",
    suffix:   "/ month",
    cta:      "Talk to us",
    href:     "mailto:contact@aievid.com?subject=LemonCake%20Enterprise%20inquiry",
    features: [
      "Everything in Pro",
      "Full KYA Tier 2 (Know Your Agent) framework",
      "Custom volume pricing, dedicated facilitator instance",
      "99.9% uptime SLA + on-call escalation",
      "Custom reporting + audit log export",
      "Dedicated Slack channel + named contact",
    ],
    accent: "from-blue-500/15 to-blue-500/[0.02] border-blue-500/30",
    badge:  "text-blue-300 bg-blue-500/15 border-blue-500/30",
  },
  {
    name:     "NRE / Consulting",
    blurb:    "We build the integration for you. Fixed price.",
    price:    "From $2,000",
    suffix:   "/ engagement",
    cta:      "See packages",
    href:     "/consulting",
    features: [
      "Pay-per-call audit ($2k / 1 wk)",
      "x402 integration into your API ($5k / 2 wk)",
      "Custom MCP build ($8k / 3 wk)",
      "Fixed scope, fixed timeline, fixed price",
      "Includes 30 days of post-launch support",
      "MPP/Tempo migration from existing facilitators",
    ],
    accent: "from-purple-500/15 to-purple-500/[0.02] border-purple-500/30",
    badge:  "text-purple-300 bg-purple-500/15 border-purple-500/30",
  },
];

// ── Comparison table data ───────────────────────────────────────────────────
const COMPARISON = [
  {
    feature: "Free tier",
    lc: "1k tx/mo, gas sponsored",
    coinbase: "1k tx/mo (Jan 2026)",
    crossmint: "—",
    stripe: "Stripe standard",
  },
  {
    feature: "Per-tx fee (after free)",
    lc: "$0.005",
    coinbase: "$0.001",
    crossmint: "$0.05/MAW + tx",
    stripe: "Stripe take rate",
  },
  {
    feature: "Stripe MPP / Tempo interop",
    lc: "✓",
    coinbase: "—",
    crossmint: "—",
    stripe: "Native",
  },
  {
    feature: "JP onramp (USDC × Base)",
    lc: "✓",
    coinbase: "—",
    crossmint: "—",
    stripe: "—",
  },
  {
    feature: "Non-custodial",
    lc: "✓",
    coinbase: "✓",
    crossmint: "✓",
    stripe: "✓ (via Privy)",
  },
  {
    feature: "KYA verified identity",
    lc: "✓",
    coinbase: "—",
    crossmint: "—",
    stripe: "—",
  },
  {
    feature: "FSA non-custodial confirmation",
    lc: "✓",
    coinbase: "—",
    crossmint: "—",
    stripe: "—",
  },
];

// ── Page ────────────────────────────────────────────────────────────────────
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#06060a] text-white font-sans antialiased">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 bg-[#06060a]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-[15px] text-white">LemonCake</span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-[13px] text-white/50">
            <Link href="/trade" className="hover:text-white/80 transition-colors">Trade stack</Link>
            <Link href="/consulting" className="hover:text-white/80 transition-colors">Consulting</Link>
            <Link href="/about/en" className="hover:text-white/80 transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-[13px] text-white/50 hover:text-white/80 transition-colors">
              Log in
            </Link>
            <Link
              href="/start/free"
              className="text-[13px] font-semibold px-4 py-1.5 bg-[#fffd43] text-[#1a0f00] rounded-lg hover:bg-[#fffd43]/90 transition-colors"
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-block px-3 py-1 mb-6 bg-[#fffd43]/10 border border-[#fffd43]/25 rounded-full text-[11px] font-mono text-[#fffd43]/80">
          AI API Gatekeeper · 1k tx/mo free · Open core
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-6 leading-[1.05]">
          Pay only for what<br />
          <span className="text-[#fffd43]">your gateway lets through.</span>
        </h1>
        <p className="text-lg text-white/55 max-w-2xl mx-auto mb-10 leading-relaxed">
          Spend-limited Pay Tokens. Per-call USDC settlement. Free up to 1,000 tx / month —
          gas sponsored, no card on file. Cheaper than Orb / Metronome at the seat tier,
          simpler than Stripe at the call tier, narrower than both — by design.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/start/free"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#fffd43] text-[#1a0f00] font-semibold rounded-xl hover:bg-[#fffd43]/90 transition-colors text-sm"
          >
            Start free — no card <IconArrow />
          </Link>
          <a
            href="#comparison"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white/8 text-white border border-white/15 font-semibold rounded-xl hover:bg-white/12 transition-colors text-sm"
          >
            Compare to alternatives →
          </a>
        </div>
      </section>

      {/* ── Tier cards ── */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className={`relative rounded-3xl bg-gradient-to-br ${t.accent} border p-6 flex flex-col`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-[#fffd43] text-[#1a0f00] text-[10px] font-black uppercase tracking-widest rounded-full">
                  Most popular
                </div>
              )}
              <span className={`inline-block self-start text-[10px] font-semibold uppercase tracking-widest border rounded-full px-2 py-0.5 ${t.badge}`}>
                {t.name}
              </span>
              <p className="text-[13px] text-white/55 mt-4 mb-5 leading-relaxed min-h-[3rem]">{t.blurb}</p>
              <div className="flex items-baseline gap-1.5 mb-5">
                <span className="text-4xl font-black text-white">{t.price}</span>
                <span className="text-[12px] text-white/40">{t.suffix}</span>
              </div>
              <ul className="flex flex-col gap-2.5 mb-6">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12.5px] text-white/55 leading-relaxed">
                    <span className="text-[#fffd43] mt-0.5"><IconCheck /></span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-4 border-t border-white/8">
                {t.href.startsWith("mailto:") ? (
                  <a
                    href={t.href}
                    className="block w-full text-center px-4 py-2.5 bg-white/8 text-white border border-white/15 rounded-xl hover:bg-white/12 transition-colors text-[13px] font-semibold"
                  >
                    {t.cta} →
                  </a>
                ) : (
                  <Link
                    href={t.href}
                    className="block w-full text-center px-4 py-2.5 bg-white/8 text-white border border-white/15 rounded-xl hover:bg-white/12 transition-colors text-[13px] font-semibold"
                  >
                    {t.cta} →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Comparison ── */}
      <section id="comparison" className="bg-white/[0.02] border-y border-white/8">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">How we compare</p>
          <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
            Why LemonCake, not <span className="text-white/40 line-through">Coinbase / Crossmint / Stripe MPP</span>
          </h2>
          <p className="text-center text-[14px] text-white/45 mb-12 max-w-2xl mx-auto">
            Honest table — Coinbase is cheaper per-tx, Stripe is the global default. We win on JP onramp + MPP interop + KYA bundle. Pick the one that fits your stack.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-3 text-white/50 font-semibold"></th>
                  <th className="text-left py-3 px-3 text-[#fffd43] font-bold">LemonCake</th>
                  <th className="text-left py-3 px-3 text-white/60 font-semibold">Coinbase x402</th>
                  <th className="text-left py-3 px-3 text-white/60 font-semibold">Crossmint</th>
                  <th className="text-left py-3 px-3 text-white/60 font-semibold">Stripe MPP</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} className="border-b border-white/5">
                    <td className="py-3 px-3 text-white/70 font-medium">{row.feature}</td>
                    <td className="py-3 px-3 text-white">{row.lc}</td>
                    <td className="py-3 px-3 text-white/40">{row.coinbase}</td>
                    <td className="py-3 px-3 text-white/40">{row.crossmint}</td>
                    <td className="py-3 px-3 text-white/40">{row.stripe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-[11px] text-white/30 text-center font-mono">
            Pricing pulled from public docs · May 2026 · We update this monthly
          </p>
        </div>
      </section>

      {/* ── "Why us vs Stripe MPP" deeper answer ── */}
      <section className="max-w-4xl mx-auto px-6 py-24">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">The honest take</p>
        <h2 className="text-center text-3xl font-black text-white mb-10 leading-tight">
          Stripe MPP is the global default.<br />
          <span className="text-[#fffd43]">We&apos;re the Base/USDC option with a JP onramp.</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              n: "01",
              t: "MPP-compatible by design",
              b: "We don't fight Stripe MPP. Our facilitator settles MPP-signed payments natively. If your stack picks Stripe, we run alongside, not against.",
            },
            {
              n: "02",
              t: "JP onramp is structural",
              b: "Stripe Crypto Onramp doesn't serve Japan. Crossmint card issuance doesn't either. We do — FSA non-custodial confirmed, Tokyo stablecoin grant applicant.",
            },
            {
              n: "03",
              t: "KYA bundle baked in",
              b: "Skyfire sells KYA as enterprise security. We include it in Pro tier — verified-agent identity from day one, not a $50k add-on.",
            },
          ].map(({ n, t, b }) => (
            <div key={n} className="rounded-2xl bg-white/4 border border-white/8 p-6">
              <p className="text-[11px] font-mono text-[#fffd43]/60 mb-3">{n}</p>
              <h3 className="text-[15px] font-bold text-white mb-2">{t}</h3>
              <p className="text-[13px] text-white/55 leading-relaxed">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 pb-24">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">FAQ</p>
        <h2 className="text-center text-3xl font-black text-white mb-10 leading-tight">Things we get asked</h2>
        <div className="flex flex-col gap-4">
          {[
            {
              q: "What counts as a transaction?",
              a: "One settled USDC payment between agent and seller. Read-only calls (price quotes, balance checks) are free and don't count against your tier.",
            },
            {
              q: "What if I exceed 1k tx on the Free tier?",
              a: "We notify you at 80% and 100%. Overage gets routed to a $0.005/tx pay-as-you-go bucket — no service interruption. You can upgrade to Pro any time.",
            },
            {
              q: "Is this really MPP-compatible?",
              a: "Yes. We accept payments signed under the Stripe Machine Payments Protocol spec and settle them on Base/USDC. Detail in our docs (link in dashboard).",
            },
            {
              q: "What does 'JP onramp included' actually mean?",
              a: "Buyers based in Japan can fund their non-custodial wallet via JPY → USDC on Base, end-to-end, without leaving the dashboard. No competitor offers this combination today.",
            },
            {
              q: "Can I switch from Coinbase x402 facilitator?",
              a: "Yes — same x402 spec, drop-in middleware change. We offer fixed-price migration consulting ($5k / 2 weeks) if you'd rather we do it.",
            },
            {
              q: "Is gas really sponsored on the Free tier?",
              a: "Yes, up to 1k tx/month. We pay the Base gas. Above the free tier we batch settlements so your effective gas cost stays in the rounding error.",
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
            1,000 free tx. <span className="text-[#fffd43]">No card.</span>
          </h2>
          <p className="text-[14px] text-white/55 mb-8 max-w-xl mx-auto">
            Validate your agent commerce flow today. Upgrade to Pro the day it stops being free.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/start/free"
              className="inline-flex items-center gap-2 px-7 py-3 bg-[#fffd43] text-[#1a0f00] font-bold rounded-xl hover:bg-[#fffd43]/90 transition-colors text-sm"
            >
              Start free <IconArrow />
            </Link>
            <ContactButton className="inline-flex items-center gap-2 px-7 py-3 bg-white/8 text-white border border-white/15 font-semibold rounded-xl hover:bg-white/12 transition-colors text-sm">
              Talk to sales
            </ContactButton>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-white/30">© 2026 evidai · LemonCake pricing</p>
          <div className="flex items-center gap-5 text-[11px] text-white/30">
            <Link href="/trade" className="hover:text-white/60 transition-colors">Trade stack</Link>
            <Link href="/consulting" className="hover:text-white/60 transition-colors">Consulting</Link>
            <Link href="/about/en" className="hover:text-white/60 transition-colors">About</Link>
            <a href="mailto:contact@aievid.com" className="hover:text-white/60 transition-colors">contact@aievid.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
