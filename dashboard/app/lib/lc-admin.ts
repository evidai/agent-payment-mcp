/**
 * Admin auth guard for the operator console's cross-owner aggregate routes.
 *
 * Auth model (Vercel/Supabase-native — no legacy Railway dependency):
 *   The operator signs in like any owner (magic link / OAuth at /app), which
 *   pins the httpOnly `lc_owner` cookie and records a verified email on
 *   lc_owners. An owner is an ADMIN iff their verified email is in the
 *   `ADMIN_EMAILS` env (comma-separated). The httpOnly cookie carries the
 *   session — no Bearer token, no localStorage, nothing to steal via XSS, and
 *   no probe to the old Express backend.
 *
 * Secure default: if ADMIN_EMAILS is unset/empty, NO ONE is admin.
 */

import type { NextRequest } from "next/server";
import { readOwnerId, sql } from "@/lib/lc-backend";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** True only for a signed-in owner whose verified email is in ADMIN_EMAILS. */
export async function requireAdmin(_req?: NextRequest): Promise<boolean> {
  const allow = adminEmails();
  if (allow.length === 0) return false; // not configured → deny

  try {
    const ownerId = await readOwnerId();
    if (!ownerId) return false;
    const rows = await sql()<{ email: string | null; email_verified_at: string | null }[]>`
      select email, email_verified_at from lc_owners where id = ${ownerId} limit 1
    `;
    const o = rows[0];
    return !!(o?.email && o.email_verified_at && allow.includes(o.email.toLowerCase()));
  } catch {
    return false;
  }
}

/** Convenience for client gating: does the current session belong to an admin? */
export async function isAdminSession(): Promise<boolean> {
  return requireAdmin();
}
