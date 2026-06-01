/**
 * GET /api/lc/stripe/status
 *
 * Refresh the current owner's connected-account status from Stripe and
 * sync it back into lc_owners. Returns the cached + freshly-pulled state.
 *
 * The /app dashboard polls this after the user returns from the hosted
 * onboarding flow so we don't need a webhook to know KYC succeeded.
 * (We'll still add a webhook in the next pass for async events.)
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { backendEnvReady, ensureOwnerId, sql } from "@/lib/lc-backend";
import { stripe, stripeReady } from "@/lib/lc-stripe";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function GET() {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (!stripeReady())     return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });

  const ownerId = await ensureOwnerId();
  const rows = await sql()<{
    stripe_account_id: string | null;
    stripe_charges_enabled: boolean;
    stripe_payouts_enabled: boolean;
    stripe_details_submitted: boolean;
    stripe_country: string | null;
  }[]>`
    select stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled,
           stripe_details_submitted, stripe_country
    from lc_owners
    where id = ${ownerId}
    limit 1
  `;
  const cached = rows[0];

  // No connected account yet — nothing to refresh.
  if (!cached?.stripe_account_id) {
    return NextResponse.json({
      connected: false,
      accountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      country: null,
    });
  }

  // Pull fresh state from Stripe. A stored id from the *other* Stripe mode
  // (classic case: a test account left behind after the platform flipped to
  // live keys) throws here with a "testmode"/"test account" message. Rather
  // than 500 on every /app load, we self-heal: drop the stale id so the seller
  // re-onboards cleanly (the connect route then mints a fresh live account).
  let account: Stripe.Account;
  try {
    account = await stripe().accounts.retrieve(cached.stripe_account_id);
  } catch (err) {
    const e = err as { message?: string; code?: string };
    const m = (e?.message ?? "").toLowerCase();
    const modeMismatch =
      m.includes("testmode") ||
      m.includes("test mode") ||
      m.includes("live mode") ||
      m.includes("test account") ||
      e?.code === "account_invalid";
    if (modeMismatch) {
      console.warn("[stripe/status] stale account id cleared:", cached.stripe_account_id, e?.message);
      await sql()`
        update lc_owners
        set stripe_account_id        = null,
            stripe_charges_enabled   = false,
            stripe_payouts_enabled   = false,
            stripe_details_submitted = false,
            stripe_country           = null
        where id = ${ownerId}
      `;
      return NextResponse.json({
        connected: false,
        accountId: null,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
        country: null,
      });
    }
    // Any other Stripe-side error: degrade to the last-known cached state
    // instead of throwing a 500 that breaks the dashboard.
    console.error("[stripe/status] retrieve failed:", e?.code, e?.message);
    return NextResponse.json({
      connected: true,
      accountId: cached.stripe_account_id,
      chargesEnabled:   cached.stripe_charges_enabled,
      payoutsEnabled:   cached.stripe_payouts_enabled,
      detailsSubmitted: cached.stripe_details_submitted,
      country:          cached.stripe_country,
      stale: true,
    });
  }

  const next = {
    chargesEnabled:   account.charges_enabled,
    payoutsEnabled:   account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    country:          account.country ?? null,
  };

  // Sync DB if anything moved.
  const drift =
    next.chargesEnabled   !== cached.stripe_charges_enabled   ||
    next.payoutsEnabled   !== cached.stripe_payouts_enabled   ||
    next.detailsSubmitted !== cached.stripe_details_submitted ||
    next.country          !== cached.stripe_country;
  if (drift) {
    await sql()`
      update lc_owners
      set stripe_charges_enabled   = ${next.chargesEnabled},
          stripe_payouts_enabled   = ${next.payoutsEnabled},
          stripe_details_submitted = ${next.detailsSubmitted},
          stripe_country           = ${next.country}
      where id = ${ownerId}
    `;
  }

  return NextResponse.json({
    connected: true,
    accountId: cached.stripe_account_id,
    chargesEnabled:   next.chargesEnabled,
    payoutsEnabled:   next.payoutsEnabled,
    detailsSubmitted: next.detailsSubmitted,
    country:          next.country,
  });
}
