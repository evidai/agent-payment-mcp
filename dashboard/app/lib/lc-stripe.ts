/**
 * Stripe client singleton + helpers for Connect Express onboarding.
 *
 * Server-side only — never expose STRIPE_SECRET_KEY to the browser.
 *
 * Architecture (Direct Charge model):
 *   Buyer → Checkout Session on Seller's connected account
 *   Application fee (3%) goes to LemonCake's platform balance
 *   97% lands directly in Seller's Stripe account
 *   LemonCake never holds funds.
 */

import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function stripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY not configured. See dashboard/SETUP-BACKEND.md.");
  }
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-09-30.clover" as Stripe.LatestApiVersion,
      typescript: true,
      appInfo: {
        name: "LemonCake",
        url: "https://www.lemoncake.xyz",
      },
    });
  }
  return _stripe;
}

export function stripeReady(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function isTestMode(): boolean {
  return !!process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_");
}

/**
 * The platform fee in basis points (300 = 3%). Applied as
 * application_fee_amount when buyers pay via Direct Charge.
 */
export const LC_PLATFORM_FEE_BPS = 300;

export function applicationFeeAmount(grossInCents: number): number {
  return Math.floor((grossInCents * LC_PLATFORM_FEE_BPS) / 10_000);
}
