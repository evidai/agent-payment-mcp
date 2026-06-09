import Link from "next/link";
import type { Metadata } from "next";
import DemoClient from "./DemoClient";

export const metadata: Metadata = {
  title: "LemonCake Playground — test paid MCP/API calls",
  description:
    "Try a sandbox paid MCP/API call in 30 seconds. Mint a spend-capped Pay Token, run a metered call, inspect the seller ledger, and copy curl or MCP config.",
  alternates: { canonical: "https://lemoncake.xyz/demo" },
  openGraph: {
    title: "LemonCake Playground — paid MCP/API calls in 30 seconds",
    description: "Mint a sandbox Pay Token, run a metered call, and inspect the seller ledger. No login, card, or crypto wallet.",
    url: "https://lemoncake.xyz/demo",
    type: "website",
  },
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#f6f7f0] text-[#1a0f00] font-sans antialiased">
      <nav className="sticky top-0 z-20 border-b border-[#1a0f00]/8 bg-[#f6f7f0]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="h-7 w-7 rounded-md object-cover" />
            <span className="text-[15px] font-black">LemonCake</span>
            <span className="hidden rounded-full border border-[#1a0f00]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#1a0f00]/42 sm:inline">
              Playground
            </span>
          </Link>
          <div className="hidden items-center gap-5 text-[13px] font-semibold text-[#1a0f00]/55 md:flex">
            <Link href="/pricing" className="hover:text-[#1a0f00]">Pricing</Link>
            <Link href="/docs" className="hover:text-[#1a0f00]">Docs</Link>
            <Link href="/about/en" className="hover:text-[#1a0f00]">About</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app" className="hidden text-[13px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] sm:inline">
              Dashboard
            </Link>
            <Link href="/app" className="rounded-md bg-[#1a0f00] px-3 py-2 text-[12px] font-black text-[#fffd43] hover:bg-[#1a0f00]/88 sm:px-4">
              Monetize API
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <DemoClient />
      </main>

      <footer className="border-t border-[#1a0f00]/8 bg-[#f6f7f0]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-[11px] text-[#1a0f00]/42 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© 2026 evidai · LemonCake</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/pricing" className="hover:text-[#1a0f00]">Pricing</Link>
            <Link href="/docs" className="hover:text-[#1a0f00]">Docs</Link>
            <Link href="/about/en" className="hover:text-[#1a0f00]">About</Link>
            <a href="mailto:contact@aievid.com" className="hover:text-[#1a0f00]">contact@aievid.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
