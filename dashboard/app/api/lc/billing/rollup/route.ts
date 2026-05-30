/**
 * GET /api/lc/billing/rollup — month-end usage rollup + invoicing (cron).
 *
 * Runs on a Vercel Cron (see vercel.json) on the 1st of each UTC month and
 * bills the PREVIOUS month. For every owner whose metered gateway calls
 * exceeded FREE_CALLS_PER_MONTH, it:
 *   1. Upserts an idempotent lc_billing_runs row keyed (owner_id, period_start),
 *      so a re-run / retry never double-counts or double-charges.
 *   2. If the owner saved a card (billing_method_saved + stripe_customer_id)
 *      and the overage is > $0, creates a Stripe Invoice for the exact amount
 *      (invoice → invoiceItem → finalize → pay) and records the invoice id.
 *      Otherwise the run is marked 'skipped_no_method'.
 *
 * We bill ONLY the metered call overage — never lc_test_runs.fee (that 3% is
 * already collected at prepaid Stripe Connect checkout; re-billing it would
 * double-charge the seller's buyers).
 *
 * Auth: Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}`. A manual
 * `?key=<CRON_SECRET>` is also accepted for ad-hoc runs. If CRON_SECRET is
 * unset the endpoint refuses to run (so it can't be triggered anonymously).
 */

import { NextResponse } from "next/server";
import { backendEnvReady, sql } from "@/lib/lc-backend";
import { stripe, stripeReady } from "@/lib/lc-stripe";
import {
  ensureBillingSchema,
  prevMonthWindowUTC,
  overageRateUsd,
  FREE_CALLS_PER_MONTH,
} from "@/lib/lc-billing";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // never run without a configured secret
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  const key = new URL(req.url).searchParams.get("key");
  return key === secret;
}

type RunResult = {
  ownerId: string;
  calls: number;
  billableCalls: number;
  amountUsd: number;
  status: string;
  invoiceId?: string | null;
  error?: string;
};

export async function GET(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (!authorized(req))   return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await ensureBillingSchema();

  const w = prevMonthWindowUTC();
  const rate = overageRateUsd();

  // Owners whose metered calls in the previous UTC month exceeded the free tier.
  const owners = await sql()<{
    owner_id: string;
    calls: string;
    stripe_customer_id: string | null;
    billing_method_saved: boolean | null;
  }[]>`
    select t.owner_id,
           count(*)::text as calls,
           o.stripe_customer_id,
           o.billing_method_saved
    from lc_test_runs t
    join lc_owners o on o.id = t.owner_id
    where t.at >= ${w.startIso} and t.at < ${w.endIso}
    group by t.owner_id, o.stripe_customer_id, o.billing_method_saved
    having count(*) > ${FREE_CALLS_PER_MONTH}
  `;

  const results: RunResult[] = [];

  for (const row of owners) {
    const ownerId = row.owner_id;
    const calls = Number(row.calls);
    const billableCalls = Math.max(0, calls - FREE_CALLS_PER_MONTH);
    const freeCalls = Math.min(calls, FREE_CALLS_PER_MONTH);
    const amountUsd = Math.round(billableCalls * rate * 100) / 100;
    const amountCents = Math.round(amountUsd * 100);

    // 1) Idempotent run row. on-conflict-do-nothing means a retry won't reset
    //    a row we already invoiced; we re-read status below to decide.
    await sql()`
      insert into lc_billing_runs
        (owner_id, period_start, period_end, calls, free_calls, billable_calls, rate_usd, amount_usd, status)
      values
        (${ownerId}, ${w.startDate}, ${w.endDate}, ${calls}, ${freeCalls}, ${billableCalls}, ${rate}, ${amountUsd}, 'pending')
      on conflict (owner_id, period_start) do nothing
    `;

    const existing = await sql()<{ status: string; stripe_invoice_id: string | null }[]>`
      select status, stripe_invoice_id from lc_billing_runs
      where owner_id = ${ownerId} and period_start = ${w.startDate}
      limit 1
    `;
    const runStatus = existing[0]?.status ?? "pending";

    // Already processed in a prior run — don't re-invoice.
    if (runStatus !== "pending") {
      results.push({ ownerId, calls, billableCalls, amountUsd, status: runStatus, invoiceId: existing[0]?.stripe_invoice_id ?? null });
      continue;
    }

    // No card on file (or Stripe unconfigured / zero amount) — record + skip.
    if (!stripeReady() || !row.billing_method_saved || !row.stripe_customer_id || amountCents <= 0) {
      await sql()`
        update lc_billing_runs set status = 'skipped_no_method', updated_at = now()
        where owner_id = ${ownerId} and period_start = ${w.startDate}
      `;
      results.push({ ownerId, calls, billableCalls, amountUsd, status: "skipped_no_method" });
      continue;
    }

    // 2) Invoice the exact overage: invoice → item → finalize → pay.
    try {
      const desc = `LemonCake gateway usage — ${w.startDate} to ${w.endDate}: ${billableCalls.toLocaleString()} billable calls @ $${rate}/call`;
      const invoice = await stripe().invoices.create({
        customer: row.stripe_customer_id,
        collection_method: "charge_automatically",
        auto_advance: false,
        description: desc,
        metadata: { lc_owner_id: ownerId, lc_period_start: w.startDate, lc_billable_calls: String(billableCalls) },
      });
      await stripe().invoiceItems.create({
        customer: row.stripe_customer_id,
        invoice: invoice.id,
        amount: amountCents,
        currency: "usd",
        description: desc,
      });
      const finalized = await stripe().invoices.finalizeInvoice(invoice.id);
      const paid = await stripe().invoices.pay(finalized.id);

      const finalStatus = paid.status === "paid" ? "paid" : "invoiced";
      await sql()`
        update lc_billing_runs
        set stripe_invoice_id = ${invoice.id}, status = ${finalStatus}, updated_at = now()
        where owner_id = ${ownerId} and period_start = ${w.startDate}
      `;
      results.push({ ownerId, calls, billableCalls, amountUsd, status: finalStatus, invoiceId: invoice.id });
    } catch (err) {
      const e = err as { message?: string };
      console.error("[billing/rollup] invoice failed for", ownerId, e?.message);
      await sql()`
        update lc_billing_runs set status = 'error', updated_at = now()
        where owner_id = ${ownerId} and period_start = ${w.startDate}
      `;
      results.push({ ownerId, calls, billableCalls, amountUsd, status: "error", error: e?.message ?? "invoice_failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    period: { start: w.startDate, end: w.endDate },
    rateUsd: rate,
    freeCallsPerMonth: FREE_CALLS_PER_MONTH,
    ownersBilled: results.length,
    results,
  });
}
