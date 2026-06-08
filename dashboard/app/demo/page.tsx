import Link from "next/link";
import type { Metadata } from "next";
import DemoClient from "./DemoClient";

export const metadata: Metadata = {
  title: "Live demo — turn an API into a paid API in under a minute (no sign-up)",
  description:
    "Mint a Pay Token and make a real metered API call through the LemonCake gateway — no login, no card. Watch the usage ledger update live, then do it with your own API.",
  alternates: { canonical: "https://lemoncake.xyz/demo" },
  openGraph: {
    title: "LemonCake live demo — monetize any API, no sign-up",
    description: "Mint a Pay Token and make a real metered API call through the gateway. No login required.",
    url: "https://lemoncake.xyz/demo",
    type: "website",
  },
};

const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

export default function DemoPage() {
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
            <Link href="/pricing" className="hover:text-[#1a0f00] transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/about/en" className="hover:text-[#1a0f00] transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-[13px] text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">Dashboard</Link>
            <Link href="/app" className="text-[13px] font-semibold px-4 py-1.5 bg-[#1a0f00] text-[#fffd43] rounded-lg hover:bg-[#1a0f00]/85 transition-colors">
              Start for free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-3xl mx-auto px-6 pt-20 pb-8 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 bg-[#1a0f00] text-[#fffd43] rounded-full text-[11px] font-bold uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-[#fffd43] animate-pulse-dot" />
          Live demo · No sign-up
        </div>
        <h1 className="text-3xl md:text-5xl font-black leading-[1.08] tracking-tight mb-4">
          Watch an API get paid,<br className="hidden md:block" /> in real time.
        </h1>
        <p className="text-[14px] md:text-[15px] text-[#1a0f00]/60 max-w-xl mx-auto leading-relaxed">
          Mint a Pay Token and make a real metered call through the production gateway.
          No login, no card — the ledger below updates as you go.
        </p>
      </section>

      {/* ── Interactive demo ── */}
      <section className="max-w-4xl mx-auto px-6 pb-16">
        <DemoClient />
      </section>

      {/* ── How it works ── */}
      <section className="bg-white border-t border-[#1a0f00]/8">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <p className="text-center text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-3">How it works</p>
          <h2 className="text-center text-xl md:text-2xl font-black mb-10 leading-tight">Three steps to a paid API</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: "1", t: "Wrap your endpoint", d: "Paste your API URL. We mint a gateway endpoint that meters every call." },
              { n: "2", t: "Issue Pay Tokens", d: "Bounded, signed tokens — budget, call cap, and expiry. Hand them to buyers or agents." },
              { n: "3", t: "Get paid per call", d: "Every successful call is metered. You keep 97%; your first 3,000 lifetime calls are free." },
            ].map((s) => (
              <div key={s.n} className="rounded-2xl bg-[#fafaf7] border border-[#1a0f00]/10 p-5">
                <span className="w-7 h-7 rounded-full bg-[#fffd43] text-[#1a0f00] text-[13px] font-black flex items-center justify-center mb-3">{s.n}</span>
                <p className="text-[14px] font-bold mb-1.5">{s.t}</p>
                <p className="text-[12.5px] text-[#1a0f00]/60 leading-relaxed">{s.d}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/app" className="inline-flex items-center gap-2 px-7 py-3 bg-[#1a0f00] text-[#fffd43] font-bold rounded-xl hover:bg-[#1a0f00]/85 transition-colors text-[14px]">
              Start with your own API <IconArrow />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1a0f00]/8 py-10 bg-[#fafaf7]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-[#1a0f00]/45">© 2026 evidai · LemonCake</p>
          <div className="flex items-center gap-5 text-[11px] text-[#1a0f00]/45">
            <Link href="/pricing" className="hover:text-[#1a0f00] transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/about/en" className="hover:text-[#1a0f00] transition-colors">About</Link>
            <a href="mailto:contact@aievid.com" className="hover:text-[#1a0f00] transition-colors">contact@aievid.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
