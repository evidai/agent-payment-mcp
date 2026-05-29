/**
 * POST /api/lc/stripe/checkout
 *
 * Buyer-facing. Create a Stripe Checkout Session as a DIRECT CHARGE on the
 * seller's connected account so the money lands in the seller's Stripe
 * balance and LemonCake skims a 3% application fee — once, at payment time.
 *
 * Body: { shortId: string, amount: number }   // amount in USD (dollars)
 *
 * Flow:
 *   1. Look up the endpoint by short_id + its owner's connected account.
 *   2. Refuse if the endpoint is paused, free, or the seller can't take
 *      charges yet (onboarding incomplete).
 *   3. Create the session on the connected account (stripeAccount header)
 *      with application_fee_amount = 3% and metadata the webhook / success
 *      page use to mint the prepaid Pay Token.
 *   4. Return the hosted Checkout URL; the client redirects to it.
 */

import { NextResponse } from "next/server";
import { backendEnvReady, sql } from "@/lib/lc-backend";
import { stripe, stripeReady, applicationFeeAmount } from "@/lib/lc-stripe";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const MIN_CENTS = 100;       // $1.00 floor (Stripe min charge is $0.50)
const MAX_CENTS = 500_000;   // $5,000 sanity ceiling per purchase

type Body = { shortId?: string; amount?: number };

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (!stripeReady())     return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const shortId = (body.shortId ?? "").trim();
  const amountCents = Math.round(Number(body.amount) * 100);
  if (!shortId) return NextResponse.json({ error: "endpoint_required" }, { status: 400 });
  if (!Number.isFinite(amountCents) || amountCents < MIN_CENTS || amountCents > MAX_CENTS) {
    return NextResponse.json(
      { error: "invalid_amount", min: MIN_CENTS / 100, max: MAX_CENTS / 100 },
      { status: 400 },
    );
  }

  const rows = await sql()<{
    id: string;
    name: string;
    owner_id: string;
    price_per_call: string;
    status: string;
    stripe_account_id: string | null;
    stripe_charges_enabled: boolean;
  }[]>`
    select e.id, e.name, e.owner_id, e.price_per_call, e.status,
           o.stripe_account_id, o.stripe_charges_enabled
    from lc_endpoints e
    join lc_owners o on o.id = e.owner_id
    where e.short_id = ${shortId}
    limit 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: "endpoint_not_found" }, { status: 404 });
  const ep = rows[0];

  if (ep.status !== "live") {
    return NextResponse.json({ error: "endpoint_paused", message: "This API is paused." }, { status: 409 });
  }
  if (Number(ep.price_per_call) <= 0) {
    return NextResponse.json({ error: "endpoint_free", message: "This API is free — no prepayment needed." }, { status: 409 });
  }
  if (!ep.stripe_account_id || !ep.stripe_charges_enabled) {
    return NextResponse.json({ error: "seller_not_ready", message: "This seller isn't accepting payments yet." }, { status: 409 });
  }

  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "payment",
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: amountCents,
              product_data: {
                name: `${ep.name} — API credit`,
                description: `Prepaid LemonCake API credit, usable at /g/${shortId}`,
              },
            },
          },
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount(amountCents),
        },
        // Metadata the webhook + success page read to mint the Pay Token.
        metadata: {
          lc_endpoint_id: ep.id,
          lc_endpoint_short_id: shortId,
          lc_owner_id: ep.owner_id,
          lc_buyer_credit_cents: String(amountCents),
        },
        success_url: `${origin}/buy/${shortId}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/buy/${shortId}?canceled=1`,
      },
      { stripeAccount: ep.stripe_account_id },
    );

    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    const e = err as { type?: string; code?: string; message?: string; statusCode?: number };
    console.error("[stripe/checkout] failed:", e?.type, e?.code, e?.message);
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
