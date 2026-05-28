/**
 * POST /api/lc/stripe/connect
 *
 * Idempotently create an Express connected account for the current
 * seller (lc_owner) and return a hosted onboarding URL.
 *
 * Flow:
 *   1. Seller must be email-verified (Phase 0a) before connecting Stripe.
 *      Anonymous-cookie sellers get a 403 — Stripe needs a stable identity.
 *   2. If lc_owners.stripe_account_id is empty, create a new Express account.
 *   3. Always (re)create a fresh AccountLink — Stripe links expire after 5 min.
 *   4. Client redirects the user to AccountLink.url; Stripe-hosted form
 *      collects KYB info; user is sent back to /app on completion.
 */

import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql } from "@/lib/lc-backend";
import { stripe, stripeReady } from "@/lib/lc-stripe";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

function notReady() {
  return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
}
function stripeNotReady() {
  return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
}

export async function POST(req: Request) {
  if (!backendEnvReady()) return notReady();
  if (!stripeReady()) return stripeNotReady();

  const ownerId = await ensureOwnerId();

  // Email gate — Stripe Connect needs a contact email that survives cookie wipes.
  const ownerRows = await sql()<{ id: string; email: string | null; stripe_account_id: string | null }[]>`
    select id, email, stripe_account_id
    from lc_owners
    where id = ${ownerId}
    limit 1
  `;
  const owner = ownerRows[0];
  if (!owner) return NextResponse.json({ error: "owner_not_found" }, { status: 404 });
  if (!owner.email) {
    return NextResponse.json({ error: "email_required", message: "Claim your workspace with an email first." }, { status: 403 });
  }

  // Determine the return / refresh origin for AccountLink callbacks.
  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  let accountId = owner.stripe_account_id;

  if (!accountId) {
    // First time — create the Express account.
    const account = await stripe().accounts.create({
      type: "express",
      country: "JP",  // Hiroto's platform country; Stripe asks the seller for theirs in onboarding
      email: owner.email,
      capabilities: {
        card_payments: { requested: true },
        transfers:     { requested: true },
      },
      business_type: undefined, // let Stripe collect via onboarding
      metadata: {
        lc_owner_id: owner.id,
      },
    });

    accountId = account.id;
    await sql()`
      update lc_owners
      set stripe_account_id = ${accountId}
      where id = ${ownerId}
    `;
  }

  // Always mint a fresh AccountLink — they're single-use + expire fast.
  const link = await stripe().accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/app?stripe=refresh`,
    return_url:  `${origin}/app?stripe=return`,
    type: "account_onboarding",
  });

  return NextResponse.json({
    accountId,
    onboardingUrl: link.url,
    expiresAt: link.expires_at,
  });
}
