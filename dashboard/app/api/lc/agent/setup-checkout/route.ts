/**
 * POST /api/lc/agent/setup-checkout — hosted card-save (Stripe Checkout, setup mode).
 *
 * Auth: `Authorization: Bearer bk_...`.
 * Returns a Stripe-hosted URL where the buyer saves a card (3DS handled by
 * Stripe). On completion they return to /agent/card-saved, which finalizes via
 * /api/lc/agent/card-result. No Stripe.js / publishable key needed on our side.
 */
import { NextResponse } from "next/server";
import { backendEnvReady } from "@/lib/lc-backend";
import { stripeReady } from "@/lib/lc-stripe";
import { ensureAgentSchema, authBuyerKey } from "@/lib/lc-agent-wallet";
import { createSetupCheckoutForKey } from "@/lib/lc-agent-stripe";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (!stripeReady()) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  await ensureAgentSchema();

  const auth = await authBuyerKey(req);
  if (!auth) return NextResponse.json({ error: "invalid_buyer_key" }, { status: 401 });

  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  const r = await createSetupCheckoutForKey(auth.key.id, origin);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "seller_not_ready" ? 409 : 502 });

  return NextResponse.json({ url: r.url });
}
