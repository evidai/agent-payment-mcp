/**
 * POST /api/lc/agent/payment-method — finalize a saved card for a Buyer Key (Phase 1).
 *
 * Auth: `Authorization: Bearer bk_...`.
 * Body: { setupIntentId }
 *
 * Called after the buyer confirms the SetupIntent (Stripe Elements). Stores the
 * resulting payment_method id on the Buyer Key so the agent can top up
 * off-session. Stores only the PM reference — never raw card data.
 */
import { NextResponse } from "next/server";
import { backendEnvReady } from "@/lib/lc-backend";
import { stripeReady } from "@/lib/lc-stripe";
import { ensureAgentSchema, authBuyerKey } from "@/lib/lc-agent-wallet";
import { storePaymentMethodForKey } from "@/lib/lc-agent-stripe";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (!stripeReady()) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  await ensureAgentSchema();

  const auth = await authBuyerKey(req);
  if (!auth) return NextResponse.json({ error: "invalid_buyer_key" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }
  const setupIntentId = String(body.setupIntentId ?? "").trim();
  if (!setupIntentId) return NextResponse.json({ error: "missing_setup_intent" }, { status: 400 });

  const r = await storePaymentMethodForKey(auth.key.id, auth.key.seller_owner_id, setupIntentId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "seller_not_ready" ? 409 : 400 });

  return NextResponse.json({ ok: true, paymentMethodId: r.paymentMethodId, cardSaved: true });
}
