/**
 * POST /api/lc/billing/webhook — Stripe events for provider usage billing.
 *
 * Listens to PLATFORM-account events (the provider's card lives on the
 * platform customer, not a connected account) so it uses its OWN signing
 * secret, STRIPE_BILLING_WEBHOOK_SECRET — deliberately separate from the
 * Connect webhook's STRIPE_WEBHOOK_SECRET.
 *
 * Events handled:
 *   - checkout.session.completed (mode=setup): the provider finished saving a
 *     card. Pull the SetupIntent → set it as the customer's default payment
 *     method → flip billing_method_saved/billing_status to active.
 *   - invoice.paid: the monthly overage invoice cleared → mark the run paid.
 *   - invoice.payment_failed: mark the owner past_due + the run failed.
 *
 * Setup (Stripe Dashboard → Developers → Webhooks):
 *   - Endpoint: https://www.lemoncake.xyz/api/lc/billing/webhook
 *   - Events: checkout.session.completed, invoice.paid, invoice.payment_failed
 *   - Copy the signing secret into STRIPE_BILLING_WEBHOOK_SECRET.
 *
 * Until STRIPE_BILLING_WEBHOOK_SECRET is set we return 503 so Stripe retries.
 */

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { backendEnvReady, sql } from "@/lib/lc-backend";
import { stripe, stripeReady } from "@/lib/lc-stripe";
import { ensureBillingSchema } from "@/lib/lc-billing";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady() || !stripeReady()) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET;
  if (!secret) {
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

  await ensureBillingSchema();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "setup") break;
        const ownerId = session.metadata?.lc_owner_id ?? null;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

        // Resolve the saved card from the SetupIntent and make it the
        // customer's default so month-end invoices charge automatically.
        let paymentMethodId: string | null = null;
        if (session.setup_intent) {
          const siId = typeof session.setup_intent === "string" ? session.setup_intent : session.setup_intent.id;
          const si = await stripe().setupIntents.retrieve(siId);
          paymentMethodId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id ?? null;
        }
        if (customerId && paymentMethodId) {
          await stripe().customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId },
          });
        }

        if (ownerId) {
          await sql()`
            update lc_owners
            set billing_method_saved = true,
                billing_status       = 'active',
                billing_setup_at     = now()
            where id = ${ownerId}
          `;
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await sql()`
          update lc_billing_runs
          set status = 'paid', updated_at = now()
          where stripe_invoice_id = ${invoice.id}
        `;
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
        await sql()`
          update lc_billing_runs
          set status = 'failed', updated_at = now()
          where stripe_invoice_id = ${invoice.id}
        `;
        if (customerId) {
          await sql()`
            update lc_owners
            set billing_status = 'past_due'
            where stripe_customer_id = ${customerId}
          `;
        }
        break;
      }

      default:
        // ignore other events
        break;
    }
  } catch (err) {
    console.error("[billing/webhook] handler failed:", (err as Error)?.message);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
