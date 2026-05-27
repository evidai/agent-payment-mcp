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

function buildMailto({ email, apiUrl, price, expected, useCase, apiName, rateLimit, monthlyCap }: {
  email:      string;
  apiUrl:     string;
  price:      string;
  expected:   string;
  useCase:    string;
  apiName:    string;
  rateLimit:  string;
  monthlyCap: string;
}) {
  const subject = encodeURIComponent("Launch Plan signup — LemonCake");
  const body = encodeURIComponent(
    `Hi Hiroto,\n\n` +
    `I want to monetize an AI API with LemonCake's Launch Plan.\n\n` +
    `Email:                ${email || "[fill in]"}\n` +
    `API name:             ${apiName || "[e.g. search-api]"}\n` +
    `API endpoint URL:     ${apiUrl || "[fill in]"}\n` +
    `Price per call (USD): ${price || "[e.g. 0.02]"}\n` +
    `Rate limit:           ${rateLimit || "[default 60/min]"}\n` +
    `Monthly call cap:     ${monthlyCap || "[default unlimited]"}\n` +
    `Expected calls/mo:    ${expected || "[best guess]"}\n` +
    `Use case:             ${useCase || "[1-2 lines]"}\n\n` +
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
  const [apiName, setApiName]   = useState("");
  const [apiUrl, setApiUrl]     = useState("");
  const [price, setPrice]       = useState("");
  const [rateLimit, setRateLimit]       = useState("60/min");
  const [monthlyCap, setMonthlyCap]     = useState("1000");
  const [expected, setExpected] = useState("");
  const [useCase, setUseCase]   = useState("");
  const [submitted, setSubmitted] = useState(false);

  const formValid = email.includes("@") && apiUrl.length > 0 && price.length > 0;
  const slug = useMemo(() => slugFromEmail(email), [email]);
  const apiSlug = apiName.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 24) || slug;
  const sampleGatewayUrl = `https://gateway.lemoncake.xyz/${apiSlug}${apiUrl ? new URL(apiUrl, "https://x.x").pathname : "/api/search"}`;
  const mailto = buildMailto({ email, apiUrl, price, expected, useCase, apiName, rateLimit, monthlyCap });

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

          {/* 3 — Name + URL */}
          <StepCard number={3} title="Name your API + endpoint" status="active">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr] gap-3 mt-2">
              <input
                type="text"
                placeholder="search-api"
                value={apiName}
                onChange={(e) => setApiName(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none font-mono"
              />
              <input
                type="url"
                placeholder="https://api.your-thing.com/v1/search"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none font-mono"
              />
            </div>
            <p className="mt-2 text-[11px] text-gray-500">
              <strong>Name</strong>: becomes the slug in your gateway URL. <strong>URL</strong>: the endpoint we&apos;ll proxy (path or prefix).
            </p>
          </StepCard>

          {/* 4 — Price + Rate limit + Monthly cap + Revenue preview */}
          <StepCard number={4} title="Pricing &amp; spend rules" status="active">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              {/* Price */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Price / call (USD)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-500">$</span>
                  <input
                    type="text"
                    placeholder="0.02"
                    value={price}
                    onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="flex-1 rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
              {/* Rate limit */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Rate limit (default)</label>
                <input
                  type="text"
                  placeholder="60/min"
                  value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>
              {/* Monthly cap */}
              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Monthly call cap</label>
                <input
                  type="text"
                  placeholder="unlimited"
                  value={monthlyCap}
                  onChange={(e) => setMonthlyCap(e.target.value.replace(/[^0-9]/g, ""))}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none font-mono"
                />
              </div>
            </div>

            {/* Revenue preview — only renders when price is meaningful */}
            {price && Number(price) > 0 && (
              <div className="mt-4 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-800/70 mb-2">Revenue preview</p>
                <div className="grid grid-cols-3 gap-3 text-[12px]">
                  {[
                    { vol: 1000,  label: "1K calls / mo"  },
                    { vol: 10000, label: "10K calls / mo" },
                    { vol: 100000, label: "100K calls / mo" },
                  ].map(({ vol, label }) => {
                    const revenue = Number(price) * vol;
                    const fee     = revenue * 0.03;
                    const earn    = revenue * 0.97;
                    return (
                      <div key={vol}>
                        <p className="text-[10px] text-emerald-900/55 font-mono">{label}</p>
                        <p className="font-mono text-emerald-900 font-bold mt-1">${earn.toFixed(2)}</p>
                        <p className="text-[10px] text-emerald-900/55 mt-0.5 font-mono">3% fee: ${fee.toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <p className="mt-3 text-[11px] text-gray-500">
              All three are defaults — buyers can issue Pay Tokens with stricter caps via the dashboard.
            </p>
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

          {/* 6 — Pay Token sample (card UI) */}
          <StepCard number={6} title="Issue a Pay Token to your first buyer" status="beta">
            <p className="text-[12px] text-gray-600 mb-3">
              Each buyer (agent or human) gets a spend-limited Pay Token. Think of it like a one-time credit card with rules:
            </p>
            {/* Card UI — matches the user-spec visual style */}
            <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-100 border border-amber-300 p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-800/70">Pay Token</p>
                  <p className="text-[14px] font-mono text-amber-950 mt-0.5">
                    lc_pt_<span className="text-amber-700">{slug.slice(0, 6)}</span>…
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-100 rounded-full px-2 py-0.5">Active</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
                <dt className="text-amber-900/55">API</dt>
                <dd className="text-amber-950 font-mono text-right truncate">{apiName || apiSlug || "your-api"}</dd>

                <dt className="text-amber-900/55">Max spend</dt>
                <dd className="text-amber-950 font-bold text-right">$5.00</dd>

                <dt className="text-amber-900/55">Expires</dt>
                <dd className="text-amber-950 text-right">in 1 hour</dd>

                <dt className="text-amber-900/55">Max calls</dt>
                <dd className="text-amber-950 text-right">100</dd>

                <dt className="text-amber-900/55">Rate limit</dt>
                <dd className="text-amber-950 text-right">10 / min</dd>

                <dt className="text-amber-900/55">Price / call</dt>
                <dd className="text-amber-950 text-right">${price || "0.02"}</dd>
              </dl>
            </div>
            <p className="mt-3 text-[11px] text-gray-500">
              Plain-English version: <em>&quot;This API · 1 hour · max $5 · 100 calls · 10/min&quot;</em>. Full JSON spec at{" "}
              <Link href="/docs/pay-token" className="text-amber-700 underline-offset-2 hover:underline">/docs/pay-token</Link>.
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
