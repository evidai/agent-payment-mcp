/**
 * lc-agent-stripe.ts — Phase 1 PaymentAdapter: real off-session card charge.
 *
 * Slots into the SAME PaymentAdapter interface as the Phase 0 StubAdapter — no
 * other code changes. Activated ONLY when env `LC_PAYMENT_ADAPTER=stripe`;
 * otherwise the Stub stays in force, so merging/deploying this changes nothing.
 *
 * Money model = Direct Charge (identical to /api/lc/stripe/checkout):
 *   • The buyer's card lives as a Customer + PaymentMethod ON THE SELLER's
 *     connected account (saved once via a SetupIntent — see /agent/setup-intent).
 *   • Top-up = an off-session PaymentIntent on that connected account, with the
 *     3% application_fee_amount to the platform (waived under the seller's
 *     lifetime free tier, mirroring checkout). LemonCake never holds funds.
 *
 * Safe by construction:
 *   • No saved PM → returns { ok:false, no_payment_method } and charges nothing.
 *   • 3DS / SCA required → { ok:false, requires_action } — nothing is captured;
 *     the buyer must confirm on-session (Phase 1b UI).
 *   • Stripe test keys (sk_test_) → test-mode charges. Verify here first.
 *   • idempotencyKey is forwarded to Stripe so a retried top-up never
 *     double-charges.
 */

import { sql, FREE_TIER_CALLS } from "@/lib/lc-backend";
import { stripe, applicationFeeAmount } from "@/lib/lc-stripe";
import type { PaymentAdapter, ChargeArgs, ChargeResult } from "@/lib/lc-agent-wallet";

type StripeErr = { code?: string; type?: string; message?: string };

export const StripeOffSessionAdapter: PaymentAdapter = {
  name: "stripe",
  async charge({ buyerKeyId, sellerOwnerId, endpointId, amountCents, idempotencyKey }: ChargeArgs): Promise<ChargeResult> {
    // 1. The Buyer Key's saved card (customer + PM on the connected account).
    const kRows = await sql()<{ stripe_customer_id: string | null; stripe_pm_id: string | null }[]>`
      select stripe_customer_id, stripe_pm_id from lc_buyer_keys where id = ${buyerKeyId} limit 1
    `;
    const k = kRows[0];
    if (!k?.stripe_customer_id || !k?.stripe_pm_id) return { ok: false, error: "no_payment_method" };

    // 2. The seller's connected account (Direct Charge target).
    const oRows = await sql()<{ stripe_account_id: string | null }[]>`
      select stripe_account_id from lc_owners where id = ${sellerOwnerId} limit 1
    `;
    const acct = oRows[0]?.stripe_account_id;
    if (!acct) return { ok: false, error: "seller_not_ready" };

    // 3. Fee waiver under the seller's lifetime free tier (mirrors checkout).
    const usedRows = await sql()<{ c: string }[]>`
      select count(*)::text as c from lc_test_runs where owner_id = ${sellerOwnerId}
    `;
    const fee = Number(usedRows[0]?.c ?? 0) < FREE_TIER_CALLS ? 0 : applicationFeeAmount(amountCents);

    // 4. Off-session PaymentIntent on the connected account.
    try {
      const pi = await stripe().paymentIntents.create(
        {
          amount: amountCents,
          currency: "usd",
          customer: k.stripe_customer_id,
          payment_method: k.stripe_pm_id,
          off_session: true,
          confirm: true,
          ...(fee > 0 ? { application_fee_amount: fee } : {}),
          metadata: { lc_buyer_key_id: buyerKeyId, lc_endpoint_id: endpointId, lc_kind: "agent_topup" },
        },
        { stripeAccount: acct, idempotencyKey: `lc_agent_${buyerKeyId}_${idempotencyKey}` },
      );
      if (pi.status === "succeeded") return { ok: true, chargeRef: pi.id, adapter: "stripe" };
      if (pi.status === "requires_action") return { ok: false, error: "requires_action", requiresAction: true };
      return { ok: false, error: `payment_${pi.status}` };
    } catch (err) {
      const e = err as StripeErr;
      // Off-session declines (insufficient funds, authentication_required, etc.)
      // surface as a structured error; nothing was captured.
      return { ok: false, error: e?.code ?? "charge_failed", requiresAction: e?.code === "authentication_required" };
    }
  },
};

