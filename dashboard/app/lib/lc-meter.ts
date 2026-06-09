/**
 * lc-meter.ts — shared metering core for BOTH money paths.
 *
 *   • /g/[shortId]        — the buyer-facing gateway proxy (validate → forward → settle).
 *   • /api/sdk/{preflight,charge} — the seller-side in-process SDK billing (Phase 2).
 *
 * The two paths MUST agree byte-for-byte on (a) what makes a Pay Token spendable
 * and (b) how the platform fee / free-tier is computed — otherwise the gateway
 * and the SDK would charge differently for the same call. This module is the
 * single source of truth for that math, so there is no drift.
 *
 * It is deliberately side-effect-light: pure predicates + the two DB reads the
 * fee decision needs. The callers own their logging (lc_blocked / lc_test_runs)
 * and HTTP shaping.
 */

import { sql, FREE_TIER_CALLS, type PayTokenRow } from "@/lib/lc-backend";

/** The platform take-rate once an owner crosses the lifetime free tier. */
export const PLATFORM_FEE_RATE = 0.03;

/**
 * Why a Pay Token is not spendable for one priced call. Mirrors the exact set
 * of checks the gateway has always made, in the same priority order:
 *   revoked → expired → exhausted (calls) → over-budget.
 */
export type TokenRejectReason =
  | "token_revoked"
  | "token_expired"
  | "token_exhausted"
  | "spend_cap_exceeded";

export type SpendCheck = { ok: true } | { ok: false; reason: TokenRejectReason };

/**
 * Pure decision: can this token row absorb one `charge` right now?
 * No DB writes, no status mutation — the caller decides what side effects
 * (status flip to expired/exhausted, lc_blocked row) to apply for the reason.
 */
export function checkTokenSpendable(tok: PayTokenRow, charge: number, nowMs: number): SpendCheck {
  if (tok.status === "revoked") return { ok: false, reason: "token_revoked" };
  if (new Date(tok.expires_at).getTime() < nowMs || tok.status === "expired") {
    return { ok: false, reason: "token_expired" };
  }
  if (tok.calls_used >= tok.max_calls || tok.status === "exhausted") {
    return { ok: false, reason: "token_exhausted" };
  }
  if (Number(tok.spent) + charge > Number(tok.budget)) {
    return { ok: false, reason: "spend_cap_exceeded" };
  }
  return { ok: true };
}

/**
 * Free tier: an owner's FIRST FREE_TIER_CALLS settled calls — ONCE, for the
 * lifetime of the owner (no monthly reset) — incur fee = 0. After that the 3%
 * take-rate kicks in. Counted off lc_test_runs (the settled-charge ledger that
 * BOTH paths write to), so the gateway and the SDK see the same threshold.
 */
export async function isOwnerInFreeTier(ownerId: string): Promise<boolean> {
  const rows = await sql()<{ count: string }[]>`
    select count(*)::text as count from lc_test_runs where owner_id = ${ownerId}
  `;
  return Number(rows[0]?.count ?? 0) < FREE_TIER_CALLS;
}

/** Split a gross charge into platform fee + seller net (97% after free tier). */
export function computeFee(charge: number, inFreeTier: boolean): { fee: number; net: number } {
  const fee = inFreeTier ? 0 : charge * PLATFORM_FEE_RATE;
  return { fee, net: charge - fee };
}

/**
 * Per-endpoint rate limit: count of settled calls in the trailing 60s window.
 * Returns true if a new call would exceed `limit`. Shared so the SDK path
 * enforces the same ceiling the gateway does.
 */
export async function isRateLimited(endpointId: string, limit: number): Promise<boolean> {
  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const rows = await sql()<{ count: string }[]>`
    select count(*)::text as count from lc_test_runs
    where endpoint_id = ${endpointId} and at >= ${sinceIso}
  `;
  return Number(rows[0]?.count ?? 0) >= limit;
}
