/**
 * POST /api/sdk/preflight — Phase 2 seller-side billing, step 1 of 2.
 *
 * Auth: `Authorization: Bearer sk_live_…` (a Seller Key, bound to one endpoint).
 * Body: { payToken, amount?, idempotencyKey, toolName? }
 *
 * Verifies the buyer's Pay Token is spendable for THIS seller's resource and
 * RESERVES the charge (atomic budget debit). Returns a chargeId the seller
 * confirms or cancels via /api/sdk/charge after the tool runs. A failed tool is
 * never charged because settlement happens on the confirm call, not here.
 *
 *   → { allowed:true, chargeId, currency:"usd", required, remaining }
 *   → { allowed:false, reason }   (402/403/429 per reason)
 */
import { NextResponse } from "next/server";
import { backendEnvReady, isGatewayHalted } from "@/lib/lc-backend";
import { ensureSdkSchema, resolveSellerKey, preflight } from "@/lib/lc-sdk";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (await isGatewayHalted()) return NextResponse.json({ error: "gateway_halted" }, { status: 503 });
  await ensureSdkSchema();

  const sellerKey = await resolveSellerKey(req);
  if (!sellerKey) return NextResponse.json({ error: "invalid_seller_key" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const payToken = String(body.payToken ?? "").trim();
  const idempotencyKey = String(body.idempotencyKey ?? "").trim();
  const toolName = body.toolName != null ? String(body.toolName) : null;
  const amount = body.amount != null ? Number(body.amount) : undefined;
  if (!payToken) return NextResponse.json({ error: "missing_pay_token" }, { status: 400 });
  if (!idempotencyKey) return NextResponse.json({ error: "missing_idempotency_key" }, { status: 400 });

  const r = await preflight({ sellerKey, payToken, amount, idempotencyKey, toolName });
  if (!r.allowed) return NextResponse.json({ allowed: false, reason: r.reason }, { status: r.status });

  return NextResponse.json({
    allowed: true,
    chargeId: r.chargeId,
    currency: r.currency,
    required: r.required,
    remaining: r.remaining,
    ...(r.alreadyReserved ? { alreadyReserved: true } : {}),
  });
}
