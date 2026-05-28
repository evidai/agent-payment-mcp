"use client";

/**
 * /app — Post-login seller workspace.
 *
 * Talks to the real Supabase-backed APIs at /api/lc/* and the production
 * gateway at /g/[shortId]. localStorage is no longer the source of truth.
 *
 * Mode detection:
 *   GET /api/lc/health → { ready: boolean }
 *   - ready === false → SetupNotice (with link to dashboard/SETUP-BACKEND.md)
 *   - ready === true  → full RealDashboard
 *
 * Everything the user does (create endpoint, issue Pay Token, run test
 * request, etc.) hits the backend. Pay Tokens are issued as real signed
 * JWTs. "Send request" actually calls the real gateway /g/[shortId],
 * which proxies to the configured upstream and decrements the token's
 * budget in Postgres.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode, type SVGProps } from "react";

/* ────────────────────────────  types  ──────────────────────────── */

type Pane = "add" | "apis" | "paytoken" | "test" | "revenue" | "blocked";

type Endpoint = {
  id: string;
  shortId: string;
  name: string;
  slug: string;
  originalUrl: string;
  upstreamAuth?: string | null;
  pricePerCall: number;
  tokenBudget: number;
  rateLimit: number;
  status: "live" | "paused";
  createdAt: number;
};

type PayToken = {
  id: string;
  endpointId: string;
  budget: number;
  spent: number;
  maxCalls: number;
  callsUsed: number;
  expiresAt: number;
  status: "active" | "expired" | "exhausted" | "revoked";
  issuedAt: number;
  /** Returned only on issue() — the signed JWT the buyer hands to the gateway. */
  jwt?: string;
};

type TestRun = {
  id: string;
  endpointId: string;
  payTokenId: string;
  gross: number;
  fee: number;
  net: number;
  upstreamStatus: number | null;
  upstreamMs: number | null;
  at: number;
};

type BlockReason = "rate_limit_exceeded" | "spend_cap_exceeded" | "token_expired" | "token_revoked" | "endpoint_paused" | "upstream_error";

type BlockedReq = {
  id: string;
  endpointId: string;
  payTokenId: string | null;
  reason: BlockReason;
  attempted: number;
  at: number;
};

/* ────────────────────────────  serializers  ──────────────────────────── */

type EndpointRow = { id: string; short_id: string; name: string; slug: string; original_url: string; upstream_auth: string | null; price_per_call: number | string; token_budget: number | string; rate_limit: number; status: "live" | "paused"; created_at: string };
type PayTokenRow = { id: string; endpoint_id: string; budget: number | string; spent: number | string; max_calls: number; calls_used: number; expires_at: string; status: PayToken["status"]; issued_at: string };
type TestRunRow  = { id: string; endpoint_id: string; pay_token_id: string; gross: number | string; fee: number | string; net: number | string; upstream_status: number | null; upstream_ms: number | null; at: string };
type BlockedRow  = { id: string; endpoint_id: string; pay_token_id: string | null; reason: BlockReason; attempted: number | string; at: string };

const fromEndpoint = (r: EndpointRow): Endpoint => ({
  id: r.id, shortId: r.short_id, name: r.name, slug: r.slug,
  originalUrl: r.original_url, upstreamAuth: r.upstream_auth ?? undefined,
  pricePerCall: Number(r.price_per_call), tokenBudget: Number(r.token_budget),
  rateLimit: r.rate_limit, status: r.status,
  createdAt: new Date(r.created_at).getTime(),
});
const fromToken = (r: PayTokenRow): PayToken => ({
  id: r.id, endpointId: r.endpoint_id,
  budget: Number(r.budget), spent: Number(r.spent),
  maxCalls: r.max_calls, callsUsed: r.calls_used,
  expiresAt: new Date(r.expires_at).getTime(),
  status: r.status, issuedAt: new Date(r.issued_at).getTime(),
});
const fromRun = (r: TestRunRow): TestRun => ({
  id: r.id, endpointId: r.endpoint_id, payTokenId: r.pay_token_id,
  gross: Number(r.gross), fee: Number(r.fee), net: Number(r.net),
  upstreamStatus: r.upstream_status, upstreamMs: r.upstream_ms,
  at: new Date(r.at).getTime(),
});
const fromBlocked = (r: BlockedRow): BlockedReq => ({
  id: r.id, endpointId: r.endpoint_id, payTokenId: r.pay_token_id,
  reason: r.reason, attempted: Number(r.attempted),
  at: new Date(r.at).getTime(),
});

/* ────────────────────────────  utils  ──────────────────────────── */

function fmtUsd(n: number): string {
  if (!isFinite(n)) return "$0.00";
  if (n === 0) return "$0.00";
  if (n > 0 && n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 0 && n > -0.01) return `-$${(-n).toFixed(4)}`;
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
}
function timeAgo(t: number): string {
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function maskAuth(h: string): string {
  return h.replace(/([A-Za-z0-9_\-.]{12,})/g, (m) => `${m.slice(0, 4)}…${m.slice(-4)}`);
}
function gatewayUrlOf(shortId: string): string {
  if (typeof window !== "undefined") return `${window.location.origin}/g/${shortId}`;
  return `https://www.lemoncake.xyz/g/${shortId}`;
}
function slugifyName(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

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

/* ────────────────────────────  sidebar  ──────────────────────────── */

type NavItem = { label: string; icon: keyof typeof Icon; pane: Pane };
const SIDEBAR: { heading: string; items: NavItem[] }[] = [
  { heading: "Setup", items: [
    { label: "Add API",      icon: "Plus", pane: "add" },
    { label: "Gateway",      icon: "Code", pane: "apis" },
    { label: "Pay Tokens",   icon: "Key",  pane: "paytoken" },
    { label: "Test Request", icon: "Play", pane: "test" },
  ]},
  { heading: "Monitor", items: [
    { label: "Usage Ledger",     icon: "Dollar", pane: "revenue" },
    { label: "Blocked Requests", icon: "Shield", pane: "blocked" },
  ]},
];

/* ────────────────────────────  page  ──────────────────────────── */

export default function Page() {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/lc/health")
      .then((r) => r.json())
      .then((d) => setReady(!!d.ready))
      .catch(() => setReady(false));
  }, []);

  if (ready === null) return <Shell><LoadingShell /></Shell>;
  if (ready === false) return <Shell><SetupNotice /></Shell>;
  return <RealDashboard />;
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">
      <header className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/about/en" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-md object-cover" />
            <span className="text-[14px] font-bold tracking-tight">LemonCake</span>
            <span className="ml-2 px-2.5 py-1 bg-[#1a0f00]/6 text-[#1a0f00]/65 rounded-full text-[9.5px] font-bold uppercase tracking-widest">Private Beta</span>
          </Link>
          <div className="flex items-center gap-5 text-[13px]">
            <Link href="/docs" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/docs/pay-token" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors inline-flex items-center gap-1">
              <Icon.External className="w-3.5 h-3.5" /> API Reference
            </Link>
          </div>
        </div>
      </header>
      <div className="max-w-[1400px] mx-auto px-6 py-8">{children}</div>
    </div>
  );
}

function LoadingShell() {
  return <p className="text-[12px] text-[#1a0f00]/40 py-16 text-center">Loading workspace…</p>;
}

function SetupNotice() {
  return (
    <div className="max-w-[640px] mx-auto py-12">
      <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-2">Backend not configured</p>
      <h1 className="text-[28px] font-black leading-tight mb-3">Set up the database to unlock the real gateway</h1>
      <p className="text-[14px] text-[#1a0f00]/70 leading-relaxed mb-5">
        /app needs Supabase + a JWT secret before it can persist endpoints, issue real Pay Tokens, and proxy traffic through <code className="font-mono text-[12px] bg-[#1a0f00]/6 px-1 rounded">/g/&lt;shortId&gt;</code>. Until then, every API call returns <code className="font-mono text-[12px] bg-[#1a0f00]/6 px-1 rounded">503 backend_not_configured</code>.
      </p>
      <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
        <p className="text-[12px] font-bold mb-2">10-minute setup</p>
        <ol className="text-[12.5px] text-[#1a0f00]/75 space-y-1.5 list-decimal pl-5 mb-4">
          <li>Create a Supabase project at <a href="https://supabase.com" target="_blank" rel="noopener" className="underline">supabase.com</a></li>
          <li>Open <code className="font-mono text-[11.5px] bg-[#1a0f00]/6 px-1 rounded">dashboard/db/schema.sql</code> and run it in the SQL editor</li>
          <li>Copy the project URL and <em>service_role</em> key from Project Settings → API</li>
          <li>Set Vercel env vars: <code className="font-mono text-[11.5px] bg-[#1a0f00]/6 px-1 rounded">SUPABASE_URL</code>, <code className="font-mono text-[11.5px] bg-[#1a0f00]/6 px-1 rounded">SUPABASE_SERVICE_KEY</code>, <code className="font-mono text-[11.5px] bg-[#1a0f00]/6 px-1 rounded">LC_JWT_SECRET</code></li>
          <li>Redeploy</li>
        </ol>
        <p className="text-[11.5px] text-[#1a0f00]/55">Full instructions: <code className="font-mono">dashboard/SETUP-BACKEND.md</code></p>
      </div>
    </div>
  );
}

/* ────────────────────────────  real dashboard  ──────────────────────────── */

