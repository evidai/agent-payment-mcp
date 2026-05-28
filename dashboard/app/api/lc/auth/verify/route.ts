/**
 * GET /api/lc/auth/verify?token=...
 *
 * Consumes a magic link. Resolves to an lc_owner row by email:
 *   - If an owner with this email already exists → swap the cookie to it (login).
 *   - Else if the requester has an anonymous owner cookie → claim it (set its email).
 *   - Else → create a fresh owner with this email and set the cookie.
 *
 * Always redirects to /app on success. On failure, redirects to /app with
 * an ?auth=<reason> hint that the dashboard can show.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendEnvReady, sql } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const OWNER_COOKIE = "lc_owner";

function redirectTo(url: string, reason?: string) {
  const target = new URL(url);
  if (reason) target.searchParams.set("auth", reason);
  return NextResponse.redirect(target.toString(), { status: 303 });
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  if (!backendEnvReady()) return redirectTo(`${origin}/app`, "backend_not_configured");

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return redirectTo(`${origin}/app`, "missing_token");

  // 1. Load + consume the magic link in a single statement so a replay can't
  //    succeed even if the user double-clicks.
  const consumed = await sql()<{ email: string; prev_owner_id: string | null }[]>`
    update lc_magic_links
    set used_at = now()
    where token = ${token}
      and used_at is null
      and expires_at > now()
    returning email, prev_owner_id
  `;
  if (consumed.length === 0) return redirectTo(`${origin}/app`, "invalid_or_expired");
  const { email, prev_owner_id: prevOwnerId } = consumed[0];

  // 2. Pick the resolved owner row.
  const existing = await sql()<{ id: string }[]>`
    select id from lc_owners where email = ${email} limit 1
  `;

  let resolvedOwnerId: string;

  if (existing.length > 0) {
    // Login: this email already owns a workspace. Use it.
    resolvedOwnerId = existing[0].id;
    // Touch verified-at on every successful verify.
    await sql()`
      update lc_owners set email_verified_at = now() where id = ${resolvedOwnerId}
    `;
  } else if (prevOwnerId) {
    // Claim: stamp the email on the existing anonymous owner.
    await sql()`
      update lc_owners
      set email = ${email}, email_verified_at = now()
      where id = ${prevOwnerId}
    `;
    resolvedOwnerId = prevOwnerId;
  } else {
    // Fresh: create a new owner with this email.
    const newId = `o_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    await sql()`
      insert into lc_owners (id, email, email_verified_at)
      values (${newId}, ${email}, now())
    `;
    resolvedOwnerId = newId;
  }

  // 3. Pin the resolved owner ID to the browser cookie.
  const c = await cookies();
  c.set(OWNER_COOKIE, resolvedOwnerId, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return redirectTo(`${origin}/app`, "signed_in");
}
