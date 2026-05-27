"use client";

/**
 * /app — Post-login seller workspace, redesigned to match the mockup.
 *
 * Goal: the moment a seller lands here, they're entering an API URL + a price.
 * Wallet / USDC / permit never appear in primary surfaces. The single metric
 * being optimized is Time to First Paid API Call.
 *
 * Layout (Stripe / Vercel / Supabase-style):
 *   ┌───── header ───────────────────────────────────────────────────┐
 *   │ Sidebar       │ Heading + yellow tip pill                       │
 *   │ - Setup       │ ┌─ Form ──────────────┐  ┌─ Live preview ────┐  │
 *   │ - Monitor     │ │ name / URL / price  │  │ Orig / Gateway    │  │
 *   │ - Manage      │ │ rate / budget       │  │ Revenue estimate  │  │
 *   │ Launch Plan   │ │ [Create endpoint]   │  │ Receive (green)   │  │
 *   │ card          │ └─────────────────────┘  └───────────────────┘  │
 *   │               │ 3-step horizontal flow                          │
 *   │               │ yellow tip pill │ Watch 2-min demo              │
 *   └───────────────────────────────────────────────────────────────-─┘
 *
 * After "Create Gateway Endpoint" is clicked, a success state + Test Console
 * (Pay Token issuer + simulated paid request with full fee breakdown) appear
 * below — the form stays intact at the top so the seller can iterate.
 *
 * Yellow surface area is intentionally minimal: primary CTA, active sidebar
 * row, "Private Beta" badge, tip pills, and pricing-card markers.
 */

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode, SVGProps } from "react";

/* ──────────────────────────── icons ──────────────────────────── */

