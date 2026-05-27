"use client";

/**
 * /app — Post-login seller workspace (interactive Private-Beta shell).
 *
 * UX principle: this is NOT an explanation page. The moment a seller lands
 * here they must be entering an API URL and a price. Wallet / USDC / permit
 * never appear in primary surfaces. Time-to-first-paid-API-call is the
 * single metric being optimized.
 *
 * Layout (Stripe / Vercel / Supabase-style):
 *   Sidebar (Setup / Monitor / Manage) + Launch Checklist
 *   Main:
 *     1. Form (API name, URL, price, token budget, rate limit) +
 *        live preview (gateway URL, revenue projection)
 *     2. After "Create Gateway Endpoint" → success state w/ real CTA to
 *        /start/free (manual provisioning still gates the real seller key
 *        until self-serve auth lands Q3 2026 — but UX-wise the user has
 *        already DESIGNED their paid API)
 *     3. Pay Token issuer + simulated test request (fee calculation visible)
 *     4. Compact cards (Gateway preview / cURL / Pricing)
 *
 * Yellow is used ONLY for: primary CTA, active sidebar item, "Live" badge.
 * Everything else stays neutral (#fafaf7 / white / #1a0f00 text).
 */

import Link from "next/link";
import { useMemo, useState } from "react";

type SidebarItem = { label: string; href?: string; active?: boolean };
type SidebarGroup = { heading: string; items: SidebarItem[] };