/* ──────────────── card setup (SetupIntent on the connected account) ──────────────── */

/**
 * Create (or reuse) a Customer on the seller's connected account and open a
 * SetupIntent so the buyer can save a card once. Returns the client_secret for
 * Stripe Elements (Phase 1b UI). Card data never touches our servers — only the
 * resulting customer/PM ids are stored on the Buyer Key.
 */
export async function createSetupIntentForKey(
  keyId: string,
  sellerOwnerId: string,
): Promise<{ ok: true; clientSecret: string; customerId: string } | { ok: false; error: string }> {
  const oRows = await sql()<{ stripe_account_id: string | null }[]>`
    select stripe_account_id from lc_owners where id = ${sellerOwnerId} limit 1
  `;
  const acct = oRows[0]?.stripe_account_id;
  if (!acct) return { ok: false, error: "seller_not_ready" };

  const kRows = await sql()<{ stripe_customer_id: string | null }[]>`
    select stripe_customer_id from lc_buyer_keys where id = ${keyId} limit 1
  `;
  let customerId = kRows[0]?.stripe_customer_id ?? null;
  if (!customerId) {
    const c = await stripe().customers.create({ metadata: { lc_buyer_key_id: keyId } }, { stripeAccount: acct });
    customerId = c.id;
    await sql()`update lc_buyer_keys set stripe_customer_id = ${customerId} where id = ${keyId}`;
  }

  const si = await stripe().setupIntents.create(
    { customer: customerId, usage: "off_session", payment_method_types: ["card"], metadata: { lc_buyer_key_id: keyId } },
    { stripeAccount: acct },
  );
  if (!si.client_secret) return { ok: false, error: "setup_intent_failed" };
  return { ok: true, clientSecret: si.client_secret, customerId };
}

/** After the buyer confirms the SetupIntent (Elements), store the resulting PM on the key. */
export async function storePaymentMethodForKey(
  keyId: string,
  sellerOwnerId: string,
  setupIntentId: string,
): Promise<{ ok: true; paymentMethodId: string } | { ok: false; error: string }> {
  const oRows = await sql()<{ stripe_account_id: string | null }[]>`
    select stripe_account_id from lc_owners where id = ${sellerOwnerId} limit 1
  `;
  const acct = oRows[0]?.stripe_account_id;
  if (!acct) return { ok: false, error: "seller_not_ready" };

  // 3-arg form: empty params, then RequestOptions, so TS treats stripeAccount correctly.
  const si = await stripe().setupIntents.retrieve(setupIntentId, {}, { stripeAccount: acct });
  const pm = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id;
  if (si.status !== "succeeded" || !pm) return { ok: false, error: "setup_not_complete" };

  await sql()`update lc_buyer_keys set stripe_pm_id = ${pm} where id = ${keyId}`;
  await propagateCardToSiblings(keyId);
  return { ok: true, paymentMethodId: pm };
}

/* ──────────────── hosted card-save (Stripe Checkout, mode: setup) ──────────────── */

/**
 * Create a hosted Stripe Checkout Session in `setup` mode on the seller's
 * connected account so the buyer can save a card on a Stripe-hosted page
 * (3DS handled there — no Stripe.js / publishable key needed on our side).
 * Mirrors /api/lc/stripe/checkout. The Buyer Key ROW id (not the secret) rides
 * in the success URL so the result page can finalize without re-auth.
 */
