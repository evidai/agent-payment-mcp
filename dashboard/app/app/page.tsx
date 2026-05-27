"use client";

/**
 * /app — Post-login seller workspace (functional Private-Beta shell).
 *
 * This is a real client-side dashboard, not a brochure. The sidebar's
 * Setup/Monitor rows switch the main pane (they don't navigate away).
 * Resources rows are the only external links — those genuinely point to
 * docs.
 *
 * State is persisted in localStorage under the `lc:*` keys:
 *   lc:endpoints   — APIs the seller has created
 *   lc:payTokens   — Pay Tokens they've issued
 *   lc:testRuns    — Simulated paid requests (success log)
 *   lc:blocked     — Simulated blocked attempts (rate / spend cap)
 *
 * Nothing here calls a backend yet — there isn't one for self-serve. But
 * everything you do persists across page reloads, the numbers update, and
 * Test Console actually decrements a Pay Token's budget. When the real
 * gateway lands (Q3 2026) this UI swaps the localStorage layer for an
 * authenticated API client without changing the rest.
 */

import Link from "next/link";
import { useEffect, useState, type ReactNode, type SVGProps } from "react";

/* ────────────────────────────  icons  ──────────────────────────── */

const Icon = {
  Plus:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>),
  Code:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg>),
  Key:     (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="7.5" cy="14.5" r="3.5" /><path d="M10 12 21 1M18 4l3 3M15 7l3 3" /></svg>),
  Play:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 4v16l14-8z" /></svg>),
  Dollar:  (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9" /><path d="M14.5 9.5c0-1-1-2-2.5-2s-2.5 1-2.5 2 1 1.7 2.5 2 2.5 1 2.5 2-1 2-2.5 2-2.5-1-2.5-2M12 6v2M12 16v2" /></svg>),
  Shield:  (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6z" /></svg>),
  Copy:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>),
  External:(p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M14 4h6v6M10 14 20 4M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6" /></svg>),
  ChevDn:  (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="m6 9 6 6 6-6" /></svg>),
  Lock:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>),
  Bolt:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>),
  Lemon:   (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 3c4.5 0 9 4.5 9 9s-4.5 9-9 9-9-4.5-9-9 4.5-9 9-9zm0 2c-3.4 0-7 3.6-7 7s3.6 7 7 7 7-3.6 7-7-3.6-7-7-7z" /></svg>),
  Trash:   (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6" /></svg>),
  Pause:   (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M9 4v16M15 4v16" /></svg>),
  Refresh: (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" /></svg>),
};

/* ────────────────────────────  types  ──────────────────────────── */

type Pane = "add" | "apis" | "paytoken" | "test" | "revenue" | "blocked";

type Endpoint = {
  id: string;
  name: string;
  slug: string;
  originalUrl: string;
  gatewayUrl: string;
  pricePerCall: number;
  tokenBudget: number;     // default per-Pay-Token spend cap
  rateLimit: number;       // req/min
  createdAt: number;
  status: "live" | "paused";
};

type PayToken = {
  id: string;              // pt_xxx
  endpointId: string;
  budget: number;          // USD
  expiresAt: number;       // ms
  maxCalls: number;
  callsUsed: number;
  spent: number;
  issuedAt: number;
  status: "active" | "expired" | "exhausted" | "revoked";
};

type TestRun = {
  id: string;
  endpointId: string;
  payTokenId: string;
  at: number;
  fee: number;             // 3% to LemonCake
  net: number;             // to seller
  gross: number;           // price/call
};

type BlockReason = "rate_limit_exceeded" | "spend_cap_exceeded" | "token_expired" | "token_revoked";

type BlockedReq = {
  id: string;
  endpointId: string;
  payTokenId?: string;
  reason: BlockReason;
  attempted: number;       // would-be charge
  at: number;
};

/* ────────────────────────────  sidebar config  ──────────────────────────── */

type PaneItem  = { kind: "pane"; label: string; icon: keyof typeof Icon; pane: Pane };
type LinkItem  = { kind: "link"; label: string; icon: keyof typeof Icon; href: string };
type NavItem   = PaneItem | LinkItem;
type NavGroup  = { heading: string; items: NavItem[] };

// Every sidebar row switches the active pane in-page — no external links.
// Docs / API Reference live in the top-right header (where users expect them).
const SIDEBAR: NavGroup[] = [
  {
    heading: "Setup",
    items: [
      { kind: "pane", label: "Add API",      icon: "Plus", pane: "add" },
      { kind: "pane", label: "Gateway",      icon: "Code", pane: "apis" },
      { kind: "pane", label: "Pay Token",    icon: "Key",  pane: "paytoken" },
      { kind: "pane", label: "Test Request", icon: "Play", pane: "test" },
    ],
  },
  {
    heading: "Monitor",
    items: [
      { kind: "pane", label: "Revenue",          icon: "Dollar", pane: "revenue" },
      { kind: "pane", label: "Blocked Requests", icon: "Shield", pane: "blocked" },
    ],
  },
];

/* ────────────────────────────  utils  ──────────────────────────── */

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}
function fmtUsd(n: number): string {
  if (!isFinite(n)) return "$0.00";
  if (n === 0) return "$0.00";
  if (n < 0.01 && n > 0) return `$${n.toFixed(4)}`;
  if (n < 0 && n > -0.01) return `-$${(-n).toFixed(4)}`;
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}
function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
function timeAgo(t: number): string {
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function gatewayUrlOf(slug: string): string {
  return `https://gateway.lemoncake.xyz/${slug}`;
}

function useLocalState<T>(key: string, initial: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(key) : null;
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {}
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value, hydrated]);
  return [value, setValue];
}

/* ────────────────────────────  main  ──────────────────────────── */

export default function AppDashboard() {
  const [activePane, setActivePane] = useState<Pane>("add");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [endpoints, setEndpoints] = useLocalState<Endpoint[]>("lc:endpoints", []);
  const [payTokens, setPayTokens] = useLocalState<PayToken[]>("lc:payTokens", []);
  const [testRuns,  setTestRuns]  = useLocalState<TestRun[]>("lc:testRuns",  []);
  const [blocked,   setBlocked]   = useLocalState<BlockedReq[]>("lc:blocked", []);

  // Quick stats for header / sidebar badges
  const liveCount     = endpoints.filter(e => e.status === "live").length;
  const activeTokens  = payTokens.filter(t => t.status === "active").length;
  const totalRevenue  = testRuns.reduce((a, r) => a + r.gross, 0);

  const counts: Record<Pane, number | null> = {
    add:      null,
    apis:     endpoints.length,
    paytoken: activeTokens,
    test:     testRuns.length,
    revenue:  null,
    blocked:  blocked.length,
  };

  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">

      {/* ──────── header ──────── */}
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
            <div className="relative ml-1">
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full bg-white border border-[#1a0f00]/10 hover:bg-[#1a0f00]/[0.03] transition-colors"
                aria-label="Local workspace menu"
                aria-expanded={menuOpen}
              >
                <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-[#1a0f00] text-white text-[10px] font-black">LC</span>
                <Icon.ChevDn className={`w-3.5 h-3.5 text-[#1a0f00]/55 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <>
                  {/* click-outside backdrop */}
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="fixed inset-0 z-30 cursor-default"
                    aria-hidden
                    tabIndex={-1}
                  />
                  {/* popover */}
                  <div className="absolute top-full right-0 mt-2 w-[280px] rounded-xl bg-white border border-[#1a0f00]/12 shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-4 z-40">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-1">Local workspace</p>
                    <p className="text-[12.5px] font-bold mb-3 leading-tight">Private Beta · no account yet</p>

                    <dl className="text-[11.5px] space-y-1.5 mb-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#1a0f00]/65">Endpoints</dt>
                        <dd className="font-mono font-semibold">{endpoints.length}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#1a0f00]/65">Active Pay Tokens</dt>
                        <dd className="font-mono font-semibold">{activeTokens}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-[#1a0f00]/65">Paid calls</dt>
                        <dd className="font-mono font-semibold">{testRuns.length}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 pt-1.5 border-t border-[#1a0f00]/6">
                        <dt className="text-[#1a0f00]/65">Earned (net)</dt>
                        <dd className="font-mono font-bold text-[#16A34A]">{fmtUsd(totalRevenue * 0.97)}</dd>
                      </div>
                    </dl>

                    <button
                      type="button"
                      onClick={() => {
                        if (!confirm("Clear all workspace data (endpoints, Pay Tokens, paid calls, blocked log)? This can't be undone.")) return;
                        setEndpoints([]);
                        setPayTokens([]);
                        setTestRuns([]);
                        setBlocked([]);
                        setActivePane("add");
                        setMenuOpen(false);
                      }}
                      disabled={endpoints.length === 0 && payTokens.length === 0 && testRuns.length === 0 && blocked.length === 0}
                      className="w-full py-2 text-[11.5px] font-semibold text-[#DC2626] bg-[#DC2626]/8 hover:bg-[#DC2626]/12 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#DC2626]/8"
                    >
                      Reset workspace
                    </button>

                    <div className="my-3 h-px bg-[#1a0f00]/8" />

                    <p className="text-[11px] text-[#1a0f00]/55 leading-relaxed mb-2">
                      Real accounts with saved settings + cloud sync arrive Q3 2026.
                    </p>
                    <Link
                      href="/start/free"
                      onClick={() => setMenuOpen(false)}
                      className="block text-center py-2 text-[11.5px] font-semibold text-white bg-[#1a0f00] hover:bg-[#1a0f00]/90 rounded-lg transition-colors"
                    >
                      Request design-partner access →
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[228px_1fr] gap-8">

        {/* ──────── sidebar ──────── */}
        <aside className="md:sticky md:top-20 self-start space-y-5">
          {SIDEBAR.map((group) => (
            <div key={group.heading}>
              <p className="text-[10px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-2 px-1">
                {group.heading}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Ico = Icon[item.icon];
                  const isPane = item.kind === "pane";
                  const isActive = isPane && item.pane === activePane;
                  const badgeCount = isPane ? counts[item.pane] : null;

                  const cls = `w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                    isActive
                      ? "bg-[#fffd43] text-[#1a0f00] font-semibold"
                      : "text-[#1a0f00]/65 hover:bg-[#1a0f00]/4 hover:text-[#1a0f00]"
                  }`;

                  const inner = (
                    <>
                      <Ico className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {isPane && badgeCount !== null && badgeCount > 0 && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isActive ? "bg-[#1a0f00]/15 text-[#1a0f00]" : "bg-[#1a0f00]/8 text-[#1a0f00]/60"
                        }`}>
                          {badgeCount}
                        </span>
                      )}
                      {!isPane && (
                        <Icon.External className="w-3 h-3 text-[#1a0f00]/35" />
                      )}
                    </>
                  );

                  return (
                    <li key={item.label}>
                      {isPane ? (
                        <button type="button" onClick={() => setActivePane(item.pane)} className={cls}>{inner}</button>
                      ) : (
                        <Link href={item.href} className={cls}>{inner}</Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Launch Plan card — kept on every pane as the persistent pricing reminder */}
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-4">
            <p className="text-[12.5px] font-bold mb-2">Launch Plan</p>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-[28px] font-black leading-none tracking-tight">$0</span>
              <span className="text-[11px] text-[#1a0f00]/55">/ month</span>
            </div>
            <ul className="space-y-1.5 text-[11.5px] mb-3">
              {["3,000 API calls free", "3% only when you earn", "No fixed transaction fee"].map((line) => (
                <li key={line} className="flex items-start gap-1.5">
                  <span className="text-[#16A34A] font-bold leading-tight">✓</span>
                  <span className="text-[#1a0f00]/75">{line}</span>
                </li>
              ))}
            </ul>
            <Link href="/pricing" className="text-[11px] font-semibold text-[#1a0f00] hover:underline inline-flex items-center gap-1">
              View details <span aria-hidden>→</span>
            </Link>
          </div>

          {/* You earned (visible after first test run) */}
          {mounted && totalRevenue > 0 && (
            <div className="rounded-2xl bg-[#1a0f00] text-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/55 mb-1.5">You&apos;ve earned</p>
              <p className="text-[24px] font-black tracking-tight">{fmtUsd(totalRevenue * 0.97)}</p>
              <p className="text-[10.5px] text-white/55 mt-1">
                from {testRuns.length} paid {testRuns.length === 1 ? "call" : "calls"} across {liveCount} {liveCount === 1 ? "API" : "APIs"}
              </p>
            </div>
          )}
        </aside>

        {/* ──────── main pane ──────── */}
        <main className="min-w-0">
          {!mounted ? (
            <div className="text-[12px] text-[#1a0f00]/40 py-12 text-center">Loading workspace…</div>
          ) : (
            <>
              {activePane === "add"      && <AddPane endpoints={endpoints} setEndpoints={setEndpoints} goTo={setActivePane} />}
              {activePane === "apis"     && <ApisPane endpoints={endpoints} setEndpoints={setEndpoints} payTokens={payTokens} setPayTokens={setPayTokens} testRuns={testRuns} setTestRuns={setTestRuns} blocked={blocked} setBlocked={setBlocked} goTo={setActivePane} />}
              {activePane === "paytoken" && <PayTokenPane endpoints={endpoints} payTokens={payTokens} setPayTokens={setPayTokens} goTo={setActivePane} />}
              {activePane === "test"     && <TestPane endpoints={endpoints} payTokens={payTokens} setPayTokens={setPayTokens} testRuns={testRuns} setTestRuns={setTestRuns} blocked={blocked} setBlocked={setBlocked} goTo={setActivePane} />}
              {activePane === "revenue"  && <RevenuePane endpoints={endpoints} testRuns={testRuns} />}
              {activePane === "blocked"  && <BlockedPane blocked={blocked} endpoints={endpoints} setBlocked={setBlocked} />}
            </>
          )}

          <p className="mt-12 text-center text-[11px] text-[#1a0f00]/40">
            The safe monetization layer for AI APIs · Private Beta · Open core · Data stays in your browser until production gateway launches Q3 2026
          </p>
        </main>
      </div>
    </div>
  );
}