const SIDEBAR: SidebarGroup[] = [
  {
    heading: "Setup",
    items: [
      { label: "Add API",      active: true },
      { label: "Gateway" },
      { label: "Pay Token" },
      { label: "Test Request" },
    ],
  },
  {
    heading: "Monitor",
    items: [
      { label: "Usage" },
      { label: "Revenue" },
      { label: "Blocked Requests" },
    ],
  },
  {
    heading: "Manage",
    items: [
      { label: "Settings" },
      { label: "Settlement" },
    ],
  },
];

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function fmtUsd(n: number): string {
  if (!isFinite(n)) return "$0.00";
  if (n < 0.01 && n > 0) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

export default function AppDashboard() {
  // Form
  const [apiName,      setApiName]      = useState("AI Search API");
  const [apiUrl,       setApiUrl]       = useState("https://api.example.com/search");
  const [pricePerCall, setPricePerCall] = useState("0.01");
  const [tokenBudget,  setTokenBudget]  = useState("5");
  const [rateLimit,    setRateLimit]    = useState("60");

  // Flow state
  const [created,         setCreated]         = useState(false);
  const [payTokenIssued,  setPayTokenIssued]  = useState(false);
  const [testSent,        setTestSent]        = useState(false);

  // Pay Token form
  const [ptBudget,   setPtBudget]   = useState("5");
  const [ptExpires,  setPtExpires]  = useState("1");
  const [ptMaxCalls, setPtMaxCalls] = useState("100");

  const apiSlug    = useMemo(() => slugify(apiName) || "your-api", [apiName]);
  const gatewayUrl = `https://gateway.lemoncake.xyz/${apiSlug}`;
  const priceNum   = Math.max(0, parseFloat(pricePerCall) || 0);
  const revenue1k  = priceNum * 1000;
  const fee1k      = revenue1k * 0.03;
  const net1k      = revenue1k - fee1k;

  // Per-call breakdown
  const callFee  = priceNum * 0.03;
  const callNet  = priceNum - callFee;
  const ptBudNum = Math.max(0, parseFloat(ptBudget) || 0);
  const ptRemain = Math.max(0, ptBudNum - priceNum);

  // Launch checklist
  const checklist = [
    { label: "Enter API URL",            done: apiUrl.startsWith("http") && apiUrl.length > 10 },
    { label: "Set price per call",       done: priceNum > 0 },
    { label: "Generate Gateway URL",     done: created },
    { label: "Issue Pay Token",          done: payTokenIssued },
    { label: "Send test paid request",   done: testSent },
    { label: "Go live (manual ~24h)",    done: false },
  ];
  const checklistDone = checklist.filter(c => c.done).length;

  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">

      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
        <div className="max-w-[1180px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/about/en" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-6 h-6 rounded-md object-cover" />
            <span className="text-[13px] font-bold">LemonCake</span>
            <span className="ml-2 px-2 py-0.5 bg-[#1a0f00]/5 text-[#1a0f00]/65 rounded-md text-[9px] font-bold uppercase tracking-widest">
              Private Beta
            </span>
          </Link>
          <div className="flex items-center gap-5 text-[12px]">
            <Link href="/docs"    className="text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/pricing" className="text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors">Pricing</Link>
            <span className="text-[#1a0f00]/35 font-mono text-[10px]">no account yet</span>
          </div>
        </div>
      </header>

      <div className="max-w-[1180px] mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-8">

        {/* ───────────────── Sidebar ───────────────── */}
        <aside className="md:sticky md:top-20 self-start">
          {SIDEBAR.map((group) => (
            <div key={group.heading} className="mb-5">
              <p className="text-[10px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-2 px-1">
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.label}>
                    <button
                      type="button"
                      className={`w-full text-left px-2.5 py-1.5 rounded-md text-[12.5px] transition-colors ${
                        item.active
                          ? "bg-[#fffd43] text-[#1a0f00] font-semibold"
                          : "text-[#1a0f00]/60 hover:bg-[#1a0f00]/4 hover:text-[#1a0f00]"
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Launch Checklist (replaces the old "SOON" labels) */}
          <div className="mt-2 rounded-xl bg-white border border-[#1a0f00]/10 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">
                Launch checklist
              </p>
              <span className="text-[10px] font-mono text-[#1a0f00]/45">{checklistDone}/{checklist.length}</span>
            </div>
            <div className="h-1 rounded-full bg-[#1a0f00]/8 overflow-hidden mb-3">
              <div
                className="h-full bg-[#16A34A] transition-all"
                style={{ width: `${(checklistDone / checklist.length) * 100}%` }}
              />
            </div>
            <ul className="space-y-1.5 text-[11.5px]">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-start gap-1.5">
                  <span className={c.done ? "text-[#16A34A]" : "text-[#1a0f00]/25"}>{c.done ? "✓" : "○"}</span>
                  <span className={c.done ? "text-[#1a0f00]/85" : "text-[#1a0f00]/55"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* ───────────────── Main column ───────────────── */}
        <main className="min-w-0">

          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-[28px] md:text-[32px] font-black leading-[1.15] tracking-tight">
              Create your first paid AI API
            </h1>
            <p className="mt-2 text-[13.5px] text-[#1a0f00]/60 leading-relaxed max-w-[640px]">
              Enter your existing API URL, set a price per call, and get a paid LemonCake Gateway endpoint.
              No monthly fee. 3% only when your API earns.
            </p>
          </div>

          {/* Form + Live Preview ───────────────────────── */}
          <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">

            {/* LEFT: form */}
            <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[15px] font-bold">Create a paid endpoint</h2>
                <span className="text-[10px] font-mono text-[#1a0f00]/40 uppercase tracking-widest">Step 1 of 3</span>
              </div>

              <div className="space-y-4">
                <Field label="API name">
                  <input
                    type="text"
                    value={apiName}
                    onChange={(e) => setApiName(e.target.value)}
                    placeholder="AI Search API"
                    className="w-full px-3 py-2 bg-[#fafaf7] border border-[#1a0f00]/12 rounded-lg text-[13px] focus:outline-none focus:border-[#1a0f00]/50 transition-colors"
                  />
                </Field>

                <Field label="Original API URL">
                  <input
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.example.com/search"
                    className="w-full px-3 py-2 bg-[#fafaf7] border border-[#1a0f00]/12 rounded-lg text-[13px] font-mono focus:outline-none focus:border-[#1a0f00]/50 transition-colors"
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Price per call" hint="USD">
                    <div className="flex items-center bg-[#fafaf7] border border-[#1a0f00]/12 rounded-lg focus-within:border-[#1a0f00]/50 transition-colors">
                      <span className="pl-3 text-[#1a0f00]/40 text-[13px]">$</span>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={pricePerCall}
                        onChange={(e) => setPricePerCall(e.target.value)}
                        className="w-full px-2 py-2 bg-transparent text-[13px] focus:outline-none"
                      />
                    </div>
                  </Field>

                  <Field label="Token budget limit" hint="USD / Pay Token">
                    <div className="flex items-center bg-[#fafaf7] border border-[#1a0f00]/12 rounded-lg focus-within:border-[#1a0f00]/50 transition-colors">
                      <span className="pl-3 text-[#1a0f00]/40 text-[13px]">$</span>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={tokenBudget}
                        onChange={(e) => setTokenBudget(e.target.value)}
                        className="w-full px-2 py-2 bg-transparent text-[13px] focus:outline-none"
                      />
                    </div>
                  </Field>

                  <Field label="Rate limit" hint="req/min">
                    <input
                      type="number"
                      step="10"
                      min="1"
                      value={rateLimit}
                      onChange={(e) => setRateLimit(e.target.value)}
                      className="w-full px-3 py-2 bg-[#fafaf7] border border-[#1a0f00]/12 rounded-lg text-[13px] focus:outline-none focus:border-[#1a0f00]/50 transition-colors"
                    />
                  </Field>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCreated(true)}
                disabled={!apiUrl.startsWith("http") || priceNum <= 0}
                className="mt-6 w-full py-2.5 bg-[#1a0f00] text-[#fffd43] font-bold text-[13px] rounded-lg hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {created ? "Gateway endpoint created ✓" : "Create Gateway Endpoint"}
              </button>

              <p className="mt-3 text-[10.5px] text-[#1a0f00]/45 leading-relaxed">
                Preview only — your real seller key + production gateway slot are provisioned within ~24h
                of submitting via <Link href="/start/free" className="underline">/start/free</Link>. Self-serve goes live Q3 2026.
              </p>
            </div>

            {/* RIGHT: live preview */}
            <aside className="rounded-2xl bg-[#1a0f00] text-[#fafaf7] p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#fafaf7]/45 mb-4">Live preview</p>

              <div className="space-y-4 text-[12px]">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#fafaf7]/40 mb-1">Original</p>
                  <p className="font-mono text-[11px] text-[#fafaf7]/70 break-all">{apiUrl || "—"}</p>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#fafaf7]/40 mb-1">LemonCake Gateway</p>
                  <p className="font-mono text-[11px] text-[#fffd43] break-all">{gatewayUrl}</p>
                </div>

                <div className="h-px bg-[#fafaf7]/10" />

                <div>
                  <p className="text-[10px] uppercase tracking-wider text-[#fafaf7]/40 mb-2">Revenue at 1,000 calls</p>
                  <dl className="space-y-1 font-mono text-[11px]">
                    <Row k="Gross" v={fmtUsd(revenue1k)} tone="onDark" />
                    <Row k="LemonCake fee (3%)" v={`-${fmtUsd(fee1k)}`} tone="onDark" muted />
                    <div className="h-px bg-[#fafaf7]/10 my-1.5" />
                    <Row k="You receive" v={fmtUsd(net1k)} tone="onDark" highlight />
                  </dl>
                </div>

                <div className="rounded-lg bg-[#fafaf7]/5 border border-[#fafaf7]/10 p-2.5 text-[10.5px] text-[#fafaf7]/55 leading-relaxed">
                  3,000 calls/month free. Above that, only 3% of revenue. No fixed transaction fee.
                </div>
              </div>
            </aside>
          </section>

          {/* SUCCESS STATE (appears after Create) ───────── */}
          {created && (
            <section className="mt-6 rounded-2xl bg-white border border-[#16A34A]/40 p-6">
              <div className="flex items-start gap-3 mb-4">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#16A34A] text-white text-[14px] font-black">✓</span>
                <div>
                  <h3 className="text-[16px] font-bold">
                    Your paid API is live
                    <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 bg-[#fffd43] text-[#1a0f00] rounded uppercase tracking-widest align-middle">Preview</span>
                  </h3>
                  <p className="text-[12px] text-[#1a0f00]/55 mt-0.5">
                    This is what your dashboard will look like once your seller key arrives. The configuration below is locked into your <Link href="/start/free" className="underline">/start/free</Link> submission.
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[12.5px]">
                <DetailRow k="Gateway URL"     v={<code className="font-mono text-[11.5px]">{gatewayUrl}</code>} />
                <DetailRow k="Price per call"  v={fmtUsd(priceNum)} />
                <DetailRow k="Rate limit"      v={`${rateLimit} req/min`} />
                <DetailRow k="Spend limit"     v={`${fmtUsd(parseFloat(tokenBudget) || 0)} per Pay Token`} />
                <DetailRow k="Pay Token"       v={<span className="text-[#16A34A] font-semibold">Required ✓</span>} />
                <DetailRow k="Abuse protection" v={<span className="text-[#16A34A] font-semibold">Rate + spend cap ✓</span>} />
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPayTokenIssued(true)}
                  className="px-4 py-2 bg-[#1a0f00] text-[#fffd43] font-bold text-[12px] rounded-lg hover:bg-[#1a0f00]/90 transition-colors"
                >
                  {payTokenIssued ? "Pay Token issued ✓" : "Generate Pay Token"}
                </button>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(gatewayUrl); }}
                  className="px-4 py-2 bg-white border border-[#1a0f00]/15 font-semibold text-[12px] rounded-lg hover:bg-[#1a0f00]/4 transition-colors"
                >
                  Copy Gateway URL
                </button>
                <Link
                  href="/start/free"
                  className="px-4 py-2 text-[12px] text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors"
                >
                  Submit for provisioning →
                </Link>
              </div>
            </section>
          )}

          {/* TEST CONSOLE (unlocked after Create) ──────── */}
          {created && (
            <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Pay Token issuer */}
              <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-bold">Issue a Pay Token</h3>
                  <span className="text-[10px] font-mono text-[#1a0f00]/40 uppercase tracking-widest">Step 2 of 3</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <Field label="Budget" hint="USD">
                    <div className="flex items-center bg-[#fafaf7] border border-[#1a0f00]/12 rounded-lg">
                      <span className="pl-2.5 text-[#1a0f00]/40 text-[12px]">$</span>
                      <input
                        type="number" step="0.50" min="0"
                        value={ptBudget}
                        onChange={(e) => setPtBudget(e.target.value)}
                        className="w-full px-1.5 py-1.5 bg-transparent text-[12px] focus:outline-none"
                      />
                    </div>
                  </Field>
                  <Field label="Expires in" hint="hours">
                    <input
                      type="number" step="1" min="1"
                      value={ptExpires}
                      onChange={(e) => setPtExpires(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#fafaf7] border border-[#1a0f00]/12 rounded-lg text-[12px] focus:outline-none focus:border-[#1a0f00]/50"
                    />
                  </Field>
                  <Field label="Max calls">
                    <input
                      type="number" step="10" min="1"
                      value={ptMaxCalls}
                      onChange={(e) => setPtMaxCalls(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-[#fafaf7] border border-[#1a0f00]/12 rounded-lg text-[12px] focus:outline-none focus:border-[#1a0f00]/50"
                    />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => setPayTokenIssued(true)}
                  className="mt-4 w-full py-2 bg-[#1a0f00] text-[#fffd43] font-bold text-[12px] rounded-lg hover:bg-[#1a0f00]/90 transition-colors"
                >
                  {payTokenIssued ? "Pay Token active ✓" : "Generate token"}
                </button>

                {payTokenIssued && (
                  <div className="mt-3 rounded-lg bg-[#fafaf7] border border-[#1a0f00]/8 p-3">
                    <p className="text-[10px] uppercase tracking-widest text-[#1a0f00]/45 mb-1">Pay Token</p>
                    <code className="block font-mono text-[11px] text-[#1a0f00] break-all">
                      pt_{apiSlug.replace(/-/g, "")}_demo{ptMaxCalls}
                    </code>
                    <p className="mt-1.5 text-[10.5px] text-[#1a0f00]/50">
                      Budget {fmtUsd(ptBudNum)} · expires in {ptExpires}h · max {ptMaxCalls} calls
                    </p>
                  </div>
                )}
              </div>

              {/* Send test request */}
              <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-bold">Send test request</h3>
                  <span className="text-[10px] font-mono text-[#1a0f00]/40 uppercase tracking-widest">Step 3 of 3</span>
                </div>

                <div className="rounded-lg bg-[#1a0f00] text-[#fafaf7] p-3 text-[11px] font-mono leading-relaxed mb-3">
                  curl -X POST {gatewayUrl} \<br />
                  &nbsp;&nbsp;-H &quot;Authorization: Bearer &lt;pay_token&gt;&quot;
                </div>

                <button
                  type="button"
                  onClick={() => setTestSent(true)}
                  disabled={!payTokenIssued}
                  className="w-full py-2 bg-[#1a0f00] text-[#fffd43] font-bold text-[12px] rounded-lg hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {testSent ? "Request sent ✓" : payTokenIssued ? "Send request" : "Issue a Pay Token first"}
                </button>

                {testSent && (
                  <div className="mt-3 rounded-lg bg-[#16A34A]/8 border border-[#16A34A]/30 p-3">
                    <p className="text-[12px] font-bold text-[#16A34A] mb-1.5">Paid API call successful</p>
                    <dl className="font-mono text-[11px] space-y-0.5">
                      <Row k="API fee"           v={fmtUsd(priceNum)}      tone="onLight" />
                      <Row k="LemonCake fee 3%"  v={`-${fmtUsd(callFee)}`} tone="onLight" muted />
                      <Row k="You receive"       v={fmtUsd(callNet)}       tone="onLight" highlight />
                      <div className="h-px bg-[#1a0f00]/8 my-1" />
                      <Row k="Remaining budget"  v={fmtUsd(ptRemain)}      tone="onLight" muted />
                    </dl>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Compact info cards ────────────────────────── */}
          <section className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Gateway preview */}
            <div className="rounded-xl bg-white border border-[#1a0f00]/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-2">Gateway</p>
              <code className="block font-mono text-[11px] text-[#1a0f00] break-all">{gatewayUrl}</code>
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(gatewayUrl); }}
                className="mt-3 text-[11px] font-semibold text-[#1a0f00]/70 hover:text-[#1a0f00] transition-colors"
              >
                Copy →
              </button>
            </div>

            {/* cURL */}
            <div className="rounded-xl bg-white border border-[#1a0f00]/10 p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-2">Test request</p>
              <code className="block font-mono text-[10.5px] text-[#1a0f00]/85 leading-relaxed">
                curl -X POST <span className="text-[#1a0f00]/55">\</span><br />
                &nbsp;&nbsp;{gatewayUrl} <span className="text-[#1a0f00]/55">\</span><br />
                &nbsp;&nbsp;-H &quot;Authorization: Bearer ...&quot;
              </code>
            </div>

            {/* Pricing */}
            <div className="rounded-xl bg-[#1a0f00] text-[#fafaf7] p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#fafaf7]/45 mb-2">Pricing</p>
              <ul className="space-y-1 text-[12px]">
                <li className="flex items-center gap-2"><span className="text-[#fffd43]">●</span> $0/month</li>
                <li className="flex items-center gap-2"><span className="text-[#fffd43]">●</span> 3% monetization fee</li>
                <li className="flex items-center gap-2"><span className="text-[#fffd43]">●</span> 3,000 calls free</li>
                <li className="flex items-center gap-2"><span className="text-[#fffd43]">●</span> No fixed transaction fee</li>
              </ul>
              <Link href="/pricing" className="mt-3 inline-block text-[11px] font-semibold text-[#fffd43] hover:underline">
                See full pricing →
              </Link>
            </div>
          </section>

          {/* Honest footer */}
          <p className="mt-10 text-center text-[11px] text-[#1a0f00]/40">
            The safe monetization layer for AI APIs · Private Beta · Open core
          </p>
        </main>
      </div>
    </div>
  );
}

/* ───── small helpers ───── */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-[#1a0f00]/70">{label}</span>
        {hint && <span className="text-[10px] font-mono text-[#1a0f00]/35">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Row({
  k, v, muted, highlight, tone = "onDark",
}: {
  k: string; v: string; muted?: boolean; highlight?: boolean; tone?: "onDark" | "onLight";
}) {
  const onDark = tone === "onDark";
  const baseK = onDark
    ? (muted ? "text-[#fafaf7]/40" : "text-[#fafaf7]/70")
    : (muted ? "text-[#1a0f00]/45" : "text-[#1a0f00]/70");
  const baseV = onDark
    ? (highlight ? "text-[#fffd43] font-bold" : "text-[#fafaf7]")
    : (highlight ? "text-[#16A34A] font-bold" : "text-[#1a0f00]");
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-[10.5px] ${baseK}`}>{k}</dt>
      <dd className={`text-[11px] ${baseV}`}>{v}</dd>
    </div>
  );
}

function DetailRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#1a0f00]/6 pb-2 last:border-0">
      <dt className="text-[11px] text-[#1a0f00]/55">{k}</dt>
      <dd className="text-[12.5px] text-[#1a0f00] font-medium text-right">{v}</dd>
    </div>
  );
}
