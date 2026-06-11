import Link from "next/link";
import type { Metadata } from "next";
import ContactButton from "../about/ContactButton";

// ── Metadata ────────────────────────────────────────────────────────────────
// Rewritten 2026-05-27 to "Launch Plan" — no subscription, 3% only when the
// seller's API earns. Reasoning:
//   1. The previous 4-tier (Free / Pro $50 / Enterprise $500 / NRE $2k) was
//      vaporware-adjacent — we don't actually have the metered Pro tier infra.
//   2. The ICP (MCP devs, indie AI API sellers) hates monthly subs they're
//      not sure they'll use.
//   3. Success-based fee is the strongest possible incentive alignment with
//      sellers; same play as Stripe's "pay-per-tx" vs Stripe Atlas's subs.
//   4. We can deliver the 3%-on-revenue model today using existing facilitator
//      logic. No new backend required to be honest about the pricing.

export const metadata: Metadata = {
  title: "Pricing — LemonCake Launch Plan (no monthly fee, 3% only when you earn)",
  description: "Turn any AI API into a paid API in minutes. $0 / month. 3,000 API calls free. 3% Monetization fee only when your API earns. No fixed transaction fees.",
  alternates: { canonical: "https://lemoncake.xyz/pricing" },
  openGraph: {
    title: "LemonCake pricing — no monthly fee, pay 3% only when your AI API earns",
    description: "Start free with 3,000 API calls. No setup fee, no fixed transaction fee.",
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
const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

// ── Page ────────────────────────────────────────────────────────────────────
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-[15px]">LemonCake</span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-[13px] text-[#1a0f00]/60">
            <Link href="/docs" className="hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/consulting" className="hover:text-[#1a0f00] transition-colors">Consulting</Link>
            <Link href="/about/en" className="hover:text-[#1a0f00] transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-[13px] text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">
              Dashboard
            </Link>
            <Link
              href="/app"
              className="text-[13px] font-semibold px-4 py-1.5 bg-[#1a0f00] text-[#fffd43] rounded-lg hover:bg-[#1a0f00]/85 transition-colors"
            >
              Start for free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-3xl mx-auto px-6 pt-24 pb-12 text-center">
        {/* Two-line eyebrow: category positioning on top, plan badge below.
            Stripe / Vercel hero pattern — institutional line + plan badge. */}
        <p className="text-[12px] font-mono text-[#1a0f00]/55 mb-3 uppercase tracking-widest">
          The safe monetization layer for AI APIs
        </p>
        <div className="inline-block px-3 py-1 mb-6 bg-[#fffd43] text-[#1a0f00] rounded-full text-[11px] font-bold uppercase tracking-widest">
          Launch Plan · Private Beta
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-5 leading-[1.04]">
          No monthly fee.<br />
          <span className="text-[#1a0f00]/70">Pay 3% only when your<br />AI API earns.</span>
        </h1>
        <p className="text-lg text-[#1a0f00]/55 max-w-2xl mx-auto mb-2 leading-relaxed">
          Start free with 3,000 API calls.
        </p>
        <p className="text-[14px] text-[#1a0f00]/45 max-w-xl mx-auto leading-relaxed">
          Gateway, Pay Token, spend limits, rate limits, usage metering — all included with zero setup fee.
        </p>
      </section>

      {/* ── The single card ── */}
      <section className="max-w-2xl mx-auto px-6 pb-20">
        <div className="rounded-3xl bg-white border-2 border-[#1a0f00] shadow-2xl overflow-hidden">
          {/* Header band */}
          <div className="bg-[#1a0f00] text-white px-8 py-5">
            <div className="flex items-baseline justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#fffd43]">Plan</p>
                <h2 className="text-2xl font-black mt-1">Launch Plan</h2>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black">$0</p>
                <p className="text-[11px] text-white/55 font-mono">/ month</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-8 py-7">
            <p className="text-[14px] text-[#1a0f00]/65 leading-relaxed mb-6">
              Designed for developers turning their first AI API into a paid product. <strong className="text-[#1a0f00]">You pay nothing until your API earns.</strong>
            </p>

            {/* Two columns: what's free / what's the fee */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-7 pb-7 border-b border-[#1a0f00]/10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/50 mb-2">Free</p>
                <p className="text-2xl font-black mb-1">3,000</p>
                <p className="text-[12px] text-[#1a0f00]/55">API calls free to start (one-time, per account)</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/50 mb-2">Monetization fee</p>
                <p className="text-2xl font-black mb-1">3%</p>
                <p className="text-[12px] text-[#1a0f00]/55">only when your API earns revenue</p>
              </div>
            </div>

            {/* Included */}
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/50 mb-4">Everything included</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4 mb-8">
              {[
                "Basic Gateway",
                "Pay Token issuance",
                "Spend limits",
                "Rate limits",
                "Usage metering",
                "Basic dashboard",
                "No setup fee",
                "No fixed transaction fee",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-[#1a0f00]/75">
                  <span className="text-[#1a0f00] mt-0.5"><IconCheck /></span>
                  {f}
                </li>
              ))}
            </ul>

            {/* CTA */}
            <Link
              href="/app"
              className="block w-full text-center px-6 py-3.5 bg-[#1a0f00] text-[#fffd43] rounded-xl hover:bg-[#1a0f00]/85 transition-colors text-[14px] font-bold"
            >
              Start for free →
            </Link>
            <p className="text-center mt-3 text-[11px] text-[#1a0f00]/45">
              No credit card. Sign in with email, Google, or GitHub — you’re live right away.
            </p>
          </div>
        </div>

        {/* Trust line below the card */}
        <p className="text-center mt-8 text-[12px] text-[#1a0f00]/50 leading-relaxed">
          Aligned incentive: we only make money when you make money.<br />
          3% is a bundle price — gateway + Pay Token + metering + dashboard, not just payments. Cheaper than Lemon Squeezy (5%) and Gumroad (10%), pricier than Stripe alone (~0.7%) because we bundle the auth + metering Stripe doesn&apos;t.
        </p>
      </section>

      {/* ── Worked example ── */}
      <section className="bg-white border-y border-[#1a0f00]/8">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <p className="text-center text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-4">How the math works</p>
          <h2 className="text-center text-2xl md:text-3xl font-black mb-10 leading-tight">
            Three realistic months.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                label: "Month 1 — Pre-launch",
                calls: "500 API calls",
                revenue: "$0 (still testing)",
                fee:   "$0",
                tone:  "neutral",
              },
              {
                label: "Month 4 — First buyers",
                calls: "2,400 API calls",
                revenue: "$48 (480 paid at $0.10)",
                fee:   "$1.44",
                tone:  "good",
              },
              {
                label: "Month 9 — Growing",
                calls: "12,000 API calls",
                revenue: "$240 (2,400 paid at $0.10)",
                fee:   "$7.20",
                tone:  "great",
              },
            ].map(({ label, calls, revenue, fee, tone }) => (
              <div key={label} className="rounded-2xl bg-[#fafaf7] border border-[#1a0f00]/10 p-5">
                <p className="text-[11px] font-bold text-[#1a0f00]/50 uppercase tracking-widest mb-3">{label}</p>
                <p className="text-[12px] text-[#1a0f00]/60 mb-1"><strong className="text-[#1a0f00]">Calls:</strong> {calls}</p>
                <p className="text-[12px] text-[#1a0f00]/60 mb-1"><strong className="text-[#1a0f00]">Revenue:</strong> {revenue}</p>
                <p className="text-[12px] text-[#1a0f00]/60"><strong className="text-[#1a0f00]">LemonCake fee:</strong> <span className={tone === "neutral" ? "" : "text-emerald-700 font-bold"}>{fee}</span></p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-[11px] text-[#1a0f00]/40">
            Numbers are illustrative. Your unit price and call volume are entirely up to you — we just take 3% of what you earn.
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 py-20">
        <p className="text-center text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-4">FAQ</p>
        <h2 className="text-center text-2xl md:text-3xl font-black mb-10 leading-tight">Common questions</h2>
        <div className="flex flex-col gap-4">
          {[
            {
              q: "Is there a monthly fee?",
              a: "No. LemonCake has no monthly fee during the Launch Plan. You can use the gateway, Pay Token, spend limits, rate limits, usage metering, and the basic dashboard at zero ongoing cost.",
            },
            {
              q: "When do I pay?",
              a: "You only pay when your AI API earns revenue. If a month goes by with no paid calls, you owe nothing.",
            },
            {
              q: "What is the fee?",
              a: "LemonCake charges a 3% Monetization fee on successful API revenue. That's it — no setup fee, no monthly fee, no fixed per-transaction fee.",
            },
            {
              q: "Are there fixed transaction fees (like Stripe's $0.30)?",
              a: "No. Sub-cent micro-payments work natively because there's no fixed floor — only the 3% revenue share. This is why LemonCake fits AI APIs that bill $0.001 - $0.05 per call.",
            },
            {
              q: "What is included for free?",
              a: "Your first 3,000 API calls — a one-time allowance per seller account, not a monthly reset — plus all the core features: basic Gateway, Pay Token issuance, spend limits, rate limits, usage metering, and the basic dashboard.",
            },
            {
              q: "What happens after 3,000 API calls?",
              a: "From then on, the 3% Monetization fee applies to your paid calls: when a call earns revenue, you keep 97% and LemonCake takes 3%. There's still no setup fee, no monthly fee, and no fixed per-transaction fee.",
            },
            {
              q: "Why 3% — that sounds higher than Stripe?",
              a: "Stripe charges ~0.7% for pure payments. LemonCake's 3% bundles permission control (Pay Token), gateway, metering, dashboard, and settlement — closer to comparing Stripe + Orb + a custom auth layer combined. Versus other monetization platforms: Lemon Squeezy is 5%, Gumroad is 10%. We chose 3% to sit visibly under both while still funding the bundle properly. And we don't take a cut until your API actually earns.",
            },
            {
              q: "How is 'revenue' measured?",
              a: "A call that successfully completes (HTTP 2xx/3xx) and that the buyer's Pay Token actually pays for. If a call fails or the buyer hits their spend cap, the call isn't counted as revenue and we take no fee.",
            },
            {
              q: "Is there a subscription / Enterprise plan?",
              a: "Not during the Launch Plan period. Single-card pricing keeps things honest while we get to 100 sellers. Enterprise contracts and SLAs come later — design partners get advance notice and locked-in terms.",
            },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
              <p className="text-[15px] font-bold mb-2">{q}</p>
              <p className="text-[13px] text-[#1a0f00]/65 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── JP FAQ (mirrored, for JP visitors landing here directly) ── */}
      <section className="bg-white border-t border-[#1a0f00]/8">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <p className="text-center text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-4">よくある質問 (日本語)</p>
          <h2 className="text-center text-xl md:text-2xl font-black mb-8 leading-tight">日本語の質問</h2>
          <div className="flex flex-col gap-4">
            {[
              { q: "月額費用はかかりますか?", a: "かかりません。Launch Plan では月額無料で始められます。" },
              { q: "いつ費用が発生しますか?", a: "AI API に売上が発生した時だけ、3% の Monetization fee が発生します。" },
              { q: "固定手数料はありますか?", a: "ありません。小額 API 課金に対応しやすいよう、固定取引手数料は設けていません。" },
              { q: "無料でどこまで使えますか?", a: "最初の 3,000 API calls、Basic Gateway、Pay Token、利用上限、レート制限、使用量計測、基本ダッシュボードが利用できます。" },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-2xl bg-[#fafaf7] border border-[#1a0f00]/10 p-5">
                <p className="text-[14px] font-bold mb-1.5">{q}</p>
                <p className="text-[12.5px] text-[#1a0f00]/65 leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="px-6 py-20">
        <div className="max-w-3xl mx-auto rounded-3xl bg-[#fffd43] p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-black leading-tight mb-3">
            Try it for free.
          </h2>
          <p className="text-[14px] text-[#1a0f00]/65 mb-7 max-w-md mx-auto">
            Turn your AI API into a paid API. Pay only when it actually earns.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-7 py-3 bg-[#1a0f00] text-[#fffd43] font-bold rounded-xl hover:bg-[#1a0f00]/85 transition-colors text-[14px]"
            >
              Start for free <IconArrow />
            </Link>
            <ContactButton className="inline-flex items-center gap-2 px-7 py-3 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold rounded-xl hover:bg-white/85 transition-colors text-[14px]">
              Talk to us
            </ContactButton>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1a0f00]/8 py-10 bg-[#fafaf7]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-[#1a0f00]/45">© 2026 evidai · LemonCake Launch Plan</p>
          <div className="flex items-center gap-5 text-[11px] text-[#1a0f00]/45">
            <Link href="/about/en" className="hover:text-[#1a0f00] transition-colors">About</Link>
            <Link href="/docs" className="hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/consulting" className="hover:text-[#1a0f00] transition-colors">Consulting</Link>
            <a href="mailto:contact@aievid.com" className="hover:text-[#1a0f00] transition-colors">contact@aievid.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
