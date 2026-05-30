/**
 * Pattern 4 — provider-facing usage billing (server-only).
 *
 * The gateway (/g/[shortId]) already meters every paid call into lc_test_runs
 * and waives LemonCake's cut for the first FREE_CALLS_PER_MONTH calls per owner
 * per UTC month. This module turns that metering into a real monthly charge:
 * a provider saves a card once (Stripe Checkout in `setup` mode), then a
 * month-end Vercel cron (/api/lc/billing/rollup) rolls up each owner's overage
 * calls and invoices them via Stripe.
 *
 * Billing model: free FREE_CALLS_PER_MONTH gateway calls / owner / UTC month,
 * then LC_OVERAGE_RATE_USD per call beyond the threshold. This is a SaaS
 * gateway-usage fee charged to the PROVIDER — deliberately DISTINCT from the
 * buyer-side 3% take rate collected at prepaid checkout (lc-stripe.ts), which
 * is left untouched. We never bill lc_test_runs.fee here (that 3% is already
 * collected at Stripe Connect checkout for prepaid buyers; re-billing it would
 * double-charge).
 *
 * Imports only `sql` from lc-backend, so it stays server-only and free of any
 * Stripe dependency — the Stripe calls live in the route handlers.
 */

import { sql } from "@/lib/lc-backend";

/** Free gateway calls per owner per UTC calendar month (matches the gateway's fee-waiver tier). */
export const FREE_CALLS_PER_MONTH = 3000;

/** Per-call overage price (USD) beyond the free tier. Tunable via env; defaults to $0.001/call ($1 / 1,000 calls). */
export function overageRateUsd(): number {
  const v = Number(process.env.LC_OVERAGE_RATE_USD);
  return Number.isFinite(v) && v >= 0 ? v : 0.001;
}

/* ──────────────── lazy schema (mirrors ensureGrowthSchema) ──────────────── */

let _billingSchemaReady: Promise<void> | null = null;

const BILLING_DDL = `
alter table lc_owners add column if not exists stripe_customer_id   text;
alter table lc_owners add column if not exists billing_status       text not null default 'none';
alter table lc_owners add column if not exists billing_method_saved boolean not null default false;
alter table lc_owners add column if not exists billing_setup_at      timestamptz;
create unique index if not exists lc_owners_stripe_customer_unq on lc_owners(stripe_customer_id) where stripe_customer_id is not null;

create table if not exists lc_billing_runs (
  id                uuid primary key default gen_random_uuid(),
  owner_id          text not null references lc_owners(id) on delete cascade,
  period_start      date not null,
  period_end        date not null,
  calls             int not null default 0,
  free_calls        int not null default 0,
  billable_calls    int not null default 0,
  rate_usd          numeric(12,6) not null default 0,
  amount_usd        numeric(12,6) not null default 0,
  stripe_invoice_id text,
  status            text not null default 'pending',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists lc_billing_runs_owner_period_unq on lc_billing_runs(owner_id, period_start);
create index if not exists lc_billing_runs_owner_idx on lc_billing_runs(owner_id, period_start desc);
create index if not exists lc_billing_runs_invoice_idx on lc_billing_runs(stripe_invoice_id) where stripe_invoice_id is not null;
`;

/** Apply the Pattern-4 billing DDL once per warm instance. Idempotent + safe. */
export function ensureBillingSchema(): Promise<void> {
  if (!_billingSchemaReady) {
    _billingSchemaReady = (async () => {
      try {
        // One statement at a time — pgbouncer (prepare:false) can't run a
        // multi-statement string, and none of our DDL contains embedded
        // semicolons. Each is IF NOT EXISTS, so order/re-runs are harmless.
        const statements = BILLING_DDL.split(";").map((s) => s.trim()).filter(Boolean);
        for (const stmt of statements) {
          await sql().unsafe(stmt);
        }
      } catch (err) {
        _billingSchemaReady = null; // let a later request retry
        throw err;
      }
    })();
  }
  return _billingSchemaReady;
}

/* ──────────────── UTC month windows ──────────────── */

export type MonthWindow = {
  startIso: string;   // inclusive lower bound (timestamptz compare)
  endIso: string;     // exclusive upper bound
  startDate: string;  // 'YYYY-MM-DD' (period_start)
  endDate: string;    // 'YYYY-MM-DD' (period_end, exclusive)
};

/** The UTC calendar month containing `ref` (default: now). */
export function monthWindowUTC(ref: Date = new Date()): MonthWindow {
  const start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

/** The UTC calendar month immediately before the month containing `ref`. */
export function prevMonthWindowUTC(ref: Date = new Date()): MonthWindow {
  const anchor = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - 1, 1, 0, 0, 0, 0));
  return monthWindowUTC(anchor);
}

/* ──────────────── usage rollup ──────────────── */

export type Usage = {
  calls: number;
  freeCalls: number;
  billableCalls: number;
  rateUsd: number;
  amountUsd: number;   // rounded to cents
};

/** Count an owner's metered gateway calls in a window and compute the billable overage. */
export async function getOwnerUsage(ownerId: string, w: MonthWindow): Promise<Usage> {
  const rows = await sql()<{ count: string }[]>`
    select count(*)::text as count from lc_test_runs
    where owner_id = ${ownerId} and at >= ${w.startIso} and at < ${w.endIso}
  `;
  const calls = Number(rows[0]?.count ?? 0);
  const freeCalls = Math.min(calls, FREE_CALLS_PER_MONTH);
  const billableCalls = Math.max(0, calls - FREE_CALLS_PER_MONTH);
  const rateUsd = overageRateUsd();
  const amountUsd = Math.round(billableCalls * rateUsd * 100) / 100;
  return { calls, freeCalls, billableCalls, rateUsd, amountUsd };
}
