"use client";

/**
 * /app — Post-login seller dashboard (placeholder, Private Beta).
 *
 * This page exists to enforce the UX vision: a logged-in seller MUST NOT
 * see a wallet/USDC/permit screen first. They see "Add your first API"
 * first. Wallet exists deeper in Settings (not built yet).
 *
 * Today there's no real seller auth backend — sellers receive their key
 * via email after submitting /start/free. This page is what they WILL
 * see when self-serve auth lands (Q3 2026). For now it functions as:
 *
 *   1. A clear "Add your first API" entry point for anyone who navigates
 *      here directly (or clicks the temporary "I have an account" link).
 *   2. A preview of the sidebar / nav structure the real app will have.
 *   3. An honest Private-Beta marker so visitors know this is a shell.
 *
 * Sidebar items per the user's UX spec:
 *   Create API · Gateway · Pay Token · Test Console ·
 *   Usage · Revenue · Settings · Settlement
 *
 * Most are disabled placeholders linking to the relevant /docs or
 * /start/free flow. When the hosted gateway lands, these become live.
 */

import Link from "next/link";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "Create API",     icon: "🚀",  status: "active" as const, href: "/start/free", desc: "Add your first endpoint" },
  { label: "Gateway",        icon: "🌐",  status: "beta"   as const, href: "/docs/migrate-from-coinbase", desc: "URL rewrite + routing" },
  { label: "Pay Token",      icon: "🎟️", status: "beta"   as const, href: "/docs/pay-token", desc: "Issue spend-limited tokens" },
  { label: "Test Console",   icon: "🧪",  status: "beta"   as const, href: "/docs/quickstart", desc: "Run your first paid call" },
  { label: "Usage",          icon: "📊",  status: "beta"   as const, href: "#",           desc: "Calls, free quota, blocks" },
  { label: "Revenue",        icon: "💰",  status: "beta"   as const, href: "/pricing",    desc: "What you earned" },
  { label: "Settings",       icon: "⚙️",  status: "beta"   as const, href: "#",           desc: "API config, rate limits" },
  { label: "Settlement",     icon: "🏦",  status: "beta"   as const, href: "#",           desc: "Payouts to your wallet" },
];

