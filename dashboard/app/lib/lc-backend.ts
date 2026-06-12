/**
 * LemonCake backend helpers — direct Postgres (via Vercel-injected
 * POSTGRES_URL), owner-cookie identity, Pay Token JWT signing/verification,
 * short-ID generator.
 *
 * We use the `postgres` library directly instead of @supabase/supabase-js
 * because Vercel's Supabase Marketplace integration doesn't expose the
 * service_role key (security default). POSTGRES_URL is auto-injected and
 * gives us full DB access, so we skip the Supabase REST layer entirely.
 */

import postgres, { type Sql } from "postgres";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

/* ──────────────── platform economics ──────────────── */

/**
 * One-time free gateway calls per owner (lifetime, NOT a monthly reset).
 * Single source of truth shared by the gateway (/g/[shortId], waives its 3%
 * cut while under this) and prepaid checkout (waives the 3% Stripe application
 * fee on a provider's buyers' top-ups until the provider crosses this). After
 * FREE_TIER_CALLS lifetime calls, LemonCake's 3% take-rate kicks in.
 */
export const FREE_TIER_CALLS = 3000;

/* ──────────────── env ──────────────── */

function pgUrl(): string | undefined {
  return process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING;
}

export function backendEnvReady(): boolean {
  return !!(pgUrl() && process.env.LC_JWT_SECRET);
}

/* ──────────────── postgres connection (singleton) ──────────────── */

// Module-scope singleton so warm Vercel functions reuse the pool.
let _sql: Sql | null = null;

export function sql(): Sql {
  const url = pgUrl();
  if (!url || !process.env.LC_JWT_SECRET) {
    throw new Error("Backend env not configured. See dashboard/SETUP-BACKEND.md.");
  }
  if (!_sql) {
    _sql = postgres(url, {
      prepare: false,      // Vercel's pooled connections (pgbouncer) don't support prepared statements
      max: 4,              // serverless cap
      idle_timeout: 20,
      max_lifetime: 60 * 30,
    });
  }
  return _sql;
}

/* ──────────────── owner ID (cookie) ──────────────── */

const OWNER_COOKIE = "lc_owner";

export async function readOwnerId(): Promise<string | null> {
  const c = await cookies();
  return c.get(OWNER_COOKIE)?.value ?? null;
}