function RealDashboard() {
  const [activePane, setActivePane] = useState<Pane>("add");
  const [menuOpen, setMenuOpen] = useState(false);
  const [preselectEndpointId, setPreselectEndpointId] = useState<string | null>(null);

  // Data
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [tokens,    setTokens]    = useState<PayToken[]>([]);
  const [runs,      setRuns]      = useState<TestRun[]>([]);
  const [blocked,   setBlocked]   = useState<BlockedReq[]>([]);
  // Track JWTs only in memory (they're only returned on issue; the server
  // stores hashes-equivalents in DB but the buyer needs the full JWT).
  // JWTs are only returned once on issue. Persist to localStorage so a
  // page reload doesn't break the "Send request" loop. Server-side state
  // (token row + budget) lives in Postgres; the JWT itself is the bearer
  // ticket the buyer needs and we never get it back from the API again.
  const [jwtById, setJwtById] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lc:jwts");
      if (raw) setJwtById(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("lc:jwts", JSON.stringify(jwtById)); } catch {}
  }, [jwtById]);
  const [loaded,    setLoaded]    = useState(false);

  const refetchAll = useCallback(async () => {
    const [e, t, r, b] = await Promise.all([
      fetch("/api/lc/endpoints").then((x) => x.json()).catch(() => ({ endpoints: [] })),
      fetch("/api/lc/tokens").then((x) => x.json()).catch(() => ({ tokens: [] })),
      fetch("/api/lc/runs").then((x) => x.json()).catch(() => ({ runs: [] })),
      fetch("/api/lc/blocks").then((x) => x.json()).catch(() => ({ blocked: [] })),
    ]);
    setEndpoints((e.endpoints  as EndpointRow[] ?? []).map(fromEndpoint));
    setTokens(   (t.tokens     as PayTokenRow[] ?? []).map(fromToken));
    setRuns(     (r.runs       as TestRunRow[]  ?? []).map(fromRun));
    setBlocked(  (b.blocked    as BlockedRow[]  ?? []).map(fromBlocked));
    setLoaded(true);
  }, []);

  useEffect(() => { refetchAll(); }, [refetchAll]);

  function goTo(p: Pane, opts?: { endpointId?: string }) {
    setActivePane(p);
    setPreselectEndpointId(opts?.endpointId ?? null);
  }

  const activeTokens = tokens.filter((t) => t.status === "active");
  const totalRevenue = runs.reduce((a, r) => a + r.gross, 0);
  const counts: Record<Pane, number | null> = {
    add: null, apis: endpoints.length, paytoken: activeTokens.length,
    test: runs.length, revenue: null, blocked: blocked.length,
  };

  /* Mutations — all hit the API, then refetch */
  const api = {
    createEndpoint: async (input: { name: string; originalUrl: string; upstreamAuth?: string; pricePerCall: number; tokenBudget: number; rateLimit: number }) => {
      const r = await fetch("/api/lc/endpoints", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!r.ok) throw new Error((await r.json()).error || "create_failed");
      await refetchAll();
      return fromEndpoint((await r.json()).endpoint as EndpointRow); // already consumed; ignore
    },
    setStatus: async (id: string, status: "live" | "paused") => {
      await fetch(`/api/lc/endpoints/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      await refetchAll();
    },
    deleteEndpoint: async (id: string) => {
      await fetch(`/api/lc/endpoints/${id}`, { method: "DELETE" });
      await refetchAll();
    },
    issueToken: async (input: { endpointId: string; budget: number; expiresInHours: number; maxCalls: number }) => {
      const r = await fetch("/api/lc/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
      if (!r.ok) throw new Error((await r.json()).error || "issue_failed");
      const json = await r.json();
      const tok = fromToken(json.token as PayTokenRow);
      setJwtById((m) => ({ ...m, [tok.id]: json.jwt as string }));
      await refetchAll();
      return { token: tok, jwt: json.jwt as string };
    },
    revokeToken: async (id: string) => {
      await fetch(`/api/lc/tokens/${id}`, { method: "DELETE" });
      await refetchAll();
    },
    clearBlocked: async () => {
      await fetch("/api/lc/blocks", { method: "DELETE" });
      await refetchAll();
    },
    refetch: refetchAll,
  };

  return (
    <div>
      <Header menuOpen={menuOpen} setMenuOpen={setMenuOpen} endpoints={endpoints} activeTokensCount={activeTokens.length} runs={runs} blocked={blocked} totalRevenue={totalRevenue} setActivePane={(p) => goTo(p)} />

      <div className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[228px_1fr] gap-8">
        <Sidebar activePane={activePane} counts={counts} onSelect={(p) => goTo(p)} />

        <main className="min-w-0">
          {!loaded ? <p className="text-[12px] text-[#1a0f00]/40 py-12 text-center">Loading workspace…</p> : (
            <>
              {activePane === "add"      && <AddPane endpoints={endpoints} goTo={goTo} api={api} />}
              {activePane === "apis"     && <ApisPane endpoints={endpoints} tokens={tokens} runs={runs} api={api} goTo={goTo} />}
              {activePane === "paytoken" && <PayTokenPane endpoints={endpoints} tokens={tokens} jwtById={jwtById} api={api} goTo={goTo} preselectEndpointId={preselectEndpointId} />}
              {activePane === "test"     && <TestPane endpoints={endpoints} tokens={tokens} jwtById={jwtById} runs={runs} api={api} goTo={goTo} preselectEndpointId={preselectEndpointId} />}
              {activePane === "revenue"  && <RevenuePane endpoints={endpoints} runs={runs} />}
              {activePane === "blocked"  && <BlockedPane blocked={blocked} endpoints={endpoints} api={api} />}
            </>
          )}

        </main>
      </div>
    </div>
  );
}

/* ────────────────────────────  header  ──────────────────────────── */

type Api = {
  createEndpoint: (i: { name: string; originalUrl: string; upstreamAuth?: string; pricePerCall: number; tokenBudget: number; rateLimit: number }) => Promise<Endpoint>;
  setStatus: (id: string, status: "live" | "paused") => Promise<void>;
  deleteEndpoint: (id: string) => Promise<void>;
  issueToken: (i: { endpointId: string; budget: number; expiresInHours: number; maxCalls: number }) => Promise<{ token: PayToken; jwt: string }>;
  revokeToken: (id: string) => Promise<void>;
  clearBlocked: () => Promise<void>;
  refetch: () => Promise<void>;
};

function Header({ menuOpen, setMenuOpen, endpoints, activeTokensCount, runs, blocked, totalRevenue, setActivePane }: {
  menuOpen: boolean; setMenuOpen: (b: boolean | ((p: boolean) => boolean)) => void;
  endpoints: Endpoint[]; activeTokensCount: number; runs: TestRun[]; blocked: BlockedReq[];
  totalRevenue: number; setActivePane: (p: Pane) => void;
}) {
  // Read the anonymous owner cookie so users can copy / back it up.
  const [ownerId, setOwnerId] = useState<string>("");
  // Fetched profile (incl. email if claimed). Refetched whenever the
  // dropdown re-opens so a magic-link sign-in is reflected immediately.
  type Me = { id: string; email: string | null; email_verified_at: string | null };
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const m = document.cookie.match(/(?:^|;\s*)lc_owner=([^;]+)/);
    setOwnerId(m ? decodeURIComponent(m[1]) : "");
    if (menuOpen) {
      fetch("/api/lc/me").then((r) => r.json()).then((d) => setMe(d.owner ?? null)).catch(() => setMe(null));
    }
  }, [menuOpen]);

  // Claim flow
  const [emailInput, setEmailInput] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimResult, setClaimResult] = useState<{ ok: true; sent: boolean; previewUrl: string | null } | { ok: false; error: string } | null>(null);
  async function submitClaim() {
    setClaimBusy(true);
    setClaimResult(null);
    try {
      const r = await fetch("/api/lc/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const j = await r.json();
      if (!r.ok) setClaimResult({ ok: false, error: j.error || "request_failed" });
      else setClaimResult({ ok: true, sent: !!j.sent, previewUrl: j.previewUrl ?? null });
    } catch {
      setClaimResult({ ok: false, error: "network_error" });
    } finally {
      setClaimBusy(false);
    }
  }
  function signOut() {
    document.cookie = "lc_owner=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
    window.location.reload();
  }

  // ─── Stripe Connect state ─────────────────────────────────────────
  type StripeStatus = {
    connected: boolean;
    accountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    country: string | null;
  };
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [stripeErr, setStripeErr] = useState<string | null>(null);

  async function fetchStripeStatus() {
    try {
      const r = await fetch("/api/lc/stripe/status");
      const j = await r.json();
      if (r.ok) setStripeStatus(j);
    } catch { /* ignore */ }
  }
  // Refresh whenever the dropdown opens for a signed-in user.
  useEffect(() => {
    if (menuOpen && me?.email) fetchStripeStatus();
  }, [menuOpen, me?.email]);
  // Also refresh once on initial load if URL has ?stripe=return (came back
  // from hosted onboarding) — gives the user immediate feedback.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("stripe") === "return") {
      fetchStripeStatus();
      // Clean the query param so a reload doesn't keep re-triggering.
      url.searchParams.delete("stripe");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, []);

  async function startStripeConnect() {
    setStripeBusy(true);
    setStripeErr(null);
    try {
      const r = await fetch("/api/lc/stripe/connect", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.onboardingUrl) {
        setStripeErr(j.message || j.error || "connect_failed");
        return;
      }
      // Redirect into Stripe's hosted onboarding form.
      window.location.href = j.onboardingUrl;
    } catch {
      setStripeErr("network_error");
    } finally {
      setStripeBusy(false);
    }
  }
  return (
    <header className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/about/en" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-md object-cover" />
            <span className="text-[14px] font-bold tracking-tight">LemonCake</span>
          </Link>
          <span className="px-2.5 py-1 bg-[#1a0f00]/6 text-[#1a0f00]/65 rounded-full text-[9.5px] font-bold uppercase tracking-widest">Private Beta</span>
        </div>
        <div className="flex items-center gap-5 text-[13px]">
          <Link href="/docs" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">Docs</Link>
          <Link href="/docs/pay-token" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors inline-flex items-center gap-1">
            <Icon.External className="w-3.5 h-3.5" /> API Reference
          </Link>
          <div className="relative ml-1">
            <button type="button" onClick={() => setMenuOpen((o) => !o)} className="inline-flex items-center gap-1 pl-1.5 pr-2 py-1 rounded-full bg-white border border-[#1a0f00]/10 hover:bg-[#1a0f00]/[0.03] transition-colors" aria-label="Workspace menu" aria-expanded={menuOpen}>
              <span className="inline-flex w-7 h-7 items-center justify-center rounded-full bg-[#1a0f00] text-white text-[10px] font-black">LC</span>
              <Icon.ChevDn className={`w-3.5 h-3.5 text-[#1a0f00]/55 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>
            {menuOpen && (
              <>
                <button type="button" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-30 cursor-default" aria-hidden tabIndex={-1} />
                <div className="absolute top-full right-0 mt-2 w-[320px] rounded-xl bg-white border border-[#1a0f00]/12 shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-4 z-40">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-1">Workspace</p>
                  <p className="text-[12.5px] font-bold mb-3 leading-tight">
                    {me?.email ? me.email : "Anonymous · Private Beta"}
                  </p>
                  <dl className="text-[11.5px] space-y-1.5 mb-3">
                    <div className="flex items-baseline justify-between gap-2"><dt className="text-[#1a0f00]/65">Endpoints</dt><dd className="font-mono font-semibold">{endpoints.length}</dd></div>
                    <div className="flex items-baseline justify-between gap-2"><dt className="text-[#1a0f00]/65">Active Pay Tokens</dt><dd className="font-mono font-semibold">{activeTokensCount}</dd></div>
                    <div className="flex items-baseline justify-between gap-2"><dt className="text-[#1a0f00]/65">Paid calls</dt><dd className="font-mono font-semibold">{runs.length}</dd></div>
                    <div className="flex items-baseline justify-between gap-2"><dt className="text-[#1a0f00]/65">Blocked</dt><dd className="font-mono font-semibold">{blocked.length}</dd></div>
                    <div className="flex items-baseline justify-between gap-2 pt-1.5 border-t border-[#1a0f00]/6"><dt className="text-[#1a0f00]/65">Earned (net)</dt><dd className="font-mono font-bold text-[#16A34A]">{fmtUsd(totalRevenue * 0.97)}</dd></div>
                  </dl>

                  {/* Email claim flow OR signed-in state */}
                  {me?.email ? (
                    <>
                      <div className="mb-3 rounded-lg bg-[#16A34A]/8 border border-[#16A34A]/25 p-2.5">
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#16A34A]">Signed in</p>
                          <button type="button" onClick={signOut} className="text-[10.5px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] underline underline-offset-2">Sign out</button>
                        </div>
                        <p className="text-[11.5px] font-semibold text-[#1a0f00] break-all">{me.email}</p>
                      </div>

                      {/* Stripe Connect status / action */}
                      {stripeStatus && (
                        stripeStatus.chargesEnabled ? (
                          <div className="mb-3 rounded-lg bg-[#635BFF]/8 border border-[#635BFF]/25 p-2.5">
                            <div className="flex items-baseline justify-between gap-2 mb-1">
                              <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#635BFF]">Stripe connected</p>
                              <span className="text-[9.5px] font-mono text-[#1a0f00]/50">{stripeStatus.country ?? "—"}</span>
                            </div>
                            <code className="block font-mono text-[10.5px] text-[#1a0f00]/75 break-all">{stripeStatus.accountId}</code>
                            <p className="mt-1 text-[10px] text-[#1a0f00]/55">Buyers can now prepay credits to this seller. Payouts settle on Stripe&apos;s schedule.</p>
                          </div>
                        ) : stripeStatus.connected ? (
                          <div className="mb-3 rounded-lg bg-[#fffd43]/15 border border-[#1a0f00]/10 p-2.5">
                            <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#1a0f00]/65 mb-1">Stripe onboarding incomplete</p>
                            <p className="text-[10.5px] text-[#1a0f00]/65 leading-snug mb-2">
                              Account created, but KYC / bank details still pending. Resume to accept payments.
                            </p>
                            <button
                              type="button"
                              onClick={startStripeConnect}
                              disabled={stripeBusy}
                              className="w-full px-2.5 py-1.5 bg-[#1a0f00] text-white font-bold text-[11px] rounded hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-50"
                            >
                              {stripeBusy ? "Opening Stripe…" : "Resume Stripe onboarding →"}
                            </button>
                          </div>
                        ) : (
                          <div className="mb-3 rounded-lg bg-[#fffd43]/15 border border-[#1a0f00]/10 p-2.5">
                            <p className="text-[9.5px] font-bold uppercase tracking-widest text-[#1a0f00]/65 mb-1">Accept buyer payments</p>
                            <p className="text-[10.5px] text-[#1a0f00]/65 leading-snug mb-2">
                              Connect Stripe so buyers can prepay credits to your account. LemonCake takes 3%, the rest goes straight to your Stripe balance.
                            </p>
                            <button
                              type="button"
                              onClick={startStripeConnect}
                              disabled={stripeBusy}
                              className="w-full px-2.5 py-1.5 bg-[#635BFF] text-white font-bold text-[11px] rounded hover:bg-[#7A73FF] transition-colors disabled:opacity-50"
                            >
                              {stripeBusy ? "Opening Stripe…" : "Connect Stripe →"}
                            </button>
                          </div>
                        )
                      )}
                      {stripeErr && (
                        <p className="mb-3 text-[10.5px] text-[#DC2626]">Stripe error: {stripeErr}</p>
                      )}
                    </>
                  ) : (
                    <div className="mb-3 rounded-lg bg-[#fffd43]/15 border border-[#1a0f00]/10 p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-1">Claim with email</p>
                      <p className="text-[10.5px] text-[#1a0f00]/65 leading-snug mb-2">
                        Add an email to recover this workspace from another browser and to enable Stripe Connect payouts (next phase).
                      </p>
                      {claimResult?.ok && (claimResult.sent ? (
                        <p className="text-[11px] text-[#16A34A] mb-2">✓ Check your inbox for the magic link.</p>
                      ) : (
                        <div className="mb-2">
                          <p className="text-[10.5px] text-[#1a0f00]/65 mb-1">Link generated (email backend not configured yet):</p>
                          {claimResult.previewUrl && (
                            <div className="flex items-center gap-1.5">
                              <a href={claimResult.previewUrl} className="flex-1 text-[10px] text-[#1a0f00] underline break-all">Open link</a>
                              <button type="button" onClick={() => navigator.clipboard?.writeText(claimResult.previewUrl!)} className="text-[10px] font-semibold text-[#1a0f00]/65 hover:text-[#1a0f00] underline">Copy</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {claimResult && !claimResult.ok && (
                        <p className="text-[11px] text-[#DC2626] mb-2">Error: {claimResult.error}</p>
                      )}
                      <div className="flex gap-1.5">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="you@example.com"
                          className="flex-1 min-w-0 px-2 py-1.5 bg-white border border-[#1a0f00]/15 rounded text-[11.5px] focus:outline-none focus:border-[#1a0f00]/55"
                          onKeyDown={(e) => { if (e.key === "Enter") submitClaim(); }}
                        />
                        <button
                          type="button"
                          onClick={submitClaim}
                          disabled={claimBusy || !emailInput.trim()}
                          className="flex-shrink-0 px-2.5 py-1.5 bg-[#1a0f00] text-white font-bold text-[11px] rounded hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-50"
                        >
                          {claimBusy ? "…" : "Send"}
                        </button>
                      </div>
                    </div>
                  )}

                  {ownerId && (
                    <details className="mb-3">
                      <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/45 hover:text-[#1a0f00]/65">Owner ID</summary>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <code className="font-mono text-[10.5px] text-[#1a0f00]/75 truncate">{ownerId}</code>
                        <button type="button" onClick={() => navigator.clipboard?.writeText(ownerId)} className="flex-shrink-0 text-[10px] font-semibold text-[#1a0f00]/65 hover:text-[#1a0f00] underline">Copy</button>
                      </div>
                    </details>
                  )}

                  <a href="mailto:contact@aievid.com?subject=Design%20partner%20access%20%E2%80%94%20LemonCake" onClick={() => setMenuOpen(false)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a0f00]/70 hover:text-[#1a0f00] underline underline-offset-2 decoration-[#1a0f00]/30 hover:decoration-[#1a0f00]">Talk to us →</a>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────  sidebar  ──────────────────────────── */

function Sidebar({ activePane, counts, onSelect }: { activePane: Pane; counts: Record<Pane, number | null>; onSelect: (p: Pane) => void }) {
  return (
    <aside className="md:sticky md:top-20 self-start space-y-5">
      {SIDEBAR.map((group) => (
        <div key={group.heading}>
          <p className="text-[10px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-2 px-1">{group.heading}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Ico = Icon[item.icon];
              const isActive = item.pane === activePane;
              const badge = counts[item.pane];
              return (
                <li key={item.label}>
                  <button type="button" onClick={() => onSelect(item.pane)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${isActive ? "bg-[#fffd43] text-[#1a0f00] font-semibold" : "text-[#1a0f00]/65 hover:bg-[#1a0f00]/4 hover:text-[#1a0f00]"}`}>
                    <Ico className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {badge !== null && badge > 0 && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${isActive ? "bg-[#1a0f00]/15 text-[#1a0f00]" : "bg-[#1a0f00]/8 text-[#1a0f00]/60"}`}>{badge}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="rounded-xl bg-[#1a0f00]/3 border border-[#1a0f00]/8 p-3">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">Launch Plan</p>
          <p className="text-[11px] font-bold text-[#1a0f00]/80"><span className="font-mono">$0</span>/mo</p>
        </div>
        <ul className="space-y-1 text-[10.5px] text-[#1a0f00]/65 mb-2">
          <li>3,000 API calls free</li>
          <li>3% when settlement goes live</li>
          <li>No fixed transaction fee</li>
        </ul>
        <Link href="/pricing" className="text-[10.5px] font-semibold text-[#1a0f00]/70 hover:text-[#1a0f00] hover:underline">View pricing →</Link>
      </div>
    </aside>
  );
}

/* ────────────────────────────  panes  ──────────────────────────── */

function AddPane({ endpoints, goTo, api }: { endpoints: Endpoint[]; goTo: (p: Pane, opts?: { endpointId?: string }) => void; api: Api }) {
  // Empty by default — the placeholder shows the example. The user types
  // their own. (Pricing / budget / rate keep real defaults since those are
  // sensible starting values, not example labels.)
  const [apiName,      setApiName]      = useState("");
  const [apiUrl,       setApiUrl]       = useState("");
  const [pricePerCall, setPricePerCall] = useState("0.01");
  const [tokenBudget,  setTokenBudget]  = useState("5.00");
  const [rateLimit,    setRateLimit]    = useState("60");
  const [upstreamAuth, setUpstreamAuth] = useState("");
  const [estCalls,     setEstCalls]     = useState<1000 | 10000 | 100000>(1000);
  const [busy,         setBusy]         = useState(false);
  const [err,          setErr]          = useState<string | null>(null);

  // Verify origin (real browser-side GET against the URL the seller pasted)
  type VerifyState =
    | null
    | { kind: "loading" }
    | { kind: "ok"; status: number; ms: number }
    | { kind: "fail"; status: number; ms: number }
    | { kind: "error"; message: string };
  const [verify, setVerify] = useState<VerifyState>(null);
  async function verifyUrl() {
    if (!/^https?:\/\//.test(apiUrl)) {
      setVerify({ kind: "error", message: "Enter a full http(s) URL first." });
      return;
    }
    setVerify({ kind: "loading" });
    const headers: Record<string, string> = {};
    if (upstreamAuth) {
      const idx = upstreamAuth.indexOf(":");
      if (idx > 0) headers[upstreamAuth.slice(0, idx).trim()] = upstreamAuth.slice(idx + 1).trim();
    }
    const t0 = performance.now();
    try {
      const res = await fetch(apiUrl, { method: "GET", headers, mode: "cors" });
      const ms = Math.round(performance.now() - t0);
      setVerify(res.ok ? { kind: "ok", status: res.status, ms } : { kind: "fail", status: res.status, ms });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Network error";
      setVerify({ kind: "error", message });
    }
  }

  const rawSlug = slugifyName(apiName) || "your-api";
  let finalSlug = rawSlug;
  if (endpoints.some((e) => e.slug === finalSlug)) {
    let i = 2;
    while (endpoints.some((e) => e.slug === `${rawSlug}-${i}`)) i++;
    finalSlug = `${rawSlug}-${i}`;
  }
  const slugConflict = finalSlug !== rawSlug;
  const previewUrl  = `https://www.lemoncake.xyz/g/${"…".padEnd(8, "…")}`;
  const previewSlug = finalSlug;

  const priceNum  = Math.max(0, parseFloat(pricePerCall) || 0);
  const budgetNum = Math.max(0, parseFloat(tokenBudget)  || 0);
  const rateNum   = Math.max(1, parseInt(rateLimit, 10)  || 1);
  const estRev    = priceNum * estCalls;
  const estFee    = estRev * 0.03;
  const estNet    = estRev - estFee;

  // After successful create, we hold the freshly returned Endpoint here
  // and swap the form area for a success card. Resetting to null re-opens
  // the form for another endpoint.
  const [created, setCreated] = useState<Endpoint | null>(null);

  async function create() {
    setErr(null);
    if (!apiName.trim()) return setErr("API name is required.");
    if (!/^https?:\/\//.test(apiUrl)) return setErr("API URL must start with http(s)://");
    if (priceNum <= 0) return setErr("Price per call must be greater than 0.");
    setBusy(true);
    try {
      const ep = await api.createEndpoint({
        name: apiName.trim(),
        originalUrl: apiUrl.trim(),
        upstreamAuth: upstreamAuth.trim() || undefined,
        pricePerCall: priceNum,
        tokenBudget: budgetNum,
        rateLimit: rateNum,
      });
      setCreated(ep);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setBusy(false);
    }
  }

  // State-aware primary CTA. Empty URL → disabled; URL pasted but Verify
  // not run yet → "Verify origin" (running verify, not create); any verify
  // result (ok / fail / error) → "Create Paid-Access Endpoint".
  type CtaState = "no_url" | "needs_verify" | "ready";
  const ctaState: CtaState =
    !/^https?:\/\//.test(apiUrl)
      ? "no_url"
      : !verify || verify.kind === "loading"
        ? "needs_verify"
        : "ready";
  const ctaLabel = busy
    ? "Creating…"
    : ctaState === "no_url"        ? "Enter API URL to continue"
      : ctaState === "needs_verify" ? "Verify origin"
        : "Create Paid-Access Endpoint";
  const ctaDisabled = busy || ctaState === "no_url" || verify?.kind === "loading";
  async function onCtaClick() {
    if (ctaState === "needs_verify") await verifyUrl();
    else if (ctaState === "ready")    await create();
  }

  // ── Post-create success state ──────────────────────────────────────
  if (created) {
    return (
      <CreatedSuccess
        endpoint={created}
        onIssueToken={() => goTo("paytoken", { endpointId: created.id })}
        onTest={() => goTo("test", { endpointId: created.id })}
        onCreateAnother={() => { setCreated(null); setVerify(null); }}
      />
    );
  }

  return (
    <>
      <PaneHeading
        eyebrow={endpoints.length === 0 ? "Welcome" : "New endpoint"}
        title={endpoints.length === 0 ? "Create your first paid-access API" : "Create another paid-access endpoint"}
        subtitle="Turn any HTTP API into a protected endpoint with price rules, Pay Tokens, spend caps, and real-time usage logs."
      />

      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {["Metering live", "Pay Tokens live", "Usage ledger live"].map((label) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-[11.5px] text-[#1a0f00]/75">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#16A34A]/15 text-[#16A34A] text-[9px] font-black">✓</span>
            {label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#1a0f00]/75">
          <span className="w-1.5 h-1.5 rounded-full bg-[#1a0f00]/45" />
          Access control live · Settlement optional
        </span>
      </div>
      <p className="mb-6 text-[10.5px] text-[#1a0f00]/45 leading-snug">
        Stripe / x402 settlement can be enabled later — endpoint, metering, and ledger work without it.
      </p>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
          <div className="space-y-5">
            <Field label="API name">
              <input type="text" value={apiName} onChange={(e) => setApiName(e.target.value)} placeholder="AI Search API" className="w-full px-3.5 py-2.5 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] focus:outline-none focus:border-[#1a0f00]/55 transition-colors" />
            </Field>
            <Field label="Original API URL">
              <div className="flex items-stretch gap-2">
                <input
                  type="url"
                  value={apiUrl}
                  onChange={(e) => { setApiUrl(e.target.value); setVerify(null); }}
                  placeholder="https://api.example.com/search"
                  className="flex-1 min-w-0 px-3.5 py-2.5 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] font-mono focus:outline-none focus:border-[#1a0f00]/55 transition-colors"
                />
                <button
                  type="button"
                  onClick={verifyUrl}
                  disabled={verify?.kind === "loading"}
                  className="flex-shrink-0 px-3 py-2 bg-white border border-[#1a0f00]/15 rounded-xl text-[12px] font-semibold text-[#1a0f00]/75 hover:bg-[#1a0f00]/[0.03] hover:text-[#1a0f00] transition-colors disabled:opacity-60"
                >
                  {verify?.kind === "loading" ? "…" : "Verify"}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed">
                {!verify && <span className="text-[#1a0f00]/45">We&apos;ll connect to this endpoint on every paid request.</span>}
                {verify?.kind === "ok" && <span className="text-[#16A34A]">✓ Origin reachable · {verify.status} · {verify.ms}ms</span>}
                {verify?.kind === "fail" && <span className="text-[#DC2626]">{verify.status} from origin · {verify.ms}ms. Check URL or upstream auth.</span>}
                {verify?.kind === "error" && <span className="text-[#DC2626]">Origin unreachable — {verify.message}. CORS / DNS likely; production gateway is server-to-server and unaffected.</span>}
              </p>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Price per call">
                <DollarInput value={pricePerCall} onChange={setPricePerCall} step="0.001" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-[#1a0f00]/45 self-center mr-1">Suggested:</span>
                  {([
                    ["0.001", "log/tool"],
                    ["0.01",  "search"],
                    ["0.05",  "extraction"],
                    ["0.20",  "deep research"],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPricePerCall(v)}
                      className={`px-2 py-0.5 text-[10.5px] font-mono rounded border transition-colors ${
                        pricePerCall === v
                          ? "bg-[#1a0f00] text-white border-[#1a0f00]"
                          : "bg-white text-[#1a0f00]/70 border-[#1a0f00]/15 hover:border-[#1a0f00]/35 hover:text-[#1a0f00]"
                      }`}
                    >
                      ${v} <span className="font-sans font-normal opacity-65">{label}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Max buyer spend per Pay Token" hintBelow="Maximum amount each Pay Token can spend before it stops working."><DollarInput value={tokenBudget} onChange={setTokenBudget} step="0.50" /></Field>
            </div>
            <Field label="Rate limit" hintBelow="Max requests allowed per minute, per endpoint">
              <div className="flex items-center bg-white border border-[#1a0f00]/15 rounded-xl focus-within:border-[#1a0f00]/55 transition-colors">
                <input
                  type="number" step="10" min="1" value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-transparent text-[13.5px] focus:outline-none"
                />
                <span className="pr-3.5 text-[12.5px] text-[#1a0f00]/45 font-mono whitespace-nowrap">requests / min</span>
              </div>
            </Field>
            <Field
              label="Upstream auth"
              hint="optional for open APIs"
              hintBelow="If your origin requires auth (e.g. OpenAI, Anthropic, internal services), paste the full header here. Stored server-side, never shown to buyers."
            >
              <input
                type="text"
                value={upstreamAuth}
                onChange={(e) => setUpstreamAuth(e.target.value)}
                placeholder="Authorization: Bearer sk-..."
                className="w-full px-3.5 py-2.5 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] font-mono focus:outline-none focus:border-[#1a0f00]/55 transition-colors"
              />
            </Field>
          </div>

          {err && <p className="mt-4 text-[12px] text-[#DC2626] bg-[#DC2626]/8 border border-[#DC2626]/25 rounded-lg px-3 py-2">{err}</p>}

          <button
            type="button"
            onClick={onCtaClick}
            disabled={ctaDisabled}
            className={`mt-6 w-full inline-flex items-center justify-center gap-2 py-3 font-bold text-[14px] rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              ctaState === "ready"
                ? "bg-[#fffd43] hover:bg-[#fff070] text-[#1a0f00] shadow-[0_1px_0_rgba(26,15,0,0.15)]"
                : ctaState === "needs_verify"
                  ? "bg-[#1a0f00] hover:bg-[#1a0f00]/90 text-white"
                  : "bg-[#1a0f00]/8 text-[#1a0f00]/55"
            }`}
          >
            {ctaState === "ready" && <Icon.Bolt className="w-4 h-4" />}
            {ctaLabel}
          </button>
          <p className="mt-2.5 text-center text-[11px] text-[#1a0f00]/55">
            Next: issue Pay Token → send test request → watch ledger update
          </p>
        </div>

        <PreviewPanel
          apiUrl={apiUrl}
          previewUrl={previewUrl}
          previewSlug={previewSlug}
          slugConflict={slugConflict}
          rawSlug={rawSlug}
          pricePerCall={priceNum}
          tokenBudget={budgetNum}
          rateLimit={rateNum}
          estCalls={estCalls}
          setEstCalls={setEstCalls}
          estRev={estRev}
          estFee={estFee}
          estNet={estNet}
        />
      </section>

    </>
  );
}

/* ─── Right-side vertical 3-step preview ─── */

function PreviewPanel({
  apiUrl, previewUrl, previewSlug, slugConflict, rawSlug,
  pricePerCall, tokenBudget, rateLimit,
  estCalls, setEstCalls, estRev, estFee, estNet,
}: {
  apiUrl: string;
  previewUrl: string;
  previewSlug: string;
  slugConflict: boolean;
  rawSlug: string;
  pricePerCall: number;
  tokenBudget: number;
  rateLimit: number;
  estCalls: 1000 | 10000 | 100000;
  setEstCalls: (n: 1000 | 10000 | 100000) => void;
  estRev: number;
  estFee: number;
  estNet: number;
}) {
  return (
    <aside className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 lg:sticky lg:top-20 self-start">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">Live preview</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#16A34A]"><span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Ready to go</span>
      </div>

      {/* Step 1 — Gateway endpoint */}
      <PreviewStep n={1} title="Gateway endpoint">
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1a0f00]/12 bg-[#fffd43]/12 px-3 py-2.5">
          <code className="font-mono text-[11.5px] text-[#1a0f00] break-all truncate">{previewUrl}</code>
          <button type="button" onClick={() => navigator.clipboard?.writeText(previewUrl)} className="flex-shrink-0 p-1 rounded hover:bg-[#1a0f00]/8 transition-colors text-[#1a0f00]/55" aria-label="Copy gateway URL">
            <Icon.Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-[10.5px] text-[#1a0f00]/55 leading-snug">
          Slug “{previewSlug}”{slugConflict ? ` (auto-renamed from “${rawSlug}”)` : ""}. Real short ID assigned on create.
          {" "}Proxies to <code className="font-mono">{apiUrl || "—"}</code>.
        </p>
      </PreviewStep>

      {/* Step 2 — Pay Token rules */}
      <PreviewStep n={2} title="Pay Token rules">
        <div className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-3 space-y-1">
          <RevRow k="Max buyer spend" v={fmtUsd(tokenBudget)} />
          <RevRow k="Rate limit" v={`${rateLimit} req/min`} />
          <RevRow k="Per-call price" v={fmtUsd(pricePerCall)} />
          <RevRow k="Expires in" v="24h (default)" muted />
        </div>
        <p className="mt-1.5 text-[10.5px] text-[#1a0f00]/55 leading-snug">
          HS256-signed JWT. Buyer attaches as <code className="font-mono">Authorization: Bearer</code>. Revocable instantly.
        </p>
      </PreviewStep>

      {/* Step 3 — Test call */}
      <PreviewStep n={3} title="Test call">
        <div className="rounded-lg bg-[#1a0f00] text-white p-2.5 text-[10.5px] font-mono leading-relaxed">
          curl -X POST {previewUrl} \<br />
          &nbsp;&nbsp;-H &quot;Authorization: Bearer &lt;PAY_TOKEN&gt;&quot;
        </div>
        <div className="mt-2 rounded-xl bg-[#16A34A]/8 border border-[#16A34A]/25 p-3 space-y-1 font-mono text-[11px]">
          <RevRow k="HTTP" v="200 OK" highlight />
          <RevRow k="x-lemoncake-charge" v={fmtUsd(pricePerCall)} />
          <RevRow k="remaining budget" v={fmtUsd(Math.max(0, tokenBudget - pricePerCall))} muted />
        </div>
        <p className="mt-1.5 text-[10.5px] text-[#1a0f00]/55 leading-snug">
          Recorded to usage ledger. Settlement can be enabled later. On block: 402 / 429 / 401 with{" "}
          <code className="font-mono text-[10px] bg-[#1a0f00]/6 px-1 rounded">{"{\"error\": \"spend_cap_exceeded\"}"}</code>.
        </p>
      </PreviewStep>

      {/* Usage ledger estimate */}
      <div className="mt-5 pt-4 border-t border-[#1a0f00]/8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11.5px] font-semibold text-[#1a0f00]/75">Usage ledger estimate</p>
          <div className="relative">
            <select value={estCalls} onChange={(e) => setEstCalls(Number(e.target.value) as 1000 | 10000 | 100000)} className="appearance-none pl-3 pr-7 py-1 bg-white border border-[#1a0f00]/15 rounded-lg text-[11px] focus:outline-none focus:border-[#1a0f00]/55">
              <option value={1000}>1,000 calls / month</option>
              <option value={10000}>10,000 calls / month</option>
              <option value={100000}>100,000 calls / month</option>
            </select>
            <Icon.ChevDn className="w-3 h-3 text-[#1a0f00]/45 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-3 space-y-1">
          <RevRow k="Gross" v={fmtUsd(estRev)} />
          <RevRow k="LemonCake fee (3%, after free 3k)" v={`-${fmtUsd(estFee)}`} muted />
          <div className="h-px bg-[#1a0f00]/8 my-1" />
          <RevRow k="You receive" v={fmtUsd(estNet)} highlight />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#1a0f00]/50">
          <Icon.Lock className="w-3 h-3" />
          Ledger only. Stripe / x402 settlement comes next.
        </p>
      </div>
    </aside>
  );
}

function PreviewStep({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#1a0f00] text-white text-[10px] font-black">{n}</span>
        <p className="text-[12px] font-bold">{title}</p>
      </div>
      {children}
    </div>
  );
}

/* ─── Post-create success state ─── */

function CreatedSuccess({
  endpoint, onIssueToken, onTest, onCreateAnother,
}: {
  endpoint: Endpoint;
  onIssueToken: () => void;
  onTest: () => void;
  onCreateAnother: () => void;
}) {
  const url = gatewayUrlOf(endpoint.shortId);
  return (
    <>
      <div className="mb-6 flex items-start gap-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#16A34A] text-white text-[16px] font-black flex-shrink-0">✓</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#16A34A] uppercase tracking-widest mb-1">Live</p>
          <h1 className="text-[26px] md:text-[30px] font-black leading-[1.15] tracking-tight">Your paid-access endpoint is live</h1>
          <p className="mt-2 text-[13px] text-[#1a0f00]/60">
            <code className="font-mono text-[12px] bg-[#1a0f00]/6 px-1.5 py-0.5 rounded">{endpoint.name}</code> is ready to take paid requests.
            Hand the gateway URL + a Pay Token to your buyer.
          </p>
        </div>
      </div>

      <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6 mb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">Gateway URL</p>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1a0f00]/12 bg-[#fffd43]/15 px-3 py-3 mb-5">
          <code className="font-mono text-[13px] text-[#1a0f00] break-all">{url}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(url)}
            className="flex-shrink-0 px-3 py-1.5 bg-white border border-[#1a0f00]/15 text-[12px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors"
          >
            Copy
          </button>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">Protection</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px] mb-5">
          {[
            ["Pay Token required",   "Every paid call must attach a signed JWT"],
            ["Spend cap enforced",   `Max ${fmtUsd(endpoint.tokenBudget)} per Pay Token`],
            ["Rate limit enforced",  `${endpoint.rateLimit} req/min per endpoint`],
            ["Usage ledger active",  "Every successful call written to Postgres"],
          ].map(([label, sub]) => (
            <div key={label} className="flex items-start gap-2">
              <span className="text-[#16A34A] font-black mt-0.5">✓</span>
              <div>
                <p className="font-semibold text-[#1a0f00]">{label}</p>
                <p className="text-[11px] text-[#1a0f00]/55 leading-snug">{sub}</p>
              </div>
            </div>
          ))}
        </dl>

        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">Next step</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onIssueToken} className="inline-flex items-center gap-2 px-4 py-2 bg-[#fffd43] hover:bg-[#fff070] text-[#1a0f00] font-bold text-[13px] rounded-lg transition-colors shadow-[0_1px_0_rgba(26,15,0,0.15)]">
            <Icon.Key className="w-4 h-4" /> Issue Pay Token
          </button>
          <button type="button" onClick={onTest} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold text-[13px] rounded-lg hover:bg-[#1a0f00]/[0.03] transition-colors">
            <Icon.Play className="w-3.5 h-3.5" /> Send test request
          </button>
          <button type="button" onClick={() => navigator.clipboard?.writeText(url)} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold text-[13px] rounded-lg hover:bg-[#1a0f00]/[0.03] transition-colors">
            <Icon.Copy className="w-3.5 h-3.5" /> Copy Gateway URL
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onCreateAnother} className="text-[12px] text-[#1a0f00]/55 hover:text-[#1a0f00] underline underline-offset-2">
            + Create another
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-[#1a0f00]/3 border border-[#1a0f00]/8 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">Endpoint summary</p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12px]">
          <div><dt className="text-[10px] uppercase tracking-widest text-[#1a0f00]/45 mb-0.5">Price</dt><dd className="font-bold">{fmtUsd(endpoint.pricePerCall)} <span className="text-[10px] text-[#1a0f00]/45 font-normal">/ call</span></dd></div>
          <div><dt className="text-[10px] uppercase tracking-widest text-[#1a0f00]/45 mb-0.5">Spend cap</dt><dd className="font-bold">{fmtUsd(endpoint.tokenBudget)} <span className="text-[10px] text-[#1a0f00]/45 font-normal">/ token</span></dd></div>
          <div><dt className="text-[10px] uppercase tracking-widest text-[#1a0f00]/45 mb-0.5">Rate</dt><dd className="font-bold">{endpoint.rateLimit} <span className="text-[10px] text-[#1a0f00]/45 font-normal">req/min</span></dd></div>
          <div><dt className="text-[10px] uppercase tracking-widest text-[#1a0f00]/45 mb-0.5">Upstream auth</dt><dd className="font-bold">{endpoint.upstreamAuth ? "Set ✓" : "—"}</dd></div>
        </dl>
      </section>
    </>
  );
}

function ApisPane({ endpoints, tokens, runs, api, goTo }: { endpoints: Endpoint[]; tokens: PayToken[]; runs: TestRun[]; api: Api; goTo: (p: Pane, opts?: { endpointId?: string }) => void }) {
  if (endpoints.length === 0) {
    return (
      <>
        <PaneHeading eyebrow="Gateway" title="No endpoints yet" subtitle="When you create a paid API, its gateway URL and config land here." />
        <EmptyState actionLabel="Add your first API" onAction={() => goTo("add")} hint="Real gateway URL provisioned in seconds." />
      </>
    );
  }
  return (
    <>
      <PaneHeading
        eyebrow="Gateway"
        title="Your endpoints"
        subtitle={`${endpoints.length} ${endpoints.length === 1 ? "endpoint" : "endpoints"} configured. ${endpoints.filter((e) => e.status === "live").length} live and serving traffic.`}
        action={<button type="button" onClick={() => goTo("add")} className="px-3 py-1.5 bg-[#1a0f00] text-white text-[12px] font-semibold rounded-lg hover:bg-[#1a0f00]/90">+ Add API</button>}
      />
      <div className="space-y-3">
        {endpoints.map((e) => {
          const tokensForThis = tokens.filter((t) => t.endpointId === e.id && t.status === "active").length;
          const callsForThis  = runs.filter((r) => r.endpointId === e.id).length;
          const earned        = runs.filter((r) => r.endpointId === e.id).reduce((a, r) => a + r.net, 0);
          const url           = gatewayUrlOf(e.shortId);
          return (
            <div key={e.id} className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-[15px] font-bold">{e.name}</h3>
                    <StatusPill status={e.status} />
                    {e.upstreamAuth && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/60 bg-[#1a0f00]/6 px-1.5 py-0.5 rounded" title={`Forwarded to origin: ${maskAuth(e.upstreamAuth)}`}>
                        <Icon.Lock className="w-2.5 h-2.5" /> Auth
                      </span>
                    )}
                  </div>
                  <code className="block font-mono text-[11.5px] text-[#1a0f00]/75 break-all">{url}</code>
                  <p className="font-mono text-[10.5px] text-[#1a0f00]/40 mt-0.5">→ {e.originalUrl}</p>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton title="Copy gateway URL" onClick={() => navigator.clipboard?.writeText(url)}><Icon.Copy className="w-3.5 h-3.5" /></IconButton>
                  <IconButton title={e.status === "live" ? "Pause" : "Resume"} onClick={() => api.setStatus(e.id, e.status === "live" ? "paused" : "live")}>
                    {e.status === "live" ? <Icon.Pause className="w-3.5 h-3.5" /> : <Icon.Refresh className="w-3.5 h-3.5" />}
                  </IconButton>
                  <IconButton title="Delete" tone="danger" onClick={() => { if (confirm(`Delete "${e.name}" and all its Pay Tokens?`)) api.deleteEndpoint(e.id); }}><Icon.Trash className="w-3.5 h-3.5" /></IconButton>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
                <Stat label="Price" v={fmtUsd(e.pricePerCall)} suf="/ call" />
                <Stat label="Rate limit" v={String(e.rateLimit)} suf="req/min" />
                <Stat label="Spend cap" v={fmtUsd(e.tokenBudget)} suf="/ token" />
                <Stat label="Upstream auth" v={e.upstreamAuth ? "Set" : "—"} suf={e.upstreamAuth ? "✓" : undefined} />
                <Stat label="Created" v={timeAgo(e.createdAt)} />
              </dl>
              <div className="mt-4 pt-4 border-t border-[#1a0f00]/6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-[#1a0f00]/65">
                <span><span className="font-semibold text-[#1a0f00]">{tokensForThis}</span> active Pay {tokensForThis === 1 ? "Token" : "Tokens"}</span>
                <span><span className="font-semibold text-[#1a0f00]">{callsForThis}</span> paid {callsForThis === 1 ? "call" : "calls"}</span>
                <span><span className="font-semibold text-[#16A34A]">{fmtUsd(earned)}</span> earned</span>
                <div className="flex-1" />
                <button type="button" onClick={() => goTo("paytoken", { endpointId: e.id })} className="text-[11.5px] font-semibold text-[#1a0f00] hover:underline">Issue Pay Token →</button>
                <button type="button" onClick={() => goTo("test", { endpointId: e.id })} className="text-[11.5px] font-semibold text-[#1a0f00] hover:underline">Test request →</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function PayTokenPane({ endpoints, tokens, jwtById, api, goTo, preselectEndpointId }: { endpoints: Endpoint[]; tokens: PayToken[]; jwtById: Record<string, string>; api: Api; goTo: (p: Pane) => void; preselectEndpointId: string | null }) {
  const [endpointId, setEndpointId] = useState<string>(() => {
    if (preselectEndpointId && endpoints.some((e) => e.id === preselectEndpointId)) return preselectEndpointId;
    return endpoints[0]?.id ?? "";
  });
  const [budget,   setBudget]   = useState("5");
  const [expires,  setExpires]  = useState("24");
  const [maxCalls, setMaxCalls] = useState("100");
  const [busy,     setBusy]     = useState(false);
  const [err,      setErr]      = useState<string | null>(null);
  const [justIssued, setJustIssued] = useState<{ token: PayToken; jwt: string } | null>(null);

  useEffect(() => {
    if (endpoints.length > 0 && !endpoints.find((e) => e.id === endpointId)) setEndpointId(endpoints[0].id);
  }, [endpoints, endpointId]);

  if (endpoints.length === 0) {
    return (<>
      <PaneHeading eyebrow="Pay Token" title="Create an endpoint first" subtitle="Pay Tokens are scoped to a specific gateway endpoint." />
      <EmptyState actionLabel="Add your first API" onAction={() => goTo("add")} />
    </>);
  }

  async function issue() {
    setErr(null);
    const b = Math.max(0, parseFloat(budget) || 0);
    const h = Math.max(1, parseInt(expires, 10) || 1);
    const m = Math.max(1, parseInt(maxCalls, 10) || 1);
    if (b <= 0) return setErr("Budget must be greater than 0.");
    setBusy(true);
    try {
      const res = await api.issueToken({ endpointId, budget: b, expiresInHours: h, maxCalls: m });
      setJustIssued(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Issue failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PaneHeading eyebrow="Pay Token" title="Issue & manage Pay Tokens" subtitle="Each token is a spend-capped, expirable JWT your buyer attaches as Bearer auth. Decremented server-side on every paid call." />

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
          <h3 className="text-[14px] font-bold mb-4">Issue a new Pay Token</h3>
          <div className="space-y-4">
            <Field label="Endpoint">
              <Select value={endpointId} onChange={setEndpointId}>
                {endpoints.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.slug}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Budget" hint="USD"><DollarInput value={budget} onChange={setBudget} step="0.50" /></Field>
              <Field label="Expires in" hint="hours"><input type="number" step="1" min="1" value={expires} onChange={(e) => setExpires(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#1a0f00]/15 rounded-lg text-[13px] focus:outline-none focus:border-[#1a0f00]/55" /></Field>
              <Field label="Max calls"><input type="number" step="10" min="1" value={maxCalls} onChange={(e) => setMaxCalls(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#1a0f00]/15 rounded-lg text-[13px] focus:outline-none focus:border-[#1a0f00]/55" /></Field>
            </div>
          </div>
          {err && <p className="mt-4 text-[12px] text-[#DC2626] bg-[#DC2626]/8 border border-[#DC2626]/25 rounded-lg px-3 py-2">{err}</p>}
          <button type="button" onClick={issue} disabled={busy} className="mt-5 w-full py-2.5 bg-[#1a0f00] text-white font-bold text-[13px] rounded-xl hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-60">{busy ? "Issuing…" : "Issue Pay Token"}</button>

          {justIssued && (
            <div className="mt-4 rounded-lg bg-[#16A34A]/8 border border-[#16A34A]/30 p-3">
              <p className="text-[12px] font-bold text-[#16A34A] mb-2">Issued. Give this JWT to your buyer.</p>
              <code className="block font-mono text-[10.5px] text-[#1a0f00]/85 break-all bg-white/60 border border-[#1a0f00]/8 rounded p-2 select-all">{justIssued.jwt}</code>
              <button type="button" onClick={() => navigator.clipboard?.writeText(justIssued.jwt)} className="mt-2 text-[11px] font-semibold text-[#1a0f00] hover:underline">Copy JWT</button>
              <p className="mt-2 text-[10.5px] text-[#1a0f00]/55">Token id <code className="font-mono">{justIssued.token.id}</code>. Shown once — the dashboard keeps it in memory until you reload.</p>
            </div>
          )}
        </div>
        <aside className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">How tokens are used</p>
          <ol className="text-[12px] text-[#1a0f00]/70 space-y-1.5 list-decimal pl-4">
            <li>Issue here. Hand the JWT to your buyer / agent.</li>
            <li>They send <code className="font-mono text-[11px] bg-[#fafaf7] px-1 rounded">Authorization: Bearer &lt;jwt&gt;</code> to your gateway URL.</li>
            <li>Gateway verifies signature, looks up the token in Postgres, decrements budget + calls, forwards to your origin.</li>
            <li>Revoke instantly — next request fails closed.</li>
          </ol>
        </aside>
      </section>

      <section className="mt-8">
        <h3 className="text-[13px] font-bold mb-3 text-[#1a0f00]/80">All Pay Tokens ({tokens.length})</h3>
        {tokens.length === 0 ? <p className="text-[12px] text-[#1a0f00]/45 italic">No tokens issued yet.</p> : (
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr><th className="text-left px-4 py-2.5 font-semibold">Token</th><th className="text-left px-4 py-2.5 font-semibold">Endpoint</th><th className="text-right px-4 py-2.5 font-semibold">Budget left</th><th className="text-right px-4 py-2.5 font-semibold">Calls</th><th className="text-right px-4 py-2.5 font-semibold">Expires</th><th className="text-right px-4 py-2.5 font-semibold">Status</th><th className="px-2"></th></tr>
              </thead>
              <tbody>
                {tokens.map((t) => {
                  const ep = endpoints.find((e) => e.id === t.endpointId);
                  const left = Math.max(0, t.budget - t.spent);
                  const hasJwt = jwtById[t.id];
                  return (
                    <tr key={t.id} className="border-b border-[#1a0f00]/6 last:border-0">
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-[11px]">{t.id}</code>
                        {hasJwt && <button type="button" onClick={() => navigator.clipboard?.writeText(jwtById[t.id])} className="ml-2 text-[10px] text-[#1a0f00]/55 hover:text-[#1a0f00] underline">Copy JWT</button>}
                      </td>
                      <td className="px-4 py-2.5 text-[#1a0f00]/75">{ep?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtUsd(left)} <span className="text-[#1a0f00]/40">/ {fmtUsd(t.budget)}</span></td>
                      <td className="px-4 py-2.5 text-right font-mono">{t.callsUsed} <span className="text-[#1a0f00]/40">/ {t.maxCalls}</span></td>
                      <td className="px-4 py-2.5 text-right text-[#1a0f00]/60">{t.status === "expired" ? "expired" : `in ${Math.max(0, Math.ceil((t.expiresAt - Date.now()) / 3600000))}h`}</td>
                      <td className="px-4 py-2.5 text-right"><TokenStatusPill status={t.status} /></td>
                      <td className="pr-3 text-right">{t.status === "active" && <button type="button" onClick={() => api.revokeToken(t.id)} className="text-[11px] text-[#DC2626] hover:underline">Revoke</button>}</td>
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

function TestPane({ endpoints, tokens, jwtById, runs, api, goTo, preselectEndpointId }: { endpoints: Endpoint[]; tokens: PayToken[]; jwtById: Record<string, string>; runs: TestRun[]; api: Api; goTo: (p: Pane, opts?: { endpointId?: string }) => void; preselectEndpointId: string | null }) {
  const activeTokens = tokens.filter((t) => t.status === "active");
  const [tokenId, setTokenId] = useState<string>(() => {
    if (preselectEndpointId) {
      const m = activeTokens.find((t) => t.endpointId === preselectEndpointId);
      if (m) return m.id;
    }
    return activeTokens[0]?.id ?? "";
  });
  const [lastResult, setLastResult] = useState<{ kind: "ok"; status: number; ms: number; bodyPreview: string } | { kind: "blocked"; status: number; reason: string } | { kind: "error"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Verify origin (bypasses the gateway entirely)
  type VerifyResult =
    | { kind: "ok"; status: number; ms: number; contentType: string; bodyPreview: string }
    | { kind: "error"; message: string; hint?: string };
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  async function verifyOrigin() {
    const t = tokens.find((p) => p.id === tokenId);
    if (!t) return;
    const e = endpoints.find((x) => x.id === t.endpointId);
    if (!e) return;
    setVerifyBusy(true);
    setVerifyResult(null);
    const headers: Record<string, string> = {};
    if (e.upstreamAuth) {
      const idx = e.upstreamAuth.indexOf(":");
      if (idx > 0) headers[e.upstreamAuth.slice(0, idx).trim()] = e.upstreamAuth.slice(idx + 1).trim();
    }
    const t0 = performance.now();
    try {
      const res = await fetch(e.originalUrl, { method: "GET", headers, mode: "cors" });
      const ms = Math.round(performance.now() - t0);
      const text = await res.text();
      setVerifyResult({
        kind: "ok",
        status: res.status,
        ms,
        contentType: res.headers.get("content-type") ?? "(none)",
        bodyPreview: text.slice(0, 400),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const looksLikeCors = /failed to fetch|networkerror|load failed/i.test(message);
      setVerifyResult({
        kind: "error",
        message,
        hint: looksLikeCors
          ? "Probably CORS / DNS. Browser-to-origin needs Access-Control-Allow-Origin from your upstream. The production gateway is server-to-server and is not affected."
          : undefined,
      });
    } finally {
      setVerifyBusy(false);
    }
  }

  useEffect(() => {
    if (activeTokens.length > 0 && !activeTokens.find((t) => t.id === tokenId)) setTokenId(activeTokens[0].id);
  }, [activeTokens, tokenId]);

  if (endpoints.length === 0) {
    return (<>
      <PaneHeading eyebrow="Test Request" title="Create an endpoint first" subtitle="Run a real paid call once you have an endpoint to point at." />
      <EmptyState actionLabel="Add your first API" onAction={() => goTo("add")} />
    </>);
  }
  if (activeTokens.length === 0) {
    return (<>
      <PaneHeading eyebrow="Test Request" title="Issue a Pay Token first" subtitle="Send a real paid call through the gateway using a JWT-signed Pay Token." />
      <EmptyState actionLabel="Go to Pay Token" onAction={() => goTo("paytoken", preselectEndpointId ? { endpointId: preselectEndpointId } : undefined)} />
    </>);
  }

  const token = tokens.find((t) => t.id === tokenId);
  const ep    = token ? endpoints.find((e) => e.id === token.endpointId) : undefined;
  const jwt   = token ? jwtById[token.id] : undefined;
  const gatewayUrl = ep ? gatewayUrlOf(ep.shortId) : "";

  async function send() {
    if (!ep || !token) return;
    if (!jwt) {
      setLastResult({ kind: "error", message: "JWT for this token isn't in memory. Issue a new Pay Token (the JWT is shown once on issue) or reload + re-issue." });
      return;
    }
    setBusy(true);
    setLastResult(null);
    const t0 = performance.now();
    try {
      const res = await fetch(gatewayUrl, {
        method: "POST",
        headers: { "Authorization": `Bearer ${jwt}` },
      });
      const ms = Math.round(performance.now() - t0);
      const text = await res.text();
      if (res.ok) {
        setLastResult({ kind: "ok", status: res.status, ms, bodyPreview: text.slice(0, 400) });
      } else {
        let reason = `HTTP ${res.status}`;
        try { reason = (JSON.parse(text).error as string) || reason; } catch { /* not JSON */ }
        setLastResult({ kind: "blocked", status: res.status, reason });
      }
      await api.refetch();
    } catch (e) {
      setLastResult({ kind: "error", message: e instanceof Error ? e.message : "Network error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PaneHeading eyebrow="Test Request" title="Send a real paid request" subtitle="Hits your live gateway URL with a signed Pay Token. The gateway verifies the JWT, decrements the token's budget, forwards to your origin, and returns the response — everything happens in Postgres for real." />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <Field label="Pay Token">
            <Select value={tokenId} onChange={setTokenId}>
              {activeTokens.map((t) => {
                const e = endpoints.find((x) => x.id === t.endpointId);
                return <option key={t.id} value={t.id}>{t.id} — {e?.name}</option>;
              })}
            </Select>
          </Field>

          {ep && token && (
            <div className="mt-4 rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-3 text-[11.5px] space-y-1">
              <RevRow k="Target endpoint" v={ep.name} />
              <RevRow k="Per-call price" v={fmtUsd(ep.pricePerCall)} />
              <RevRow k="Token budget" v={`${fmtUsd(Math.max(0, token.budget - token.spent))} of ${fmtUsd(token.budget)} left`} />
              <RevRow k="Calls remaining" v={`${token.maxCalls - token.callsUsed} of ${token.maxCalls}`} />
              <RevRow k="Rate limit" v={`${ep.rateLimit} req/min`} />
            </div>
          )}

          {ep && (
            <div className="mt-4 rounded-lg bg-[#1a0f00] text-white p-3 text-[11px] font-mono leading-relaxed">
              curl -X POST {gatewayUrl} \<br />
              &nbsp;&nbsp;-H &quot;Authorization: Bearer {jwt ? `${jwt.slice(0, 20)}…` : "<jwt>"}&quot;
            </div>
          )}
          {!jwt && (
            <p className="mt-2 text-[10.5px] text-[#DC2626]/85 leading-snug">JWT for this token isn&apos;t in memory. JWTs are only returned once on issue — re-issue a Pay Token to get a fresh JWT.</p>
          )}

          <button type="button" onClick={send} disabled={busy || !jwt} className="mt-4 w-full py-2.5 bg-[#1a0f00] text-white font-bold text-[13px] rounded-xl hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-60">
            {busy ? "Calling gateway…" : "Send request"} <span className="text-[10px] font-normal text-white/55 ml-1">via gateway</span>
          </button>

          {/* Verify origin — bypass gateway, hit upstream directly */}
          {ep && (
            <div className="mt-6 pt-5 border-t border-[#1a0f00]/8">
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-[12px] font-bold">Verify origin reachable</p>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#1a0f00]/55">bypasses gateway</span>
              </div>
              <p className="text-[10.5px] text-[#1a0f00]/55 leading-snug mb-3">
                Browser-side GET to <code className="font-mono">{ep.originalUrl}</code>{ep.upstreamAuth ? <> with your stored <code className="font-mono">{maskAuth(ep.upstreamAuth)}</code></> : null}. Confirms URL + upstream auth actually reach origin. No Pay Token decrement.
              </p>
              <button type="button" onClick={verifyOrigin} disabled={verifyBusy} className="w-full py-2 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold text-[12px] rounded-lg hover:bg-[#1a0f00]/[0.03] transition-colors disabled:opacity-60">
                {verifyBusy ? "Calling origin…" : "GET upstream now"}
              </button>
              {verifyResult?.kind === "ok" && (
                <div className={`mt-3 rounded-lg border p-3 ${verifyResult.status < 400 ? "bg-[#16A34A]/8 border-[#16A34A]/30" : "bg-[#DC2626]/8 border-[#DC2626]/30"}`}>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className={`text-[12.5px] font-bold ${verifyResult.status < 400 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{verifyResult.status} {verifyResult.status < 400 ? "OK" : "from origin"}</p>
                    <p className="text-[10.5px] font-mono text-[#1a0f00]/55">{verifyResult.ms}ms · {verifyResult.contentType}</p>
                  </div>
                  {verifyResult.bodyPreview ? (
                    <pre className="font-mono text-[10.5px] text-[#1a0f00]/75 whitespace-pre-wrap break-all max-h-32 overflow-auto bg-white/50 border border-[#1a0f00]/8 rounded p-2">{verifyResult.bodyPreview}{verifyResult.bodyPreview.length === 400 ? "…" : ""}</pre>
                  ) : <p className="text-[10.5px] text-[#1a0f00]/45 italic">(empty body)</p>}
                </div>
              )}
              {verifyResult?.kind === "error" && (
                <div className="mt-3 rounded-lg bg-[#DC2626]/8 border border-[#DC2626]/30 p-3">
                  <p className="text-[12.5px] font-bold text-[#DC2626] mb-1">Network error</p>
                  <p className="text-[11px] font-mono text-[#1a0f00]/75 break-all">{verifyResult.message}</p>
                  {verifyResult.hint && <p className="mt-2 text-[10.5px] text-[#1a0f00]/65 leading-snug">{verifyResult.hint}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-3">Last result</p>
          {!lastResult && <p className="text-[12px] text-[#1a0f00]/45 italic">Send a request to see the gateway response.</p>}
          {lastResult?.kind === "ok" && (
            <div className="rounded-xl bg-[#16A34A]/8 border border-[#16A34A]/30 p-3">
              <p className="text-[12.5px] font-bold text-[#16A34A] mb-2">{lastResult.status} — Paid call successful · {lastResult.ms}ms</p>
              {lastResult.bodyPreview && (
                <pre className="font-mono text-[10.5px] text-[#1a0f00]/75 whitespace-pre-wrap break-all max-h-40 overflow-auto bg-white/50 border border-[#1a0f00]/8 rounded p-2">{lastResult.bodyPreview}{lastResult.bodyPreview.length === 400 ? "…" : ""}</pre>
              )}
            </div>
          )}
          {lastResult?.kind === "blocked" && (
            <div className="rounded-xl bg-[#DC2626]/8 border border-[#DC2626]/30 p-3">
              <p className="text-[12.5px] font-bold text-[#DC2626] mb-1">{lastResult.status} — Blocked</p>
              <p className="text-[11.5px] text-[#1a0f00]/75 font-mono">{lastResult.reason}</p>
            </div>
          )}
          {lastResult?.kind === "error" && (
            <div className="rounded-xl bg-[#DC2626]/8 border border-[#DC2626]/30 p-3">
              <p className="text-[12.5px] font-bold text-[#DC2626] mb-1">Network error</p>
              <p className="text-[11px] text-[#1a0f00]/75 break-all">{lastResult.message}</p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-[13px] font-bold mb-3 text-[#1a0f00]/80">Recent paid requests ({runs.length})</h3>
        {runs.length === 0 ? <p className="text-[12px] text-[#1a0f00]/45 italic">No paid requests yet.</p> : (
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr><th className="text-left px-4 py-2.5 font-semibold">When</th><th className="text-left px-4 py-2.5 font-semibold">Endpoint</th><th className="text-left px-4 py-2.5 font-semibold">Pay Token</th><th className="text-right px-4 py-2.5 font-semibold">Status · ms</th><th className="text-right px-4 py-2.5 font-semibold">Gross</th><th className="text-right px-4 py-2.5 font-semibold">Fee 3%</th><th className="text-right px-4 py-2.5 font-semibold">You receive</th></tr>
              </thead>
              <tbody>
                {runs.slice(0, 50).map((r) => {
                  const e = endpoints.find((x) => x.id === r.endpointId);
                  return (
                    <tr key={r.id} className="border-b border-[#1a0f00]/6 last:border-0">
                      <td className="px-4 py-2.5 text-[#1a0f00]/55">{timeAgo(r.at)}</td>
                      <td className="px-4 py-2.5">{e?.name ?? "—"}</td>
                      <td className="px-4 py-2.5"><code className="font-mono text-[11px] text-[#1a0f00]/65">{r.payTokenId}</code></td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1a0f00]/65">{r.upstreamStatus ?? "—"} · {r.upstreamMs ?? "—"}ms</td>
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

function RevenuePane({ endpoints, runs }: { endpoints: Endpoint[]; runs: TestRun[] }) {
  const gross = runs.reduce((a, r) => a + r.gross, 0);
  const fee   = runs.reduce((a, r) => a + r.fee, 0);
  const net   = runs.reduce((a, r) => a + r.net, 0);

  // Free-tier counter: paid calls in the current UTC month, capped display at 3,000
  const FREE_TIER = 3000;
  const monthStart = useMemo(() => {
    const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  }, []);
  const callsThisMonth = runs.filter((r) => r.at >= monthStart).length;
  const freeRemaining = Math.max(0, FREE_TIER - callsThisMonth);
  const freePct = Math.min(100, (callsThisMonth / FREE_TIER) * 100);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
    const end = d.getTime() + 86400000;
    const g = runs.filter((r) => r.at >= d.getTime() && r.at < end).reduce((a, r) => a + r.gross, 0);
    return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), gross: g };
  }), [runs]);
  const maxG = Math.max(0.0001, ...days.map((d) => d.gross));

  return (
    <>
      <PaneHeading eyebrow="Usage Ledger" title="What your APIs have earned" subtitle="All numbers are read directly from Postgres — every charge is a real paid request that went through the gateway. Ledger only for now; Stripe / x402 settlement layer next." />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <BigStat label="Gross" v={fmtUsd(gross)} sub={`${runs.length} paid ${runs.length === 1 ? "call" : "calls"}`} />
        <BigStat label="LemonCake fee (3%)" v={fmtUsd(fee)} sub="What we collect" muted />
        <BigStat label="You receive" v={fmtUsd(net)} sub="Settles to your wallet (Q3 2026)" highlight />
      </section>

      {/* Free-tier progress */}
      <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[12px] font-bold">Free tier this month</p>
          <p className="text-[11px] text-[#1a0f00]/55">
            <span className="font-mono font-bold text-[#1a0f00]">{callsThisMonth.toLocaleString()}</span> / 3,000 calls
            {freeRemaining > 0
              ? <span className="ml-2 text-[#16A34A] font-semibold">{freeRemaining.toLocaleString()} free left</span>
              : <span className="ml-2 text-[#1a0f00]/55">3% fee active</span>}
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-[#1a0f00]/8 overflow-hidden">
          <div
            className={`h-full transition-all ${freePct < 100 ? "bg-[#16A34A]" : "bg-[#1a0f00]/35"}`}
            style={{ width: `${freePct}%` }}
          />
        </div>
        <p className="mt-2 text-[10.5px] text-[#1a0f00]/55 leading-snug">
          {freeRemaining > 0
            ? "LemonCake takes 0% on every paid call until you hit 3,000 this month. After that, the standard 3% kicks in."
            : "You've used your 3,000 free calls this month. Calls 3,001+ are charged the standard 3%."}
          {" "}Counter resets at the start of next UTC month.
        </p>
      </section>
      <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-3">Last 14 days · gross</p>
        <div className="flex items-end gap-1 h-32">
          {days.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className={`w-full rounded-t-md ${d.gross > 0 ? "bg-[#1a0f00]" : "bg-[#1a0f00]/8"}`} style={{ height: `${Math.max(2, (d.gross / maxG) * 100)}%` }} title={`${d.label}: ${fmtUsd(d.gross)}`} />
              <span className="text-[8.5px] text-[#1a0f00]/40 font-mono">{d.label.split(" ")[1]}</span>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="text-[13px] font-bold mb-3 text-[#1a0f00]/80">Per endpoint</h3>
        {endpoints.length === 0 ? <p className="text-[12px] text-[#1a0f00]/45 italic">Add an endpoint to start tracking revenue.</p> : (
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr><th className="text-left px-4 py-2.5 font-semibold">Endpoint</th><th className="text-right px-4 py-2.5 font-semibold">Calls</th><th className="text-right px-4 py-2.5 font-semibold">Gross</th><th className="text-right px-4 py-2.5 font-semibold">Fee</th><th className="text-right px-4 py-2.5 font-semibold">You receive</th></tr>
              </thead>
              <tbody>
                {endpoints.map((e) => {
                  const rows = runs.filter((r) => r.endpointId === e.id);
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

function BlockedPane({ blocked, endpoints, api }: { blocked: BlockedReq[]; endpoints: Endpoint[]; api: Api }) {
  const [filter, setFilter] = useState<BlockReason | "all">("all");
  const filtered = blocked.filter((b) => filter === "all" || b.reason === filter);
  const saved = blocked.reduce((a, b) => a + b.attempted, 0);
  return (
    <>
      <PaneHeading eyebrow="Blocked Requests" title="What we kept off your meter" subtitle="Every block is a real gateway-side enforcement event written by /g/[shortId] in the moment it happened." />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <BigStat label="Blocked" v={String(blocked.length)} sub="lifetime" />
        <BigStat label="Charge prevented" v={fmtUsd(saved)} sub="Pay Token spend the gateway refused" muted />
        <BigStat label="Reasons" v={String(new Set(blocked.map((b) => b.reason)).size)} sub="distinct block types" />
      </section>
      {blocked.length === 0 ? <p className="text-[12px] text-[#1a0f00]/45 italic">No blocks yet. Spam the Send-request button to hit rate limits and spend caps.</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {(["all", "rate_limit_exceeded", "spend_cap_exceeded", "token_expired", "token_revoked", "endpoint_paused", "upstream_error"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${filter === f ? "bg-[#1a0f00] text-white" : "bg-white border border-[#1a0f00]/12 text-[#1a0f00]/65 hover:text-[#1a0f00]"}`}>{f === "all" ? "All" : reasonLabel(f)}</button>
            ))}
            <div className="flex-1" />
            <button type="button" onClick={() => api.clearBlocked()} className="text-[11px] text-[#1a0f00]/55 hover:text-[#1a0f00]">Clear log</button>
          </div>
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr><th className="text-left px-4 py-2.5 font-semibold">When</th><th className="text-left px-4 py-2.5 font-semibold">Endpoint</th><th className="text-left px-4 py-2.5 font-semibold">Reason</th><th className="text-right px-4 py-2.5 font-semibold">Charge prevented</th></tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((b) => {
                  const e = endpoints.find((x) => x.id === b.endpointId);
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

/* ────────────────────────────  small components  ──────────────────────────── */

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
      <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none px-3.5 py-2.5 pr-9 bg-white border border-[#1a0f00]/15 rounded-xl text-[13px] focus:outline-none focus:border-[#1a0f00]/55">{children}</select>
      <Icon.ChevDn className="w-4 h-4 text-[#1a0f00]/45 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}
function UrlBox({ label, url, tint, hint }: { label: string; url: string; tint?: boolean; hint?: string }) {
  return (
    <div>
      <p className="text-[11.5px] font-semibold text-[#1a0f00]/75 mb-1.5">{label}</p>
      <div className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${tint ? "bg-[#fffd43]/12 border-[#1a0f00]/12" : "bg-[#fafaf7] border-[#1a0f00]/12"}`}>
        <code className="font-mono text-[11.5px] text-[#1a0f00] break-all truncate">{url || "—"}</code>
        <button type="button" onClick={() => navigator.clipboard?.writeText(url)} className="flex-shrink-0 p-1 rounded hover:bg-[#1a0f00]/8 transition-colors text-[#1a0f00]/55" aria-label={`Copy ${label}`}><Icon.Copy className="w-3.5 h-3.5" /></button>
      </div>
      {hint && <p className="mt-1.5 text-[10.5px] text-[#1a0f00]/55 leading-snug">{hint}</p>}
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
    <button type="button" onClick={onClick} title={title} aria-label={title} className={`p-1.5 rounded-md transition-colors ${tone === "danger" ? "text-[#1a0f00]/45 hover:text-[#DC2626] hover:bg-[#DC2626]/8" : "text-[#1a0f00]/55 hover:text-[#1a0f00] hover:bg-[#1a0f00]/6"}`}>{children}</button>
  );
}
function StatusPill({ status }: { status: Endpoint["status"] }) {
  if (status === "live") return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#16A34A] bg-[#16A34A]/10 px-1.5 py-0.5 rounded"><span className="w-1 h-1 rounded-full bg-[#16A34A]" /> Live</span>;
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
        <Icon.Bolt className="w-4 h-4" />{actionLabel}
      </button>
      {hint && <p className="mt-3 text-[11.5px] text-[#1a0f00]/45">{hint}</p>}
    </div>
  );
}
function reasonLabel(r: BlockReason): string {
  return ({
    rate_limit_exceeded: "Rate limit exceeded",
    spend_cap_exceeded:  "Spend cap exceeded",
    token_expired:       "Pay Token expired",
    token_revoked:       "Pay Token revoked",
    endpoint_paused:     "Endpoint paused",
    upstream_error:      "Upstream error",
  } as Record<BlockReason, string>)[r];
}