const Icon = {
  Plus:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>),
  Code:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg>),
  Key:     (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="7.5" cy="14.5" r="3.5" /><path d="M10 12 21 1M18 4l3 3M15 7l3 3" /></svg>),
  Play:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 4v16l14-8z" /></svg>),
  Chart:   (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 20V8M10 20V4M16 20v-8M22 20H2" /></svg>),
  Dollar:  (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5c0-1-1-2-2.5-2s-2.5 1-2.5 2 1 1.7 2.5 2 2.5 1 2.5 2-1 2-2.5 2-2.5-1-2.5-2M12 6v2M12 16v2" /></svg>),
  Shield:  (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6z" /></svg>),
  Gear:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.5 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.2l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.5-2-1.5c0-.4.1-.8.1-1.2z" /></svg>),
  Bank:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 10 12 4l9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 21h18" /></svg>),
  Copy:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>),
  External:(p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 4h6v6M10 14 20 4M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></svg>),
  ChevDn:  (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6" /></svg>),
  Lock:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>),
  Bolt:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>),
  Lemon:   (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 3c4.5 0 9 4.5 9 9s-4.5 9-9 9-9-4.5-9-9 4.5-9 9-9zm0 2c-3.4 0-7 3.6-7 7s3.6 7 7 7 7-3.6 7-7-3.6-7-7-7z" /></svg>),
};

/* ──────────────────────────── sidebar config ──────────────────────────── */

type NavItem = { label: string; icon: keyof typeof Icon; href: string; active?: boolean };
type NavGroup = { heading: string; items: NavItem[] };

// Every sidebar row points to an existing page. Usage / Settings / Settlement
// are intentionally omitted until they're real — surfacing dead navigation
// hurts trust more than a shorter menu does.
const SIDEBAR: NavGroup[] = [
  {
    heading: "Setup",
    items: [
      { label: "Add API",      icon: "Plus", href: "/app",                        active: true },
      { label: "Gateway",      icon: "Code", href: "/docs/migrate-from-coinbase" },
      { label: "Pay Token",    icon: "Key",  href: "/docs/pay-token" },
      { label: "Test Request", icon: "Play", href: "/docs/quickstart" },
    ],
  },
  {
    heading: "Monitor",
    items: [
      { label: "Revenue",          icon: "Dollar", href: "/pricing" },
      { label: "Blocked Requests", icon: "Shield", href: "/about/en" },
    ],
  },
];

/* ──────────────────────────── utils ──────────────────────────── */

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}
function fmtUsd(n: number): string {
  if (!isFinite(n)) return "$0.00";
  if (n < 0.01 && n > 0) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

/* ──────────────────────────── page ──────────────────────────── */

export default function AppDashboard() {
  // Form
  const [apiName,      setApiName]      = useState("AI Search API");
  const [apiUrl,       setApiUrl]       = useState("https://api.example.com/search");
  const [pricePerCall, setPricePerCall] = useState("0.01");
  const [tokenBudget,  setTokenBudget]  = useState("5.00");
  const [rateLimit,    setRateLimit]    = useState("60");

  // Revenue-estimate dropdown
  const [estCalls, setEstCalls] = useState<1000 | 10000 | 100000>(1000);

  // Flow state
  const [created,        setCreated]        = useState(false);
  const [payTokenIssued, setPayTokenIssued] = useState(false);
  const [testSent,       setTestSent]       = useState(false);

  // Pay Token form
  const [ptBudget,   setPtBudget]   = useState("5");
  const [ptExpires,  setPtExpires]  = useState("1");
  const [ptMaxCalls, setPtMaxCalls] = useState("100");

  // Derived
  const apiSlug    = useMemo(() => slugify(apiName) || "your-api", [apiName]);
  const gatewayUrl = `https://gateway.lemoncake.xyz/${apiSlug}`;
  const priceNum   = Math.max(0, parseFloat(pricePerCall) || 0);
  const estRevenue = priceNum * estCalls;
  const estFee     = estRevenue * 0.03;
  const estNet     = estRevenue - estFee;

  // Per-call breakdown for test console
  const callFee  = priceNum * 0.03;
  const callNet  = priceNum - callFee;
  const ptBudNum = Math.max(0, parseFloat(ptBudget) || 0);
  const ptRemain = Math.max(0, ptBudNum - priceNum);

  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">

      {/* ─────────── header ─────────── */}
      <header className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/about/en" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-md object-cover" />
              <span className="text-[14px] font-bold tracking-tight">LemonCake</span>
            </Link>
            <span className="px-2.5 py-1 bg-[#1a0f00]/6 text-[#1a0f00]/65 rounded-full text-[9.5px] font-bold uppercase tracking-widest">
              Private Beta
            </span>
          </div>
          <div className="flex items-center gap-5 text-[13px]">
            <Link href="/docs" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/docs/pay-token" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors inline-flex items-center gap-1">
              <Icon.External className="w-3.5 h-3.5" />
              API Reference
            </Link>
            <button
              type="button"
              className="ml-1 inline-flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full bg-white border border-[#1a0f00]/10 hover:bg-[#1a0f00]/[0.03] transition-colors"
              aria-label="Account menu"
            >
              <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-[#1a0f00] text-white text-[10px] font-black">LC</span>
              <Icon.ChevDn className="w-3.5 h-3.5 text-[#1a0f00]/55" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[228px_1fr] gap-8">

        {/* ─────────── sidebar ─────────── */}
        <aside className="md:sticky md:top-20 self-start space-y-5">
          {SIDEBAR.map((group) => {
            return (
              <div key={group.heading}>
                <p className="text-[10px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-2 px-1">
                  {group.heading}
                </p>
                <ul className="space-y-0.5">
                  {group.items.map((item) => {
                    const Ico = Icon[item.icon];
                    return (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                            item.active
                              ? "bg-[#fffd43] text-[#1a0f00] font-semibold"
                              : "text-[#1a0f00]/65 hover:bg-[#1a0f00]/4 hover:text-[#1a0f00]"
                          }`}
                        >
                          <Ico className="w-4 h-4 flex-shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}

          {/* Launch Plan card */}
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-4">
            <p className="text-[12.5px] font-bold mb-2">Launch Plan</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-[28px] font-black leading-none tracking-tight">$0</span>
              <span className="text-[11px] text-[#1a0f00]/55">/ month</span>
            </div>
            <ul className="space-y-1.5 text-[11.5px] mb-3">
              {[
                "3,000 API calls free",
                "3% only when you earn",
                "No fixed transaction fee",
              ].map((line) => (
                <li key={line} className="flex items-start gap-1.5">
                  <span className="text-[#16A34A] font-bold leading-tight">✓</span>
                  <span className="text-[#1a0f00]/75">{line}</span>
                </li>
              ))}
            </ul>
            <Link href="/pricing" className="text-[11px] font-semibold text-[#1a0f00] hover:underline inline-flex items-center gap-1">
              View details
              <span aria-hidden>→</span>
            </Link>
          </div>
        </aside>

        {/* ─────────── main column ─────────── */}
        <main className="min-w-0">

          {/* Heading + yellow tip pill */}
          <div className="mb-6">
            <h1 className="text-[30px] md:text-[36px] font-black leading-[1.1] tracking-tight">
              Create your first paid API
            </h1>
            <p className="mt-2 text-[14px] text-[#1a0f00]/60 leading-relaxed max-w-[640px]">
              Enter your existing API URL, set a price, and get a paid LemonCake Gateway endpoint.
            </p>

            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#1a0f00]/12">
              <Icon.Lemon className="w-4 h-4 text-[#1a0f00]/55" />
              <span className="text-[12px] font-medium text-[#1a0f00]/80">No monthly fee. 3% only when your API earns.</span>
            </div>
          </div>

          {/* Form + Live Preview */}
          <section className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">

            {/* LEFT: form */}
            <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
              <div className="space-y-5">
                <Field label="API name">
                  <input
                    type="text"
                    value={apiName}
                    onChange={(e) => setApiName(e.target.value)}
                    placeholder="AI Search API"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] focus:outline-none focus:border-[#1a0f00]/55 transition-colors"
                  />
                </Field>

                <Field label="Original API URL" hintBelow="We&apos;ll connect to this endpoint on your behalf.">
                  <input
                    type="url"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.example.com/search"
                    className="w-full px-3.5 py-2.5 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] font-mono focus:outline-none focus:border-[#1a0f00]/55 transition-colors"
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Price per call">
                    <div className="flex items-center bg-white border border-[#1a0f00]/15 rounded-xl focus-within:border-[#1a0f00]/55 transition-colors">
                      <span className="pl-3.5 text-[#1a0f00]/40 text-[13.5px]">$</span>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={pricePerCall}
                        onChange={(e) => setPricePerCall(e.target.value)}
                        className="w-full px-2 py-2.5 bg-transparent text-[13.5px] focus:outline-none"
                      />
                    </div>
                  </Field>

                  <Field label="Token budget limit" hintBelow="Max amount each Pay Token can spend">
                    <div className="flex items-center bg-white border border-[#1a0f00]/15 rounded-xl focus-within:border-[#1a0f00]/55 transition-colors">
                      <span className="pl-3.5 text-[#1a0f00]/40 text-[13.5px]">$</span>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={tokenBudget}
                        onChange={(e) => setTokenBudget(e.target.value)}
                        className="w-full px-2 py-2.5 bg-transparent text-[13.5px] focus:outline-none"
                      />
                    </div>
                  </Field>
                </div>

                <Field label="Rate limit" hintBelow="Max requests allowed per minute per token">
                  <div className="grid grid-cols-[1fr_160px] gap-2">
                    <input
                      type="number"
                      step="10"
                      min="1"
                      value={rateLimit}
                      onChange={(e) => setRateLimit(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] focus:outline-none focus:border-[#1a0f00]/55 transition-colors"
                    />
                    <div className="relative">
                      <select
                        disabled
                        className="w-full appearance-none px-3.5 py-2.5 pr-9 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] text-[#1a0f00]/85 focus:outline-none focus:border-[#1a0f00]/55"
                      >
                        <option>requests / min</option>
                      </select>
                      <Icon.ChevDn className="w-4 h-4 text-[#1a0f00]/45 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </Field>
              </div>

              <button
                type="button"
                onClick={() => setCreated(true)}
                disabled={!apiUrl.startsWith("http") || priceNum <= 0}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 py-3 bg-[#fffd43] hover:bg-[#fff070] text-[#1a0f00] font-bold text-[14px] rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_1px_0_rgba(26,15,0,0.15)]"
              >
                <Icon.Bolt className="w-4 h-4" />
                {created ? "Gateway endpoint created" : "Create Gateway Endpoint"}
              </button>
            </div>

            {/* RIGHT: live preview */}
            <aside className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">Live preview</p>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-[#16A34A]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                  Ready to go
                </span>
              </div>

              <div className="space-y-4">
                <UrlBox label="Original API"     url={apiUrl} />
                <UrlBox label="LemonCake Gateway" url={gatewayUrl} tint />

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11.5px] font-semibold text-[#1a0f00]/75">Revenue estimate</p>
                    <div className="relative">
                      <select
                        value={estCalls}
                        onChange={(e) => setEstCalls(Number(e.target.value) as 1000 | 10000 | 100000)}
                        className="appearance-none pl-3 pr-7 py-1 bg-white border border-[#1a0f00]/15 rounded-lg text-[11px] focus:outline-none focus:border-[#1a0f00]/55"
                      >
                        <option value={1000}>1,000 calls / month</option>
                        <option value={10000}>10,000 calls / month</option>
                        <option value={100000}>100,000 calls / month</option>
                      </select>
                      <Icon.ChevDn className="w-3 h-3 text-[#1a0f00]/45 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-3.5 space-y-1.5">
                    <RevRow k="Est. revenue"        v={fmtUsd(estRevenue)} />
                    <RevRow k="LemonCake fee (3%)"  v={`-${fmtUsd(estFee)}`} muted />
                    <div className="h-px bg-[#1a0f00]/8 my-1.5" />
                    <RevRow k="You receive"         v={fmtUsd(estNet)} highlight />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[10.5px] text-[#1a0f00]/55">
                  <Icon.Lock className="w-3 h-3" />
                  <span>Only successful, paid requests are charged.</span>
                </div>
              </div>
            </aside>
          </section>

          {/* 3-step horizontal flow */}
          <section className="mt-6 rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 sm:gap-2">
              <FlowStep n={1} active title="Add your API"      desc="Enter your existing AI API URL"      icon={<MiniBrowser />} />
              <FlowArrow />
              <FlowStep n={2}         title="Set price & limits" desc="Configure pricing and protection"  icon={<MiniList />} />
              <FlowArrow />
              <FlowStep n={3}         title="Get paid endpoint"  desc="Use the gateway URL to start earning" icon={<MiniCode />} />
            </div>
          </section>

          {/* Bottom: tip pill + watch demo */}
          <section className="mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#1a0f00]/12">
              <span className="text-[14px]">💡</span>
              <span className="text-[12px] text-[#1a0f00]/85"><span className="font-semibold text-[#1a0f00]">Tip:</span> After creating your API, generate a Pay Token and try a test request.</span>
            </div>
            <Link
              href="/docs/quickstart"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-[#1a0f00]/15 rounded-xl text-[12px] font-semibold text-[#1a0f00] hover:bg-[#1a0f00]/[0.03] transition-colors self-start sm:self-auto"
            >
              <Icon.Play className="w-3.5 h-3.5" />
              Watch 2-min demo
            </Link>
          </section>

          {/* SUCCESS STATE (after Create) */}
          {created && (
            <section className="mt-8 rounded-2xl bg-white border border-[#16A34A]/40 p-6">
              <div className="flex items-start gap-3 mb-4">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-[#16A34A] text-white text-[14px] font-black">✓</span>
                <div>
                  <h3 className="text-[16px] font-bold flex items-center gap-2">
                    Your paid API is live
                    <span className="text-[9.5px] font-mono px-1.5 py-0.5 bg-[#1a0f00]/8 text-[#1a0f00]/70 rounded uppercase tracking-widest">Preview</span>
                  </h3>
                  <p className="text-[12px] text-[#1a0f00]/55 mt-0.5 max-w-[640px]">
                    This is what your dashboard will look like once your seller key arrives. The configuration is locked into your{" "}
                    <Link href="/start/free" className="underline">/start/free</Link> submission.
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <DetailRow k="Gateway URL"      v={<code className="font-mono text-[11.5px]">{gatewayUrl}</code>} />
                <DetailRow k="Price per call"   v={fmtUsd(priceNum)} />
                <DetailRow k="Rate limit"       v={`${rateLimit} req/min`} />
                <DetailRow k="Spend limit"      v={`${fmtUsd(parseFloat(tokenBudget) || 0)} per Pay Token`} />
                <DetailRow k="Pay Token"        v={<span className="text-[#16A34A] font-semibold">Required ✓</span>} />
                <DetailRow k="Abuse protection" v={<span className="text-[#16A34A] font-semibold">Rate + spend cap ✓</span>} />
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPayTokenIssued(true)}
                  className="px-4 py-2 bg-[#1a0f00] hover:bg-[#1a0f00]/90 text-white font-bold text-[12.5px] rounded-lg transition-colors"
                >
                  {payTokenIssued ? "Pay Token issued ✓" : "Generate Pay Token"}
                </button>
                <button
                  type="button"
                  onClick={() => { navigator.clipboard?.writeText(gatewayUrl); }}
                  className="px-4 py-2 bg-white border border-[#1a0f00]/15 font-semibold text-[12.5px] rounded-lg hover:bg-[#1a0f00]/[0.03] transition-colors inline-flex items-center gap-1.5"
                >
                  <Icon.Copy className="w-3.5 h-3.5" />
                  Copy Gateway URL
                </button>
                <Link
                  href="/start/free"
                  className="px-4 py-2 text-[12.5px] text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors"
                >
                  Submit for provisioning →
                </Link>
              </div>
            </section>
          )}

          {/* TEST CONSOLE (after Create) */}
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
                    <div className="flex items-center bg-white border border-[#1a0f00]/15 rounded-lg">
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
                      className="w-full px-2.5 py-1.5 bg-white border border-[#1a0f00]/15 rounded-lg text-[12px] focus:outline-none focus:border-[#1a0f00]/50"
                    />
                  </Field>
                  <Field label="Max calls">
                    <input
                      type="number" step="10" min="1"
                      value={ptMaxCalls}
                      onChange={(e) => setPtMaxCalls(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-[#1a0f00]/15 rounded-lg text-[12px] focus:outline-none focus:border-[#1a0f00]/50"
                    />
                  </Field>
                </div>

                <button
                  type="button"
                  onClick={() => setPayTokenIssued(true)}
                  className="mt-4 w-full py-2 bg-[#1a0f00] text-white font-bold text-[12px] rounded-lg hover:bg-[#1a0f00]/90 transition-colors"
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
                  className="w-full py-2 bg-[#1a0f00] text-white font-bold text-[12px] rounded-lg hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {testSent ? "Request sent ✓" : payTokenIssued ? "Send request" : "Issue a Pay Token first"}
                </button>

                {testSent && (
                  <div className="mt-3 rounded-lg bg-[#16A34A]/8 border border-[#16A34A]/30 p-3">
                    <p className="text-[12px] font-bold text-[#16A34A] mb-1.5">Paid API call successful</p>
                    <dl className="font-mono text-[11px] space-y-0.5">
                      <RevRow k="API fee"          v={fmtUsd(priceNum)} />
                      <RevRow k="LemonCake fee 3%" v={`-${fmtUsd(callFee)}`} muted />
                      <RevRow k="You receive"      v={fmtUsd(callNet)} highlight />
                      <div className="h-px bg-[#1a0f00]/8 my-1" />
                      <RevRow k="Remaining budget" v={fmtUsd(ptRemain)} muted />
                    </dl>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Honest footer */}
          <p className="mt-12 text-center text-[11px] text-[#1a0f00]/40">
            The safe monetization layer for AI APIs · Private Beta · Open core ·{" "}
            <Link href="/start/free" className="underline hover:text-[#1a0f00]/65">Self-serve goes live Q3 2026</Link>
          </p>
        </main>
      </div>
    </div>
  );
}

/* ──────────────────────────── small components ──────────────────────────── */

function Field({ label, hint, hintBelow, children }: {
  label: string; hint?: string; hintBelow?: string; children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12px] font-semibold text-[#1a0f00]/80">{label}</span>
        {hint && <span className="text-[10px] font-mono text-[#1a0f00]/35">{hint}</span>}
      </div>
      {children}
      {hintBelow && (
        <p className="mt-1.5 text-[11px] text-[#1a0f00]/45 leading-relaxed">{hintBelow}</p>
      )}
    </label>
  );
}

function UrlBox({ label, url, tint }: { label: string; url: string; tint?: boolean }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold text-[#1a0f00]/75 mb-1.5">{label}</p>
      <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
        tint ? "bg-[#fffd43]/12 border-[#1a0f00]/12" : "bg-[#fafaf7] border-[#1a0f00]/12"
      }`}>
        <code className="font-mono text-[11.5px] text-[#1a0f00] break-all truncate">{url || "—"}</code>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(url); }}
          className="flex-shrink-0 p-1 rounded hover:bg-[#1a0f00]/8 transition-colors text-[#1a0f00]/55"
          aria-label={`Copy ${label}`}
        >
          <Icon.Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function RevRow({ k, v, muted, highlight }: {
  k: string; v: string; muted?: boolean; highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-[12px] ${muted ? "text-[#1a0f00]/50" : "text-[#1a0f00]/75"}`}>{k}</dt>
      <dd className={`text-[13px] font-mono ${highlight ? "text-[#16A34A] font-bold" : muted ? "text-[#1a0f00]/65" : "text-[#1a0f00] font-semibold"}`}>{v}</dd>
    </div>
  );
}

function DetailRow({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-[#1a0f00]/6 pb-2 last:border-0">
      <dt className="text-[11.5px] text-[#1a0f00]/55">{k}</dt>
      <dd className="text-[12.5px] text-[#1a0f00] font-medium text-right">{v}</dd>
    </div>
  );
}

/* ─── 3-step flow ─── */

function FlowStep({ n, title, desc, icon, active }: {
  n: number; title: string; desc: string; icon: ReactNode; active?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-[12px] font-black ${
        active ? "bg-[#1a0f00] text-white" : "bg-[#1a0f00]/8 text-[#1a0f00]/60"
      }`}>
        {n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight">{title}</p>
        <p className="text-[11px] text-[#1a0f00]/55 leading-snug mt-0.5">{desc}</p>
      </div>
      <div className="flex-shrink-0">{icon}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="hidden sm:flex justify-center text-[#1a0f00]/25 text-[18px] leading-none px-1" aria-hidden>
      →
    </div>
  );
}

/* tiny illustration tiles */
function MiniBrowser() {
  return (
    <div className="w-10 h-10 rounded-lg bg-[#fafaf7] border border-[#1a0f00]/10 flex flex-col p-1 gap-0.5">
      <div className="flex gap-0.5">
        <span className="w-1 h-1 rounded-full bg-[#1a0f00]/25" />
        <span className="w-1 h-1 rounded-full bg-[#1a0f00]/25" />
        <span className="w-1 h-1 rounded-full bg-[#1a0f00]/25" />
      </div>
      <div className="flex-1 rounded-sm bg-[#1a0f00]/8" />
    </div>
  );
}
function MiniList() {
  return (
    <div className="w-10 h-10 rounded-lg bg-[#fafaf7] border border-[#1a0f00]/10 flex flex-col justify-center gap-1 p-1.5">
      <div className="h-0.5 w-full rounded bg-[#1a0f00]/25" />
      <div className="h-0.5 w-3/4 rounded bg-[#1a0f00]/15" />
      <div className="h-0.5 w-1/2 rounded bg-[#1a0f00]/10" />
    </div>
  );
}
function MiniCode() {
  return (
    <div className="w-10 h-10 rounded-lg bg-[#fafaf7] border border-[#1a0f00]/10 flex items-center justify-center">
      <Icon.Code className="w-4 h-4 text-[#1a0f00]/65" />
    </div>
  );
}
