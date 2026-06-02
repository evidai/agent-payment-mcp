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
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode, type SVGProps } from "react";
import {
  publicPageUrl,
  badgeUrl as badgeUrlOf,
  curlExample,
  readmeBadgeMarkdown,
  xPostText,
  docsSnippet,
  mcpListingText,
  CATEGORIES,
} from "@/lib/lc-growth";
import { LocaleProvider, useT, LanguageSelector } from "@/lib/i18n";
import type { MessageKey } from "@/lib/messages/en";

/* ────────────────────────────  types  ──────────────────────────── */

type Pane = "add" | "apis" | "buylinks" | "paytoken" | "test" | "revenue" | "blocked" | "account";

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
  // ── Phase 4: Developer Growth Loop ──
  publicSlug?: string | null;
  publicTitle?: string | null;
  publicDescription?: string | null;
  category?: string | null;
  sellerDisplayName?: string | null;
  publicPageEnabled?: boolean;
  badgeEnabled?: boolean;
  directoryStatus?: "none" | "pending" | "approved" | "rejected";
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
  /** Buyer's email, captured at Stripe Checkout. null for manually-issued test tokens. */
  buyerEmail?: string | null;
  /**
   * Where the token came from:
   *   "purchase" — a buyer prepaid on /buy/[shortId] (real money, 97% already
   *                landed in the seller's Stripe balance at checkout).
   *   "test"     — the seller hand-issued it from the dashboard (a comp / for
   *                testing the gateway). No money behind it.
   */
  source: "purchase" | "test";
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

/** Shape returned by GET /api/lc/stripe/status. */
type StripeStatus = { connected: boolean; accountId?: string | null; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean; country: string | null };

/** Aggregate of buyer prepaid purchases — the real money figures post-pivot. */
type Sales = {
  count: number;        // number of purchases (purchased tokens)
  gross: number;        // total prepaid by buyers (sum of purchased token budgets)
  net: number;          // what reaches the seller's Stripe balance (97%)
  consumed: number;     // prepaid credit buyers have already spent through the gateway
  outstanding: number;  // prepaid credit not yet consumed (seller's liability)
};
function computeSales(tokens: PayToken[]): Sales {
  const purchased = tokens.filter((t) => t.source === "purchase");
  const gross = purchased.reduce((a, t) => a + t.budget, 0);
  const consumed = purchased.reduce((a, t) => a + Math.min(t.spent, t.budget), 0);
  return {
    count: purchased.length,
    gross,
    net: gross * 0.97,
    consumed,
    outstanding: Math.max(0, gross - consumed),
  };
}

/* ────────────────────────────  serializers  ──────────────────────────── */

type EndpointRow = { id: string; short_id: string; name: string; slug: string; original_url: string; upstream_auth: string | null; price_per_call: number | string; token_budget: number | string; rate_limit: number; status: "live" | "paused"; created_at: string; public_slug?: string | null; public_title?: string | null; public_description?: string | null; category?: string | null; seller_display_name?: string | null; public_page_enabled?: boolean; badge_enabled?: boolean; directory_status?: "none" | "pending" | "approved" | "rejected" };
type PayTokenRow = { id: string; endpoint_id: string; budget: number | string; spent: number | string; max_calls: number; calls_used: number; expires_at: string; status: PayToken["status"]; issued_at: string; stripe_checkout_session_id?: string | null; buyer_email?: string | null };
type TestRunRow  = { id: string; endpoint_id: string; pay_token_id: string; gross: number | string; fee: number | string; net: number | string; upstream_status: number | null; upstream_ms: number | null; at: string };
type BlockedRow  = { id: string; endpoint_id: string; pay_token_id: string | null; reason: BlockReason; attempted: number | string; at: string };