export async function createSetupCheckoutForKey(
  keyId: string,
  origin: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const kRows = await sql()<{ seller_owner_id: string; stripe_customer_id: string | null }[]>`
    select seller_owner_id, stripe_customer_id from lc_buyer_keys where id = ${keyId} limit 1
  `;
  const k = kRows[0];
  if (!k) return { ok: false, error: "key_not_found" };

  const oRows = await sql()<{ stripe_account_id: string | null }[]>`
    select stripe_account_id from lc_owners where id = ${k.seller_owner_id} limit 1
  `;
  const acct = oRows[0]?.stripe_account_id;
  if (!acct) return { ok: false, error: "seller_not_ready" };

  let customerId = k.stripe_customer_id;
  if (!customerId) {
    const c = await stripe().customers.create({ metadata: { lc_buyer_key_id: keyId } }, { stripeAccount: acct });
    customerId = c.id;
    await sql()`update lc_buyer_keys set stripe_customer_id = ${customerId} where id = ${keyId}`;
  }

  try {
    const session = await stripe().checkout.sessions.create(
      {
        mode: "setup",
        payment_method_types: ["card"],
        customer: customerId,
        metadata: { lc_buyer_key_id: keyId },
        success_url: `${origin}/agent/card-saved?session_id={CHECKOUT_SESSION_ID}&key=${keyId}`,
        cancel_url: `${origin}/agent/fund?canceled=1`,
      },
      { stripeAccount: acct },
    );
    if (!session.url) return { ok: false, error: "checkout_failed" };
    return { ok: true, url: session.url };
  } catch (err) {
    const e = err as StripeErr;
    return { ok: false, error: e?.code ?? "stripe_error" };
  }
}

/**
 * Finalize a hosted card-save: read the completed setup-mode Checkout Session
 * on the connected account, pull the saved PaymentMethod, store its id on the
 * Buyer Key. Knowing the (single-use) session id is the capability here.
 */
export async function finalizeCardFromSession(
  keyId: string,
  sessionId: string,
): Promise<{ ok: true; paymentMethodId: string } | { ok: false; error: string }> {
  const kRows = await sql()<{ seller_owner_id: string }[]>`
    select seller_owner_id from lc_buyer_keys where id = ${keyId} limit 1
  `;
  const k = kRows[0];
  if (!k) return { ok: false, error: "key_not_found" };

  const oRows = await sql()<{ stripe_account_id: string | null }[]>`
    select stripe_account_id from lc_owners where id = ${k.seller_owner_id} limit 1
  `;
  const acct = oRows[0]?.stripe_account_id;
  if (!acct) return { ok: false, error: "seller_not_ready" };

  try {
    const session = await stripe().checkout.sessions.retrieve(sessionId, { expand: ["setup_intent"] }, { stripeAccount: acct });
    const si = session.setup_intent;
    const pm =
      si && typeof si !== "string"
        ? (typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id ?? null)
        : null;
    if (!pm) return { ok: false, error: "no_payment_method" };
    await sql()`update lc_buyer_keys set stripe_pm_id = ${pm} where id = ${keyId}`;
    await propagateCardToSiblings(keyId);
    return { ok: true, paymentMethodId: pm };
  } catch (err) {
    const e = err as StripeErr;
    return { ok: false, error: e?.message ?? "retrieve_failed" };
  }
}

/**
 * Share a saved card across the workspace: copy this key's customer+PM onto every
 * sibling Buyer Key for the SAME (wallet, seller) that doesn't have one yet. The
 * card is a Customer+PM on the seller's connected account, so it's valid for all
 * of that wallet's keys against that seller. Never overwrites an existing card.
 * Result: the buyer enters a card ONCE, and every endpoint of that seller works.
 */
async function propagateCardToSiblings(keyId: string): Promise<void> {
  await sql()`
    update lc_buyer_keys sib
       set stripe_customer_id = me.stripe_customer_id,
           stripe_pm_id       = me.stripe_pm_id
      from lc_buyer_keys me
     where me.id = ${keyId}
       and sib.wallet_id = me.wallet_id
       and sib.seller_owner_id = me.seller_owner_id
       and sib.id <> me.id
       and me.stripe_customer_id is not null
       and me.stripe_pm_id is not null
       and (sib.stripe_pm_id is null or sib.stripe_customer_id is null)
  `;
}
