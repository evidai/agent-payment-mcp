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
      httpOnly: false,
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