export default function AppDashboard() {
  const [activeIdx] = useState(0);  // "Create API" is the default

  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
        <div className="max-w-7xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/about/en" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-6 h-6 rounded-md object-cover" />
            <span className="text-sm font-bold">LemonCake</span>
            <span className="ml-2 px-2 py-0.5 bg-[#1a0f00] text-[#fffd43] rounded-full text-[9px] font-bold uppercase tracking-widest">App · Private Beta</span>
          </Link>
          <div className="flex items-center gap-5 text-xs">
            <Link href="/docs"    className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/pricing" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">Pricing</Link>
            <span className="text-[#1a0f00]/40 font-mono text-[10px]">no account yet</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 py-8 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">

        {/* Sidebar */}
        <aside>
          <p className="text-[10px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-3">Workspace</p>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item, i) => {
              const isActive = i === activeIdx;
              const enabled  = item.status === "active";
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    isActive
                      ? "bg-[#1a0f00] text-[#fffd43] font-semibold"
                      : enabled
                        ? "text-[#1a0f00] hover:bg-[#1a0f00]/5"
                        : "text-[#1a0f00]/40 hover:bg-[#1a0f00]/[0.02]"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {item.status === "beta" && !isActive && (
                    <span className="text-[9px] font-mono text-[#1a0f00]/35 uppercase">soon</span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-xl bg-[#1a0f00]/4 border border-[#1a0f00]/8 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-1.5">Stage</p>
            <p className="text-[11px] text-[#1a0f00]/70 leading-relaxed">
              Self-serve dashboard lands <strong>Q3 2026</strong>. Until then, provisioning is manual (~24h) via{" "}
              <Link href="/start/free" className="underline">/start/free</Link>.
            </p>
          </div>
        </aside>

        {/* Main content — "Create your first paid API" big card */}
        <main>
          {/* Welcome heading */}
          <div className="mb-8">
            <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-2">Welcome</p>
            <h1 className="text-3xl md:text-4xl font-black leading-tight">
              Add your first paid API.
            </h1>
            <p className="mt-3 text-[14px] text-[#1a0f00]/65 leading-relaxed max-w-xl">
              The fastest path to your first paid request is the 8-step setup flow.
              You leave with a gateway URL preview, a Pay Token shape, and a sample test request — and we email you your seller key within 24h.
            </p>
          </div>

          {/* The big card */}
          <Link
            href="/start/free"
            className="block rounded-3xl bg-gradient-to-br from-[#fffd43] via-[#fffd43] to-amber-100 border-2 border-[#1a0f00] p-8 hover:shadow-xl transition-shadow group"
          >
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-[#1a0f00] text-[#fffd43] flex items-center justify-center text-2xl font-black">
                🚀
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-[#1a0f00]/55 uppercase tracking-widest mb-2">8-step flow · ~5 min</p>
                <h2 className="text-2xl font-black text-[#1a0f00] mb-2 group-hover:underline">
                  Create your first paid API →
                </h2>
                <p className="text-[13px] text-[#1a0f00]/70 leading-relaxed">
                  Name it, enter the original URL, set the per-call price, pick a rate limit + monthly cap.
                  We&apos;ll show you the gateway URL preview, a sample Pay Token, and your projected revenue at multiple volumes.
                </p>
              </div>
            </div>

            {/* Mini 8-step indicator */}
            <div className="mt-6 grid grid-cols-8 gap-1.5">
              {Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  className="h-1.5 rounded-full bg-[#1a0f00]/15"
                  title={`Step ${i + 1}`}
                />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-[#1a0f00]/45">
              <span>1. Understand</span>
              <span>4. Price</span>
              <span>8. Revenue log</span>
            </div>
          </Link>

          {/* Secondary actions row */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link
              href="/docs/pay-token"
              className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 hover:border-[#1a0f00]/25 transition-colors"
            >
              <p className="text-[11px] font-bold text-[#1a0f00]/45 uppercase tracking-widest mb-1">Reference</p>
              <h3 className="text-[14px] font-bold text-[#1a0f00] mb-1">Pay Token spec</h3>
              <p className="text-[12px] text-[#1a0f00]/60 leading-relaxed">JSON shape, fields, signing. Draft v0.1.</p>
            </Link>
            <Link
              href="/docs/quickstart"
              className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 hover:border-[#1a0f00]/25 transition-colors"
            >
              <p className="text-[11px] font-bold text-[#1a0f00]/45 uppercase tracking-widest mb-1">Quickstart</p>
              <h3 className="text-[14px] font-bold text-[#1a0f00] mb-1">SDK install</h3>
              <p className="text-[12px] text-[#1a0f00]/60 leading-relaxed"><code className="text-[11px] bg-[#1a0f00]/5 px-1 rounded">npm i @lemon-cake/mcp-sdk</code></p>
            </Link>
            <Link
              href="/pricing"
              className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 hover:border-[#1a0f00]/25 transition-colors"
            >
              <p className="text-[11px] font-bold text-[#1a0f00]/45 uppercase tracking-widest mb-1">Pricing</p>
              <h3 className="text-[14px] font-bold text-[#1a0f00] mb-1">Launch Plan</h3>
              <p className="text-[12px] text-[#1a0f00]/60 leading-relaxed">$0/mo · 3% only when API earns</p>
            </Link>
          </div>

          {/* What you'll see once provisioned */}
          <div className="mt-10 rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
            <p className="text-[10px] font-bold text-[#1a0f00]/45 uppercase tracking-widest mb-3">Coming up — once your seller key arrives</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 text-[12px] text-[#1a0f00]/65">
              {[
                "Your APIs list (with edit + pause)",
                "Live request feed (success + blocked)",
                "Revenue chart + earnings ledger",
                "Pay Token issuer (web UI)",
                "Test console (in-browser curl)",
                "Margin dashboard (cost vs revenue per endpoint)",
                "Settlement schedule + payout history",
                "Webhook + Slack integrations",
              ].map((line) => (
                <div key={line} className="flex items-start gap-2">
                  <span className="text-[#1a0f00]/30 mt-0.5">○</span>
                  <span>{line}</span>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[11px] text-[#1a0f00]/40 leading-relaxed">
              All of the above land Q3 2026. Design partners get early access — see <Link href="/start/free" className="underline">/start/free</Link>.
            </p>
          </div>

          {/* Honest footer */}
          <p className="mt-12 text-center text-[11px] text-[#1a0f00]/40">
            The safe monetization layer for AI APIs · Private Beta · Open core
          </p>
        </main>
      </div>
    </div>
  );
}
