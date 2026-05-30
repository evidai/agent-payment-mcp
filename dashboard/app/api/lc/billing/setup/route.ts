/**
 * POST /api/lc/billing/setup — provider saves a card for usage billing.
 *
 * Pattern 4: the PROVIDER (seller / lc_owner) pays LemonCake a monthly
 * gateway-usage fee — free for the first FREE_CALLS_PER_MONTH calls, then
 * a small per-call overage. This route is the one-time "save a card" step:
 *
 *   1. Email gate — we need a stable identity for the Stripe Customer.
 *   2. Idempotently ensure a Stripe Customer for this owner (metadata links
 *      it back to lc_owner_id; the customer id is cached on lc_owners).
 *   3. Open a Checkout Session in `mode:"setup"` (no charge now) so Stripe
 *      collects + vaults a card. The webhook promotes billing_status to
 *      'active' once the SetupIntent succeeds.
 *
 * Distinct from /api/lc/stripe/connect (that's the SELLER-RECEIVES Connect
 * account for buyer prepaid checkout). Here the owner is the PAYER.
 */

import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql } from "@/lib/lc-backend";
import { stripe, stripeReady } from "@/lib/lc-stripe";
import { ensureBillingSchema } from "@/lib/lc-billing";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (!stripeReady())     return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });

  await ensureBillingSchema();
  const ownerId = await ensureOwnerId();

  const ownerRows = await sql()<{ id: string; email: string | null; stripe_customer_id: string | null }[]>`
    select id, email, stripe_customer_id
    from lc_owners
    where id = ${ownerId}
    limit 1
  `;
  const owner = ownerRows[0];
  if (!owner) return NextResponse.json({ error: "owner_not_found" }, { status: 404 });
  if (!owner.email) {
    return NextResponse.json(
      { error: "email_required", message: "Claim your workspace with an email first." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  try {
    let customerId = owner.stripe_customer_id;

    // First time — create the Customer and cache it.
    if (!customerId) {
      const customer = await stripe().customers.create({
        email: owner.email,
        metadata: { lc_owner_id: owner.id },
      });
      customerId = customer.id;
      await sql()`
        update lc_owners
        set stripe_customer_id = ${customerId}
        where id = ${ownerId}
      `;
    }

    // Checkout in setup mode: collect + vault a card, charge nothing now.
    const session = await stripe().checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      payment_method_types: ["card"],
      success_url: `${origin}/app?billing=saved`,
      cancel_url:  `${origin}/app?billing=cancel`,
      metadata: { lc_owner_id: owner.id },
    });

    return NextResponse.json({ url: session.url, customerId });
  } catch (err) {
    const e = err as { type?: string; code?: string; message?: string; statusCode?: number };
    console.error("[billing/setup] Stripe call failed:", e?.type, e?.code, e?.message);
    return NextResponse.json(
      {
        error: "stripe_error",
        stripeType: e?.type ?? null,
        stripeCode: e?.code ?? null,
        message: e?.message ?? "Stripe request failed.",
      },
      { status: e?.statusCode && e.statusCode >= 400 && e.statusCode < 600 ? e.statusCode : 502 },
    );
  }
}
