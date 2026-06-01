/**
 * POST /api/lc/agent/setup-intent — start saving a card for a Buyer Key (Phase 1).
 *
 * Auth: `Authorization: Bearer bk_...`.
 * Returns a Stripe SetupIntent client_secret (on the seller's connected
 * account) for Stripe Elements. The buyer enters the card once; afterwards the
 * agent can top up off-session. Card data never touches our servers.
 *
 * This is the only step that needs a human (one-time per seller). The future
 * one-click "approve $X for this seller" UI wraps exactly this call.
 */
import { NextResponse } from "next/server";
import { backendEnvReady } from "@/lib/lc-backend";
import { stripeReady } from "@/lib/lc-stripe";
import { ensureAgentSchema, authBuyerKey } from "@/lib/lc-agent-wallet";
import { createSetupIntentForKey } from "@/lib/lc-agent-stripe";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (!stripeReady()) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  await ensureAgentSchema();

  const auth = await authBuyerKey(req);
  if (!auth) return NextResponse.json({ error: "invalid_buyer_key" }, { status: 401 });

  const r = await createSetupIntentForKey(auth.key.id, auth.key.seller_owner_id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "seller_not_ready" ? 409 : 502 });

  return NextResponse.json({ clientSecret: r.clientSecret, customerId: r.customerId });
}
