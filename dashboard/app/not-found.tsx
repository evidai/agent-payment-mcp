import Link from "next/link";
import type { Metadata } from "next";

// Custom 404 — keeps brand voice instead of Next.js default.
// Quietly funnels lost visitors to the most-likely-useful destinations
// (pricing, docs, free signup) rather than dead-ending them.

export const metadata: Metadata = {
  title: "Not found — LemonCake",
  description: "That page doesn't exist. Try /pricing, /docs, or /start/free.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased flex flex-col">
      <nav className="sticky top-0 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/about/en" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-[15px]">LemonCake</span>
          </Link>
          <div className="flex items-center gap-5 text-[13px] text-[#1a0f00]/60">
            <Link href="/pricing"    className="hover:text-[#1a0f00] transition-colors">Pricing</Link>
            <Link href="/docs"       className="hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/start/free" className="font-semibold text-[#1a0f00]">Start free →</Link>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="text-center max-w-lg">
          <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-4">404 · Page not found</p>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-5 leading-[1.05]">
            That page<br />
            <span className="text-[#1a0f00]/55">isn&apos;t baked yet.</span>
          </h1>
          <p className="text-[14px] text-[#1a0f00]/60 mb-8 leading-relaxed">
            Maybe a stale link, a typo, or a page we shipped and unshipped. Either way, you probably want one of these:
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a0f00] text-[#fffd43] font-bold rounded-xl hover:bg-[#1a0f00]/85 transition-colors text-[13px]"
            >
              See pricing
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold rounded-xl hover:bg-white/85 transition-colors text-[13px]"
            >
              Read docs
            </Link>
            <Link
              href="/start/free"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold rounded-xl hover:bg-white/85 transition-colors text-[13px]"
            >
              Start for free →
            </Link>
          </div>
          <p className="mt-8 text-[11px] text-[#1a0f00]/40 font-mono">
            The safe monetization layer for AI APIs · Private Beta
          </p>
        </div>
      </div>
    </main>
  );
}