/* ────────────────────────────  Add API pane  ──────────────────────────── */

function AddPane({
  endpoints, setEndpoints, goTo,
}: {
  endpoints: Endpoint[];
  setEndpoints: (n: Endpoint[] | ((p: Endpoint[]) => Endpoint[])) => void;
  goTo: (p: Pane) => void;
}) {
  const [apiName,      setApiName]      = useState("");
  const [apiUrl,       setApiUrl]       = useState("");
  const [pricePerCall, setPricePerCall] = useState("0.01");
  const [tokenBudget,  setTokenBudget]  = useState("5.00");
  const [rateLimit,    setRateLimit]    = useState("60");
  const [estCalls,     setEstCalls]     = useState<1000 | 10000 | 100000>(1000);
  const [err, setErr] = useState<string | null>(null);

  const slug       = slugify(apiName) || "your-api";
  const gatewayUrl = gatewayUrlOf(slug);
  const priceNum   = Math.max(0, parseFloat(pricePerCall) || 0);
  const budgetNum  = Math.max(0, parseFloat(tokenBudget) || 0);
  const rateNum    = Math.max(1, parseInt(rateLimit, 10) || 1);

  const estRevenue = priceNum * estCalls;
  const estFee     = estRevenue * 0.03;
  const estNet     = estRevenue - estFee;

  function create() {
    setErr(null);
    if (!apiName.trim())  return setErr("API name is required.");
    if (!/^https?:\/\//.test(apiUrl)) return setErr("API URL must start with http(s)://");
    if (priceNum <= 0)    return setErr("Price per call must be greater than 0.");
    if (endpoints.some(e => e.slug === slug)) return setErr(`Slug "${slug}" is already taken. Try a different name.`);

    const e: Endpoint = {
      id: uid("ep"),
      name: apiName.trim(),
      slug,
      originalUrl: apiUrl.trim(),
      gatewayUrl,
      pricePerCall: priceNum,
      tokenBudget: budgetNum,
      rateLimit: rateNum,
      createdAt: Date.now(),
      status: "live",
    };
    setEndpoints((prev) => [...prev, e]);
    goTo("apis");
  }

  return (
    <>
      <PaneHeading
        eyebrow={endpoints.length === 0 ? "Welcome" : "New endpoint"}
        title={endpoints.length === 0 ? "Create your first paid API" : "Create another paid endpoint"}
        subtitle="Enter your existing API URL, set a price, and get a paid LemonCake Gateway endpoint."
      />

      <div className="mb-6 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#1a0f00]/12">
        <Icon.Lemon className="w-4 h-4 text-[#1a0f00]/55" />
        <span className="text-[12px] font-medium text-[#1a0f00]/80">No monthly fee. 3% only when your API earns.</span>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">

        {/* form */}
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
          <div className="space-y-5">
            <Field label="API name">
              <input
                type="text" value={apiName} onChange={(e) => setApiName(e.target.value)}
                placeholder="AI Search API"
                className="w-full px-3.5 py-2.5 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] focus:outline-none focus:border-[#1a0f00]/55 transition-colors"
              />
            </Field>

            <Field label="Original API URL" hintBelow="We&apos;ll connect to this endpoint on your behalf.">
              <input
                type="url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://api.example.com/search"
                className="w-full px-3.5 py-2.5 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] font-mono focus:outline-none focus:border-[#1a0f00]/55 transition-colors"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Price per call">
                <DollarInput value={pricePerCall} onChange={setPricePerCall} step="0.001" />
              </Field>
              <Field label="Token budget limit" hintBelow="Max amount each Pay Token can spend">
                <DollarInput value={tokenBudget} onChange={setTokenBudget} step="0.50" />
              </Field>
            </div>

            <Field label="Rate limit" hintBelow="Max requests allowed per minute per token">
              <div className="grid grid-cols-[1fr_160px] gap-2">
                <input
                  type="number" step="10" min="1" value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] focus:outline-none focus:border-[#1a0f00]/55 transition-colors"
                />
                <div className="relative">
                  <select disabled className="w-full appearance-none px-3.5 py-2.5 pr-9 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] text-[#1a0f00]/85">
                    <option>requests / min</option>
                  </select>
                  <Icon.ChevDn className="w-4 h-4 text-[#1a0f00]/45 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </Field>
          </div>

          {err && (
            <p className="mt-4 text-[12px] text-[#DC2626] bg-[#DC2626]/8 border border-[#DC2626]/25 rounded-lg px-3 py-2">{err}</p>
          )}

          <button
            type="button"
            onClick={create}
            className="mt-6 w-full inline-flex items-center justify-center gap-2 py-3 bg-[#fffd43] hover:bg-[#fff070] text-[#1a0f00] font-bold text-[14px] rounded-xl transition-colors shadow-[0_1px_0_rgba(26,15,0,0.15)]"
          >
            <Icon.Bolt className="w-4 h-4" />
            Create Gateway Endpoint
          </button>
        </div>

        {/* live preview */}
        <aside className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 self-start">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">Live preview</p>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#16A34A]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
              Ready to go
            </span>
          </div>

          <div className="space-y-4">
            <UrlBox label="Original API"      url={apiUrl || "—"} />
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
                <RevRow k="Est. revenue"       v={fmtUsd(estRevenue)} />
                <RevRow k="LemonCake fee (3%)" v={`-${fmtUsd(estFee)}`} muted />
                <div className="h-px bg-[#1a0f00]/8 my-1.5" />
                <RevRow k="You receive"        v={fmtUsd(estNet)} highlight />
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[10.5px] text-[#1a0f00]/55">
              <Icon.Lock className="w-3 h-3" />
              <span>Only successful, paid requests are charged.</span>
            </div>
          </div>
        </aside>
      </section>

      {endpoints.length === 0 ? (
        <section className="mt-6 rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-4 sm:gap-2">
            <FlowStep n={1} active title="Add your API"      desc="Enter your existing AI API URL" />
            <FlowArrow />
            <FlowStep n={2}        title="Set price & limits" desc="Configure pricing and protection" />
            <FlowArrow />
            <FlowStep n={3}        title="Get paid endpoint"  desc="Use the gateway URL to start earning" />
          </div>
        </section>
      ) : (
        <section className="mt-6 rounded-2xl bg-white border border-[#1a0f00]/10 p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold">You already have {endpoints.length} {endpoints.length === 1 ? "endpoint" : "endpoints"}.</p>
            <p className="text-[11.5px] text-[#1a0f00]/55 mt-0.5">Switch to the Gateway pane to view, pause, or issue a Pay Token for any of them.</p>
          </div>
          <button type="button" onClick={() => goTo("apis")} className="px-4 py-2 bg-[#1a0f00] text-white font-semibold text-[12.5px] rounded-lg hover:bg-[#1a0f00]/90 transition-colors">
            View Gateway →
          </button>
        </section>
      )}
    </>
  );
}

/* ────────────────────────────  APIs (Gateway) pane  ──────────────────────────── */

function ApisPane({
  endpoints, setEndpoints, payTokens, setPayTokens, testRuns, setTestRuns, blocked, setBlocked, goTo,
}: {
  endpoints: Endpoint[];
  setEndpoints: (n: Endpoint[] | ((p: Endpoint[]) => Endpoint[])) => void;
  payTokens: PayToken[];
  setPayTokens: (n: PayToken[] | ((p: PayToken[]) => PayToken[])) => void;
  testRuns: TestRun[];
  setTestRuns: (n: TestRun[] | ((p: TestRun[]) => TestRun[])) => void;
  blocked: BlockedReq[];
  setBlocked: (n: BlockedReq[] | ((p: BlockedReq[]) => BlockedReq[])) => void;
  goTo: (p: Pane) => void;
}) {
  function togglePause(id: string) {
    setEndpoints((prev) => prev.map((e) => e.id === id ? { ...e, status: e.status === "live" ? "paused" : "live" } : e));
  }
  function remove(id: string) {
    if (!confirm("Delete this endpoint and all its Pay Tokens? Test history is kept for revenue accuracy.")) return;
    setEndpoints((prev) => prev.filter((e) => e.id !== id));
    setPayTokens((prev) => prev.filter((t) => t.endpointId !== id));
    setBlocked((prev) => prev.filter((b) => b.endpointId !== id));
  }

  if (endpoints.length === 0) {
    return (
      <>
        <PaneHeading eyebrow="Gateway" title="No endpoints yet" subtitle="When you create a paid API, its gateway URL and config land here." />
        <EmptyState
          actionLabel="Add your first API"
          onAction={() => goTo("add")}
          hint="Setup takes about 60 seconds."
        />
      </>
    );
  }

  return (
    <>
      <PaneHeading
        eyebrow="Gateway"
        title="Your endpoints"
        subtitle={`${endpoints.length} ${endpoints.length === 1 ? "endpoint" : "endpoints"} configured. ${endpoints.filter(e => e.status === "live").length} live.`}
        action={<button type="button" onClick={() => goTo("add")} className="px-3 py-1.5 bg-[#1a0f00] text-white text-[12px] font-semibold rounded-lg hover:bg-[#1a0f00]/90">+ Add API</button>}
      />

      <div className="space-y-3">
        {endpoints.map((e) => {
          const tokensForThis = payTokens.filter(t => t.endpointId === e.id && t.status === "active").length;
          const callsForThis  = testRuns.filter(r => r.endpointId === e.id).length;
          const earned        = testRuns.filter(r => r.endpointId === e.id).reduce((a, r) => a + r.net, 0);

          return (
            <div key={e.id} className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-[15px] font-bold">{e.name}</h3>
                    <StatusPill status={e.status} />
                  </div>
                  <code className="block font-mono text-[11.5px] text-[#1a0f00]/75 break-all">{e.gatewayUrl}</code>
                  <p className="font-mono text-[10.5px] text-[#1a0f00]/40 mt-0.5">→ {e.originalUrl}</p>
                </div>

                <div className="flex items-center gap-1">
                  <IconButton title="Copy gateway URL" onClick={() => navigator.clipboard?.writeText(e.gatewayUrl)}>
                    <Icon.Copy className="w-3.5 h-3.5" />
                  </IconButton>
                  <IconButton title={e.status === "live" ? "Pause" : "Resume"} onClick={() => togglePause(e.id)}>
                    {e.status === "live" ? <Icon.Pause className="w-3.5 h-3.5" /> : <Icon.Refresh className="w-3.5 h-3.5" />}
                  </IconButton>
                  <IconButton title="Delete" tone="danger" onClick={() => remove(e.id)}>
                    <Icon.Trash className="w-3.5 h-3.5" />
                  </IconButton>
                </div>
              </div>

              <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Price"        v={fmtUsd(e.pricePerCall)} suf="/ call" />
                <Stat label="Rate limit"   v={String(e.rateLimit)} suf="req/min" />
                <Stat label="Spend cap"    v={fmtUsd(e.tokenBudget)} suf="/ token" />
                <Stat label="Created"      v={timeAgo(e.createdAt)} />
              </dl>

              <div className="mt-4 pt-4 border-t border-[#1a0f00]/6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-[#1a0f00]/65">
                <span><span className="font-semibold text-[#1a0f00]">{tokensForThis}</span> active Pay {tokensForThis === 1 ? "Token" : "Tokens"}</span>
                <span><span className="font-semibold text-[#1a0f00]">{callsForThis}</span> paid {callsForThis === 1 ? "call" : "calls"}</span>
                <span><span className="font-semibold text-[#16A34A]">{fmtUsd(earned)}</span> earned</span>
                <div className="flex-1" />
                <button type="button" onClick={() => goTo("paytoken")} className="text-[11.5px] font-semibold text-[#1a0f00] hover:underline">Issue Pay Token →</button>
                <button type="button" onClick={() => goTo("test")} className="text-[11.5px] font-semibold text-[#1a0f00] hover:underline">Test request →</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ────────────────────────────  Pay Token pane  ──────────────────────────── */

function PayTokenPane({
  endpoints, payTokens, setPayTokens, goTo,
}: {
  endpoints: Endpoint[];
  payTokens: PayToken[];
  setPayTokens: (n: PayToken[] | ((p: PayToken[]) => PayToken[])) => void;
  goTo: (p: Pane) => void;
}) {
  const [endpointId, setEndpointId] = useState<string>(endpoints[0]?.id ?? "");
  const [budget,     setBudget]     = useState("5");
  const [expires,    setExpires]    = useState("24");
  const [maxCalls,   setMaxCalls]   = useState("100");
  const [err,        setErr]        = useState<string | null>(null);

  // ensure selected endpoint exists
  useEffect(() => {
    if (endpoints.length > 0 && !endpoints.find(e => e.id === endpointId)) {
      setEndpointId(endpoints[0].id);
    }
  }, [endpoints, endpointId]);

  function issue() {
    setErr(null);
    const ep = endpoints.find(e => e.id === endpointId);
    if (!ep) return setErr("Pick an endpoint.");
    const b = Math.max(0, parseFloat(budget) || 0);
    const h = Math.max(1, parseInt(expires, 10) || 1);
    const m = Math.max(1, parseInt(maxCalls, 10) || 1);
    if (b <= 0) return setErr("Budget must be greater than 0.");
    if (b > ep.tokenBudget * 5) return setErr(`Budget can't exceed 5× the endpoint's spend cap (${fmtUsd(ep.tokenBudget * 5)}).`);

    const t: PayToken = {
      id: uid("pt"),
      endpointId,
      budget: b,
      expiresAt: Date.now() + h * 3600 * 1000,
      maxCalls: m,
      callsUsed: 0,
      spent: 0,
      issuedAt: Date.now(),
      status: "active",
    };
    setPayTokens((prev) => [t, ...prev]);
  }

  function revoke(id: string) {
    setPayTokens((prev) => prev.map(t => t.id === id ? { ...t, status: "revoked" } : t));
  }

  if (endpoints.length === 0) {
    return (
      <>
        <PaneHeading eyebrow="Pay Token" title="Create an endpoint first" subtitle="Pay Tokens are scoped to a specific gateway endpoint." />
        <EmptyState actionLabel="Add your first API" onAction={() => goTo("add")} />
      </>
    );
  }

  // recompute status for stale tokens
  const refreshed = payTokens.map(t => {
    if (t.status !== "active") return t;
    if (Date.now() > t.expiresAt) return { ...t, status: "expired" as const };
    if (t.callsUsed >= t.maxCalls) return { ...t, status: "exhausted" as const };
    return t;
  });

  return (
    <>
      <PaneHeading
        eyebrow="Pay Token"
        title="Issue & manage Pay Tokens"
        subtitle="Each token is a spend-capped, expirable bearer ticket your buyer (or their agent) attaches to paid requests."
      />

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
          <h3 className="text-[14px] font-bold mb-4">Issue a new Pay Token</h3>

          <div className="space-y-4">
            <Field label="Endpoint">
              <Select value={endpointId} onChange={setEndpointId}>
                {endpoints.map(e => <option key={e.id} value={e.id}>{e.name} · {e.slug}</option>)}
              </Select>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Budget" hint="USD">
                <DollarInput value={budget} onChange={setBudget} step="0.50" />
              </Field>
              <Field label="Expires in" hint="hours">
                <input type="number" step="1" min="1" value={expires} onChange={(e) => setExpires(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#1a0f00]/15 rounded-lg text-[13px] focus:outline-none focus:border-[#1a0f00]/55" />
              </Field>
              <Field label="Max calls">
                <input type="number" step="10" min="1" value={maxCalls} onChange={(e) => setMaxCalls(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#1a0f00]/15 rounded-lg text-[13px] focus:outline-none focus:border-[#1a0f00]/55" />
              </Field>
            </div>
          </div>

          {err && <p className="mt-4 text-[12px] text-[#DC2626] bg-[#DC2626]/8 border border-[#DC2626]/25 rounded-lg px-3 py-2">{err}</p>}

          <button type="button" onClick={issue} className="mt-5 w-full py-2.5 bg-[#1a0f00] text-white font-bold text-[13px] rounded-xl hover:bg-[#1a0f00]/90 transition-colors">
            Issue Pay Token
          </button>
        </div>

        <aside className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">How tokens are used</p>
          <ol className="text-[12px] text-[#1a0f00]/70 space-y-1.5 list-decimal pl-4">
            <li>Issue a token here, hand the <code className="font-mono text-[11px] bg-[#fafaf7] px-1 rounded">pt_…</code> string to your buyer / agent.</li>
            <li>They attach it via <code className="font-mono text-[11px] bg-[#fafaf7] px-1 rounded">Authorization: Bearer pt_…</code> on every paid request.</li>
            <li>LemonCake decrements budget + counts calls until either runs out or it expires.</li>
            <li>Either side can revoke instantly — the next request fails closed.</li>
          </ol>
        </aside>
      </section>

      <section className="mt-8">
        <h3 className="text-[13px] font-bold mb-3 text-[#1a0f00]/80">All Pay Tokens ({refreshed.length})</h3>
        {refreshed.length === 0 ? (
          <p className="text-[12px] text-[#1a0f00]/45 italic">No tokens issued yet.</p>
        ) : (
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr>
                  <th className="text-left  px-4 py-2.5 font-semibold">Token</th>
                  <th className="text-left  px-4 py-2.5 font-semibold">Endpoint</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Budget left</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Calls</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Expires</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-2"></th>
                </tr>
              </thead>
              <tbody>
                {refreshed.map((t) => {
                  const ep = endpoints.find(e => e.id === t.endpointId);
                  const left = Math.max(0, t.budget - t.spent);
                  return (
                    <tr key={t.id} className="border-b border-[#1a0f00]/6 last:border-0">
                      <td className="px-4 py-2.5"><code className="font-mono text-[11px]">{t.id}</code></td>
                      <td className="px-4 py-2.5 text-[#1a0f00]/75">{ep?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtUsd(left)} <span className="text-[#1a0f00]/40">/ {fmtUsd(t.budget)}</span></td>
                      <td className="px-4 py-2.5 text-right font-mono">{t.callsUsed} <span className="text-[#1a0f00]/40">/ {t.maxCalls}</span></td>
                      <td className="px-4 py-2.5 text-right text-[#1a0f00]/60">{t.status === "expired" ? "expired" : `in ${Math.max(0, Math.ceil((t.expiresAt - Date.now()) / 3600000))}h`}</td>
                      <td className="px-4 py-2.5 text-right"><TokenStatusPill status={t.status} /></td>
                      <td className="pr-3 text-right">
                        {t.status === "active" && (
                          <button type="button" onClick={() => revoke(t.id)} className="text-[11px] text-[#DC2626] hover:underline">Revoke</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ────────────────────────────  Test pane  ──────────────────────────── */

function TestPane({
  endpoints, payTokens, setPayTokens, testRuns, setTestRuns, blocked, setBlocked, goTo,
}: {
  endpoints: Endpoint[];
  payTokens: PayToken[];
  setPayTokens: (n: PayToken[] | ((p: PayToken[]) => PayToken[])) => void;
  testRuns: TestRun[];
  setTestRuns: (n: TestRun[] | ((p: TestRun[]) => TestRun[])) => void;
  blocked: BlockedReq[];
  setBlocked: (n: BlockedReq[] | ((p: BlockedReq[]) => BlockedReq[])) => void;
  goTo: (p: Pane) => void;
}) {
  const activeTokens = payTokens.filter(t => t.status === "active");
  const [tokenId, setTokenId] = useState<string>(activeTokens[0]?.id ?? "");
  const [lastResult, setLastResult] = useState<{ kind: "ok"; run: TestRun } | { kind: "blocked"; b: BlockedReq } | null>(null);

  useEffect(() => {
    if (activeTokens.length > 0 && !activeTokens.find(t => t.id === tokenId)) {
      setTokenId(activeTokens[0].id);
    }
  }, [activeTokens, tokenId]);

  if (endpoints.length === 0) {
    return (
      <>
        <PaneHeading eyebrow="Test Request" title="Create an endpoint first" subtitle="Run a simulated paid call once you have an endpoint to point at." />
        <EmptyState actionLabel="Add your first API" onAction={() => goTo("add")} />
      </>
    );
  }
  if (activeTokens.length === 0) {
    return (
      <>
        <PaneHeading eyebrow="Test Request" title="Issue a Pay Token first" subtitle="The test console signs requests with a real Pay Token, so the fee & budget math is accurate." />
        <EmptyState actionLabel="Go to Pay Token" onAction={() => goTo("paytoken")} />
      </>
    );
  }

  function send() {
    const t  = payTokens.find(p => p.id === tokenId);
    if (!t) return;
    const ep = endpoints.find(e => e.id === t.endpointId);
    if (!ep) return;

    // Validation — would-be charge
    const charge = ep.pricePerCall;

    // Expired?
    if (Date.now() > t.expiresAt || t.status !== "active") {
      const b: BlockedReq = { id: uid("bl"), endpointId: ep.id, payTokenId: t.id, reason: t.status === "revoked" ? "token_revoked" : "token_expired", attempted: charge, at: Date.now() };
      setBlocked((prev) => [b, ...prev]);
      setPayTokens((prev) => prev.map(x => x.id === t.id ? { ...x, status: Date.now() > t.expiresAt ? "expired" : x.status } : x));
      setLastResult({ kind: "blocked", b });
      return;
    }

    // Spend cap?
    if (t.spent + charge > t.budget) {
      const b: BlockedReq = { id: uid("bl"), endpointId: ep.id, payTokenId: t.id, reason: "spend_cap_exceeded", attempted: charge, at: Date.now() };
      setBlocked((prev) => [b, ...prev]);
      setLastResult({ kind: "blocked", b });
      return;
    }

    // Rate limit? Count test runs for this endpoint in the last minute.
    const recent = testRuns.filter(r => r.endpointId === ep.id && Date.now() - r.at < 60_000).length;
    if (recent >= ep.rateLimit) {
      const b: BlockedReq = { id: uid("bl"), endpointId: ep.id, payTokenId: t.id, reason: "rate_limit_exceeded", attempted: charge, at: Date.now() };
      setBlocked((prev) => [b, ...prev]);
      setLastResult({ kind: "blocked", b });
      return;
    }

    // OK — charge and record
    const fee = charge * 0.03;
    const net = charge - fee;
    const run: TestRun = {
      id: uid("run"),
      endpointId: ep.id,
      payTokenId: t.id,
      at: Date.now(),
      gross: charge,
      fee,
      net,
    };
    setTestRuns((prev) => [run, ...prev]);
    setPayTokens((prev) => prev.map(x => x.id === t.id ? {
      ...x,
      callsUsed: x.callsUsed + 1,
      spent: x.spent + charge,
      status: x.callsUsed + 1 >= x.maxCalls ? "exhausted" : x.status,
    } : x));
    setLastResult({ kind: "ok", run });
  }

  const token = payTokens.find(p => p.id === tokenId);
  const ep    = token ? endpoints.find(e => e.id === token.endpointId) : undefined;

  return (
    <>
      <PaneHeading eyebrow="Test Request" title="Send a paid request" subtitle="Simulates a real gateway call against your config. Fee math, spend cap, rate limit, and expiry all enforce locally so what you see is exactly what production will do." />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <Field label="Pay Token">
            <Select value={tokenId} onChange={setTokenId}>
              {activeTokens.map(t => {
                const e = endpoints.find(x => x.id === t.endpointId);
                return <option key={t.id} value={t.id}>{t.id} — {e?.name}</option>;
              })}
            </Select>
          </Field>

          {ep && token && (
            <div className="mt-4 rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-3 text-[11.5px] space-y-1">
              <RevRow k="Target endpoint"  v={ep.name} />
              <RevRow k="Per-call price"   v={fmtUsd(ep.pricePerCall)} />
              <RevRow k="Token budget"     v={`${fmtUsd(Math.max(0, token.budget - token.spent))} of ${fmtUsd(token.budget)} left`} />
              <RevRow k="Calls remaining"  v={`${token.maxCalls - token.callsUsed} of ${token.maxCalls}`} />
              <RevRow k="Rate limit"       v={`${ep.rateLimit} req/min`} />
            </div>
          )}

          {ep && (
            <div className="mt-4 rounded-lg bg-[#1a0f00] text-white p-3 text-[11px] font-mono leading-relaxed">
              curl -X POST {ep.gatewayUrl} \<br />
              &nbsp;&nbsp;-H &quot;Authorization: Bearer {tokenId}&quot;
            </div>
          )}

          <button type="button" onClick={send} className="mt-4 w-full py-2.5 bg-[#1a0f00] text-white font-bold text-[13px] rounded-xl hover:bg-[#1a0f00]/90 transition-colors">
            Send request
          </button>
        </div>

        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-3">Last result</p>

          {!lastResult && <p className="text-[12px] text-[#1a0f00]/45 italic">No request sent in this session yet.</p>}

          {lastResult?.kind === "ok" && (
            <div className="rounded-xl bg-[#16A34A]/8 border border-[#16A34A]/30 p-3">
              <p className="text-[12.5px] font-bold text-[#16A34A] mb-2">200 OK — Paid call successful</p>
              <dl className="font-mono text-[11.5px] space-y-1">
                <RevRow k="API fee"          v={fmtUsd(lastResult.run.gross)} />
                <RevRow k="LemonCake fee 3%" v={`-${fmtUsd(lastResult.run.fee)}`} muted />
                <RevRow k="You receive"      v={fmtUsd(lastResult.run.net)} highlight />
              </dl>
            </div>
          )}

          {lastResult?.kind === "blocked" && (
            <div className="rounded-xl bg-[#DC2626]/8 border border-[#DC2626]/30 p-3">
              <p className="text-[12.5px] font-bold text-[#DC2626] mb-1.5">402 / 429 — Blocked</p>
              <p className="text-[11.5px] text-[#1a0f00]/75 mb-2">{reasonLabel(lastResult.b.reason)}</p>
              <p className="text-[10.5px] text-[#1a0f00]/55">Logged in Blocked Requests. Pay Token charge of {fmtUsd(lastResult.b.attempted)} was prevented.</p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-[13px] font-bold mb-3 text-[#1a0f00]/80">Recent paid requests ({testRuns.length})</h3>
        {testRuns.length === 0 ? (
          <p className="text-[12px] text-[#1a0f00]/45 italic">No paid requests yet. Hit “Send request” above.</p>
        ) : (
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr>
                  <th className="text-left  px-4 py-2.5 font-semibold">When</th>
                  <th className="text-left  px-4 py-2.5 font-semibold">Endpoint</th>
                  <th className="text-left  px-4 py-2.5 font-semibold">Pay Token</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Gross</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Fee 3%</th>
                  <th className="text-right px-4 py-2.5 font-semibold">You receive</th>
                </tr>
              </thead>
              <tbody>
                {testRuns.slice(0, 50).map((r) => {
                  const e = endpoints.find(x => x.id === r.endpointId);
                  return (
                    <tr key={r.id} className="border-b border-[#1a0f00]/6 last:border-0">
                      <td className="px-4 py-2.5 text-[#1a0f00]/55">{timeAgo(r.at)}</td>
                      <td className="px-4 py-2.5">{e?.name ?? "—"}</td>
                      <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-[#1a0f00]/65">{r.payTokenId}</code></td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtUsd(r.gross)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1a0f00]/55">-{fmtUsd(r.fee)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-[#16A34A]">{fmtUsd(r.net)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ────────────────────────────  Revenue pane  ──────────────────────────── */

function RevenuePane({ endpoints, testRuns }: { endpoints: Endpoint[]; testRuns: TestRun[] }) {
  const gross = testRuns.reduce((a, r) => a + r.gross, 0);
  const fee   = testRuns.reduce((a, r) => a + r.fee, 0);
  const net   = testRuns.reduce((a, r) => a + r.net, 0);

  // Last 14 days mini-chart
  const days = Array.from({ length: 14 }, (_, i) => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - (13 - i));
    const end = dayStart.getTime() + 86400000;
    const dayGross = testRuns.filter(r => r.at >= dayStart.getTime() && r.at < end).reduce((a, r) => a + r.gross, 0);
    return { label: dayStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }), gross: dayGross };
  });
  const maxGross = Math.max(0.0001, ...days.map(d => d.gross));

  return (
    <>
      <PaneHeading eyebrow="Revenue" title="What you've earned" subtitle="Numbers below are derived from your local test runs. When the production gateway lands, they'll come from real paid requests." />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <BigStat label="Gross"     v={fmtUsd(gross)} sub={`${testRuns.length} paid ${testRuns.length === 1 ? "call" : "calls"}`} />
        <BigStat label="LemonCake fee (3%)"  v={fmtUsd(fee)} sub="What we collect" muted />
        <BigStat label="You receive"   v={fmtUsd(net)} sub="Settles to your wallet (Q3 2026)" highlight />
      </section>

      <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-3">Last 14 days · gross</p>
        <div className="flex items-end gap-1 h-32">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-t-md ${d.gross > 0 ? "bg-[#1a0f00]" : "bg-[#1a0f00]/8"}`}
                style={{ height: `${Math.max(2, (d.gross / maxGross) * 100)}%` }}
                title={`${d.label}: ${fmtUsd(d.gross)}`}
              />
              <span className="text-[8.5px] text-[#1a0f00]/40 font-mono">{d.label.split(" ")[1]}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[13px] font-bold mb-3 text-[#1a0f00]/80">Per endpoint</h3>
        {endpoints.length === 0 ? (
          <p className="text-[12px] text-[#1a0f00]/45 italic">Add an endpoint to start tracking revenue.</p>
        ) : (
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr>
                  <th className="text-left px-4 py-2.5 font-semibold">Endpoint</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Calls</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Gross</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Fee</th>
                  <th className="text-right px-4 py-2.5 font-semibold">You receive</th>
                </tr>
              </thead>
              <tbody>
                {endpoints.map(e => {
                  const rows = testRuns.filter(r => r.endpointId === e.id);
                  const g = rows.reduce((a, r) => a + r.gross, 0);
                  const f = rows.reduce((a, r) => a + r.fee, 0);
                  const n = rows.reduce((a, r) => a + r.net, 0);
                  return (
                    <tr key={e.id} className="border-b border-[#1a0f00]/6 last:border-0">
                      <td className="px-4 py-2.5">{e.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{rows.length}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtUsd(g)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1a0f00]/55">-{fmtUsd(f)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-[#16A34A]">{fmtUsd(n)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ────────────────────────────  Blocked pane  ──────────────────────────── */

function BlockedPane({
  blocked, endpoints, setBlocked,
}: {
  blocked: BlockedReq[];
  endpoints: Endpoint[];
  setBlocked: (n: BlockedReq[] | ((p: BlockedReq[]) => BlockedReq[])) => void;
}) {
  const [filter, setFilter] = useState<BlockReason | "all">("all");
  const filtered = blocked.filter(b => filter === "all" || b.reason === filter);
  const saved = blocked.reduce((a, b) => a + b.attempted, 0);

  return (
    <>
      <PaneHeading eyebrow="Blocked Requests" title="What we kept off your meter" subtitle="Every block here is a request that would've charged your Pay Token (or a buyer agent's wallet). The block was free." />

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <BigStat label="Blocked"      v={String(blocked.length)} sub="lifetime" />
        <BigStat label="Charge prevented" v={fmtUsd(saved)} sub="would-be Pay Token spend" muted />
        <BigStat label="Reasons" v={String(new Set(blocked.map(b => b.reason)).size)} sub="distinct block types" />
      </section>

      {blocked.length === 0 ? (
        <p className="text-[12px] text-[#1a0f00]/45 italic">No blocks yet. Spam the Send-request button on the Test Request pane to see rate limits and spend caps kick in.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {(["all", "rate_limit_exceeded", "spend_cap_exceeded", "token_expired", "token_revoked"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${
                  filter === f ? "bg-[#1a0f00] text-white" : "bg-white border border-[#1a0f00]/12 text-[#1a0f00]/65 hover:text-[#1a0f00]"
                }`}
              >
                {f === "all" ? "All" : reasonLabel(f)}
              </button>
            ))}
            <div className="flex-1" />
            <button type="button" onClick={() => setBlocked([])} className="text-[11px] text-[#1a0f00]/55 hover:text-[#1a0f00]">Clear log</button>
          </div>

          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr>
                  <th className="text-left  px-4 py-2.5 font-semibold">When</th>
                  <th className="text-left  px-4 py-2.5 font-semibold">Endpoint</th>
                  <th className="text-left  px-4 py-2.5 font-semibold">Reason</th>
                  <th className="text-right px-4 py-2.5 font-semibold">Charge prevented</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((b) => {
                  const e = endpoints.find(x => x.id === b.endpointId);
                  return (
                    <tr key={b.id} className="border-b border-[#1a0f00]/6 last:border-0">
                      <td className="px-4 py-2.5 text-[#1a0f00]/55">{timeAgo(b.at)}</td>
                      <td className="px-4 py-2.5">{e?.name ?? "—"}</td>
                      <td className="px-4 py-2.5"><span className="font-mono text-[11px] text-[#DC2626]">{reasonLabel(b.reason)}</span></td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtUsd(b.attempted)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/* ────────────────────────────  shared subcomponents  ──────────────────────────── */

function PaneHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-1.5">{eyebrow}</p>
        <h1 className="text-[28px] md:text-[32px] font-black leading-[1.1] tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-[13.5px] text-[#1a0f00]/60 leading-relaxed max-w-[640px]">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 pt-2">{action}</div>}
    </div>
  );
}

function Field({ label, hint, hintBelow, children }: { label: string; hint?: string; hintBelow?: string; children: ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12px] font-semibold text-[#1a0f00]/80">{label}</span>
        {hint && <span className="text-[10px] font-mono text-[#1a0f00]/35">{hint}</span>}
      </div>
      {children}
      {hintBelow && <p className="mt-1.5 text-[11px] text-[#1a0f00]/45 leading-relaxed">{hintBelow}</p>}
    </label>
  );
}

function DollarInput({ value, onChange, step }: { value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <div className="flex items-center bg-white border border-[#1a0f00]/15 rounded-xl focus-within:border-[#1a0f00]/55 transition-colors">
      <span className="pl-3.5 text-[#1a0f00]/40 text-[13.5px]">$</span>
      <input type="number" step={step ?? "0.01"} min="0" value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-2 py-2.5 bg-transparent text-[13.5px] focus:outline-none" />
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none px-3.5 py-2.5 pr-9 bg-white border border-[#1a0f00]/15 rounded-xl text-[13px] focus:outline-none focus:border-[#1a0f00]/55">
        {children}
      </select>
      <Icon.ChevDn className="w-4 h-4 text-[#1a0f00]/45 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function UrlBox({ label, url, tint }: { label: string; url: string; tint?: boolean }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold text-[#1a0f00]/75 mb-1.5">{label}</p>
      <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${tint ? "bg-[#fffd43]/12 border-[#1a0f00]/12" : "bg-[#fafaf7] border-[#1a0f00]/12"}`}>
        <code className="font-mono text-[11.5px] text-[#1a0f00] break-all truncate">{url || "—"}</code>
        <button type="button" onClick={() => navigator.clipboard?.writeText(url)} className="flex-shrink-0 p-1 rounded hover:bg-[#1a0f00]/8 transition-colors text-[#1a0f00]/55" aria-label={`Copy ${label}`}>
          <Icon.Copy className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function RevRow({ k, v, muted, highlight }: { k: string; v: string; muted?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={`text-[12px] ${muted ? "text-[#1a0f00]/50" : "text-[#1a0f00]/75"}`}>{k}</dt>
      <dd className={`text-[13px] font-mono ${highlight ? "text-[#16A34A] font-bold" : muted ? "text-[#1a0f00]/65" : "text-[#1a0f00] font-semibold"}`}>{v}</dd>
    </div>
  );
}

function Stat({ label, v, suf }: { label: string; v: string; suf?: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-1">{label}</p>
      <p className="text-[13.5px] font-bold">{v} {suf && <span className="text-[#1a0f00]/45 font-normal text-[11px]">{suf}</span>}</p>
    </div>
  );
}

function BigStat({ label, v, sub, highlight, muted }: { label: string; v: string; sub?: string; highlight?: boolean; muted?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 border ${highlight ? "bg-[#16A34A]/8 border-[#16A34A]/30" : muted ? "bg-[#fafaf7] border-[#1a0f00]/8" : "bg-white border-[#1a0f00]/10"}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-1.5">{label}</p>
      <p className={`text-[26px] font-black tracking-tight ${highlight ? "text-[#16A34A]" : "text-[#1a0f00]"}`}>{v}</p>
      {sub && <p className="text-[11px] text-[#1a0f00]/55 mt-1">{sub}</p>}
    </div>
  );
}

function IconButton({ children, onClick, title, tone }: { children: ReactNode; onClick: () => void; title: string; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`p-1.5 rounded-md transition-colors ${tone === "danger" ? "text-[#1a0f00]/45 hover:text-[#DC2626] hover:bg-[#DC2626]/8" : "text-[#1a0f00]/55 hover:text-[#1a0f00] hover:bg-[#1a0f00]/6"}`}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: Endpoint["status"] }) {
  if (status === "live") {
    return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#16A34A] bg-[#16A34A]/10 px-1.5 py-0.5 rounded">
      <span className="w-1 h-1 rounded-full bg-[#16A34A]" /> Live
    </span>;
  }
  return <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/60 bg-[#1a0f00]/8 px-1.5 py-0.5 rounded">Paused</span>;
}

function TokenStatusPill({ status }: { status: PayToken["status"] }) {
  const map: Record<PayToken["status"], { label: string; cls: string }> = {
    active:    { label: "Active",    cls: "text-[#16A34A] bg-[#16A34A]/10" },
    expired:   { label: "Expired",   cls: "text-[#1a0f00]/55 bg-[#1a0f00]/6" },
    exhausted: { label: "Exhausted", cls: "text-[#1a0f00]/55 bg-[#1a0f00]/6" },
    revoked:   { label: "Revoked",   cls: "text-[#DC2626] bg-[#DC2626]/10" },
  };
  const m = map[status];
  return <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${m.cls}`}>{m.label}</span>;
}

function EmptyState({ actionLabel, onAction, hint }: { actionLabel: string; onAction: () => void; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white border border-dashed border-[#1a0f00]/15 p-10 text-center">
      <button type="button" onClick={onAction} className="px-5 py-2.5 bg-[#fffd43] hover:bg-[#fff070] text-[#1a0f00] font-bold text-[13px] rounded-xl shadow-[0_1px_0_rgba(26,15,0,0.15)] transition-colors inline-flex items-center gap-2">
        <Icon.Bolt className="w-4 h-4" />
        {actionLabel}
      </button>
      {hint && <p className="mt-3 text-[11.5px] text-[#1a0f00]/45">{hint}</p>}
    </div>
  );
}

function FlowStep({ n, title, desc, active }: { n: number; title: string; desc: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-[12px] font-black ${active ? "bg-[#1a0f00] text-white" : "bg-[#1a0f00]/8 text-[#1a0f00]/60"}`}>{n}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight">{title}</p>
        <p className="text-[11px] text-[#1a0f00]/55 leading-snug mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function FlowArrow() {
  return <div className="hidden sm:flex justify-center text-[#1a0f00]/25 text-[18px] leading-none px-1" aria-hidden>→</div>;
}

function reasonLabel(r: BlockReason): string {
  return ({
    rate_limit_exceeded: "Rate limit exceeded",
    spend_cap_exceeded:  "Spend cap exceeded",
    token_expired:       "Pay Token expired",
    token_revoked:       "Pay Token revoked",
  } as Record<BlockReason, string>)[r];
}

