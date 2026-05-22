"use client";

/**
 * /en/sellers — Provider signup (English locale).
 *
 * Mirrors /sellers but with English copy and USD pricing emphasis.
 * Uses the same ProviderRegistrationWizard component; locale is
 * controlled by the parent page context (see global LangContext).
 */

import { ProviderRegistrationWizard } from "@/components/ProviderRegistrationWizard";

export default function SellersPageEn() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">

        {/* Hero */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider">
            <span>🍋</span><span>For API Providers</span>
          </span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold text-gray-900 leading-tight tracking-tight">
            Turn your API into<br />
            <span className="text-amber-600">AI agent revenue</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl mx-auto">
            Receive USDC directly. <strong className="text-gray-900">60× cheaper than Stripe</strong>.
            First 1,000 calls/mo free. <strong className="text-gray-900">1 minute to register</strong>.
          </p>
        </div>

        {/* 3 column value props */}
        <div className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "💰", title: "Direct USDC payouts", desc: "Skip credit cards — funds land in your wallet instantly. No chargebacks." },
            { icon: "⚡", title: "From $0.001/call", desc: "60× cheaper than Stripe's ¥45 minimum fee. Charge cents-per-request profitably." },
            { icon: "🌏", title: "No geo friction", desc: "Works where cards don't. JP/US/EU/UK/SG/CA/CH regulatory green." },
          ].map((v) => (
            <div key={v.title} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-3xl">{v.icon}</div>
              <div className="mt-3 font-bold text-gray-900">{v.title}</div>
              <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* Pricing teaser (USD primary) */}
        <div className="mb-10 rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Plans</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 divide-x divide-gray-100">
            {[
              { name: "Free",      price: "$0",   sub: "1,000 calls/mo" },
              { name: "Pro",       price: "$69",  sub: "10K calls + QuickBooks coming, accounting unlocks" },
              { name: "Business",  price: "$199", sub: "100K calls + off-ramp + multi-wallet" },
              { name: "Scale",     price: "$699", sub: "500K calls + audit + team + SLA" },
            ].map((p) => (
              <div key={p.name} className="p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{p.name}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 font-mono">{p.price}<span className="text-[10px] font-normal text-gray-500">/mo</span></p>
                <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">{p.sub}</p>
              </div>
            ))}
          </div>
          <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-100">
            Start free, upgrade when you need accounting integrations. Subscriptions billed monthly via Stripe (USD).
          </p>
        </div>

        {/* Wizard (shared component) */}
        <ProviderRegistrationWizard variant="page" />

        <p className="mt-12 text-center text-xs text-gray-400">
          USDC settles directly to your wallet. LemonCake never touches your funds.
          <br />
          Details: <a href="/en/security" className="underline hover:text-amber-700">/security</a>
        </p>
      </div>
    </main>
  );
}