/** Read or create + set the owner cookie + upsert the owner row. */
export async function ensureOwnerId(): Promise<string> {
  const c = await cookies();
  let id = c.get(OWNER_COOKIE)?.value;
  if (!id) {
    id = `o_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    c.set(OWNER_COOKIE, id, {
      httpOnly: true, // server-only; the client reads its owner id via /api/lc/me
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  await sql()`
    insert into lc_owners (id) values (${id})
    on conflict (id) do nothing
  `;
  return id;
}

/* ──────────────── Pay Token JWT (HS256) ──────────────── */

const ALG = "HS256";

function jwtKey(): Uint8Array {
  return new TextEncoder().encode(process.env.LC_JWT_SECRET!);
}

export type PayTokenClaims = {
  jti: string;     // Pay Token ID (DB pk)
  sub: string;     // endpoint ID
  own: string;     // owner ID
};

export async function signPayToken(claims: PayTokenClaims, expiresAt: number): Promise<string> {
  return await new SignJWT({ own: claims.own })
    .setProtectedHeader({ alg: ALG, typ: "JWT" })
    .setJti(claims.jti)
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt / 1000))
    .sign(jwtKey());
}

export async function verifyPayToken(jwt: string): Promise<PayTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(jwt, jwtKey(), { algorithms: [ALG] });
    if (!payload.jti || !payload.sub || !payload.own) return null;
    return { jti: String(payload.jti), sub: String(payload.sub), own: String(payload.own) };
  } catch {
    return null;
  }
}

/* ──────────────── short id ──────────────── */

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function shortId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % 32];
  return out.toLowerCase();
}

/* ──────────────── operator flags (runtime kill switch, etc.) ──────────────── */

let _flagsReady = false;
async function ensureFlags(): Promise<void> {
  if (_flagsReady) return;
  await sql()`create table if not exists lc_flags (
    key        text primary key,
    value      text not null,
    updated_at timestamptz not null default now()
  )`;
  _flagsReady = true;
}

export async function getFlag(key: string): Promise<string | null> {
  await ensureFlags();
  const r = await sql()<{ value: string }[]>`select value from lc_flags where key = ${key} limit 1`;
  return r[0]?.value ?? null;
}

export async function setFlag(key: string, value: string): Promise<void> {
  await ensureFlags();
  await sql()`
    insert into lc_flags (key, value) values (${key}, ${value})
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
}

/**
 * Global kill switch for the LIVE money path. When on, the gateway refuses to
 * forward/charge and minting refuses to fund — stopping ALL new charges at once.
 * Two independent triggers: env `LC_KILL_SWITCH=1` (set+redeploy, always works
 * even if the DB is unreachable) OR the runtime DB flag (instant, toggled from
 * the admin console). Either being on halts the path.
 */
export async function isGatewayHalted(): Promise<boolean> {
  if (process.env.LC_KILL_SWITCH === "1") return true;
  try {
    return (await getFlag("gateway_halted")) === "1";
  } catch {
    return false; // DB hiccup must not wedge the gateway; env trigger still applies
  }
}

/* ──────────────── DB row types (matches schema.sql) ──────────────── */

export type EndpointRow = {
  id: string;
  short_id: string;
  owner_id: string;
  name: string;
  slug: string;
  original_url: string;
  upstream_auth: string | null;
  price_per_call: string;     // postgres NUMERIC is returned as string
  token_budget: string;
  rate_limit: number;
  status: "live" | "paused";
  created_at: Date;
  // ── Phase 4: Developer Growth Loop (nullable until ensureGrowthSchema runs) ──
  public_slug?: string | null;
  public_title?: string | null;
  public_description?: string | null;
  category?: string | null;
  seller_display_name?: string | null;
  public_page_enabled?: boolean;
  badge_enabled?: boolean;
  directory_status?: "none" | "pending" | "approved" | "rejected";
  share_count?: number;
  public_page_views?: number;
};

export type DirectorySubmissionRow = {
  id: string;
  endpoint_id: string;
  owner_id: string;
  category: string;
  description: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: Date;
  reviewed_at: Date | null;
  reviewed_by: string | null;
};

export type PayTokenRow = {
  id: string;
  endpoint_id: string;
  owner_id: string;
  budget: string;
  spent: string;
  max_calls: number;
  calls_used: number;
  expires_at: Date;
  status: "active" | "expired" | "exhausted" | "revoked";
  issued_at: Date;
  // Phase 2 (buyer prepaid bundles) — null for seller-issued test tokens.
  stripe_checkout_session_id?: string | null;
  buyer_email?: string | null;
  // Agent Identity (thin layer) — set when this token is bound to an Agent.
  agent_id?: string | null;
};

export type TestRunRow = {
  id: string;
  endpoint_id: string;
  pay_token_id: string;
  owner_id: string;
  gross: string;
  fee: string;
  net: string;
  upstream_status: number | null;
  upstream_ms: number | null;
  at: Date;
};

export type BlockedRow = {
  id: string;
  endpoint_id: string;
  pay_token_id: string | null;
  owner_id: string;
  reason: "rate_limit_exceeded" | "spend_cap_exceeded" | "token_expired" | "token_revoked" | "endpoint_paused" | "upstream_error";
  attempted: string;
  at: Date;
};

export type ShareEventRow = {
  id: string;
  endpoint_id: string | null;
  owner_id: string | null;
  share_type: string;
  created_at: Date;
};

/* ──────────────── Phase 4: lazy growth-loop schema ──────────────── */

// Memoized so a warm Vercel instance runs the DDL at most once. The block
// mirrors the "Phase 4" section in db/schema.sql exactly, so a fresh deploy
// works even before that file is re-run by hand in the Supabase SQL editor.
// Every statement is idempotent (IF NOT EXISTS), so re-running is harmless.
let _growthSchemaReady: Promise<void> | null = null;

const GROWTH_DDL = `
alter table lc_owners add column if not exists referral_code        text;
alter table lc_owners add column if not exists referred_by          text;
alter table lc_owners add column if not exists referral_credited_at timestamptz;
alter table lc_owners add column if not exists free_calls_bonus     int not null default 0;
create unique index if not exists lc_owners_referral_code_unq on lc_owners(referral_code) where referral_code is not null;
alter table lc_endpoints add column if not exists public_slug         text;
alter table lc_endpoints add column if not exists public_title        text;
alter table lc_endpoints add column if not exists public_description  text;
alter table lc_endpoints add column if not exists category            text;
alter table lc_endpoints add column if not exists seller_display_name text;
alter table lc_endpoints add column if not exists public_page_enabled boolean not null default true;
alter table lc_endpoints add column if not exists badge_enabled       boolean not null default true;
alter table lc_endpoints add column if not exists directory_status    text not null default 'none';
alter table lc_endpoints add column if not exists share_count         int  not null default 0;
alter table lc_endpoints add column if not exists public_page_views   int  not null default 0;
create unique index if not exists lc_endpoints_public_slug_unq
  on lc_endpoints(public_slug) where public_slug is not null;

create table if not exists lc_directory_submissions (
  id           uuid primary key default gen_random_uuid(),
  endpoint_id  uuid not null unique references lc_endpoints(id) on delete cascade,
  owner_id     text not null references lc_owners(id) on delete cascade,
  category     text not null,
  description  text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  text
);
create index if not exists lc_directory_submissions_status_idx on lc_directory_submissions(status);

create table if not exists lc_share_events (
  id          uuid primary key default gen_random_uuid(),
  endpoint_id uuid references lc_endpoints(id) on delete cascade,
  owner_id    text,
  share_type  text not null,
  created_at  timestamptz not null default now()
);
create index if not exists lc_share_events_endpoint_idx on lc_share_events(endpoint_id, created_at desc);
create index if not exists lc_share_events_type_idx on lc_share_events(share_type, created_at desc);
`;

/** Apply the Phase 4 DDL once per warm instance. Safe + idempotent. */
export function ensureGrowthSchema(): Promise<void> {
  if (!_growthSchemaReady) {
    _growthSchemaReady = (async () => {
      try {
        // Fast path: once the schema is applied (the steady state in prod) the
        // DDL is pure overhead — re-running idempotent ALTER/CREATE statements
        // is harmless but floods Postgres NOTICE logs ("… already exists,
        // skipping") on every cold start, which buries real errors. Gate on a
        // sentinel (last column added + last table created); skip if present.
        const probe = await sql()<{ ready: boolean }[]>`
          select (
            exists(select 1 from information_schema.columns
                   where table_name = 'lc_endpoints' and column_name = 'public_page_views')
            and exists(select 1 from information_schema.columns
                       where table_name = 'lc_owners' and column_name = 'free_calls_bonus')
            and exists(select 1 from information_schema.tables
                       where table_name = 'lc_share_events')
          ) as ready
        `;
        if (probe[0]?.ready) return;

        // Run each statement individually — pgbouncer (prepare:false) + the
        // extended protocol can't run multi-statement strings, and none of
        // our DDL statements contain embedded semicolons, so a plain split is
        // safe. Each is idempotent (IF NOT EXISTS), so order doesn't matter.
        const statements = GROWTH_DDL.split(";").map((s) => s.trim()).filter(Boolean);
        for (const stmt of statements) {
          await sql().unsafe(stmt);
        }
      } catch (err) {
        // Reset so a later request can retry (e.g. transient connection drop).
        _growthSchemaReady = null;
        throw err;
      }
    })();
  }
  return _growthSchemaReady;
}

/* ──────────────── public-slug generation ──────────────── */

/** Sanitize an arbitrary string into a slug fragment (lowercase, hyphenated). */
export function sanitizeSlug(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "api";
}

/**
 * Build a globally-unique public_slug from a base name. Tries the sanitized
 * base, then -2, -3, … until it finds one free in lc_endpoints.public_slug.
 * Assumes ensureGrowthSchema() has already run.
 */
export async function generatePublicSlug(base: string): Promise<string> {
  const root = sanitizeSlug(base);
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const hit = await sql()<{ one: number }[]>`
      select 1 as one from lc_endpoints where public_slug = ${candidate} limit 1
    `;
    if (hit.length === 0) return candidate;
  }
  // Extremely unlikely fallback: append a short random suffix.
  return `${root}-${shortId().slice(0, 6)}`;
}

