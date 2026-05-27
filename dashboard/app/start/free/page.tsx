"use client";

/**
 * /start/free — 8-step "ideal first-time experience" onboarding flow.
 *
 * Designed to match the user's stated target: a developer arrives, walks
 * through 8 steps in under 5 minutes, leaves with a clear picture of what
 * the live product will deliver.
 *
 * Honest split:
 *   - Steps 1-2: education (you got it just by being here)
 *   - Steps 3-4: real form inputs that get sent to contact@aievid.com
 *                via mailto so Hiroto can provision manually
 *   - Steps 5-8: visual previews of what the hosted product produces.
 *                Each carries an honest "Private Beta — ready ~24h after
 *                we provision" marker. No fake-success states.
 *
 * The point isn't to actually run the gateway from this page — it's to
 * show the seller the SHAPE of the experience so they can decide whether
 * to engage. Once they submit, the manual handoff begins.
 *
 * Once the hosted gateway lands (target Q3 2026), steps 5-8 turn live
 * and the page becomes a self-serve wizard. The structure already
 * matches; only the placeholder values get swapped for real ones.
 */

import { useState, useMemo } from "react";
import Link from "next/link";

/* ── Helpers ────────────────────────────────────────────────────────── */

function slugFromEmail(email: string): string {
  if (!email || !email.includes("@")) return "your-handle";
  return email.split("@")[0].toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 24);
}

function buildMailto({ email, apiUrl, price, expected, useCase }: {
  email:    string;
  apiUrl:   string;
  price:    string;
  expected: string;
  useCase:  string;
}) {
  const subject = encodeURIComponent("Launch Plan signup — LemonCake");
  const body = encodeURIComponent(
    `Hi Hiroto,\n\n` +
    `I want to monetize an AI API with LemonCake's Launch Plan.\n\n` +
    `Email:               ${email || "[fill in]"}\n` +
    `API endpoint URL:    ${apiUrl || "[fill in]"}\n` +
    `Price per call (USD): ${price || "[e.g. 0.02]"}\n` +
    `Expected calls/mo:   ${expected || "[best guess]"}\n` +
    `Use case:            ${useCase || "[1-2 lines]"}\n\n` +
    `Send me my seller key + gateway URL when ready.\n\n` +
    `Thanks!`
  );
  return `mailto:contact@aievid.com?subject=${subject}&body=${body}`;
}

/* ── Step container ─────────────────────────────────────────────────── */

type StepStatus = "done" | "active" | "beta";

