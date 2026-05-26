"use client";

/**
 * /start/free — Free tier signup landing.
 *
 * Why this exists: /start/v2 funnels into ERC-2612 permit signing, which
 * is the Pro-tier path. The Free tier (1k tx/mo, gas sponsored) needs a
 * lighter on-ramp: someone evaluating LemonCake shouldn't have to sign a
 * permit before they know if the product works.
 *
 * For now (until we have automated provisioning) the form just builds a
 * pre-filled mailto: to contact@aievid.com. Manual processing is fine at
 * < 10 signups/week, which is where we are. When inbound grows we wire
 * this to /api/free-tier-signup and provision automatically.
 *
 * Notable choices:
 *   - No password / no account creation. We collect: email, agent stack,
 *     expected tx/month. Three fields, no captcha, no consent checkbox.
 *   - The submit goes through mailto: so the user *sees* what's being
 *     sent — no hidden POSTs to third-party form services. This is what
 *     a privacy-aware crypto-native dev expects.
 *   - We DO surface the limit/expectation up front: "manual provisioning,
 *     ~24h to get your API key". No "instant" claims we can't keep.
 */

import { useState } from "react";
import Link from "next/link";

export default function StartFreePage() {
  const [email, setEmail]       = useState("");
  const [stack, setStack]       = useState("");
  const [expected, setExpected] = useState("");

  const subject = encodeURIComponent("Free tier signup — LemonCake");
  const body = encodeURIComponent(
    `Hi Hiroto,\n\nI'd like to provision a Free tier API key.\n\n` +
    `Email:           ${email || "[fill in]"}\n` +
    `Agent stack:     ${stack || "[Claude Desktop / Cursor / Cline / LangChain / Eliza / ...]"}\n` +
    `Expected tx/mo:  ${expected || "[best guess, e.g. 200]"}\n\n` +
    `Use case: \n[1-2 lines on what your agent is calling APIs for]\n\n` +
    `Thanks!`
  );
  const mailto = `mailto:contact@aievid.com?subject=${subject}&body=${body}`;

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">

        {/* Banner */}
        <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-100/60 p-4 text-sm text-amber-900">
          <p className="font-bold">
            🍋 Free tier · 1,000 tx / month · Gas sponsored on Base · No card
          </p>
        </div>

        <h1 className="text-3xl font-bold text-gray-900">Get the Free tier API key</h1>
        <p className="mt-2 text-gray-600">
          Three fields, no signup, no permit signing required for the Free tier.
          We provision manually within 24h — fine at our current volume; the
          process becomes automatic when inbound grows.
        </p>

        <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <label className="block">
            <span className="text-sm font-bold text-gray-900">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
            />
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-bold text-gray-900">Agent stack</span>
            <input
              type="text"
              placeholder="Claude Desktop · Cursor · Cline · LangChain · Eliza · …"
              value={stack}
              onChange={(e) => setStack(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              Just so we can flag known integration gotchas in the welcome email.
            </span>
          </label>

          <label className="mt-5 block">
            <span className="text-sm font-bold text-gray-900">Expected tx / month</span>
            <input
              type="text"
              placeholder="e.g. 200 (you can guess)"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-gray-500">
              Free tier caps at 1,000. Over that auto-routes to $0.005/tx. No surprise rate-limiting.
            </span>
          </label>

          <a
            href={mailto}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-gray-800"
          >
            Open email draft →
          </a>
          <p className="mt-3 text-[11px] text-gray-500">
            Clicking opens your default mail client with the message pre-filled.
            Review and hit send — we&apos;ll reply with your API key within 24h.
          </p>
        </div>

        {/* What you get */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "💸", title: "1,000 tx free",   desc: "Gas sponsored by us. No card on file." },
            { icon: "⚡", title: "MPP / Tempo",     desc: "Accept Stripe MPP-signed payments alongside x402." },
            { icon: "🇯🇵", title: "JP onramp",      desc: "Only facilitator with JPY → USDC → Base. Stripe can&apos;t serve JP." },
          ].map((v) => (
            <div key={v.title} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-2xl">{v.icon}</div>
              <div className="mt-2 font-bold text-gray-900 text-[14px]">{v.title}</div>
              <p className="mt-1 text-[12px] text-gray-500 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* Alternative paths */}
        <div className="mt-10 rounded-2xl border border-amber-200 bg-amber-50/40 p-5 text-sm text-gray-700">
          <p className="font-bold text-gray-900">Already at the &gt; 1k tx / mo scale?</p>
          <p className="mt-1.5 leading-relaxed">
            Skip the manual provisioning. The <Link href="/start/v2" className="text-amber-700 underline-offset-2 hover:underline font-semibold">Pro tier signup at /start/v2</Link> issues an ERC-2612 permit on the spot.
            Pricing: $50/mo + $0.005/tx. See full breakdown at <Link href="/pricing" className="text-amber-700 underline-offset-2 hover:underline">lemoncake.xyz/pricing</Link>.
          </p>
        </div>

        <p className="mt-10 text-center text-xs text-gray-400">
          We don&apos;t hold your USDC. We don&apos;t hold your wallet keys. The Free
          tier is throttled by the facilitator alone — your wallet never gets
          permit-bound until you graduate to Pro.{" "}
          <Link href="/security" className="underline hover:text-amber-700">Security details →</Link>
        </p>
      </div>
    </main>
  );
}
