/**
 * LemonCake backend helpers — Supabase client, owner ID, Pay Token JWT,
 * short ID generator.
 *
 * Why this lives in app/lib: keeps API routes lean and lets the gateway
 * proxy share the same primitives.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";

/* ──────────────── env ──────────────── */

export function backendEnvReady(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY && process.env.LC_JWT_SECRET);
}

/* ──────────────── supabase ──────────────── */

let _client: SupabaseClient | null = null;

export function sb(): SupabaseClient {
  if (!backendEnvReady()) {
    throw new Error("Supabase env not configured. See dashboard/SETUP-BACKEND.md.");
  }
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { persistSession: false } },
    );
  }
  return _client;
}

/* ──────────────── owner ID (cookie) ──────────────── */

const OWNER_COOKIE = "lc_owner";

// Read the owner cookie. Returns null if missing.
export async function readOwnerId(): Promise<string | null> {
  const c = await cookies();
  return c.get(OWNER_COOKIE)?.value ?? null;
}

// Read or create + set the owner cookie + lazily create the owner row.
// Returns the owner ID. Must be called from a route handler that can set cookies.
export async function ensureOwnerId(): Promise<string> {
  const c = await cookies();
  let id = c.get(OWNER_COOKIE)?.value;
  if (!id) {
    id = `o_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    c.set(OWNER_COOKIE, id, {
      httpOnly: false,            // readable by client for "current owner" display
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,  // 1 year
      path: "/",
    });
  }
  // Lazy upsert
  await sb().from("lc_owners").upsert({ id }, { onConflict: "id" });
  return id;
}

/* ──────────────── Pay Token JWT (HS256) ──────────────── */

const ALG = "HS256";

function jwtKey(): Uint8Array {
  return new TextEncoder().encode(process.env.LC_JWT_SECRET!);
}

export type PayTokenClaims = {
  /** Pay Token ID — also the DB primary key. */
  jti: string;
  /** Endpoint ID this token can call. */
  sub: string;
  /** Owner ID who issued the token (for traceability). */
  own: string;
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
    return {
      jti: String(payload.jti),
      sub: String(payload.sub),
      own: String(payload.own),
    };
  } catch {
    return null;
  }
}

/* ──────────────── short id (gateway URL slug) ──────────────── */

// Crockford base32, no ambiguous chars. 8 chars = 40 bits, plenty for an
// owner's lifetime worth of endpoints with collision retry.
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
  price_per_call: number;
  token_budget: number;
  rate_limit: number;
  status: "live" | "paused";
  created_at: string;
};

export type PayTokenRow = {
  id: string;
  endpoint_id: string;
  owner_id: string;
  budget: number;
  spent: number;
  max_calls: number;
  calls_used: number;
  expires_at: string;
  status: "active" | "expired" | "exhausted" | "revoked";
  issued_at: string;
};

export type TestRunRow = {
  id: string;
  endpoint_id: string;
  pay_token_id: string;
  owner_id: string;
  gross: number;
  fee: number;
  net: number;
  upstream_status: number | null;
  upstream_ms: number | null;
  at: string;
};

export type BlockedRow = {
  id: string;
  endpoint_id: string;
  pay_token_id: string | null;
  owner_id: string;
  reason: "rate_limit_exceeded" | "spend_cap_exceeded" | "token_expired" | "token_revoked" | "endpoint_paused" | "upstream_error";
  attempted: number;
  at: string;
};