/* ──────────────── share / growth analytics ──────────────── */

export type ShareType =
  | "copy_gateway_url"
  | "copy_curl"
  | "copy_readme_badge"
  | "copy_x_post"
  | "copy_docs_snippet"
  | "copy_mcp_listing"
  | "view_public_page"
  | "submit_directory"
  | "click_try_demo_from_public_page"
  | "click_create_own_api_from_public_page";

/**
 * Log a share/growth event and bump the relevant counter on the endpoint.
 * view_public_page → public_page_views; copy_* / submit_directory → share_count.
 * Best-effort: never throws — analytics must not break a user-facing action.
 */
export async function recordShareEvent(opts: {
  endpointId?: string | null;
  ownerId?: string | null;
  shareType: ShareType | string;
}): Promise<void> {
  const { endpointId = null, ownerId = null, shareType } = opts;
  try {
    await sql()`
      insert into lc_share_events (endpoint_id, owner_id, share_type)
      values (${endpointId}, ${ownerId}, ${shareType})
    `;
    if (endpointId) {
      if (shareType === "view_public_page") {
        await sql()`update lc_endpoints set public_page_views = public_page_views + 1 where id = ${endpointId}`;
      } else if (shareType.startsWith("copy_") || shareType === "submit_directory") {
        await sql()`update lc_endpoints set share_count = share_count + 1 where id = ${endpointId}`;
      }
    }
  } catch {
    // swallow — analytics is non-critical
  }
}
