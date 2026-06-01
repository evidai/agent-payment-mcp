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
  const ownerEmail = owner.email; // narrowed to string for the closures below

  // Determine the return / refresh origin for AccountLink callbacks.
  const url = new URL(req.url);
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;

  let accountId = owner.stripe_account_id;

  // Create a brand-new Express account and persist its id on the owner row.
  async function createFreshAccount(): Promise<string> {
    const account = await stripe().accounts.create({
      type: "express",
      country: "JP",  // Hiroto's platform country; Stripe asks the seller for theirs in onboarding
      email: ownerEmail,
      capabilities: {
        card_payments: { requested: true },
        transfers:     { requested: true },
      },
      business_type: undefined, // let Stripe collect via onboarding
      metadata: { lc_owner_id: owner.id },
    });
    await sql()`
      update lc_owners
      set stripe_account_id = ${account.id}
      where id = ${ownerId}
    `;
    return account.id;
  }

  function freshLink(account: string) {
    // AccountLinks are single-use + expire fast, so we always mint a new one.
    return stripe().accountLinks.create({
      account,
      refresh_url: `${origin}/app?stripe=refresh`,
      return_url:  `${origin}/app?stripe=return`,
      type: "account_onboarding",
    });
  }

  // A stored account id created in the *other* Stripe mode (classic case: a
  // test account left behind after the platform flipped to live keys) can't be
  // used with the current key — Stripe 400s with a message mentioning
  // "testmode"/"live mode". When that happens we drop the stale id and onboard
  // a fresh account so the seller is never permanently stuck.
  function isModeMismatch(e: { message?: string; code?: string }): boolean {
    const m = (e?.message ?? "").toLowerCase();
    return (
      m.includes("testmode") ||
      m.includes("test mode") ||
      m.includes("live mode") ||
      m.includes("test account") ||
      e?.code === "account_invalid"
    );
  }

  // Wrap all Stripe calls so a Stripe-side failure (e.g. Connect not yet
  // enabled on the platform) surfaces as a structured JSON error the UI can
  // show — instead of an unhandled 500 with a non-JSON body, which the
  // client surfaces uselessly as "network_error".
  try {
    if (!accountId) {
      // First time — create the Express account.
      accountId = await createFreshAccount();
    }

    let link;
    try {
      link = await freshLink(accountId);
    } catch (linkErr) {
      const le = linkErr as { message?: string; code?: string };
      if (isModeMismatch(le)) {
        console.warn("[stripe/connect] stale account id, re-onboarding fresh:", accountId, le?.message);
        accountId = await createFreshAccount();
        link = await freshLink(accountId);
      } else {
        throw linkErr;
      }
    }

    return NextResponse.json({
      accountId,
      onboardingUrl: link.url,
      expiresAt: link.expires_at,
    });
  } catch (err) {
    const e = err as { type?: string; code?: string; message?: string; statusCode?: number };
    console.error("[stripe/connect] Stripe call failed:", e?.type, e?.code, e?.message);
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
