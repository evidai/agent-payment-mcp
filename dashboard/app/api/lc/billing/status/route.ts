/**
 * GET /api/lc/billing/status — provider's usage-billing snapshot.
 *
 * Read-only: uses readOwnerId (does NOT create an owner cookie) so the /app
 * Billing pane can poll it freely. Returns whether a card is saved plus the
 * current UTC month's call count, free-tier remaining, billable overage and
 * the estimated charge at the configured rate.
 */

import { NextResponse } from "next/server";
import { backendEnvReady, readOwnerId, sql } from "@/lib/lc-backend";
import { stripeReady } from "@/lib/lc-stripe";
import {
  ensureBillingSchema,
  getOwnerUsage,
  monthWindowUTC,
  overageRateUsd,
  FREE_CALLS_PER_MONTH,
} from "@/lib/lc-billing";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function GET() {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

  const ownerId = await readOwnerId();
  if (!ownerId) {
    return NextResponse.json({
      billingStatus: "none",
      methodSaved: false,
      stripeReady: stripeReady(),
      freeCallsPerMonth: FREE_CALLS_PER_MONTH,
      rateUsd: overageRateUsd(),
      thisMonth: null,
    });
  }

  await ensureBillingSchema();

  const rows = await sql()<{
    billing_status: string | null;
    billing_method_saved: boolean | null;
  }[]>`
    select billing_status, billing_method_saved
    from lc_owners
    where id = ${ownerId}
    limit 1
  `;
  const owner = rows[0];

  const w = monthWindowUTC();
  const usage = await getOwnerUsage(ownerId, w);
  const freeRemaining = Math.max(0, FREE_CALLS_PER_MONTH - usage.calls);

  return NextResponse.json({
    billingStatus: owner?.billing_status ?? "none",
    methodSaved: owner?.billing_method_saved ?? false,
    stripeReady: stripeReady(),
    freeCallsPerMonth: FREE_CALLS_PER_MONTH,
    rateUsd: usage.rateUsd,
    thisMonth: {
      calls: usage.calls,
      freeRemaining,
      billableCalls: usage.billableCalls,
      estAmountUsd: usage.amountUsd,
      periodStart: w.startDate,
      periodEnd: w.endDate,
    },
  });
}
