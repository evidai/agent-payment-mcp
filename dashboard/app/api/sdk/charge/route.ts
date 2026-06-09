/**
 * POST /api/sdk/charge — Phase 2 seller-side billing, step 2 of 2.
 *
 * Auth: `Authorization: Bearer sk_live_…` (the same Seller Key as preflight).
 * Body: { chargeId, success }
 *
 *   success=true  → CONFIRM: record seller earnings (lc_test_runs, 3% platform
 *                   fee after the free tier). Budget was already debited at
 *                   reserve, so no double-spend.
 *   success=false → CANCEL: refund the reservation, write no earnings row.
 *
 * Idempotent: re-confirming or re-cancelling the same chargeId is a no-op that
 * echoes the terminal state.
 *
 *   → { ok:true, charged, remaining, chargeRef, settled }
 */
import { NextResponse } from "next/server";
import { backendEnvReady } from "@/lib/lc-backend";
import { ensureSdkSchema, resolveSellerKey, settleCharge } from "@/lib/lc-sdk";
import { ensureAgentIdentitySchema } from "@/lib/lc-agents";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  // NOTE: no kill-switch gate here — a charge that's already been reserved must
  // be allowed to settle/cancel so budget isn't stranded. The switch blocks new
  // reservations at /preflight (and the gateway), which is the right seam.
  await ensureSdkSchema();
  await ensureAgentIdentitySchema(); // lc_test_runs.agent_id for settlement

  const sellerKey = await resolveSellerKey(req);
  if (!sellerKey) return NextResponse.json({ error: "invalid_seller_key" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const chargeId = String(body.chargeId ?? "").trim();
  const success = body.success === true;
  if (!chargeId) return NextResponse.json({ error: "missing_charge_id" }, { status: 400 });

  const r = await settleCharge({ sellerKey, chargeId, success });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });

  return NextResponse.json({
    ok: true,
    charged: r.charged,
    remaining: r.remaining,
    chargeRef: r.chargeRef,
    settled: r.settled,
  });
}
