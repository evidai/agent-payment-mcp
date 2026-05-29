/**
 * GET /api/lc/stripe/checkout-result?session_id=cs_...&shortId=xxxx
 *
 * The buyer lands here (via the /buy/[shortId]/success page) after returning
 * from Stripe-hosted Checkout. We:
 *   1. Resolve the endpoint + its seller's connected account from shortId.
 *   2. Retrieve the Checkout Session ON that connected account.
 *   3. Verify it's paid, then idempotently mint the prepaid Pay Token.
 *   4. Return the signed JWT + usage info so the buyer can call the gateway.
 *
 * Knowledge of the (single-use, unguessable) session id is the capability
 * here — it only ends up in the success URL of the buyer who completed the
 * payment. We still re-check payment_status === "paid" before minting.
 *
 * This is the PRIMARY delivery path; it works with no webhook configured.
 */

import { NextResponse } from "next/server";
import { backendEnvReady, sql } from "@/lib/lc-backend";
import { stripe, stripeReady } from "@/lib/lc-stripe";
import { mintPrepaidToken } from "@/lib/lc-credits";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function GET(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (!stripeReady())     return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  const shortId = url.searchParams.get("shortId");
  if (!sessionId || !shortId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const rows = await sql()<{
    id: string;
    name: string;
    owner_id: string;
    stripe_account_id: string | null;
  }[]>`
    select e.id, e.name, e.owner_id, o.stripe_account_id
    from lc_endpoints e
    join lc_owners o on o.id = e.owner_id
    where e.short_id = ${shortId}
    limit 1
  `;
  if (rows.length === 0) return NextResponse.json({ error: "endpoint_not_found" }, { status: 404 });
  const ep = rows[0];
  if (!ep.stripe_account_id) return NextResponse.json({ error: "seller_not_ready" }, { status: 409 });

  let session;
  try {
    // stripeAccount is a RequestOption (3rd arg); pass empty params 2nd so TS
    // routes it correctly instead of treating it as SessionRetrieveParams.
    session = await stripe().checkout.sessions.retrieve(sessionId, {}, { stripeAccount: ep.stripe_account_id });
  } catch (err) {
    const e = err as { message?: string };
    return NextResponse.json({ error: "stripe_error", message: e?.message ?? "retrieve failed" }, { status: 502 });
  }

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return NextResponse.json({ paid: false, status: session.payment_status });
  }

  // Sanity: the session metadata must point at this endpoint.
  if (session.metadata?.lc_endpoint_id && session.metadata.lc_endpoint_id !== ep.id) {
    return NextResponse.json({ error: "session_endpoint_mismatch" }, { status: 409 });
  }

  const creditCents = Number(session.metadata?.lc_buyer_credit_cents ?? session.amount_total ?? 0);
  const buyerEmail = session.customer_details?.email ?? null;

  const minted = await mintPrepaidToken({
    sessionId,
    endpointId: ep.id,
    ownerId: ep.owner_id,
    creditCents,
    buyerEmail,
  });
  if (!minted.ok) return NextResponse.json({ error: minted.error }, { status: 500 });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;
  return NextResponse.json({
    paid: true,
    jwt: minted.jwt,
    token: {
      id: minted.row.id,
      budget: minted.row.budget,
      maxCalls: minted.row.max_calls,
      expiresAt: minted.row.expires_at,
    },
    endpoint: { shortId, name: ep.name },
    gatewayUrl: `${origin}/g/${shortId}`,
  });
}
