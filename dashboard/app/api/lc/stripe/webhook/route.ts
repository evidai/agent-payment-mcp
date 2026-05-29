/**
 * POST /api/lc/stripe/webhook
 *
 * OPTIONAL reconciliation layer. The /buy success page already mints the
 * Pay Token on fetch, so the happy path needs no webhook. This endpoint
 * exists so that if the buyer closes the tab before returning, the token is
 * still minted server-side (and the seller's token list stays consistent).
 *
 * Setup (Stripe Dashboard → Developers → Webhooks):
 *   - Add endpoint: https://www.lemoncake.xyz/api/lc/stripe/webhook
 *   - Enable "Listen to events on Connected accounts" (Direct Charges fire on
 *     the connected account, not the platform).
 *   - Select event: checkout.session.completed
 *   - Copy the signing secret into STRIPE_WEBHOOK_SECRET.
 *
 * Until STRIPE_WEBHOOK_SECRET is set we return 503 so Stripe retries later.
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { backendEnvReady } from "@/lib/lc-backend";
import { stripe, stripeReady } from "@/lib/lc-stripe";
import { mintPrepaidToken } from "@/lib/lc-credits";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady() || !stripeReady()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Webhook not wired up yet — the success-page fetch covers delivery.
    return NextResponse.json({ error: "webhook_secret_missing" }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const e = err as { message?: string };
    return NextResponse.json({ error: "invalid_signature", message: e?.message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid" || session.payment_status === "no_payment_required") {
      const md = session.metadata ?? {};
      const endpointId = md.lc_endpoint_id;
      const ownerId = md.lc_owner_id;
      const creditCents = Number(md.lc_buyer_credit_cents ?? session.amount_total ?? 0);
      if (endpointId && ownerId && creditCents > 0) {
        const r = await mintPrepaidToken({
          sessionId: session.id,
          endpointId,
          ownerId,
          creditCents,
          buyerEmail: session.customer_details?.email ?? null,
        });
        if (!r.ok) console.error("[stripe/webhook] mint failed:", r.error, session.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