const fromEndpoint = (r: EndpointRow): Endpoint => ({
  id: r.id, shortId: r.short_id, name: r.name, slug: r.slug,
  originalUrl: r.original_url, upstreamAuth: r.upstream_auth ?? undefined,
  pricePerCall: Number(r.price_per_call), tokenBudget: Number(r.token_budget),
  rateLimit: r.rate_limit, status: r.status,
  createdAt: new Date(r.created_at).getTime(),
  publicSlug: r.public_slug ?? null,
  publicTitle: r.public_title ?? null,
  publicDescription: r.public_description ?? null,
  category: r.category ?? null,
  sellerDisplayName: r.seller_display_name ?? null,
  publicPageEnabled: r.public_page_enabled ?? true,
  badgeEnabled: r.badge_enabled ?? true,
  directoryStatus: r.directory_status ?? "none",
});
const fromToken = (r: PayTokenRow): PayToken => ({
  id: r.id, endpointId: r.endpoint_id,
  budget: Number(r.budget), spent: Number(r.spent),
  maxCalls: r.max_calls, callsUsed: r.calls_used,
  expiresAt: new Date(r.expires_at).getTime(),
  status: r.status, issuedAt: new Date(r.issued_at).getTime(),
  buyerEmail: r.buyer_email ?? null,
  source: r.stripe_checkout_session_id ? "purchase" : "test",
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
/** Public buyer-facing prepaid-purchase page. This is the link a seller shares
 *  with buyers post-pivot: they pay on it and get a Pay Token automatically. */
function buyUrlOf(shortId: string): string {
  if (typeof window !== "undefined") return `${window.location.origin}/buy/${shortId}`;
  return `https://www.lemoncake.xyz/buy/${shortId}`;
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
  Bank:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 10 12 4l9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18" /></svg>),
  Link:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>),
  Card:    (p: SVGProps<SVGSVGElement>) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20M6 15h4" /></svg>),
};

/* ────────────────────────────  sidebar  ──────────────────────────── */

type NavItem = { labelKey: MessageKey; icon: keyof typeof Icon; pane: Pane };
const SIDEBAR: { headingKey: MessageKey; items: NavItem[] }[] = [
  { headingKey: "nav.setup", items: [
    { labelKey: "nav.addApi",      icon: "Plus", pane: "add" },
    { labelKey: "nav.gateway",     icon: "Code", pane: "apis" },
    { labelKey: "nav.buyLinks",    icon: "Link", pane: "buylinks" },
    { labelKey: "nav.payTokens",   icon: "Key",  pane: "paytoken" },
    { labelKey: "nav.testRequest", icon: "Play", pane: "test" },
  ]},
  { headingKey: "nav.monitor", items: [
    { labelKey: "nav.usageLedger",     icon: "Dollar", pane: "revenue" },
    { labelKey: "nav.blockedRequests", icon: "Shield", pane: "blocked" },
  ]},
  { headingKey: "nav.account", items: [
    { labelKey: "nav.signinPayouts", icon: "Bank", pane: "account" },
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

  return (
    <LocaleProvider>
      {ready === null ? (
        <Shell><LoadingShell /></Shell>
      ) : ready === false ? (
        <Shell><SetupNotice /></Shell>
      ) : (
        <RealDashboard />
      )}
    </LocaleProvider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { t } = useT();
  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">
      <header className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/about/en" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-md object-cover" />
            <span className="text-[14px] font-bold tracking-tight">LemonCake</span>
            <span className="ml-2 px-2.5 py-1 bg-[#1a0f00]/6 text-[#1a0f00]/65 rounded-full text-[9.5px] font-bold uppercase tracking-widest">{t("header.privateBeta")}</span>
          </Link>
          <div className="flex items-center gap-5 text-[13px]">
            <Link href="/docs" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">{t("header.docs")}</Link>
            <Link href="/docs/pay-token" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors inline-flex items-center gap-1">
              <Icon.External className="w-3.5 h-3.5" /> {t("header.apiRef")}
            </Link>
            <LanguageSelector />
          </div>
        </div>
      </header>
      <div className="max-w-[1400px] mx-auto px-6 py-8">{children}</div>
    </div>
  );
}

function LoadingShell() {
  const { t } = useT();
  return <p className="text-[12px] text-[#1a0f00]/40 py-16 text-center">{t("common.loadingWorkspace")}</p>;
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

  // Seller's Stripe Connect state — lifted here so the Gateway, Usage Ledger,
  // and post-create success card can all tell whether a shared buy link will
  // actually take payments (charges_enabled) without each refetching it.
  const [stripe, setStripe] = useState<StripeStatus | null>(null);
  useEffect(() => {
    fetch("/api/lc/stripe/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && typeof j.connected === "boolean") setStripe(j as StripeStatus); })
      .catch(() => { /* 503 / not configured → leave null */ });
  }, []);
  const paymentsReady = !!stripe?.chargesEnabled;

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
  const sales = computeSales(tokens);
  const sellableCount = endpoints.filter((e) => e.pricePerCall > 0).length;
  const counts: Record<Pane, number | null> = {
    add: null, apis: endpoints.length, buylinks: sellableCount || null, paytoken: activeTokens.length,
    test: runs.length, revenue: sales.count || null, blocked: blocked.length, account: null,
  };

  // Returning from Stripe-hosted onboarding lands on /app?stripe=return|refresh.
  // Jump straight to the Account pane so the user sees their updated status
  // (AccountPane refreshes from Stripe + clears the query param on mount).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URL(window.location.href).searchParams;
    const sp = params.get("stripe");
    if (sp === "return" || sp === "refresh") setActivePane("account");
    // Returning from a magic link or OAuth round-trip lands on ?auth=... —
    // jump to the Account pane so the sign-in result is visible.
    if (params.get("auth")) setActivePane("account");
  }, []);

  // ── First-run sign-in gate ──────────────────────────────────────────────
  // Visitors arriving from the "無料で始める" CTA see a sign-in screen first,
  // so each person reconnects to their OWN workspace from any browser. The
  // workspace is "claimed" once it has an email (via OAuth or magic link).
  // Anonymous use stays one click away ("あとで") to keep friction low.
  const [claimedEmail, setClaimedEmail] = useState<string | null | undefined>(undefined); // undefined = still loading
  const [bypassGate, setBypassGate] = useState(false);
  useEffect(() => {
    fetch("/api/lc/me")
      .then((r) => r.json())
      .then((d) => setClaimedEmail(d.owner?.email ?? null))
      .catch(() => setClaimedEmail(null));
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { if (sessionStorage.getItem("lc:skipSignin")) setBypassGate(true); } catch {}
    // Just came back from an OAuth / Stripe / magic-link round-trip → never gate.
    const params = new URL(window.location.href).searchParams;
    if (params.get("auth") || params.get("stripe")) setBypassGate(true);
  }, []);
  const showGate = claimedEmail === null && !bypassGate;

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

  // Hold the dashboard until we know whether this workspace is claimed, then
  // show the sign-in screen first for unclaimed (new) visitors.
  if (claimedEmail === undefined) return <Shell><LoadingShell /></Shell>;
  if (showGate) {
    return (
      <Shell>
        <SignInGate
          onSkip={() => {
            try { sessionStorage.setItem("lc:skipSignin", "1"); } catch {}
            setBypassGate(true);
          }}
        />
      </Shell>
    );
  }

  return (
    <div>
      <Header />

      <div className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-[228px_1fr] gap-8">
        <Sidebar activePane={activePane} counts={counts} onSelect={(p) => goTo(p)} />

        <main className="min-w-0">
          {!loaded ? <p className="text-[12px] text-[#1a0f00]/40 py-12 text-center">Loading workspace…</p> : (
            <>
              {activePane === "add"      && <AddPane endpoints={endpoints} goTo={goTo} api={api} paymentsReady={paymentsReady} />}
              {activePane === "apis"     && <ApisPane endpoints={endpoints} tokens={tokens} runs={runs} api={api} goTo={goTo} paymentsReady={paymentsReady} />}
              {activePane === "buylinks" && <BuyLinksPane endpoints={endpoints} tokens={tokens} goTo={goTo} paymentsReady={paymentsReady} />}
              {activePane === "paytoken" && <PayTokenPane endpoints={endpoints} tokens={tokens} jwtById={jwtById} api={api} goTo={goTo} preselectEndpointId={preselectEndpointId} />}
              {activePane === "test"     && <TestPane endpoints={endpoints} tokens={tokens} jwtById={jwtById} runs={runs} api={api} goTo={goTo} preselectEndpointId={preselectEndpointId} />}
              {activePane === "revenue"  && <RevenuePane endpoints={endpoints} runs={runs} tokens={tokens} sales={sales} stripe={stripe} goTo={goTo} />}
              {activePane === "blocked"  && <BlockedPane blocked={blocked} endpoints={endpoints} api={api} />}
              {activePane === "account"  && <AccountPane />}
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

function Header() {
  const { t } = useT();
  return (
    <header className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/about/en" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-md object-cover" />
            <span className="text-[14px] font-bold tracking-tight">LemonCake</span>
          </Link>
          <span className="px-2.5 py-1 bg-[#1a0f00]/6 text-[#1a0f00]/65 rounded-full text-[9.5px] font-bold uppercase tracking-widest">{t("header.privateBeta")}</span>
        </div>
        <div className="flex items-center gap-5 text-[13px]">
          <Link href="/docs" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">{t("header.docs")}</Link>
          <Link href="/docs/pay-token" className="text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors inline-flex items-center gap-1">
            <Icon.External className="w-3.5 h-3.5" /> {t("header.apiRef")}
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ────────────────────────────  sidebar  ──────────────────────────── */

function Sidebar({ activePane, counts, onSelect }: { activePane: Pane; counts: Record<Pane, number | null>; onSelect: (p: Pane) => void }) {
  const { t } = useT();
  return (
    <aside className="md:sticky md:top-20 self-start space-y-5">
      {SIDEBAR.map((group) => (
        <div key={group.headingKey}>
          <p className="text-[10px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-2 px-1">{t(group.headingKey)}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Ico = Icon[item.icon];
              const isActive = item.pane === activePane;
              const badge = counts[item.pane];
              return (
                <li key={item.labelKey}>
                  <button type="button" onClick={() => onSelect(item.pane)} className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${isActive ? "bg-[#fffd43] text-[#1a0f00] font-semibold" : "text-[#1a0f00]/65 hover:bg-[#1a0f00]/4 hover:text-[#1a0f00]"}`}>
                    <Ico className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{t(item.labelKey)}</span>
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
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">{t("launch.plan")}</p>
          <p className="text-[11px] font-bold text-[#1a0f00]/80"><span className="font-mono">$0</span>{t("launch.perMonth")}</p>
        </div>
        <ul className="space-y-1 text-[10.5px] text-[#1a0f00]/65 mb-2">
          <li>{t("launch.freeCalls")}</li>
          <li>{t("launch.thenFee")}</li>
          <li>{t("launch.noFixed")}</li>
        </ul>
        <Link href="/pricing" className="text-[10.5px] font-semibold text-[#1a0f00]/70 hover:text-[#1a0f00] hover:underline">{t("launch.viewPricing")}</Link>
      </div>
    </aside>
  );
}

/* ────────────────────────────  panes  ──────────────────────────── */

/* ──────────────────────  first-run sign-in screen  ────────────────────── */

function SignInGate({ onSkip }: { onSkip: () => void }) {
  const [providers, setProviders] = useState<{ google: boolean; github: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/lc/auth/providers")
      .then((r) => r.json())
      .then((d) => setProviders({ google: !!d.google, github: !!d.github }))
      .catch(() => setProviders({ google: false, github: false }));
  }, []);

  const { t } = useT();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(false);
  async function submitEmail(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setErr(false);
    try {
      const r = await fetch("/api/lc/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!r.ok) setErr(true);
      else setSent(true);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[420px] mx-auto py-16">
      <div className="text-center mb-8">
        <h1 className="text-[26px] font-black leading-tight mb-2">{t("signin.title")}</h1>
        <p className="text-[13px] text-[#1a0f00]/55 leading-relaxed">
          {t("signin.subtitle")}
        </p>
      </div>

      {sent ? (
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6 text-center">
          <p className="text-[13px] text-[#16A34A] font-semibold mb-1">{t("signin.sent.title")}</p>
          <p className="text-[12.5px] text-[#1a0f00]/60 leading-relaxed">{t("signin.sent.body")}</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
          {providers && (providers.google || providers.github) && (
            <div className="space-y-2 mb-4">
              {providers.google && (
                <a href="/api/lc/auth/oauth/google/start" className="flex items-center justify-center gap-2.5 w-full px-4 py-2.5 bg-white border border-[#1a0f00]/15 rounded-lg text-[13px] font-semibold text-[#1a0f00] hover:border-[#1a0f00]/40 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.4 5.4 0 0 1-2.4 3.58v2.97h3.86c2.26-2.09 3.56-5.17 3.56-8.79z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.97c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
                    <path fill="#FBBC05" d="M5.27 14.32a7.2 7.2 0 0 1 0-4.62V6.61H1.29a12 12 0 0 0 0 10.8l3.98-3.09z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.61l3.98 3.09C6.22 6.85 8.87 4.75 12 4.75z" />
                  </svg>
                  {t("auth.google")}
                </a>
              )}
              {providers.github && (
                <a href="/api/lc/auth/oauth/github/start" className="flex items-center justify-center gap-2.5 w-full px-4 py-2.5 bg-[#1a0f00] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1a0f00]/90 transition-colors">
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                    <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.7 18 5 18 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
                  </svg>
                  {t("auth.github")}
                </a>
              )}
              <div className="flex items-center gap-3 pt-1">
                <span className="h-px flex-1 bg-[#1a0f00]/10" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-[#1a0f00]/35">{t("auth.orEmail")}</span>
                <span className="h-px flex-1 bg-[#1a0f00]/10" />
              </div>
            </div>
          )}

          <form onSubmit={submitEmail} className="space-y-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("common.emailPlaceholder")}
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#1a0f00]/15 text-[13px] focus:outline-none focus:border-[#1a0f00]/40"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full px-4 py-2.5 bg-[#fffd43] text-[#1a0f00] rounded-lg text-[13px] font-semibold hover:bg-[#fffd43]/90 transition-colors disabled:opacity-50"
            >
              {busy ? t("signin.sending") : t("signin.emailButton")}
            </button>
          </form>
          {err && <p className="text-[12px] text-[#B91C1C] mt-2">{t("signin.error")}</p>}
        </div>
      )}

      <div className="text-center mt-5">
        <button type="button" onClick={onSkip} className="text-[12.5px] text-[#1a0f00]/45 hover:text-[#1a0f00]/80 underline">
          {t("signin.skip")}
        </button>
      </div>
    </div>
  );
}

function AccountPane() {
  const { t } = useT();
  // ── Identity: anonymous owner cookie + claimed email ──
  const [ownerId, setOwnerId] = useState<string>("");
  type Me = { id: string; email: string | null; email_verified_at: string | null };
  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const loadMe = useCallback(() => {
    fetch("/api/lc/me").then((r) => r.json()).then((d) => setMe(d.owner ?? null)).catch(() => setMe(null)).finally(() => setMeLoaded(true));
  }, []);
  useEffect(() => {
    if (typeof document !== "undefined") {
      const m = document.cookie.match(/(?:^|;\s*)lc_owner=([^;]+)/);
      setOwnerId(m ? decodeURIComponent(m[1]) : "");
    }
    loadMe();
  }, [loadMe]);

  // ── Social sign-in: which provider buttons to show ──
  const [providers, setProviders] = useState<{ google: boolean; github: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/lc/auth/providers")
      .then((r) => r.json())
      .then((d) => setProviders({ google: !!d.google, github: !!d.github }))
      .catch(() => setProviders({ google: false, github: false }));
  }, []);

  // ── Sign-in result banner (magic link AND OAuth both land on ?auth=...) ──
  const [authNote, setAuthNote] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const a = url.searchParams.get("auth");
    if (!a) return;
    setAuthNote(a);
    if (a === "signed_in") loadMe(); // refresh so the card flips to "Signed in"
    url.searchParams.delete("auth");
    window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
  }, [loadMe]);

  // ── Email claim flow ──
  const [emailInput, setEmailInput] = useState("");
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimResult, setClaimResult] = useState<{ ok: true; sent: boolean; previewUrl: string | null } | { ok: false; error: string } | null>(null);
  async function submitClaim() {
    setClaimBusy(true);
    setClaimResult(null);
    try {
      const r = await fetch("/api/lc/auth/request-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: emailInput.trim() }) });
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

  // ── Stripe Connect ──
  type StripeStatus = { connected: boolean; accountId: string | null; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean; country: string | null };
  const [stripeStatus, setStripeStatus] = useState<StripeStatus | null>(null);
  const [stripeBusy, setStripeBusy] = useState(false);
  const [stripeErr, setStripeErr] = useState<string | null>(null);
  const fetchStripeStatus = useCallback(async () => {
    try { const r = await fetch("/api/lc/stripe/status"); const j = await r.json(); if (r.ok) setStripeStatus(j); } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (me?.email) fetchStripeStatus(); }, [me?.email, fetchStripeStatus]);
  // Returning from hosted onboarding lands on ?stripe=return|refresh — refresh
  // status so KYC completion shows immediately, then clean the query param.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const sp = url.searchParams.get("stripe");
    if (sp === "return" || sp === "refresh") {
      fetchStripeStatus();
      url.searchParams.delete("stripe");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
    }
  }, [fetchStripeStatus]);
  async function startStripeConnect() {
    setStripeBusy(true);
    setStripeErr(null);
    try {
      const r = await fetch("/api/lc/stripe/connect", { method: "POST" });
      const j = await r.json();
      if (!r.ok || !j.onboardingUrl) { setStripeErr(j.message || j.error || "connect_failed"); return; }
      window.location.href = j.onboardingUrl;
    } catch {
      setStripeErr("network_error");
    } finally {
      setStripeBusy(false);
    }
  }

  const authBanner: { tone: "ok" | "err"; text: string } | null = (() => {
    if (!authNote) return null;
    switch (authNote) {
      case "signed_in": return { tone: "ok", text: t("auth.banner.signed_in") };
      case "oauth_denied": return { tone: "err", text: t("auth.banner.oauth_denied") };
      case "bad_state":
      case "missing_code": return { tone: "err", text: t("auth.banner.session_expired") };
      case "oauth_exchange_failed":
      case "owner_resolve_failed": return { tone: "err", text: t("auth.banner.complete_failed") };
      case "invalid_or_expired": return { tone: "err", text: t("auth.banner.invalid_or_expired") };
      case "missing_token": return { tone: "err", text: t("auth.banner.missing_token") };
      case "backend_not_configured": return { tone: "err", text: t("auth.banner.backend_not_configured") };
      default: return authNote.endsWith("_not_configured") ? { tone: "err", text: t("auth.banner.method_not_configured") } : null;
    }
  })();

  return (
    <>
      <PaneHeading eyebrow={t("account.eyebrow")} title={t("account.title")} subtitle={t("account.subtitle")} />

      {authBanner && (
        <div className={`mb-4 px-3.5 py-2.5 rounded-lg text-[12.5px] font-medium border ${authBanner.tone === "ok" ? "bg-[#16A34A]/8 border-[#16A34A]/25 text-[#15803D]" : "bg-[#DC2626]/8 border-[#DC2626]/25 text-[#B91C1C]"}`}>
          {authBanner.text}
        </div>
      )}

      {/* Language — the seller switches the dashboard's display language here. */}
      <section className="mb-4 rounded-2xl bg-white border border-[#1a0f00]/10 p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-1">{t("lang.label")}</p>
          <p className="text-[12.5px] text-[#1a0f00]/60 leading-relaxed">{t("account.languageHint")}</p>
        </div>
        <div className="flex-shrink-0 rounded-lg border border-[#1a0f00]/15 px-3 py-2">
          <LanguageSelector />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Card 1 — workspace identity */}
        <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-3">{t("account.workspace")}</p>
          {!meLoaded ? (
            <p className="text-[12px] text-[#1a0f00]/40">{t("common.loading")}</p>
          ) : me?.email ? (
            <div className="rounded-xl bg-[#16A34A]/8 border border-[#16A34A]/25 p-4">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#16A34A]">{t("account.signedIn")}</p>
                <button type="button" onClick={signOut} className="text-[11px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] underline underline-offset-2">{t("account.signOut")}</button>
              </div>
              <p className="text-[14px] font-semibold text-[#1a0f00] break-all">{me.email}</p>
              <p className="mt-1 text-[11px] text-[#1a0f00]/55">{t("account.recoverable")}</p>
            </div>
          ) : (
            <div>
              <p className="text-[12.5px] text-[#1a0f00]/70 leading-relaxed mb-3">
                {t("account.claimPrompt")}
              </p>

              {providers && (providers.google || providers.github) && (
                <div className="mb-3 space-y-2">
                  {providers.google && (
                    <a href="/api/lc/auth/oauth/google/start" className="flex items-center justify-center gap-2.5 w-full px-4 py-2.5 bg-white border border-[#1a0f00]/15 rounded-lg text-[13px] font-semibold text-[#1a0f00] hover:border-[#1a0f00]/40 transition-colors">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.4 5.4 0 0 1-2.4 3.58v2.97h3.86c2.26-2.09 3.56-5.17 3.56-8.79z" />
                        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.97c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z" />
                        <path fill="#FBBC05" d="M5.27 14.32a7.2 7.2 0 0 1 0-4.62V6.61H1.29a12 12 0 0 0 0 10.8l3.98-3.09z" />
                        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.61l3.98 3.09C6.22 6.85 8.87 4.75 12 4.75z" />
                      </svg>
                      {t("auth.google")}
                    </a>
                  )}
                  {providers.github && (
                    <a href="/api/lc/auth/oauth/github/start" className="flex items-center justify-center gap-2.5 w-full px-4 py-2.5 bg-[#1a0f00] text-white rounded-lg text-[13px] font-semibold hover:bg-[#1a0f00]/90 transition-colors">
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                        <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.7 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17 4.7 18 5 18 5c.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.5 7.9-5.8 7.9-10.9C23.5 5.7 18.3.5 12 .5z" />
                      </svg>
                      {t("auth.github")}
                    </a>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <span className="h-px flex-1 bg-[#1a0f00]/10" />
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#1a0f00]/35">{t("auth.orEmail")}</span>
                    <span className="h-px flex-1 bg-[#1a0f00]/10" />
                  </div>
                </div>
              )}

              {claimResult?.ok && (claimResult.sent ? (
                <p className="text-[12px] text-[#16A34A] mb-3">{t("account.checkInbox")}</p>
              ) : (
                <div className="mb-3 rounded-lg bg-[#1a0f00]/4 border border-[#1a0f00]/10 p-3">
                  <p className="text-[11.5px] text-[#1a0f00]/65 mb-1.5">{t("account.noEmailDelivery")}</p>
                  {claimResult.previewUrl && (
                    <div className="flex items-center gap-2">
                      <a href={claimResult.previewUrl} className="flex-1 text-[11px] text-[#1a0f00] underline break-all">{t("account.openSigninLink")}</a>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(claimResult.previewUrl!)} className="flex-shrink-0 text-[11px] font-semibold text-[#1a0f00]/65 hover:text-[#1a0f00] underline">{t("common.copy")}</button>
                    </div>
                  )}
                </div>
              ))}
              {claimResult && !claimResult.ok && (
                <p className="text-[12px] text-[#DC2626] mb-3">{t("account.errorPrefix", { error: claimResult.error })}</p>
              )}
              <div className="flex gap-2">
                <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} placeholder={t("common.emailPlaceholder")} onKeyDown={(e) => { if (e.key === "Enter") submitClaim(); }} className="flex-1 min-w-0 px-3 py-2 bg-white border border-[#1a0f00]/15 rounded-lg text-[13px] focus:outline-none focus:border-[#1a0f00]/55" />
                <button type="button" onClick={submitClaim} disabled={claimBusy || !emailInput.trim()} className="flex-shrink-0 px-4 py-2 bg-[#1a0f00] text-white font-bold text-[12.5px] rounded-lg hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-50">{claimBusy ? "…" : t("account.sendLink")}</button>
              </div>
            </div>
          )}

          {ownerId && (
            <details className="mt-4">
              <summary className="cursor-pointer list-none text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/45 hover:text-[#1a0f00]/65">{t("account.ownerId")}</summary>
              <div className="mt-2 flex items-center justify-between gap-2">
                <code className="font-mono text-[11px] text-[#1a0f00]/75 truncate">{ownerId}</code>
                <button type="button" onClick={() => navigator.clipboard?.writeText(ownerId)} className="flex-shrink-0 text-[11px] font-semibold text-[#1a0f00]/65 hover:text-[#1a0f00] underline">{t("common.copy")}</button>
              </div>
            </details>
          )}
        </section>

        {/* Card 2 — Stripe Connect */}
        <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Icon.Bank className="w-4 h-4 text-[#635BFF]" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#1a0f00]/45">{t("account.acceptPayments")}</p>
          </div>

          {!me?.email ? (
            <div className="rounded-xl bg-[#1a0f00]/4 border border-[#1a0f00]/10 p-4 flex items-start gap-2.5">
              <Icon.Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#1a0f00]/40" />
              <p className="text-[12.5px] text-[#1a0f00]/65 leading-relaxed">{t("account.claimFirst")}</p>
            </div>
          ) : (
            <>
              {stripeStatus?.chargesEnabled ? (
                <div className="rounded-xl bg-[#635BFF]/8 border border-[#635BFF]/25 p-4">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#635BFF]">{t("account.stripeConnected")}</p>
                    <span className="text-[10px] font-mono text-[#1a0f00]/50">{stripeStatus.country ?? "—"}</span>
                  </div>
                  <code className="block font-mono text-[11.5px] text-[#1a0f00]/75 break-all mb-1">{stripeStatus.accountId}</code>
                  <p className="text-[11.5px] text-[#1a0f00]/55">{t("account.buyersCanPrepay")}</p>
                </div>
              ) : stripeStatus?.connected ? (
                <div className="rounded-xl bg-[#fffd43]/15 border border-[#1a0f00]/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/65 mb-1.5">{t("account.onboardingIncomplete")}</p>
                  <p className="text-[12px] text-[#1a0f00]/65 leading-relaxed mb-3">{t("account.kycPending")}</p>
                  <button type="button" onClick={startStripeConnect} disabled={stripeBusy} className="px-4 py-2 bg-[#1a0f00] text-white font-bold text-[12.5px] rounded-lg hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-50">{stripeBusy ? t("account.openingStripe") : t("account.resumeOnboarding")}</button>
                </div>
              ) : (
                <div>
                  <p className="text-[12.5px] text-[#1a0f00]/70 leading-relaxed mb-3">{t("account.connectIntro")}</p>
                  <button type="button" onClick={startStripeConnect} disabled={stripeBusy} className="px-4 py-2 bg-[#635BFF] text-white font-bold text-[12.5px] rounded-lg hover:bg-[#7A73FF] transition-colors disabled:opacity-50">{stripeBusy ? t("account.openingStripe") : t("account.connectStripe")}</button>
                </div>
              )}
              {stripeErr && <p className="mt-3 text-[12px] text-[#DC2626] break-words">{t("account.stripeErrorPrefix", { error: stripeErr })}</p>}
            </>
          )}
        </section>
      </div>
    </>
  );
}

function AddPane({ endpoints, goTo, api, paymentsReady }: { endpoints: Endpoint[]; goTo: (p: Pane, opts?: { endpointId?: string }) => void; api: Api; paymentsReady: boolean }) {
  // Empty by default — the placeholder shows the example. The user types
  // their own. (Pricing / budget / rate keep real defaults since those are
  // sensible starting values, not example labels.)
  const { t } = useT();
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
      setVerify({ kind: "error", message: t("add.verifyEnterUrl") });
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
      const message = e instanceof Error ? e.message : t("test.networkError");
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
    if (!apiName.trim()) return setErr(t("add.errName"));
    if (!/^https?:\/\//.test(apiUrl)) return setErr(t("add.errUrl"));
    if (priceNum <= 0) return setErr(t("add.errPrice"));
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
      setErr(e instanceof Error ? e.message : t("add.errCreate"));
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
    ? t("add.creating")
    : ctaState === "no_url"        ? t("add.ctaNoUrl")
      : ctaState === "needs_verify" ? t("add.ctaVerify")
        : t("add.ctaCreate");
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
        paymentsReady={paymentsReady}
        onConnectStripe={() => goTo("account")}
        onIssueToken={() => goTo("paytoken", { endpointId: created.id })}
        onTest={() => goTo("test", { endpointId: created.id })}
        onCreateAnother={() => { setCreated(null); setVerify(null); }}
      />
    );
  }

  return (
    <>
      <PaneHeading
        eyebrow={endpoints.length === 0 ? t("add.eyebrowWelcome") : t("add.eyebrowNew")}
        title={endpoints.length === 0 ? t("add.titleFirst") : t("add.titleAnother")}
        subtitle={t("add.subtitle")}
      />

      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {(["add.chipMetering", "add.chipPayTokens", "add.chipLedger", "add.chipAccess", "add.chipCheckout"] as const).map((key) => (
          <span key={key} className="inline-flex items-center gap-1.5 text-[11.5px] text-[#1a0f00]/75">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-[#16A34A]/15 text-[#16A34A] text-[9px] font-black">✓</span>
            {t(key)}
          </span>
        ))}
      </div>
      <p className="mb-6 text-[10.5px] text-[#1a0f00]/45 leading-snug">
        {t("add.intro")}
      </p>

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-5">
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
          <div className="space-y-5">
            <Field label={t("add.fieldName")}>
              <input type="text" value={apiName} onChange={(e) => setApiName(e.target.value)} placeholder={t("add.phName")} className="w-full px-3.5 py-2.5 bg-white border border-[#1a0f00]/15 rounded-xl text-[13.5px] focus:outline-none focus:border-[#1a0f00]/55 transition-colors" />
            </Field>
            <Field label={t("add.fieldUrl")}>
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
                  {verify?.kind === "loading" ? "…" : t("add.verify")}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed">
                {!verify && <span className="text-[#1a0f00]/45">{t("add.verifyHint")}</span>}
                {verify?.kind === "ok" && <span className="text-[#16A34A]">{t("add.verifyOk", { status: verify.status, ms: verify.ms })}</span>}
                {verify?.kind === "fail" && <span className="text-[#DC2626]">{t("add.verifyFail", { status: verify.status, ms: verify.ms })}</span>}
                {verify?.kind === "error" && <span className="text-[#DC2626]">{t("add.verifyError", { message: verify.message })}</span>}
              </p>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("add.fieldPrice")}>
                <DollarInput value={pricePerCall} onChange={setPricePerCall} step="0.001" />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-[#1a0f00]/45 self-center mr-1">{t("add.suggested")}</span>
                  {([
                    ["0.001", "add.tagLog"],
                    ["0.01",  "add.tagSearch"],
                    ["0.05",  "add.tagExtraction"],
                    ["0.20",  "add.tagResearch"],
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
                      ${v} <span className="font-sans font-normal opacity-65">{t(label)}</span>
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={t("add.fieldBudget")} hintBelow={t("add.fieldBudgetHint")}><DollarInput value={tokenBudget} onChange={setTokenBudget} step="0.50" /></Field>
            </div>
            <Field label={t("add.fieldRate")} hintBelow={t("add.fieldRateHint")}>
              <div className="flex items-center bg-white border border-[#1a0f00]/15 rounded-xl focus-within:border-[#1a0f00]/55 transition-colors">
                <input
                  type="number" step="10" min="1" value={rateLimit}
                  onChange={(e) => setRateLimit(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-transparent text-[13.5px] focus:outline-none"
                />
                <span className="pr-3.5 text-[12.5px] text-[#1a0f00]/45 font-mono whitespace-nowrap">{t("add.requestsPerMin")}</span>
              </div>
            </Field>
            <Field
              label={t("add.fieldAuth")}
              hint={t("add.fieldAuthHint")}
              hintBelow={t("add.fieldAuthHintBelow")}
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
            {t("add.nextHint")}
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
  const { t } = useT();
  return (
    <aside className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 lg:sticky lg:top-20 self-start">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">{t("preview.title")}</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-[#16A34A]"><span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> {t("preview.ready")}</span>
      </div>

      {/* Step 1 — Gateway endpoint */}
      <PreviewStep n={1} title={t("preview.step1")}>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1a0f00]/12 bg-[#fffd43]/12 px-3 py-2.5">
          <code className="font-mono text-[11.5px] text-[#1a0f00] break-all truncate">{previewUrl}</code>
          <button type="button" onClick={() => navigator.clipboard?.writeText(previewUrl)} className="flex-shrink-0 p-1 rounded hover:bg-[#1a0f00]/8 transition-colors text-[#1a0f00]/55" aria-label={t("apis.copyGatewayTitle")}>
            <Icon.Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="mt-1.5 text-[10.5px] text-[#1a0f00]/55 leading-snug">
          {t("preview.slugNote", { slug: previewSlug })}{slugConflict ? t("preview.slugRenamed", { raw: rawSlug }) : ""}{t("preview.slugAssigned")}<code className="font-mono">{apiUrl || "—"}</code>{t("preview.proxiesEnd")}
        </p>
      </PreviewStep>

      {/* Step 2 — Pay Token rules */}
      <PreviewStep n={2} title={t("preview.step2")}>
        <div className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-3 space-y-1">
          <RevRow k={t("preview.maxSpend")} v={fmtUsd(tokenBudget)} />
          <RevRow k={t("preview.rateLimit")} v={t("test.rateLimitFmt", { n: rateLimit })} />
          <RevRow k={t("preview.perCallPrice")} v={fmtUsd(pricePerCall)} />
          <RevRow k={t("preview.expiresIn")} v={t("preview.expiresVal")} muted />
        </div>
        <p className="mt-1.5 text-[10.5px] text-[#1a0f00]/55 leading-snug">
          {t("preview.jwtNotePre")}<code className="font-mono">Authorization: Bearer</code>{t("preview.jwtNotePost")}
        </p>
      </PreviewStep>

      {/* Step 3 — Test call */}
      <PreviewStep n={3} title={t("preview.step3")}>
        <div className="rounded-lg bg-[#1a0f00] text-white p-2.5 text-[10.5px] font-mono leading-relaxed">
          curl -X POST {previewUrl} \<br />
          &nbsp;&nbsp;-H &quot;Authorization: Bearer &lt;PAY_TOKEN&gt;&quot;
        </div>
        <div className="mt-2 rounded-xl bg-[#16A34A]/8 border border-[#16A34A]/25 p-3 space-y-1 font-mono text-[11px]">
          <RevRow k="HTTP" v="200 OK" highlight />
          <RevRow k="x-lemoncake-charge" v={fmtUsd(pricePerCall)} />
          <RevRow k={t("preview.remainingBudget")} v={fmtUsd(Math.max(0, tokenBudget - pricePerCall))} muted />
        </div>
        <p className="mt-1.5 text-[10.5px] text-[#1a0f00]/55 leading-snug">
          {t("preview.ledgerNotePre")}<code className="font-mono text-[10px] bg-[#1a0f00]/6 px-1 rounded">{"{\"error\": \"spend_cap_exceeded\"}"}</code>{t("preview.ledgerNotePost")}
        </p>
      </PreviewStep>

      {/* Usage ledger estimate */}
      <div className="mt-5 pt-4 border-t border-[#1a0f00]/8">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11.5px] font-semibold text-[#1a0f00]/75">{t("preview.estTitle")}</p>
          <div className="relative">
            <select value={estCalls} onChange={(e) => setEstCalls(Number(e.target.value) as 1000 | 10000 | 100000)} className="appearance-none pl-3 pr-7 py-1 bg-white border border-[#1a0f00]/15 rounded-lg text-[11px] focus:outline-none focus:border-[#1a0f00]/55">
              <option value={1000}>{t("preview.calls1k")}</option>
              <option value={10000}>{t("preview.calls10k")}</option>
              <option value={100000}>{t("preview.calls100k")}</option>
            </select>
            <Icon.ChevDn className="w-3 h-3 text-[#1a0f00]/45 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
        <div className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-3 space-y-1">
          <RevRow k={t("preview.gross")} v={fmtUsd(estRev)} />
          <RevRow k={t("preview.feeRow")} v={`-${fmtUsd(estFee)}`} muted />
          <div className="h-px bg-[#1a0f00]/8 my-1" />
          <RevRow k={t("preview.youReceive")} v={fmtUsd(estNet)} highlight />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#1a0f00]/50">
          <Icon.Bank className="w-3 h-3" />
          {t("preview.meterNote")}
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
  endpoint, paymentsReady, onConnectStripe, onIssueToken, onTest, onCreateAnother,
}: {
  endpoint: Endpoint;
  paymentsReady: boolean;
  onConnectStripe: () => void;
  onIssueToken: () => void;
  onTest: () => void;
  onCreateAnother: () => void;
}) {
  const { t } = useT();
  const url = gatewayUrlOf(endpoint.shortId);
  const buyUrl = buyUrlOf(endpoint.shortId);
  const isPriced = endpoint.pricePerCall > 0;
  return (
    <>
      <div className="mb-6 flex items-start gap-3">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#16A34A] text-white text-[16px] font-black flex-shrink-0">✓</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-[#16A34A] uppercase tracking-widest mb-1">{t("created.live")}</p>
          <h1 className="text-[26px] md:text-[30px] font-black leading-[1.15] tracking-tight">{t("created.title")}</h1>
          <p className="mt-2 text-[13px] text-[#1a0f00]/60">
            <code className="font-mono text-[12px] bg-[#1a0f00]/6 px-1.5 py-0.5 rounded">{endpoint.name}</code> {t("created.subtitleRest")}
          </p>
        </div>
      </div>

      {isPriced && (
        <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6 mb-5">
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">{t("apis.buyLink")}</p>
            <span className="text-[10px] text-[#1a0f00]/45">{t("apis.buyLinkHint")}</span>
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1a0f00]/12 bg-[#fffd43]/15 px-3 py-3">
            <code className="font-mono text-[13px] text-[#1a0f00] break-all">{buyUrl}</code>
            <div className="flex-shrink-0 flex items-center gap-1.5">
              <button type="button" onClick={() => navigator.clipboard?.writeText(buyUrl)} className="px-3 py-1.5 bg-white border border-[#1a0f00]/15 text-[12px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors">{t("common.copy")}</button>
              <a href={buyUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-[#1a0f00]/15 text-[12px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors"><Icon.External className="w-3.5 h-3.5" /> {t("common.open")}</a>
            </div>
          </div>
          {!paymentsReady && (
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#1a0f00]/4 border border-[#1a0f00]/10 p-3">
              <Icon.Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#1a0f00]/40" />
              <p className="text-[11.5px] text-[#1a0f00]/65 leading-relaxed">
                {t("created.notReadyText")}{" "}
                <button type="button" onClick={onConnectStripe} className="font-semibold text-[#1a0f00] underline underline-offset-2">{t("created.connectStripeAccount")}</button>
              </p>
            </div>
          )}
        </section>
      )}

      <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6 mb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">{t("created.gatewayUrl")} <span className="font-normal normal-case tracking-normal text-[#1a0f00]/45">{t("created.gatewayUrlSub")}</span></p>
        <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1a0f00]/12 bg-[#fafaf7] px-3 py-3 mb-5">
          <code className="font-mono text-[13px] text-[#1a0f00] break-all">{url}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(url)}
            className="flex-shrink-0 px-3 py-1.5 bg-white border border-[#1a0f00]/15 text-[12px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors"
          >
            {t("common.copy")}
          </button>
        </div>

        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">{t("created.protection")}</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px] mb-5">
          {[
            [t("created.protPayToken"),  t("created.protPayTokenSub")],
            [t("created.protSpendCap"),  t("created.protSpendCapSub", { max: fmtUsd(endpoint.tokenBudget) })],
            [t("created.protRate"),      t("created.protRateSub", { n: endpoint.rateLimit })],
            [t("created.protLedger"),    t("created.protLedgerSub")],
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

        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">{t("created.nextStep")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {isPriced && (
            <button type="button" onClick={() => navigator.clipboard?.writeText(buyUrl)} className="inline-flex items-center gap-2 px-4 py-2 bg-[#fffd43] hover:bg-[#fff070] text-[#1a0f00] font-bold text-[13px] rounded-lg transition-colors shadow-[0_1px_0_rgba(26,15,0,0.15)]">
              <Icon.Copy className="w-3.5 h-3.5" /> {t("created.copyBuyLink")}
            </button>
          )}
          <button type="button" onClick={onTest} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold text-[13px] rounded-lg hover:bg-[#1a0f00]/[0.03] transition-colors">
            <Icon.Play className="w-3.5 h-3.5" /> {t("created.sendTest")}
          </button>
          <button type="button" onClick={onIssueToken} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold text-[13px] rounded-lg hover:bg-[#1a0f00]/[0.03] transition-colors">
            <Icon.Key className="w-3.5 h-3.5" /> {t("created.issueTest")}
          </button>
          <div className="flex-1" />
          <button type="button" onClick={onCreateAnother} className="text-[12px] text-[#1a0f00]/55 hover:text-[#1a0f00] underline underline-offset-2">
            {t("created.createAnother")}
          </button>
        </div>
      </section>

      <ShareKit endpoint={endpoint} />

      <section className="rounded-2xl bg-[#1a0f00]/3 border border-[#1a0f00]/8 p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">{t("created.summary")}</p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[12px]">
          <div><dt className="text-[10px] uppercase tracking-widest text-[#1a0f00]/45 mb-0.5">{t("created.sumPrice")}</dt><dd className="font-bold">{fmtUsd(endpoint.pricePerCall)} <span className="text-[10px] text-[#1a0f00]/45 font-normal">{t("apis.perCall")}</span></dd></div>
          <div><dt className="text-[10px] uppercase tracking-widest text-[#1a0f00]/45 mb-0.5">{t("created.sumSpendCap")}</dt><dd className="font-bold">{fmtUsd(endpoint.tokenBudget)} <span className="text-[10px] text-[#1a0f00]/45 font-normal">{t("apis.perToken")}</span></dd></div>
          <div><dt className="text-[10px] uppercase tracking-widest text-[#1a0f00]/45 mb-0.5">{t("created.sumRate")}</dt><dd className="font-bold">{endpoint.rateLimit} <span className="text-[10px] text-[#1a0f00]/45 font-normal">{t("apis.reqMin")}</span></dd></div>
          <div><dt className="text-[10px] uppercase tracking-widest text-[#1a0f00]/45 mb-0.5">{t("created.sumAuth")}</dt><dd className="font-bold">{endpoint.upstreamAuth ? t("created.setCheck") : "—"}</dd></div>
        </dl>
      </section>
    </>
  );
}

/* ─── Share Kit + Submit to Directory (shown on the success screen) ─── */

type GrowthShareType =
  | "copy_gateway_url"
  | "copy_curl"
  | "copy_readme_badge"
  | "copy_x_post"
  | "copy_docs_snippet"
  | "copy_mcp_listing"
  | "submit_directory";

function ShareKit({ endpoint }: { endpoint: Endpoint }) {
  const { t } = useT();
  const pSlug = endpoint.publicSlug || endpoint.shortId;
  const apiId = endpoint.shortId;
  const publicUrl = publicPageUrl(pSlug);
  const badge = badgeUrlOf(apiId);

  const snippets = {
    readme: readmeBadgeMarkdown({ apiId, slug: pSlug }),
    curl: curlExample({ shortId: endpoint.shortId }),
    docs: docsSnippet({ name: endpoint.name, description: endpoint.publicDescription, shortId: endpoint.shortId, price: endpoint.pricePerCall, slug: pSlug }),
    xpost: xPostText({ name: endpoint.name, price: endpoint.pricePerCall, slug: pSlug }),
    mcp: mcpListingText({ name: endpoint.name, description: endpoint.publicDescription, shortId: endpoint.shortId, price: endpoint.pricePerCall, slug: pSlug }),
  };

  const [copied, setCopied] = useState<string | null>(null);

  // directory form
  const [category, setCategory] = useState<string>(endpoint.category || "");
  const [description, setDescription] = useState<string>(endpoint.publicDescription || "");
  const [submitting, setSubmitting] = useState(false);
  const [dirStatus, setDirStatus] = useState<Endpoint["directoryStatus"]>(endpoint.directoryStatus || "none");
  const [dirError, setDirError] = useState<string | null>(null);

  function track(shareType: GrowthShareType) {
    try {
      void fetch("/api/lc/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ shareType, endpointId: endpoint.id, slug: pSlug, shortId: endpoint.shortId }),
      });
    } catch {
      /* analytics best-effort */
    }
  }

  async function copy(text: string, key: string, shareType: GrowthShareType) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
      track(shareType);
    } catch {
      /* clipboard blocked */
    }
  }

  async function submitDirectory() {
    if (!category || submitting) return;
    setSubmitting(true);
    setDirError(null);
    try {
      const res = await fetch("/api/lc/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointId: endpoint.id, category, description: description.trim() || undefined }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setDirError(json?.error || t("share.errSubmit"));
        return;
      }
      setDirStatus("pending");
    } catch {
      setDirError(t("share.errNetwork"));
    } finally {
      setSubmitting(false);
    }
  }

  const fields: { key: string; label: string; text: string; share: GrowthShareType; mono?: boolean }[] = [
    { key: "readme", label: t("share.fReadme"), text: snippets.readme, share: "copy_readme_badge", mono: true },
    { key: "curl", label: t("share.fCurl"), text: snippets.curl, share: "copy_curl", mono: true },
    { key: "docs", label: t("share.fDocs"), text: snippets.docs, share: "copy_docs_snippet", mono: true },
    { key: "xpost", label: t("share.fXpost"), text: snippets.xpost, share: "copy_x_post" },
    { key: "mcp", label: t("share.fMcp"), text: snippets.mcp, share: "copy_mcp_listing" },
  ];

  return (
    <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6 mb-5">
      {/* Public API page URL */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">{t("share.publicPage")}</p>
      <div className="flex items-center justify-between gap-2 rounded-xl border border-[#1a0f00]/12 bg-[#fafaf7] px-3 py-3 mb-1.5">
        <code className="font-mono text-[13px] text-[#1a0f00] break-all">{publicUrl}</code>
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <button type="button" onClick={() => copy(publicUrl, "purl", "copy_gateway_url")} className="px-3 py-1.5 bg-white border border-[#1a0f00]/15 text-[12px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors">{copied === "purl" ? t("common.copied") : t("common.copy")}</button>
          <a href={publicUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-[#1a0f00]/15 text-[12px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors"><Icon.External className="w-3.5 h-3.5" /> {t("common.open")}</a>
        </div>
      </div>
      <p className="text-[11px] text-[#1a0f00]/50 mb-6">{t("share.publicPageNote")}</p>

      {/* Share kit */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-1">{t("share.title")}</p>
      <p className="text-[12px] text-[#1a0f00]/60 mb-4">{t("share.subtitle")}</p>

      {/* badge preview */}
      <div className="flex items-center gap-2 mb-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={badge} alt="Paid access powered by LemonCake" className="h-5" />
        <span className="text-[11px] text-[#1a0f00]/45">{t("share.badgeHint")}</span>
      </div>

      <div className="flex flex-col gap-3 mb-6">
        {fields.map((f) => (
          <div key={f.key}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[11.5px] font-bold text-[#1a0f00]/70">{f.label}</p>
              <button type="button" onClick={() => copy(f.text, f.key, f.share)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors">
                <Icon.Copy className="w-3.5 h-3.5" />{copied === f.key ? t("common.copied") : t("common.copy")}
              </button>
            </div>
            <pre className={`rounded-xl border border-[#1a0f00]/10 bg-[#fafaf7] p-3 text-[10.5px] leading-relaxed overflow-x-auto whitespace-pre-wrap break-words ${f.mono ? "font-mono text-[#1a0f00]/75" : "text-[#1a0f00]/75"}`}>{f.text}</pre>
          </div>
        ))}
      </div>

      {/* Submit to Directory */}
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">{t("share.dirTitle")}</p>
      {dirStatus === "pending" ? (
        <div className="rounded-xl bg-[#fffbe6] border border-[#1a0f00]/12 px-3 py-3 text-[12.5px] text-[#1a0f00]/70">
          <b>{t("share.dirPendingBold")}</b>{t("share.dirPendingPre")}<Link href="/directory" className="underline underline-offset-2">{t("share.directoryWord")}</Link>{t("share.dirPendingPost")}
        </div>
      ) : dirStatus === "approved" ? (
        <div className="rounded-xl bg-[#F0FDF4] border border-[#16A34A]/20 px-3 py-3 text-[12.5px] text-[#16A34A]">
          <b>{t("share.dirApprovedBold")}</b> <Link href="/directory" className="underline underline-offset-2 text-[#16A34A]">{t("share.dirViewIt")}</Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[#1a0f00]/12 bg-[#fafaf7] p-4">
          <div className="grid sm:grid-cols-[180px_1fr] gap-3 mb-3">
            <div>
              <label className="text-[11px] font-semibold text-[#1a0f00]/60 block mb-1">{t("share.category")}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#1a0f00]/15 bg-white text-[13px] text-[#1a0f00] focus:outline-none focus:border-[#1a0f00]/40"
              >
                <option value="">{t("share.selectCategory")}</option>
                {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[#1a0f00]/60 block mb-1">{t("share.shortDesc")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder={t("share.descPlaceholder")}
                className="w-full px-3 py-2 rounded-lg border border-[#1a0f00]/15 bg-white text-[13px] text-[#1a0f00] resize-none focus:outline-none focus:border-[#1a0f00]/40"
              />
            </div>
          </div>
          {dirError && <p className="text-[11.5px] text-[#DC2626] mb-2">{dirError}</p>}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={submitDirectory}
              disabled={!category || submitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a0f00] text-[#fffd43] font-bold text-[13px] rounded-lg hover:bg-[#1a0f00]/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? t("share.submitting") : t("share.submitButton")}
            </button>
            <p className="text-[11px] text-[#1a0f00]/45">{t("share.adminNote")}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function ApisPane({ endpoints, tokens, runs, api, goTo, paymentsReady }: { endpoints: Endpoint[]; tokens: PayToken[]; runs: TestRun[]; api: Api; goTo: (p: Pane, opts?: { endpointId?: string }) => void; paymentsReady: boolean }) {
  const { t } = useT();
  if (endpoints.length === 0) {
    return (
      <>
        <PaneHeading eyebrow={t("apis.eyebrow")} title={t("apis.emptyTitle")} subtitle={t("apis.emptySubtitle")} />
        <EmptyState actionLabel={t("apis.emptyAction")} onAction={() => goTo("add")} hint={t("apis.emptyHint")} />
      </>
    );
  }
  return (
    <>
      <PaneHeading
        eyebrow={t("apis.eyebrow")}
        title={t("apis.title")}
        subtitle={t("apis.subtitle", { total: endpoints.length, live: endpoints.filter((e) => e.status === "live").length })}
        action={<button type="button" onClick={() => goTo("add")} className="px-3 py-1.5 bg-[#1a0f00] text-white text-[12px] font-semibold rounded-lg hover:bg-[#1a0f00]/90">{t("apis.addApi")}</button>}
      />
      <div className="space-y-3">
        {endpoints.map((e) => {
          const tokensForThis    = tokens.filter((t) => t.endpointId === e.id && t.status === "active").length;
          const callsForThis     = runs.filter((r) => r.endpointId === e.id).length;
          const purchasedForThis = tokens.filter((t) => t.endpointId === e.id && t.source === "purchase");
          const soldGross        = purchasedForThis.reduce((a, t) => a + t.budget, 0);
          const soldNet          = soldGross * 0.97;
          const url              = gatewayUrlOf(e.shortId);
          const buyUrl           = buyUrlOf(e.shortId);
          const isPriced         = e.pricePerCall > 0;
          return (
            <div key={e.id} className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="text-[15px] font-bold">{e.name}</h3>
                    <StatusPill status={e.status} />
                    {e.upstreamAuth && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/60 bg-[#1a0f00]/6 px-1.5 py-0.5 rounded" title={t("apis.authForwarded", { auth: maskAuth(e.upstreamAuth) })}>
                        <Icon.Lock className="w-2.5 h-2.5" /> {t("apis.authBadge")}
                      </span>
                    )}
                  </div>
                  <code className="block font-mono text-[11.5px] text-[#1a0f00]/75 break-all">{url}</code>
                  <p className="font-mono text-[10.5px] text-[#1a0f00]/40 mt-0.5">→ {e.originalUrl}</p>
                </div>
                <div className="flex items-center gap-1">
                  <IconButton title={t("apis.copyGatewayTitle")} onClick={() => navigator.clipboard?.writeText(url)}><Icon.Copy className="w-3.5 h-3.5" /></IconButton>
                  <IconButton title={e.status === "live" ? t("apis.actionPause") : t("apis.actionResume")} onClick={() => api.setStatus(e.id, e.status === "live" ? "paused" : "live")}>
                    {e.status === "live" ? <Icon.Pause className="w-3.5 h-3.5" /> : <Icon.Refresh className="w-3.5 h-3.5" />}
                  </IconButton>
                  <IconButton title={t("apis.deleteTitle")} tone="danger" onClick={() => { if (confirm(t("apis.deleteConfirm", { name: e.name }))) api.deleteEndpoint(e.id); }}><Icon.Trash className="w-3.5 h-3.5" /></IconButton>
                </div>
              </div>

              {/* Buy link — the post-pivot share artifact. Buyers prepay here and
                  get a Pay Token automatically; the seller never hand-issues. */}
              {isPriced ? (
                <div className="mt-4 rounded-xl border border-[#1a0f00]/12 bg-[#fffd43]/12 p-3.5">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">{t("apis.buyLink")}</p>
                    <span className="text-[10px] text-[#1a0f00]/45">{t("apis.buyLinkHint")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 font-mono text-[12px] text-[#1a0f00] break-all truncate">{buyUrl}</code>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(buyUrl)} className="flex-shrink-0 px-2.5 py-1 bg-white border border-[#1a0f00]/15 text-[11px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors">{t("common.copy")}</button>
                    <a href={buyUrl} target="_blank" rel="noopener" className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#1a0f00]/15 text-[11px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors"><Icon.External className="w-3 h-3" /> {t("common.open")}</a>
                  </div>
                  {!paymentsReady && (
                    <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[#1a0f00]/55 leading-snug">
                      <Icon.Lock className="w-3 h-3 flex-shrink-0" />
                      {t("apis.connectStripeCta")}
                      <button type="button" onClick={() => goTo("account")} className="font-semibold text-[#1a0f00] underline underline-offset-2">{t("apis.finishInAccount")}</button>
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-[#1a0f00]/10 bg-[#fafaf7] px-3.5 py-2.5 text-[11px] text-[#1a0f00]/55 leading-snug">
                  {t("apis.freeEndpoint")}
                </p>
              )}

              <dl className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
                <Stat label={t("apis.statPrice")} v={fmtUsd(e.pricePerCall)} suf={t("apis.perCall")} />
                <Stat label={t("apis.statRateLimit")} v={String(e.rateLimit)} suf={t("apis.reqMin")} />
                <Stat label={t("apis.statSpendCap")} v={fmtUsd(e.tokenBudget)} suf={t("apis.perToken")} />
                <Stat label={t("apis.statUpstreamAuth")} v={e.upstreamAuth ? t("common.set") : "—"} suf={e.upstreamAuth ? "✓" : undefined} />
                <Stat label={t("apis.statCreated")} v={timeAgo(e.createdAt)} />
              </dl>
              <div className="mt-4 pt-4 border-t border-[#1a0f00]/6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-[#1a0f00]/65">
                <span><span className="font-semibold text-[#1a0f00]">{purchasedForThis.length}</span> {t("apis.purchasesLabel")}</span>
                <span><span className="font-semibold text-[#16A34A]">{fmtUsd(soldNet)}</span> {t("apis.earnedNetLabel")}</span>
                <span><span className="font-semibold text-[#1a0f00]">{tokensForThis}</span> {t("apis.activeTokensLabel")}</span>
                <span><span className="font-semibold text-[#1a0f00]">{callsForThis}</span> {t("apis.callsLabel")}</span>
                <div className="flex-1" />
                <button type="button" onClick={() => goTo("paytoken", { endpointId: e.id })} className="text-[11.5px] font-semibold text-[#1a0f00] hover:underline">{t("apis.issueTestToken")}</button>
                <button type="button" onClick={() => goTo("test", { endpointId: e.id })} className="text-[11.5px] font-semibold text-[#1a0f00] hover:underline">{t("apis.testRequest")}</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* Buy links — the post-pivot go-to-market surface. One public prepaid-purchase
   page per priced endpoint; sellers copy/share these and buyers self-serve. */
function BuyLinksPane({ endpoints, tokens, goTo, paymentsReady }: { endpoints: Endpoint[]; tokens: PayToken[]; goTo: (p: Pane, opts?: { endpointId?: string }) => void; paymentsReady: boolean }) {
  const { t } = useT();
  const priced = endpoints.filter((e) => e.pricePerCall > 0);
  const free   = endpoints.filter((e) => e.pricePerCall <= 0);

  if (endpoints.length === 0) {
    return (
      <>
        <PaneHeading eyebrow={t("buy.eyebrow")} title={t("buy.title")} subtitle={t("buy.emptySubtitle")} />
        <EmptyState actionLabel={t("apis.emptyAction")} onAction={() => goTo("add")} hint={t("buy.emptyHint")} />
      </>
    );
  }

  return (
    <>
      <PaneHeading
        eyebrow={t("buy.eyebrow")}
        title={t("buy.title")}
        subtitle={t("buy.subtitle")}
        action={<button type="button" onClick={() => goTo("add")} className="px-3 py-1.5 bg-[#1a0f00] text-white text-[12px] font-semibold rounded-lg hover:bg-[#1a0f00]/90">{t("apis.addApi")}</button>}
      />

      {!paymentsReady && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#635BFF]/25 bg-[#635BFF]/6 p-4">
          <Icon.Bank className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#635BFF]" />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-bold text-[#1a0f00]">{t("buy.connectBannerTitle")}</p>
            <p className="text-[11.5px] text-[#1a0f00]/60 leading-snug mt-0.5">{t("buy.connectBannerBody")}</p>
          </div>
          <button type="button" onClick={() => goTo("account")} className="flex-shrink-0 px-3.5 py-2 bg-[#635BFF] text-white font-bold text-[12px] rounded-lg hover:bg-[#7A73FF] transition-colors">{t("account.connectStripe")}</button>
        </div>
      )}

      {priced.length > 0 ? (
        <div className="space-y-3">
          {priced.map((e) => {
            const buyUrl    = buyUrlOf(e.shortId);
            const purchases = tokens.filter((t) => t.endpointId === e.id && t.source === "purchase");
            const soldGross = purchases.reduce((a, t) => a + t.budget, 0);
            const soldNet   = soldGross * 0.97;
            const isLive    = e.status === "live";
            return (
              <div key={e.id} className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <h3 className="text-[15px] font-bold">{e.name}</h3>
                  <StatusPill status={e.status} />
                  <span className="text-[11px] text-[#1a0f00]/50">{fmtUsd(e.pricePerCall)} {t("apis.perCall")}</span>
                </div>

                {!isLive && (
                  <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 leading-snug">
                    {t("buy.pausedNotice")}
                  </p>
                )}

                <div className="rounded-xl border border-[#1a0f00]/12 bg-[#fffd43]/12 p-3.5">
                  <div className="flex items-baseline justify-between gap-2 mb-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">{t("apis.buyLink")}</p>
                    <span className="text-[10px] text-[#1a0f00]/45">{t("apis.buyLinkHint")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 min-w-0 font-mono text-[12px] text-[#1a0f00] break-all truncate">{buyUrl}</code>
                    <button type="button" onClick={() => navigator.clipboard?.writeText(buyUrl)} className="flex-shrink-0 px-2.5 py-1 bg-white border border-[#1a0f00]/15 text-[11px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors">{t("common.copy")}</button>
                    <a href={buyUrl} target="_blank" rel="noopener" className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#1a0f00]/15 text-[11px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors"><Icon.External className="w-3 h-3" /> {t("common.open")}</a>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-[#1a0f00]/6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11.5px] text-[#1a0f00]/65">
                  <span><span className="font-semibold text-[#1a0f00]">{purchases.length}</span> {t("apis.purchasesLabel")}</span>
                  <span><span className="font-semibold text-[#16A34A]">{fmtUsd(soldNet)}</span> {t("apis.earnedNetLabel")}</span>
                  <div className="flex-1" />
                  <button type="button" onClick={() => goTo("revenue")} className="text-[11.5px] font-semibold text-[#1a0f00] hover:underline">{t("buy.viewSales")}</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-dashed border-[#1a0f00]/15 p-8 text-center">
          <p className="text-[13px] font-semibold text-[#1a0f00]/70">{t("buy.noSellableTitle")}</p>
          <p className="mt-1.5 text-[11.5px] text-[#1a0f00]/50 leading-relaxed max-w-[440px] mx-auto">{t("buy.noSellableBody")}</p>
        </div>
      )}

      {free.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[#1a0f00]/10 bg-[#fafaf7] p-4">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-2">{t("buy.freeHeading")}</p>
          <div className="flex flex-wrap gap-2">
            {free.map((e) => (
              <span key={e.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-[#1a0f00]/10 text-[11.5px] text-[#1a0f00]/65">
                {e.name} <span className="text-[#1a0f00]/35">{t("buy.freeTag")}</span>
              </span>
            ))}
          </div>
          <p className="mt-2.5 text-[10.5px] text-[#1a0f00]/45 leading-snug">{t("buy.freeNote")}</p>
        </div>
      )}
    </>
  );
}

function PayTokenPane({ endpoints, tokens, jwtById, api, goTo, preselectEndpointId }: { endpoints: Endpoint[]; tokens: PayToken[]; jwtById: Record<string, string>; api: Api; goTo: (p: Pane) => void; preselectEndpointId: string | null }) {
  const { t } = useT();
  const t2 = t; // alias: inside the `tokens.map((t) => …)` table below the row param `t` shadows the translate fn
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
  // Agent funding key (Buyer Key bk_) — issued once for the selected endpoint.
  const [agentKey, setAgentKey] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  type AgentKeyRow = { id: string; prefix: string; endpointShortId: string; status: string; cardSaved: boolean };
  const [agentKeys, setAgentKeys] = useState<AgentKeyRow[]>([]);

  const loadKeys = useCallback(async () => {
    try {
      const r = await fetch("/api/lc/agent/keys");
      const j = await r.json();
      if (r.ok && Array.isArray(j.keys)) setAgentKeys(j.keys);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (endpoints.length > 0 && !endpoints.find((e) => e.id === endpointId)) setEndpointId(endpoints[0].id);
  }, [endpoints, endpointId]);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const selectedEp = endpoints.find((e) => e.id === endpointId);
  const buyUrl = selectedEp ? buyUrlOf(selectedEp.shortId) : "";
  const purchasedCount = tokens.filter((t) => t.source === "purchase").length;
  const testCount = tokens.length - purchasedCount;

  if (endpoints.length === 0) {
    return (<>
      <PaneHeading eyebrow={t("pt.eyebrow")} title={t("pt.emptyTitle")} subtitle={t("pt.emptySubtitle")} />
      <EmptyState actionLabel={t("apis.emptyAction")} onAction={() => goTo("add")} />
    </>);
  }

  async function issue() {
    setErr(null);
    const b = Math.max(0, parseFloat(budget) || 0);
    const h = Math.max(1, parseInt(expires, 10) || 1);
    const m = Math.max(1, parseInt(maxCalls, 10) || 1);
    if (b <= 0) return setErr(t("pt.budgetError"));
    setBusy(true);
    try {
      const res = await api.issueToken({ endpointId, budget: b, expiresInHours: h, maxCalls: m });
      setJustIssued(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("pt.issueFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function genKey() {
    if (!selectedEp) return;
    setGenErr(null);
    setAgentKey(null);
    setGenBusy(true);
    try {
      const res = await fetch("/api/lc/agent/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpointShortId: selectedEp.shortId }),
      });
      const j = await res.json();
      if (!res.ok || !j.buyerKey) { setGenErr(j.error || "request_failed"); return; }
      setAgentKey(j.buyerKey as string);
      loadKeys();
    } catch {
      setGenErr("network_error");
    } finally {
      setGenBusy(false);
    }
  }

  async function revokeKey(id: string) {
    try {
      await fetch(`/api/lc/agent/keys/${id}/revoke`, { method: "POST" });
      loadKeys();
    } catch { /* ignore */ }
  }

  return (
    <>
      <PaneHeading eyebrow={t("pt.eyebrow")} title={t("pt.title")} subtitle={t("pt.subtitle")} />

      {selectedEp && selectedEp.pricePerCall > 0 && (
        <section className="rounded-2xl border border-[#1a0f00]/12 bg-[#fffd43]/12 p-4 mb-5">
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55">{t("pt.howBuyersTitle")}</p>
            <span className="text-[10px] text-[#1a0f00]/45">{selectedEp.name}</span>
          </div>
          <p className="text-[11.5px] text-[#1a0f00]/65 leading-relaxed mb-2">{t("pt.howBuyersBody")}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 font-mono text-[12px] text-[#1a0f00] break-all truncate">{buyUrl}</code>
            <button type="button" onClick={() => navigator.clipboard?.writeText(buyUrl)} className="flex-shrink-0 px-2.5 py-1 bg-white border border-[#1a0f00]/15 text-[11px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors">{t("common.copy")}</button>
            <a href={buyUrl} target="_blank" rel="noopener" className="flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-[#1a0f00]/15 text-[11px] font-semibold text-[#1a0f00]/75 hover:text-[#1a0f00] rounded-lg transition-colors"><Icon.External className="w-3 h-3" /> {t("common.open")}</a>
          </div>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
          <h3 className="text-[14px] font-bold mb-1">{t("pt.issueTitle")}</h3>
          <p className="text-[11.5px] text-[#1a0f00]/55 leading-snug mb-4">{t("pt.issueBody")}</p>
          <div className="space-y-4">
            <Field label={t("pt.fieldEndpoint")}>
              <Select value={endpointId} onChange={setEndpointId}>
                {endpoints.map((e) => <option key={e.id} value={e.id}>{e.name} · {e.slug}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label={t("pt.fieldBudget")} hint={t("pt.unitUsd")}><DollarInput value={budget} onChange={setBudget} step="0.50" /></Field>
              <Field label={t("pt.fieldExpires")} hint={t("pt.unitHours")}><input type="number" step="1" min="1" value={expires} onChange={(e) => setExpires(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#1a0f00]/15 rounded-lg text-[13px] focus:outline-none focus:border-[#1a0f00]/55" /></Field>
              <Field label={t("pt.fieldMaxCalls")}><input type="number" step="10" min="1" value={maxCalls} onChange={(e) => setMaxCalls(e.target.value)} className="w-full px-3 py-2 bg-white border border-[#1a0f00]/15 rounded-lg text-[13px] focus:outline-none focus:border-[#1a0f00]/55" /></Field>
            </div>
          </div>
          {err && <p className="mt-4 text-[12px] text-[#DC2626] bg-[#DC2626]/8 border border-[#DC2626]/25 rounded-lg px-3 py-2">{err}</p>}
          <button type="button" onClick={issue} disabled={busy} className="mt-5 w-full py-2.5 bg-[#1a0f00] text-white font-bold text-[13px] rounded-xl hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-60">{busy ? t("pt.issuing") : t("pt.issueButton")}</button>

          {justIssued && (
            <div className="mt-4 rounded-lg bg-[#16A34A]/8 border border-[#16A34A]/30 p-3">
              <p className="text-[12px] font-bold text-[#16A34A] mb-2">{t("pt.issuedTitle")}</p>
              <code className="block font-mono text-[10.5px] text-[#1a0f00]/85 break-all bg-white/60 border border-[#1a0f00]/8 rounded p-2 select-all">{justIssued.jwt}</code>
              <button type="button" onClick={() => navigator.clipboard?.writeText(justIssued.jwt)} className="mt-2 text-[11px] font-semibold text-[#1a0f00] hover:underline">{t("pt.copyJwt")}</button>
              <p className="mt-2 text-[10.5px] text-[#1a0f00]/55">{t("pt.tokenIdPrefix")}<code className="font-mono">{justIssued.token.id}</code>{t("pt.tokenIdSuffix")}</p>
            </div>
          )}
        </div>
        <aside className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">{t("pt.howWorkTitle")}</p>
          <ol className="text-[12px] text-[#1a0f00]/70 space-y-1.5 list-decimal pl-4">
            <li><span className="font-semibold">{t("pt.howWork1Bold")}</span>{t("pt.howWork1Rest")}</li>
            <li>{t("pt.howWork2pre")}<code className="font-mono text-[11px] bg-[#fafaf7] px-1 rounded">Authorization: Bearer &lt;jwt&gt;</code>{t("pt.howWork2post")}</li>
            <li>{t("pt.howWork3")}</li>
            <li>{t("pt.howWork4")}</li>
          </ol>
        </aside>
      </section>

      {/* Agent funding key (Buyer Key) — lets an agent top up off-session */}
      <section className="rounded-2xl border border-[#635BFF]/25 bg-[#635BFF]/6 p-6 mt-5">
        <h3 className="text-[14px] font-bold mb-1">{t("pt.agentTitle")}</h3>
        <p className="text-[11.5px] text-[#1a0f00]/60 leading-snug mb-3">{t("pt.agentBody")}</p>
        <button type="button" onClick={genKey} disabled={genBusy || !selectedEp} className="px-4 py-2 bg-[#635BFF] text-white font-bold text-[12.5px] rounded-lg hover:bg-[#7A73FF] transition-colors disabled:opacity-50">
          {genBusy ? "…" : t("pt.agentGenerate")}{selectedEp ? ` · ${selectedEp.name}` : ""}
        </button>
        {genErr && <p className="mt-2 text-[12px] text-[#DC2626]">{t("account.errorPrefix", { error: genErr })}</p>}
        {agentKey && (
          <div className="mt-3 rounded-lg bg-white border border-[#635BFF]/30 p-3">
            <p className="text-[12px] font-bold text-[#635BFF] mb-2">{t("pt.agentKeyShownOnce")}</p>
            <code className="block font-mono text-[11px] text-[#1a0f00]/85 break-all bg-[#fafaf7] border border-[#1a0f00]/8 rounded p-2 select-all">{agentKey}</code>
            <div className="mt-2 flex items-center gap-4">
              <button type="button" onClick={() => navigator.clipboard?.writeText(agentKey)} className="text-[11px] font-semibold text-[#1a0f00] hover:underline">{t("common.copy")}</button>
              <a href="/agent/fund" target="_blank" rel="noopener" className="text-[11px] font-semibold text-[#635BFF] hover:underline">{t("pt.agentSaveCard")}</a>
            </div>
          </div>
        )}

        {agentKeys.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#635BFF]/15">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">{t("pt.agentKeysTitle")}</p>
            <ul className="space-y-1.5">
              {agentKeys.map((k) => (
                <li key={k.id} className="flex items-center gap-2 text-[11.5px]">
                  <code className="font-mono text-[#1a0f00]/75">{k.prefix}</code>
                  <span className="text-[#1a0f00]/45">· {k.endpointShortId}</span>
                  {k.cardSaved && <span className="text-[10px] text-[#16A34A]">{t("pt.agentCardOn")}</span>}
                  <span className="flex-1" />
                  {k.status === "active"
                    ? <button type="button" onClick={() => revokeKey(k.id)} className="text-[11px] font-semibold text-[#DC2626] hover:underline">{t("pt.agentRevoke")}</button>
                    : <span className="text-[10px] uppercase tracking-widest text-[#1a0f00]/45">{t("pt.agentRevoked")}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h3 className="text-[13px] font-bold mb-3 text-[#1a0f00]/80">{t("pt.allTokens", { n: tokens.length })} <span className="font-normal text-[#1a0f00]/45">{t("pt.tokenBreakdown", { purchased: purchasedCount, test: testCount })}</span></h3>
        {tokens.length === 0 ? <p className="text-[12px] text-[#1a0f00]/45 italic">{t("pt.empty")}</p> : (
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr><th className="text-left px-4 py-2.5 font-semibold">{t("pt.colToken")}</th><th className="text-left px-4 py-2.5 font-semibold">{t("pt.colSource")}</th><th className="text-left px-4 py-2.5 font-semibold">{t("pt.colEndpoint")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("pt.colBudgetLeft")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("pt.colCalls")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("pt.colExpires")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("pt.colStatus")}</th><th className="px-2"></th></tr>
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
                        {hasJwt && <button type="button" onClick={() => navigator.clipboard?.writeText(jwtById[t.id])} className="ml-2 text-[10px] text-[#1a0f00]/55 hover:text-[#1a0f00] underline">{t2("pt.copyJwt")}</button>}
                      </td>
                      <td className="px-4 py-2.5">
                        {t.source === "purchase" ? (
                          <div className="min-w-0">
                            <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded text-[#635BFF] bg-[#635BFF]/10">{t2("pt.purchased")}</span>
                            {t.buyerEmail && <p className="mt-0.5 text-[10.5px] text-[#1a0f00]/50 truncate max-w-[160px]" title={t.buyerEmail}>{t.buyerEmail}</p>}
                          </div>
                        ) : (
                          <span className="inline-block text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded text-[#1a0f00]/55 bg-[#1a0f00]/6">{t2("pt.test")}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#1a0f00]/75">{ep?.name ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtUsd(left)} <span className="text-[#1a0f00]/40">/ {fmtUsd(t.budget)}</span></td>
                      <td className="px-4 py-2.5 text-right font-mono">{t.callsUsed} <span className="text-[#1a0f00]/40">/ {t.maxCalls}</span></td>
                      <td className="px-4 py-2.5 text-right text-[#1a0f00]/60">{t.status === "expired" ? t2("pt.expiredShort") : t2("pt.inHours", { h: Math.max(0, Math.ceil((t.expiresAt - Date.now()) / 3600000)) })}</td>
                      <td className="px-4 py-2.5 text-right"><TokenStatusPill status={t.status} /></td>
                      <td className="pr-3 text-right">{t.status === "active" && <button type="button" onClick={() => api.revokeToken(t.id)} className="text-[11px] text-[#DC2626] hover:underline">{t2("pt.revoke")}</button>}</td>
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
  const { t } = useT();
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
    const tok = tokens.find((p) => p.id === tokenId);
    if (!tok) return;
    const e = endpoints.find((x) => x.id === tok.endpointId);
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
      const message = err instanceof Error ? err.message : t("test.unknownError");
      const looksLikeCors = /failed to fetch|networkerror|load failed/i.test(message);
      setVerifyResult({
        kind: "error",
        message,
        hint: looksLikeCors ? t("test.corsHint") : undefined,
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
      <PaneHeading eyebrow={t("test.eyebrow")} title={t("test.emptyTitle")} subtitle={t("test.emptySubtitle")} />
      <EmptyState actionLabel={t("apis.emptyAction")} onAction={() => goTo("add")} />
    </>);
  }
  if (activeTokens.length === 0) {
    return (<>
      <PaneHeading eyebrow={t("test.eyebrow")} title={t("test.needTokenTitle")} subtitle={t("test.needTokenSubtitle")} />
      <EmptyState actionLabel={t("test.goToPayToken")} onAction={() => goTo("paytoken", preselectEndpointId ? { endpointId: preselectEndpointId } : undefined)} />
    </>);
  }

  const token = tokens.find((t) => t.id === tokenId);
  const ep    = token ? endpoints.find((e) => e.id === token.endpointId) : undefined;
  const jwt   = token ? jwtById[token.id] : undefined;
  const gatewayUrl = ep ? gatewayUrlOf(ep.shortId) : "";

  async function send() {
    if (!ep || !token) return;
    if (!jwt) {
      setLastResult({ kind: "error", message: t("test.jwtMissingResult") });
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
      setLastResult({ kind: "error", message: e instanceof Error ? e.message : t("test.networkError") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PaneHeading eyebrow={t("test.eyebrow")} title={t("test.title")} subtitle={t("test.subtitle")} />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <Field label={t("test.fieldPayToken")}>
            <Select value={tokenId} onChange={setTokenId}>
              {activeTokens.map((tk) => {
                const e = endpoints.find((x) => x.id === tk.endpointId);
                return <option key={tk.id} value={tk.id}>{tk.id} — {e?.name}</option>;
              })}
            </Select>
          </Field>

          {ep && token && (
            <div className="mt-4 rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-3 text-[11.5px] space-y-1">
              <RevRow k={t("test.rowTarget")} v={ep.name} />
              <RevRow k={t("test.rowPerCall")} v={fmtUsd(ep.pricePerCall)} />
              <RevRow k={t("test.rowTokenBudget")} v={t("test.budgetLeftFmt", { left: fmtUsd(Math.max(0, token.budget - token.spent)), total: fmtUsd(token.budget) })} />
              <RevRow k={t("test.rowCallsRemaining")} v={t("test.callsRemainingFmt", { remaining: token.maxCalls - token.callsUsed, total: token.maxCalls })} />
              <RevRow k={t("test.rowRateLimit")} v={t("test.rateLimitFmt", { n: ep.rateLimit })} />
            </div>
          )}

          {ep && (
            <div className="mt-4 rounded-lg bg-[#1a0f00] text-white p-3 text-[11px] font-mono leading-relaxed">
              curl -X POST {gatewayUrl} \<br />
              &nbsp;&nbsp;-H &quot;Authorization: Bearer {jwt ? `${jwt.slice(0, 20)}…` : "<jwt>"}&quot;
            </div>
          )}
          {!jwt && (
            <p className="mt-2 text-[10.5px] text-[#DC2626]/85 leading-snug">{t("test.jwtMissing")}</p>
          )}

          <button type="button" onClick={send} disabled={busy || !jwt} className="mt-4 w-full py-2.5 bg-[#1a0f00] text-white font-bold text-[13px] rounded-xl hover:bg-[#1a0f00]/90 transition-colors disabled:opacity-60">
            {busy ? t("test.calling") : t("test.sendRequest")} <span className="text-[10px] font-normal text-white/55 ml-1">{t("test.viaGateway")}</span>
          </button>

          {/* Verify origin — bypass gateway, hit upstream directly */}
          {ep && (
            <div className="mt-6 pt-5 border-t border-[#1a0f00]/8">
              <div className="flex items-baseline justify-between mb-1">
                <p className="text-[12px] font-bold">{t("test.verifyTitle")}</p>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#1a0f00]/55">{t("test.bypassesGateway")}</span>
              </div>
              <p className="text-[10.5px] text-[#1a0f00]/55 leading-snug mb-3">
                {t("test.verifyDescPre")}<code className="font-mono">{ep.originalUrl}</code>{ep.upstreamAuth ? <>{t("test.verifyDescWithAuth")}<code className="font-mono">{maskAuth(ep.upstreamAuth)}</code></> : null}{t("test.verifyDescPost")}
              </p>
              <button type="button" onClick={verifyOrigin} disabled={verifyBusy} className="w-full py-2 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold text-[12px] rounded-lg hover:bg-[#1a0f00]/[0.03] transition-colors disabled:opacity-60">
                {verifyBusy ? t("test.callingOrigin") : t("test.getUpstream")}
              </button>
              {verifyResult?.kind === "ok" && (
                <div className={`mt-3 rounded-lg border p-3 ${verifyResult.status < 400 ? "bg-[#16A34A]/8 border-[#16A34A]/30" : "bg-[#DC2626]/8 border-[#DC2626]/30"}`}>
                  <div className="flex items-baseline justify-between mb-2">
                    <p className={`text-[12.5px] font-bold ${verifyResult.status < 400 ? "text-[#16A34A]" : "text-[#DC2626]"}`}>{verifyResult.status} {verifyResult.status < 400 ? t("test.statusOk") : t("test.statusFromOrigin")}</p>
                    <p className="text-[10.5px] font-mono text-[#1a0f00]/55">{verifyResult.ms}ms · {verifyResult.contentType}</p>
                  </div>
                  {verifyResult.bodyPreview ? (
                    <pre className="font-mono text-[10.5px] text-[#1a0f00]/75 whitespace-pre-wrap break-all max-h-32 overflow-auto bg-white/50 border border-[#1a0f00]/8 rounded p-2">{verifyResult.bodyPreview}{verifyResult.bodyPreview.length === 400 ? "…" : ""}</pre>
                  ) : <p className="text-[10.5px] text-[#1a0f00]/45 italic">{t("test.emptyBody")}</p>}
                </div>
              )}
              {verifyResult?.kind === "error" && (
                <div className="mt-3 rounded-lg bg-[#DC2626]/8 border border-[#DC2626]/30 p-3">
                  <p className="text-[12.5px] font-bold text-[#DC2626] mb-1">{t("test.networkError")}</p>
                  <p className="text-[11px] font-mono text-[#1a0f00]/75 break-all">{verifyResult.message}</p>
                  {verifyResult.hint && <p className="mt-2 text-[10.5px] text-[#1a0f00]/65 leading-snug">{verifyResult.hint}</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-3">{t("test.lastResult")}</p>
          {!lastResult && <p className="text-[12px] text-[#1a0f00]/45 italic">{t("test.lastResultEmpty")}</p>}
          {lastResult?.kind === "ok" && (
            <div className="rounded-xl bg-[#16A34A]/8 border border-[#16A34A]/30 p-3">
              <p className="text-[12.5px] font-bold text-[#16A34A] mb-2">{t("test.paidSuccessFmt", { status: lastResult.status, ms: lastResult.ms })}</p>
              {lastResult.bodyPreview && (
                <pre className="font-mono text-[10.5px] text-[#1a0f00]/75 whitespace-pre-wrap break-all max-h-40 overflow-auto bg-white/50 border border-[#1a0f00]/8 rounded p-2">{lastResult.bodyPreview}{lastResult.bodyPreview.length === 400 ? "…" : ""}</pre>
              )}
            </div>
          )}
          {lastResult?.kind === "blocked" && (
            <div className="rounded-xl bg-[#DC2626]/8 border border-[#DC2626]/30 p-3">
              <p className="text-[12.5px] font-bold text-[#DC2626] mb-1">{t("test.blockedFmt", { status: lastResult.status })}</p>
              <p className="text-[11.5px] text-[#1a0f00]/75 font-mono">{lastResult.reason}</p>
            </div>
          )}
          {lastResult?.kind === "error" && (
            <div className="rounded-xl bg-[#DC2626]/8 border border-[#DC2626]/30 p-3">
              <p className="text-[12.5px] font-bold text-[#DC2626] mb-1">{t("test.networkError")}</p>
              <p className="text-[11px] text-[#1a0f00]/75 break-all">{lastResult.message}</p>
            </div>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-[13px] font-bold mb-3 text-[#1a0f00]/80">{t("test.recentTitle", { n: runs.length })}</h3>
        {runs.length === 0 ? <p className="text-[12px] text-[#1a0f00]/45 italic">{t("test.recentEmpty")}</p> : (
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr><th className="text-left px-4 py-2.5 font-semibold">{t("test.colWhen")}</th><th className="text-left px-4 py-2.5 font-semibold">{t("test.colEndpoint")}</th><th className="text-left px-4 py-2.5 font-semibold">{t("test.colPayToken")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("test.colStatusMs")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("test.colGross")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("test.colFee")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("test.colYouReceive")}</th></tr>
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

function RevenuePane({ endpoints, runs, tokens, sales, stripe, goTo }: { endpoints: Endpoint[]; runs: TestRun[]; tokens: PayToken[]; sales: Sales; stripe: StripeStatus | null; goTo: (p: Pane, opts?: { endpointId?: string }) => void }) {
  // `sales` is the real money (buyer prepayments). The per-call `runs` are how
  // buyers consume that prepaid credit through the gateway — no money moves per
  // call, since the 3% platform fee is taken once at checkout. `stripe` is
  // lifted from the parent so we don't refetch status here; a null value
  // (Stripe not configured on this deployment) simply hides the banner.
  const { t } = useT();
  const receiveSub =
    stripe?.payoutsEnabled ? t("rev.receiveSettles")
      : stripe?.connected   ? t("rev.receiveFinish")
        : stripe === null   ? t("rev.receiveNet")
          : t("rev.receiveConnect");

  // Free-tier counter: lifetime paid calls (no monthly reset), capped display at 3,000.
  // Uses the same `runs` source the rest of this pane trusts; the gateway enforces
  // the real lifetime cap server-side.
  const FREE_TIER = 3000;
  const callsLifetime = runs.length;
  const freeRemaining = Math.max(0, FREE_TIER - callsLifetime);
  const freePct = Math.min(100, (callsLifetime / FREE_TIER) * 100);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (13 - i));
    const end = d.getTime() + 86400000;
    const g = runs.filter((r) => r.at >= d.getTime() && r.at < end).reduce((a, r) => a + r.gross, 0);
    return { label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), gross: g };
  }), [runs]);
  const maxG = Math.max(0.0001, ...days.map((d) => d.gross));

  return (
    <>
      <PaneHeading eyebrow={t("rev.eyebrow")} title={t("rev.title")} subtitle={t("rev.subtitle")} />

      {/* Settlement readiness — reflects the seller's live Stripe Connect state */}
      {stripe && (
        stripe.payoutsEnabled ? (
          <section className="rounded-2xl bg-[#16A34A]/8 border border-[#16A34A]/25 p-4 mb-6 flex items-start gap-3">
            <Icon.Bank className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#16A34A]" />
            <div className="min-w-0">
              <p className="text-[12.5px] font-bold text-[#16A34A]">{t("rev.payoutsEnabled")}{stripe.country ? ` · ${stripe.country}` : ""}</p>
              <p className="text-[11.5px] text-[#1a0f00]/65 leading-relaxed">{t("rev.payoutsEnabledBody")}</p>
            </div>
          </section>
        ) : stripe.connected ? (
          <section className="rounded-2xl bg-[#fffd43]/15 border border-[#1a0f00]/10 p-4 mb-6 flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <Icon.Bank className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#1a0f00]/55" />
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold">{t("rev.onboardingIncomplete")}</p>
                <p className="text-[11.5px] text-[#1a0f00]/65 leading-relaxed">{t("rev.onboardingIncompleteBody")}</p>
              </div>
            </div>
            <button type="button" onClick={() => goTo("account")} className="flex-shrink-0 px-3.5 py-2 bg-[#1a0f00] text-white font-bold text-[12px] rounded-lg hover:bg-[#1a0f00]/90 transition-colors">{t("rev.finishInAccount")}</button>
          </section>
        ) : (
          <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-4 mb-6 flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0">
              <Icon.Bank className="w-4 h-4 mt-0.5 flex-shrink-0 text-[#635BFF]" />
              <div className="min-w-0">
                <p className="text-[12.5px] font-bold">{t("rev.notReady")}</p>
                <p className="text-[11.5px] text-[#1a0f00]/65 leading-relaxed">{t("rev.notReadyBody")}</p>
              </div>
            </div>
            <button type="button" onClick={() => goTo("account")} className="flex-shrink-0 px-3.5 py-2 bg-[#635BFF] text-white font-bold text-[12px] rounded-lg hover:bg-[#7A73FF] transition-colors">{t("account.connectStripe")}</button>
          </section>
        )
      )}

      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-2">{t("rev.prepaidSales")}</p>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <BigStat label={t("rev.statSold")} v={fmtUsd(sales.gross)} sub={t("rev.soldSubFmt", { count: sales.count })} />
        <BigStat label={t("rev.statFee")} v={fmtUsd(sales.gross * 0.03)} sub={t("rev.feeSub")} muted />
        <BigStat label={t("rev.statReceive")} v={fmtUsd(sales.net)} sub={receiveSub} highlight />
      </section>

      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/45 mb-2">{t("rev.creditUsage")}</p>
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <BigStat label={t("rev.statCallsServed")} v={runs.length.toLocaleString()} sub={t("rev.callsServedSub")} muted />
        <BigStat label={t("rev.statCreditConsumed")} v={fmtUsd(sales.consumed)} sub={t("rev.creditConsumedSub")} muted />
        <BigStat label={t("rev.statCreditOutstanding")} v={fmtUsd(sales.outstanding)} sub={t("rev.creditOutstandingSub")} muted />
      </section>

      {/* Free-tier progress */}
      <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 mb-6">
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-[12px] font-bold">{t("rev.freeTierTitle")}</p>
          <p className="text-[11px] text-[#1a0f00]/55">
            <span className="font-mono font-bold text-[#1a0f00]">{callsLifetime.toLocaleString()}</span> {t("rev.ofCalls")}
            {freeRemaining > 0
              ? <span className="ml-2 text-[#16A34A] font-semibold">{t("rev.freeLeftFmt", { n: freeRemaining.toLocaleString() })}</span>
              : <span className="ml-2 text-[#1a0f00]/55">{t("rev.feeActive")}</span>}
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-[#1a0f00]/8 overflow-hidden">
          <div
            className={`h-full transition-all ${freePct < 100 ? "bg-[#16A34A]" : "bg-[#1a0f00]/35"}`}
            style={{ width: `${freePct}%` }}
          />
        </div>
        <p className="mt-2 text-[10.5px] text-[#1a0f00]/55 leading-snug">
          {freeRemaining > 0 ? t("rev.freeNoteRemaining") : t("rev.freeNoteDone")}
        </p>
      </section>
      <section className="rounded-2xl bg-white border border-[#1a0f00]/10 p-5 mb-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-3">{t("rev.last14")}</p>
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
        <h3 className="text-[13px] font-bold mb-3 text-[#1a0f00]/80">{t("rev.perEndpoint")}</h3>
        {endpoints.length === 0 ? <p className="text-[12px] text-[#1a0f00]/45 italic">{t("rev.perEndpointEmpty")}</p> : (
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr><th className="text-left px-4 py-2.5 font-semibold">{t("rev.colEndpoint")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("rev.colPurchases")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("rev.colSold")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("rev.colYouReceive")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("rev.colCalls")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("rev.colCreditLeft")}</th></tr>
              </thead>
              <tbody>
                {endpoints.map((e) => {
                  const purchased  = tokens.filter((t) => t.source === "purchase" && t.endpointId === e.id);
                  const soldG      = purchased.reduce((a, t) => a + t.budget, 0);
                  const calls      = runs.filter((r) => r.endpointId === e.id).length;
                  const creditLeft = purchased.reduce((a, t) => a + Math.max(0, t.budget - t.spent), 0);
                  return (
                    <tr key={e.id} className="border-b border-[#1a0f00]/6 last:border-0">
                      <td className="px-4 py-2.5">{e.name}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{purchased.length}</td>
                      <td className="px-4 py-2.5 text-right font-mono">{fmtUsd(soldG)}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-[#16A34A]">{fmtUsd(soldG * 0.97)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1a0f00]/55">{calls}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#1a0f00]/55">{fmtUsd(creditLeft)}</td>
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
  const { t } = useT();
  const [filter, setFilter] = useState<BlockReason | "all">("all");
  const filtered = blocked.filter((b) => filter === "all" || b.reason === filter);
  const saved = blocked.reduce((a, b) => a + b.attempted, 0);
  return (
    <>
      <PaneHeading eyebrow={t("blocked.eyebrow")} title={t("blocked.title")} subtitle={t("blocked.subtitle")} />
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <BigStat label={t("blocked.statBlocked")} v={String(blocked.length)} sub={t("blocked.statBlockedSub")} />
        <BigStat label={t("blocked.statPrevented")} v={fmtUsd(saved)} sub={t("blocked.statPreventedSub")} muted />
        <BigStat label={t("blocked.statReasons")} v={String(new Set(blocked.map((b) => b.reason)).size)} sub={t("blocked.statReasonsSub")} />
      </section>
      {blocked.length === 0 ? <p className="text-[12px] text-[#1a0f00]/45 italic">{t("blocked.empty")}</p> : (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {(["all", "rate_limit_exceeded", "spend_cap_exceeded", "token_expired", "token_revoked", "endpoint_paused", "upstream_error"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${filter === f ? "bg-[#1a0f00] text-white" : "bg-white border border-[#1a0f00]/12 text-[#1a0f00]/65 hover:text-[#1a0f00]"}`}>{f === "all" ? t("blocked.filterAll") : t(reasonKey(f))}</button>
            ))}
            <div className="flex-1" />
            <button type="button" onClick={() => api.clearBlocked()} className="text-[11px] text-[#1a0f00]/55 hover:text-[#1a0f00]">{t("blocked.clearLog")}</button>
          </div>
          <div className="rounded-2xl bg-white border border-[#1a0f00]/10 overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
                <tr><th className="text-left px-4 py-2.5 font-semibold">{t("blocked.colWhen")}</th><th className="text-left px-4 py-2.5 font-semibold">{t("blocked.colEndpoint")}</th><th className="text-left px-4 py-2.5 font-semibold">{t("blocked.colReason")}</th><th className="text-right px-4 py-2.5 font-semibold">{t("blocked.colPrevented")}</th></tr>
              </thead>
              <tbody>
                {filtered.slice(0, 100).map((b) => {
                  const e = endpoints.find((x) => x.id === b.endpointId);
                  return (
                    <tr key={b.id} className="border-b border-[#1a0f00]/6 last:border-0">
                      <td className="px-4 py-2.5 text-[#1a0f00]/55">{timeAgo(b.at)}</td>
                      <td className="px-4 py-2.5">{e?.name ?? "—"}</td>
                      <td className="px-4 py-2.5"><span className="font-mono text-[11px] text-[#DC2626]">{t(reasonKey(b.reason))}</span></td>
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
  const { t } = useT();
  if (status === "live") return <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#16A34A] bg-[#16A34A]/10 px-1.5 py-0.5 rounded"><span className="w-1 h-1 rounded-full bg-[#16A34A]" /> {t("pill.live")}</span>;
  return <span className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/60 bg-[#1a0f00]/8 px-1.5 py-0.5 rounded">{t("pill.paused")}</span>;
}
function TokenStatusPill({ status }: { status: PayToken["status"] }) {
  const { t } = useT();
  const map: Record<PayToken["status"], { key: MessageKey; cls: string }> = {
    active:    { key: "token.active",    cls: "text-[#16A34A] bg-[#16A34A]/10" },
    expired:   { key: "token.expired",   cls: "text-[#1a0f00]/55 bg-[#1a0f00]/6" },
    exhausted: { key: "token.exhausted", cls: "text-[#1a0f00]/55 bg-[#1a0f00]/6" },
    revoked:   { key: "token.revoked",   cls: "text-[#DC2626] bg-[#DC2626]/10" },
  };
  const m = map[status];
  return <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${m.cls}`}>{t(m.key)}</span>;
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
function reasonKey(r: BlockReason): MessageKey {
  return ({
    rate_limit_exceeded: "block.rate_limit_exceeded",
    spend_cap_exceeded:  "block.spend_cap_exceeded",
    token_expired:       "block.token_expired",
    token_revoked:       "block.token_revoked",
    endpoint_paused:     "block.endpoint_paused",
    upstream_error:      "block.upstream_error",
  } as Record<BlockReason, MessageKey>)[r];
}