function StepCard({
  number,
  title,
  status,
  children,
}: {
  number:   number;
  title:    string;
  status:   StepStatus;
  children: React.ReactNode;
}) {
  const tone = {
    done:   { num: "bg-emerald-500 text-white",        ring: "ring-emerald-200" },
    active: { num: "bg-amber-500 text-white",          ring: "ring-amber-200"   },
    beta:   { num: "bg-gray-200 text-gray-500",         ring: "ring-gray-100"    },
  }[status];

  const badge = {
    done:   <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">Done — by being here</span>,
    active: <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">Fill this in</span>,
    beta:   <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600 bg-gray-100 rounded-full px-2 py-0.5">Private Beta · ~24h</span>,
  }[status];

  return (
    <div className="relative pl-12 pb-10">
      {/* vertical timeline line */}
      <div className="absolute left-[15px] top-9 bottom-0 w-px bg-gray-200" />
      {/* number bubble */}
      <div className={`absolute left-0 top-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ring-4 ${tone.num} ${tone.ring}`}>
        {status === "done" ? "✓" : number}
      </div>
      {/* card */}
      <div className="mb-2 flex items-center gap-2 flex-wrap">
        <h3 className="text-[15px] font-bold text-gray-900">{title}</h3>
        {badge}
      </div>
      <div className="text-[13.5px] text-gray-700 leading-relaxed">{children}</div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function StartFreePage() {
  const [email, setEmail]       = useState("");
  const [apiUrl, setApiUrl]     = useState("");
  const [price, setPrice]       = useState("");
  const [expected, setExpected] = useState("");
  const [useCase, setUseCase]   = useState("");
  const [submitted, setSubmitted] = useState(false);

  const formValid = email.includes("@") && apiUrl.length > 0 && price.length > 0;
  const slug = useMemo(() => slugFromEmail(email), [email]);
  const sampleGatewayUrl = `https://gateway.lemoncake.xyz/${slug}${apiUrl ? new URL(apiUrl, "https://x.x").pathname : "/api/search"}`;
  const mailto = buildMailto({ email, apiUrl, price, expected, useCase });

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50 text-gray-900">
      {/* Sticky nav */}
      <nav className="sticky top-0 z-20 bg-amber-50/85 backdrop-blur-md border-b border-amber-200/60">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between">
          <Link href="/about/en" className="flex items-center gap-2">
            <img src="/logo.png" alt="LemonCake" className="w-6 h-6 rounded-md object-cover" />
            <span className="text-sm font-bold">LemonCake</span>
          </Link>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</Link>
            <Link href="/docs"    className="text-gray-600 hover:text-gray-900 transition-colors">Docs</Link>
            <Link href="/about/en" className="text-gray-600 hover:text-gray-900 transition-colors">About</Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">

        {/* Hero */}
        <div className="mb-3 inline-flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1 bg-gray-900 text-amber-300 rounded-full text-[10px] font-bold uppercase tracking-widest">
            Launch Plan · Private Beta
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
          Turn your AI API into a<br />
          <span className="text-gray-500">paid API in 5 minutes.</span>
        </h1>
        <p className="mt-4 text-[14px] text-gray-600 leading-relaxed max-w-xl">
          Walk through the 8 steps below. Submit your endpoint + price at the end and we&apos;ll provision your gateway within 24h (manual during Private Beta — self-serve lands Q3 2026).
        </p>

        {/* The 8 steps */}
        <div className="mt-12">

          {/* 1 */}
          <StepCard number={1} title="AI APIs can be monetized — even sub-cent per call" status="done">
            Stripe&apos;s $0.30 floor blocks per-call billing under a dollar. LemonCake settles in USDC with no fixed transaction fee, so <code className="text-[12px] bg-gray-100 px-1 rounded">$0.001</code> per call works natively.
          </StepCard>

          {/* 2 */}
          <StepCard number={2} title="$0 / month. 3% only when your API earns." status="done">
            No setup fee. No monthly fee. First 3,000 API calls free regardless of revenue. The 3% Monetization fee fires only when a buyer actually pays for a call. See <Link href="/pricing" className="text-amber-700 underline-offset-2 hover:underline font-semibold">/pricing</Link> for the full breakdown.
          </StepCard>

          {/* 3 — API URL */}
          <StepCard number={3} title="Your API endpoint URL" status="active">
            <input
              type="url"
              placeholder="https://api.your-thing.com/v1/search"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none font-mono"
            />
            <p className="mt-2 text-[11px] text-gray-500">
              The endpoint LemonCake will proxy. Can be a single path or a prefix (we&apos;ll match suffixes too).
            </p>
          </StepCard>

          {/* 4 — Price per call */}
          <StepCard number={4} title="Price per call (USD)" status="active">
            <div className="mt-2 flex items-center gap-3">
              <span className="text-sm font-bold text-gray-500">$</span>
              <input
                type="text"
                placeholder="0.02"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                className="w-32 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none font-mono"
              />
              <span className="text-[11px] text-gray-500">per successful call</span>
            </div>
            {price && (
              <p className="mt-2 text-[11px] text-gray-500">
                LemonCake takes 3% = <code className="bg-gray-100 px-1 rounded">${(Number(price) * 0.03).toFixed(5)}</code> per call. You keep <code className="bg-gray-100 px-1 rounded">${(Number(price) * 0.97).toFixed(5)}</code>.
              </p>
            )}
          </StepCard>

          {/* 5 — Gateway URL preview */}
          <StepCard number={5} title="Your Gateway URL — issued after we provision" status="beta">
            <div className="mt-2 rounded-xl bg-gray-950 text-gray-300 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
              <span className="text-gray-500"># Buyers call this — we proxy to your API and meter:</span><br />
              <span className="text-amber-300">{sampleGatewayUrl}</span>
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              The slug <code className="bg-gray-100 px-1 rounded">{slug}</code> derives from your email (we&apos;ll confirm it on provisioning — you can pick a different one).
            </p>
          </StepCard>

          {/* 6 — Pay Token sample */}
          <StepCard number={6} title="Issue a Pay Token to your first buyer" status="beta">
            <p className="text-[12px] text-gray-600 mb-2">
              Each buyer (agent or human) gets a spend-limited Pay Token. Sample shape:
            </p>
            <div className="rounded-xl bg-gray-950 text-gray-300 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`{
  "v": "0.1",
  "iss": "lc_seller_${slug.slice(0, 8)}...",
  "allowed_api": "${slug}",
  "exp": <epoch + 1h>,
  "max_spend": 5.00,
  "price_per_call": ${price || "0.02"},
  "rate_limit": "10/min"
}`}
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              Full spec: <Link href="/docs/pay-token" className="text-amber-700 underline-offset-2 hover:underline">/docs/pay-token</Link>.
            </p>
          </StepCard>

          {/* 7 — Test request */}
          <StepCard number={7} title="Run your first test request" status="beta">
            <p className="text-[12px] text-gray-600 mb-2">
              Once your gateway URL + Pay Token are issued, your first paid call is one curl away:
            </p>
            <div className="rounded-xl bg-gray-950 text-gray-300 p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`curl -H "Authorization: Bearer <pay-token>" \\
     "${sampleGatewayUrl}?q=hello"
# → 200 OK, charge recorded`}
            </div>
          </StepCard>

          {/* 8 — Usage + revenue log */}
          <StepCard number={8} title="Usage + revenue log in your dashboard" status="beta">
            <p className="text-[12px] text-gray-600 mb-2">
              After your first paid call, the dashboard lights up. Sample:
            </p>
            <div className="rounded-xl border border-gray-200 bg-white p-4 text-[12px] font-mono">
              <div className="flex items-center justify-between text-gray-600 mb-2 pb-2 border-b border-gray-100">
                <span>Time</span><span>Buyer</span><span>Status</span><span>You earned</span>
              </div>
              {[
                { t: "12:04:21", b: "agent:abc-…",  s: "✓",  e: `$${(Number(price) * 0.97 || 0.0194).toFixed(5)}` },
                { t: "12:04:18", b: "agent:abc-…",  s: "✓",  e: `$${(Number(price) * 0.97 || 0.0194).toFixed(5)}` },
                { t: "12:04:11", b: "agent:xyz-…",  s: "402", e: "—" },
                { t: "12:04:05", b: "agent:abc-…",  s: "✓",  e: `$${(Number(price) * 0.97 || 0.0194).toFixed(5)}` },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between text-gray-700 py-1">
                  <span>{r.t}</span>
                  <span className="text-gray-500">{r.b}</span>
                  <span className={r.s === "✓" ? "text-emerald-700" : "text-amber-700"}>{r.s}</span>
                  <span className="font-bold">{r.e}</span>
                </div>
              ))}
              <p className="mt-2 text-[10px] text-gray-400 text-center">Live dashboard lands Q3 2026. Until then: weekly email summary.</p>
            </div>
          </StepCard>

          {/* Optional: email + use case for the submission */}
          <div className="mt-2 ml-12 rounded-2xl border border-amber-300 bg-amber-50/50 p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800 mb-3">
              Final step — tell us where to send your seller key
            </p>

            <label className="block">
              <span className="text-[12px] font-bold text-gray-700">Email *</span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-[12px] font-bold text-gray-700">Expected calls / month (optional)</span>
              <input
                type="text"
                placeholder="e.g. 200"
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
              />
            </label>

            <label className="mt-4 block">
              <span className="text-[12px] font-bold text-gray-700">Use case (1-2 lines)</span>
              <textarea
                rows={2}
                placeholder="e.g. AI agents calling our embeddings API for $0.001 per request"
                value={useCase}
                onChange={(e) => setUseCase(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none resize-none"
              />
            </label>

            <a
              href={formValid ? mailto : undefined}
              onClick={() => formValid && setSubmitted(true)}
              aria-disabled={!formValid}
              className={`mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-colors ${
                formValid
                  ? "bg-gray-900 text-amber-300 hover:bg-gray-800"
                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              Open email draft →
            </a>
            {!formValid && (
              <p className="mt-2 text-[11px] text-gray-500">
                Fill email + API URL + price above first.
              </p>
            )}

            {submitted && (
              <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-bold mb-1">✓ Email draft opened.</p>
                <p className="leading-relaxed text-[13px]">
                  Review the draft in your mail client and hit send. We&apos;ll reply within 24h with your{" "}
                  <code className="bg-emerald-100 px-1 rounded text-xs">LEMONCAKE_SELLER_KEY</code>,
                  your gateway URL <code className="bg-emerald-100 px-1 rounded text-xs">{sampleGatewayUrl}</code>,
                  a one-page integration guide, and an invite to a private Slack for design partners.
                </p>
              </div>
            )}
          </div>
        </div>

        <hr className="my-12 border-gray-200" />

        <p className="text-center text-[11px] text-gray-400">
          The safe monetization layer for AI APIs · Private Beta · Open core (MIT SDK)
        </p>
      </div>
    </main>
  );
}
