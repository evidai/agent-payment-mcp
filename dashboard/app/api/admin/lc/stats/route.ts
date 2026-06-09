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

  // Providers — REAL providers only, not every anonymous cookie owner.
  // lc_owners gets one row per visitor (ensureOwnerId upserts a cookie owner
  // on the public lc routes), so count(*) over the raw table is meaningless
  // (mostly empty ghosts). We count owners who have actually published an
  // endpoint OR made a real (Stripe-purchased) sale — the same population the
  // Provider table lists — so this KPI equals the rows you see there.
  const [owners] = await db<{ total: number; with_stripe: number; live_charges: number }[]>`
    with p as (
      select o.stripe_account_id, o.stripe_charges_enabled
      from lc_owners o
      where exists (select 1 from lc_endpoints e where e.owner_id = o.id)
         or exists (select 1 from lc_pay_tokens t
                      where t.owner_id = o.id and t.stripe_checkout_session_id is not null)
    )
    select
      count(*)::int                                              as total,
      count(*) filter (where stripe_account_id is not null)::int as with_stripe,
      count(*) filter (where stripe_charges_enabled)::int        as live_charges
    from p
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

  // Gateway calls metered — REAL buyer calls only (runs on a Stripe-purchased
  // Pay Token). lc_test_runs also logs sellers test-calling their own endpoint
  // with a comp/test token; counting those conflated test traffic with real
  // usage (e.g. "6 calls / $0.06" while the purchased token only spent $0.01).
  // Same rule as "sales": real == has a checkout session.
  const [calls] = await db<{ total: number; gross: number }[]>`
    select
      count(*)::int                      as total,
      coalesce(sum(r.gross), 0)::float8  as gross
    from lc_test_runs r
    join lc_pay_tokens t on t.id = r.pay_token_id
    where t.stripe_checkout_session_id is not null
  `;

  // ── Activation funnel — where the 624→0 actually dies ─────────────────────
  // Staged counts so the cliff is visible. Supply side is owner-keyed; the
  // demand cliff is the jump from "issued a token" to "a real buyer paid".
  const [funnel] = await db<{
    owners_total: number; owners_endpoint: number; owners_priced: number;
    owners_token: number; owners_purchase: number; owners_paid_call: number;
    ep_total: number; ep_priced: number; ep_purchase: number; ep_paid_call: number;
    agents_total: number; share_7d: number;
  }[]>`
    select
      (select count(*) from lc_owners)::int as owners_total,
      (select count(distinct owner_id) from lc_endpoints)::int as owners_endpoint,
      (select count(distinct owner_id) from lc_endpoints where price_per_call > 0)::int as owners_priced,
      (select count(distinct owner_id) from lc_pay_tokens)::int as owners_token,
      (select count(distinct owner_id) from lc_pay_tokens where stripe_checkout_session_id is not null)::int as owners_purchase,
      (select count(distinct t.owner_id) from lc_test_runs r join lc_pay_tokens t on t.id = r.pay_token_id
         where t.stripe_checkout_session_id is not null)::int as owners_paid_call,
      (select count(*) from lc_endpoints)::int as ep_total,
      (select count(*) from lc_endpoints where price_per_call > 0)::int as ep_priced,
      (select count(distinct endpoint_id) from lc_pay_tokens where stripe_checkout_session_id is not null)::int as ep_purchase,
      (select count(distinct r.endpoint_id) from lc_test_runs r join lc_pay_tokens t on t.id = r.pay_token_id
         where t.stripe_checkout_session_id is not null)::int as ep_paid_call,
      (case when to_regclass('public.lc_agents') is not null
            then (select count(*) from lc_agents) else 0 end)::int as agents_total,
      (select count(*) from lc_share_events where created_at > now() - interval '7 days')::int as share_7d
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
      count(*)              filter (where r.at >= b.day_start)::int            as today_calls,
      coalesce(sum(r.gross) filter (where r.at >= b.day_start),   0)::float8  as today_gross,
      count(*)              filter (where r.at >= b.month_start)::int          as month_calls,
      coalesce(sum(r.gross) filter (where r.at >= b.month_start), 0)::float8  as month_gross,
      count(*)::int                                                            as all_calls,
      coalesce(sum(r.gross), 0)::float8                                        as all_gross
    from lc_test_runs r
    join lc_pay_tokens t on t.id = r.pay_token_id
    cross join b
    where t.stripe_checkout_session_id is not null
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
    funnel: {
      owners: funnel.owners_total,
      ownersWithEndpoint: funnel.owners_endpoint,
      ownersWithPriced: funnel.owners_priced,
      ownersWithToken: funnel.owners_token,
      ownersWithPurchase: funnel.owners_purchase,
      ownersWithPaidCall: funnel.owners_paid_call,
      endpoints: funnel.ep_total,
      endpointsPriced: funnel.ep_priced,
      endpointsWithPurchase: funnel.ep_purchase,
      endpointsWithPaidCall: funnel.ep_paid_call,
      agents: funnel.agents_total,
      shareEvents7d: funnel.share_7d,
    },
    blocked7d: blocked.total,
    feeRate: PLATFORM_FEE,
  });
}
