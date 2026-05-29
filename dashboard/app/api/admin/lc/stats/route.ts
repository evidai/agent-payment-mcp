/**
 * Operator console — platform-wide KPI rollup over the live lc_* tables.
 *
 * Post-pivot model (see schema.sql Phase 2): buyers prepay on /buy/[shortId]
 * via Stripe Checkout, which mints ONE Pay Token whose budget == amount paid.
 * The 3% platform fee is taken once at Checkout, not per call. So:
 *   - gross  = total prepaid (sum of purchased Pay Token budgets)
 *   - fee    = LemonCake's 3% cut of gross
 *   - net    = what providers receive (gross - fee, ≈97%)
 *   - calls  = gateway calls actually metered (lc_test_runs)
 *   - outstanding = prepaid credit not yet consumed (budget - spent on live tokens)
 *
 * A purchased token is distinguished from a seller-issued test/comp token by
 * the presence of stripe_checkout_session_id.
 *
 * Admin-only: reads across ALL owners, so it is gated by requireAdmin().
 */

import { NextRequest, NextResponse } from "next/server";
import { backendEnvReady, sql } from "@/lib/lc-backend";
import { requireAdmin } from "@/lib/lc-admin";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const PLATFORM_FEE = 0.03;

export async function GET(req: NextRequest) {
  if (!backendEnvReady()) {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  }
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = sql();

  // Providers (owners) + how many have a sellable endpoint / Stripe connected.
  const [owners] = await db<{ total: number; with_stripe: number; live_charges: number }[]>`
    select
      count(*)::int                                              as total,
      count(*) filter (where stripe_account_id is not null)::int as with_stripe,
      count(*) filter (where stripe_charges_enabled)::int        as live_charges
    from lc_owners
  `;

  // Endpoints (APIs) — total, sellable (priced), live.
  const [endpoints] = await db<{ total: number; sellable: number; live: number }[]>`
    select
      count(*)::int                                       as total,
      count(*) filter (where price_per_call > 0)::int     as sellable,
      count(*) filter (where status = 'live')::int        as live
    from lc_endpoints
  `;

  // Prepaid sales: only Stripe-purchased Pay Tokens (have a checkout session).
  const [sales] = await db<{ orders: number; gross: number; spent: number; buyers: number }[]>`
    select
      count(*)::int                                         as orders,
      coalesce(sum(budget), 0)::float8                      as gross,
      coalesce(sum(spent), 0)::float8                       as spent,
      count(distinct buyer_email)::int                      as buyers
    from lc_pay_tokens
    where stripe_checkout_session_id is not null
  `;

  // Providers who have made at least one real sale.
  const [withSale] = await db<{ providers_with_sale: number }[]>`
    select count(distinct owner_id)::int as providers_with_sale
    from lc_pay_tokens
    where stripe_checkout_session_id is not null
  `;

  // Outstanding (unconsumed) prepaid credit on still-usable purchased tokens.
  const [outstanding] = await db<{ amount: number }[]>`
    select coalesce(sum(budget - spent), 0)::float8 as amount
    from lc_pay_tokens
    where stripe_checkout_session_id is not null
      and status = 'active'
  `;

  // Gateway calls metered (across all owners).
  const [calls] = await db<{ total: number; gross: number }[]>`
    select
      count(*)::int                      as total,
      coalesce(sum(gross), 0)::float8    as gross
    from lc_test_runs
  `;

  // Blocked attempts (rate-limit / spend-cap / expired …) — last 7 days.
  const [blocked] = await db<{ total: number }[]>`
    select count(*)::int as total
    from lc_blocked
    where at > now() - interval '7 days'
  `;

  // ── Time-series: 今日 / 今月 / 累計 (JST day & month boundaries) ──────────────
  // now() is UTC; we truncate in JST wall-clock then convert the naive JST
  // midnight back to a timestamptz instant so the >= compares correctly.
  const [salesTs] = await db<{
    today_gross: number; today_orders: number;
    month_gross: number; month_orders: number;
    all_gross: number;   all_orders: number;
  }[]>`
    with b as (
      select
        date_trunc('day',   now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo' as day_start,
        date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo' as month_start
    )
    select
      coalesce(sum(budget) filter (where issued_at >= b.day_start),   0)::float8 as today_gross,
      count(*)             filter (where issued_at >= b.day_start)::int           as today_orders,
      coalesce(sum(budget) filter (where issued_at >= b.month_start), 0)::float8 as month_gross,
      count(*)             filter (where issued_at >= b.month_start)::int         as month_orders,
      coalesce(sum(budget), 0)::float8                                            as all_gross,
      count(*)::int                                                               as all_orders
    from lc_pay_tokens t, b
    where t.stripe_checkout_session_id is not null
  `;

  const [callsTs] = await db<{
    today_calls: number; today_gross: number;
    month_calls: number; month_gross: number;
    all_calls: number;   all_gross: number;
  }[]>`
    with b as (
      select
        date_trunc('day',   now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo' as day_start,
        date_trunc('month', now() at time zone 'Asia/Tokyo') at time zone 'Asia/Tokyo' as month_start
    )
    select
      count(*)            filter (where at >= b.day_start)::int             as today_calls,
      coalesce(sum(gross) filter (where at >= b.day_start),   0)::float8   as today_gross,
      count(*)            filter (where at >= b.month_start)::int           as month_calls,
      coalesce(sum(gross) filter (where at >= b.month_start), 0)::float8   as month_gross,
      count(*)::int                                                         as all_calls,
      coalesce(sum(gross), 0)::float8                                       as all_gross
    from lc_test_runs r, b
  `;

  const window = (g: number, orders: number, calls: number, callGross: number) => ({
    gross: g,
    fee: g * PLATFORM_FEE,
    net: g - g * PLATFORM_FEE,
    orders,
    calls,
    callGross,
  });

  const gross = sales.gross;
  const fee = gross * PLATFORM_FEE;
  const net = gross - fee;

  return NextResponse.json({
    providers: {
      total: owners.total,
      withStripe: owners.with_stripe,
      chargesEnabled: owners.live_charges,
      withSale: withSale.providers_with_sale,
    },
    endpoints: {
      total: endpoints.total,
      sellable: endpoints.sellable,
      live: endpoints.live,
    },
    sales: {
      orders: sales.orders,
      buyers: sales.buyers,
      gross,
      fee,
      net,
      spent: sales.spent,
      outstanding: outstanding.amount,
    },
    gateway: {
      calls: calls.total,
      grossMetered: calls.gross,
    },
    timeseries: {
      today: window(salesTs.today_gross, salesTs.today_orders, callsTs.today_calls, callsTs.today_gross),
      month: window(salesTs.month_gross, salesTs.month_orders, callsTs.month_calls, callsTs.month_gross),
      all:   window(salesTs.all_gross,   salesTs.all_orders,   callsTs.all_calls,   callsTs.all_gross),
    },
    blocked7d: blocked.total,
    feeRate: PLATFORM_FEE,
  });
}
