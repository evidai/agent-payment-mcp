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
  // Local-only "submitted" flag flips when the user clicks the mailto link.
  // We can't actually verify they sent the email — that's their mail
  // client's job — but we *can* show a clear "we're expecting you" state
  // so the page doesn't feel like nothing happened.
  const [submitted, setSubmitted] = useState(false);

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
  const formValid = email.trim().length > 0 && email.includes("@");

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      {/* Minimal nav so users coming directly to /start/free can hop back. */}
      <nav className="sticky top-0 z-20 bg-amber-50/80 backdrop-blur-md border-b border-amber-200/60">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/about/en" className="flex items-center gap-2">
            <img src="/logo.png" alt="LemonCake" className="w-6 h-6 rounded-md object-cover" />
            <span className="text-sm font-bold text-gray-900">LemonCake</span>
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/docs"    className="text-gray-600 hover:text-gray-900 transition-colors">Docs</Link>
            <Link href="/about/en" className="text-gray-600 hover:text-gray-900 transition-colors">About</Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">

        {/* Banner */}
        <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-100/60 p-4 text-sm text-amber-900">
          <p className="font-bold">
            🍋 Launch Plan · No monthly fee · 3% only when your API earns · No card
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
              First 3,000 API calls free regardless of revenue. After that, your account stays on — overage policy lands later, won't apply retroactively.
            </span>
          </label>

          <a
            href={formValid ? mailto : undefined}
            onClick={() => formValid && setSubmitted(true)}
            aria-disabled={!formValid}
            className={`mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-colors ${
              formValid
                ? "bg-gray-900 text-white hover:bg-gray-800"
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            Open email draft →
          </a>
          {!formValid && (
            <p className="mt-3 text-[11px] text-gray-500">
              Fill in your email above first — we need a way to send the API key back.
            </p>
          )}
          {formValid && !submitted && (
            <p className="mt-3 text-[11px] text-gray-500">
              Clicking opens your default mail client with the message pre-filled.
              Review and hit send.
            </p>
          )}
          {submitted && (
            <div className="mt-6 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
              <p className="font-bold mb-1">✓ Email draft opened.</p>
              <p className="leading-relaxed">
                Review the draft in your mail client and hit send. We&apos;ll reply with
                your seller key + onboarding doc within 24h (usually faster — Hiroto
                checks the inbox a few times a day).
              </p>
              <p className="mt-3 text-[12px] text-emerald-900/75">
                <strong>What to expect next:</strong> a reply from <code className="text-xs bg-emerald-100 px-1 rounded">contact@aievid.com</code>{" "}
                with your <code className="text-xs bg-emerald-100 px-1 rounded">LEMONCAKE_SELLER_KEY</code>,
                a one-page integration guide, and an invite to a private Slack channel for design partners.
              </p>
            </div>
          )}
        </div>

        {/* What you get */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "💸", title: "3,000 calls free",  desc: "First 3,000 API calls per month included. No setup fee, no monthly fee." },
            { icon: "📈", title: "3% only when earning", desc: "We charge only when your API generates revenue. No fixed transaction fee." },
            { icon: "🇯🇵", title: "JP onramp",      desc: "Only safe monetization layer with JPY → USDC → Base. Stripe can&apos;t serve JP." },
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
          <p className="font-bold text-gray-900">High-volume already?</p>
          <p className="mt-1.5 leading-relaxed">
            The Launch Plan covers you — no tier upgrade required. The <Link href="/start/v2" className="text-amber-700 underline-offset-2 hover:underline font-semibold">on-chain permit flow at /start/v2</Link> handles ERC-2612 signing if you want to skip manual provisioning. See <Link href="/pricing" className="text-amber-700 underline-offset-2 hover:underline">lemoncake.xyz/pricing</Link> for the full breakdown.
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
