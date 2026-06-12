/**
 * Operator console — emergency Pay Token revoke.
 *
 * POST { id: "pt_..." } → sets status='revoked'. The gateway checks token
 * status on every call, so the next call on this token is rejected (and
 * logged to lc_blocked as token_revoked). Idempotent: revoking an already
 * revoked token reports alreadyRevoked instead of failing.
 *
 * Admin-only: this acts across ALL owners, gated by requireAdmin().
 */

import { NextRequest, NextResponse } from "next/server";
import { backendEnvReady, sql } from "@/lib/lc-backend";
import { requireAdmin } from "@/lib/lc-admin";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: NextRequest) {
  if (!backendEnvReady()) {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  }
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { id?: string };
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!/^pt_[a-z0-9]+$/i.test(id)) {
    return NextResponse.json({ error: "invalid_token_id" }, { status: 400 });
  }

  const db = sql();
  const updated = await db<{ id: string }[]>`
    update lc_pay_tokens
    set status = 'revoked'
    where id = ${id} and status <> 'revoked'
    returning id
  `;
  if (updated.length > 0) {
    return NextResponse.json({ ok: true, id, status: "revoked" });
  }

  const exists = await db<{ id: string }[]>`
    select id from lc_pay_tokens where id = ${id} limit 1
  `;
  if (exists.length === 0) {
    return NextResponse.json({ error: "token_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, id, status: "revoked", alreadyRevoked: true });
}
