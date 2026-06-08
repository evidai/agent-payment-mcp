import Link from "next/link";
import type { Metadata } from "next";
import DemoClient from "./DemoClient";

export const metadata: Metadata = {
  title: "Live demo — monetize an MCP server or API in under a minute",
  description:
    "Mint a sandbox Pay Token and make a metered API call through the LemonCake gateway — no login, no card, no crypto wallet. Watch the usage ledger update live, then do it with your own MCP server or API.",
  alternates: { canonical: "https://lemoncake.xyz/demo" },
  openGraph: {
    title: "LemonCake live demo — paid MCP/API flow, no sign-up",
    description: "Mint a sandbox Pay Token and make a metered call through the gateway. No login, no card, no crypto wallet.",
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
    <div className="min-h-screen bg-[#fbfbf4] text-[#1a0f00] font-sans antialiased">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 bg-[#fbfbf4]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-[15px]">LemonCake</span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-[13px] text-[#1a0f00]/60">
            <Link href="/pricing" className="hover:text-[#1a0f00] transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/about/en" className="hover:text-[#1a0f00] transition-colors">About</Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/app" className="hidden sm:inline text-[13px] text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">Dashboard</Link>
            <Link href="/app" className="text-[13px] font-semibold px-3 sm:px-4 py-1.5 bg-[#1a0f00] text-[#fffd43] rounded-lg hover:bg-[#1a0f00]/85 transition-colors whitespace-nowrap">
              Start for free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="max-w-6xl mx-auto px-6 pt-14 md:pt-18 pb-7">
        <div className="grid lg:grid-cols-[1fr_360px] gap-8 lg:gap-12 items-end">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-5 bg-[#1a0f00] text-[#fffd43] rounded-full text-[11px] font-bold uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-[#fffd43] animate-pulse-dot" />
              Live sandbox · No sign-up
            </div>
            <h1 className="text-[38px] md:text-6xl font-black leading-[1.02] tracking-tight mb-4 max-w-3xl">
              See a paid MCP/API call work before you integrate.
            </h1>
            <p className="text-[15px] md:text-[17px] text-[#1a0f00]/64 max-w-2xl leading-relaxed">
              Mint a sandbox Pay Token, call a metered endpoint, and watch the ledger update.
              No login, no card, no crypto wallet.
            </p>
          </div>
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-2">
            {[
              ["$0", "sandbox funds"],
              ["20", "test calls"],
              ["97%", "seller share"],
            ].map(([value, label]) => (
              <div key={label} className="border border-[#1a0f00]/10 bg-white px-4 py-3 rounded-xl">
                <p className="text-[22px] font-black tabular-nums leading-none">{value}</p>
                <p className="mt-1 text-[11px] font-bold text-[#1a0f00]/45 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Interactive demo ── */}
      <section className="max-w-5xl mx-auto px-6 pb-16">
        <DemoClient />
      </section>

      {/* ── How it works ── */}
      <section className="bg-white border-t border-[#1a0f00]/8">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <p className="text-center text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-3">After the demo</p>
          <h2 className="text-center text-xl md:text-3xl font-black mb-3 leading-tight">Turn your own MCP server or API into a paid endpoint.</h2>
          <p className="text-center text-[13.5px] text-[#1a0f00]/55 max-w-2xl mx-auto mb-10 leading-relaxed">
            The live demo uses the same building blocks you get in production: gateway routing, Pay Token verification, usage metering, and seller payouts.
          </p>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { n: "1", t: "Paste your URL", d: "Point LemonCake at an MCP server or HTTP API. We create the paid gateway endpoint." },
              { n: "2", t: "Set a per-call price", d: "Buyers prepay by card and receive a spend-capped Pay Token for agents to use." },
              { n: "3", t: "Share the buy link", d: "Successful calls are metered automatically. You keep 97%; first 3,000 lifetime calls are free." },
            ].map((s) => (
              <div key={s.n} className="rounded-xl bg-[#fbfbf4] border border-[#1a0f00]/10 p-5">
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
      <footer className="border-t border-[#1a0f00]/8 py-10 bg-[#fbfbf4]">
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
