/**
 * Referral program — sellers recruiting sellers.
 *
 *   GET  → this owner's referral code (lazily created), share URL, bonus state.
 *   POST → claim a referral code ({ code }) as the CURRENT owner's referrer.
 *
 * Reward: when a referred owner creates their FIRST endpoint ("goes live"),
 * BOTH sides get +REFERRAL_BONUS_CALLS added to their fee-free call allowance
 * (free_calls_bonus, applied on top of FREE_TIER_CALLS at checkout time).
 * The credit fires once, in POST /api/lc/endpoints, guarded by
 * referral_credited_at — claiming a code after you already have endpoints
 * sets referred_by but can never trigger a credit.
 *
 * The referral code is a separate random slug — NEVER the owner id (the
 * lc_owner cookie value is the session credential and must not be shared).
 */

import { NextResponse } from "next/server";
import { backendEnvReady, ensureGrowthSchema, ensureOwnerId, sql } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export const REFERRAL_BONUS_CALLS = 3000;

function newCode(): string {
  // 10 chars base36 — unguessable enough for a growth code, short enough to share.
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("").slice(0, 10);
}

export async function GET(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  await ensureGrowthSchema();
  const ownerId = await ensureOwnerId();
  const db = sql();

  let [me] = await db<{ referral_code: string | null; free_calls_bonus: number; referred_by: string | null }[]>`
    select referral_code, coalesce(free_calls_bonus, 0)::int as free_calls_bonus, referred_by
    from lc_owners where id = ${ownerId} limit 1
  `;

  // Lazily mint a code; retry on the (astronomically unlikely) unique clash.
  if (!me?.referral_code) {
    for (let i = 0; i < 3; i++) {
      const code = newCode();
      const updated = await db<{ referral_code: string }[]>`
        update lc_owners set referral_code = ${code}
        where id = ${ownerId} and referral_code is null
        returning referral_code
      `;
      if (updated.length > 0) { me = { ...me, referral_code: updated[0].referral_code }; break; }
      const [again] = await db<{ referral_code: string | null }[]>`
        select referral_code from lc_owners where id = ${ownerId} limit 1
      `;
      if (again?.referral_code) { me = { ...me, referral_code: again.referral_code }; break; }
    }
  }

  const [stats] = await db<{ referred: number; credited: number }[]>`
    select
      count(*)::int as referred,
      count(*) filter (where referral_credited_at is not null)::int as credited
    from lc_owners where referred_by = ${ownerId}
  `;

  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  return NextResponse.json({
    code: me?.referral_code ?? null,
    shareUrl: me?.referral_code ? `${origin}/app?ref=${me.referral_code}` : null,
    bonusCalls: me?.free_calls_bonus ?? 0,
    bonusPerReferral: REFERRAL_BONUS_CALLS,
    referred: stats?.referred ?? 0,
    referredLive: stats?.credited ?? 0,
    referredBy: me?.referred_by != null,
  });
}

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  await ensureGrowthSchema();
  const ownerId = await ensureOwnerId();

  const body = (await req.json().catch(() => ({}))) as { code?: string };
  const code = typeof body.code === "string" ? body.code.trim().toLowerCase() : "";
  if (!/^[a-z0-9]{6,16}$/.test(code)) {
    return NextResponse.json({ error: "invalid_code" }, { status: 400 });
  }

  const db = sql();
  const refs = await db<{ id: string }[]>`
    select id from lc_owners where referral_code = ${code} limit 1
  `;
  if (refs.length === 0) return NextResponse.json({ ok: true, claimed: false, reason: "code_not_found" });
  const referrerId = refs[0].id;
  if (referrerId === ownerId) return NextResponse.json({ ok: true, claimed: false, reason: "self" });

  const updated = await db<{ id: string }[]>`
    update lc_owners set referred_by = ${referrerId}
    where id = ${ownerId} and referred_by is null
    returning id
  `;
  return NextResponse.json({ ok: true, claimed: updated.length > 0 });
}
