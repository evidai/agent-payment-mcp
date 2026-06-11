/**
 * Operator console — operational depth beyond /stats:
 *
 *   - revenueDaily:   30-day daily series (prepaid gross/orders + metered calls)
 *   - gatewayHealth:  7-day latency percentiles + error rate over ALL runs
 *                     (test + real — health is about the gateway, not revenue)
 *   - endpointBoard:  per-endpoint rollup (owner, price, sales, calls, blocks)
 *   - tokens:         latest Pay Tokens across all owners (admin oversight)
 *
 * Admin-only: reads across ALL owners, gated by requireAdmin().
 */

import { NextRequest, NextResponse } from "next/server";
import { backendEnvReady, sql } from "@/lib/lc-backend";
import { requireAdmin } from "@/lib/lc-admin";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

/** a***@example.com — keep first char + domain, drop the rest. */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

export async function GET(req: NextRequest) {
  if (!backendEnvReady()) {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  }
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = sql();

  const [daily, health, board, tokens] = await Promise.all([
    // 30-day daily revenue series (JST day boundaries, zero-filled).
    db<{ day: string; gross: number; orders: number; call_gross: number; calls: number }[]>`
      with days as (
        select generate_series(
          date_trunc('day', now() at time zone 'Asia/Tokyo') - interval '29 days',
          date_trunc('day', now() at time zone 'Asia/Tokyo'),
          interval '1 day') as d
      ), p as (
        select date_trunc('day', issued_at at time zone 'Asia/Tokyo') as d,
               sum(budget)::float8 as gross, count(*)::int as orders
        from lc_pay_tokens
        where stripe_checkout_session_id is not null
          and issued_at > now() - interval '31 days'
        group by 1
      ), c as (
        select date_trunc('day', r.at at time zone 'Asia/Tokyo') as d,
               sum(r.gross)::float8 as call_gross, count(*)::int as calls
        from lc_test_runs r
        join lc_pay_tokens t on t.id = r.pay_token_id
        where t.stripe_checkout_session_id is not null
          and r.at > now() - interval '31 days'
        group by 1
      )
      select
        to_char(days.d, 'YYYY-MM-DD')      as day,
        coalesce(p.gross, 0)::float8       as gross,
        coalesce(p.orders, 0)::int         as orders,
        coalesce(c.call_gross, 0)::float8  as call_gross,
        coalesce(c.calls, 0)::int          as calls
      from days
      left join p on p.d = days.d
      left join c on c.d = days.d
      order by days.d
    `,
    // 7-day gateway health over all runs.
    db<{ calls: number; errors: number; avg_ms: number | null; p50: number | null; p95: number | null }[]>`
      select
        count(*)::int as calls,
        count(*) filter (where upstream_status is null or upstream_status >= 500)::int as errors,
        avg(upstream_ms)::float8 as avg_ms,
        percentile_cont(0.5)  within group (order by upstream_ms)::float8 as p50,
        percentile_cont(0.95) within group (order by upstream_ms)::float8 as p95
      from lc_test_runs
      where at > now() - interval '7 days'
    `,
    // Per-endpoint board: sales + usage + blocks, money-makers first.
    db<{
      short_id: string; name: string; status: string; price: number;
      owner_email: string | null;
      purchases: number; purchase_gross: number;
      calls: number; call_gross: number; last_call_at: Date | null;
      blocked7d: number;
    }[]>`
      select
        e.short_id, e.name, e.status,
        e.price_per_call::float8 as price,
        o.email as owner_email,
        coalesce(pt.purchases, 0)::int      as purchases,
        coalesce(pt.gross, 0)::float8       as purchase_gross,
        coalesce(r.calls, 0)::int           as calls,
        coalesce(r.gross, 0)::float8        as call_gross,
        r.last_at                           as last_call_at,
        coalesce(b.blocked, 0)::int         as blocked7d
      from lc_endpoints e
      join lc_owners o on o.id = e.owner_id
      left join lateral (
        select count(*) as purchases, sum(budget) as gross
        from lc_pay_tokens t
        where t.endpoint_id = e.id and t.stripe_checkout_session_id is not null
      ) pt on true
      left join lateral (
        select count(*) as calls, sum(gross) as gross, max(at) as last_at
        from lc_test_runs r where r.endpoint_id = e.id
      ) r on true
      left join lateral (
        select count(*) as blocked
        from lc_blocked b
        where b.endpoint_id = e.id and b.at > now() - interval '7 days'
      ) b on true
      order by coalesce(pt.gross, 0) desc, coalesce(r.calls, 0) desc, e.created_at desc
      limit 100
    `,
    // Latest Pay Tokens across all owners (purchased + seller-issued comps).
    db<{
      id: string; endpoint_name: string | null; short_id: string | null;
      budget: number; spent: number; calls_used: number; max_calls: number;
      status: string; buyer_email: string | null; purchased: boolean;
      issued_at: Date; expires_at: Date;
    }[]>`
      select
        t.id,
        e.name              as endpoint_name,
        e.short_id          as short_id,
        t.budget::float8    as budget,
        t.spent::float8     as spent,
        t.calls_used        as calls_used,
        t.max_calls         as max_calls,
        t.status            as status,
        t.buyer_email       as buyer_email,
        (t.stripe_checkout_session_id is not null) as purchased,
        t.issued_at         as issued_at,
        t.expires_at        as expires_at
      from lc_pay_tokens t
      left join lc_endpoints e on e.id = t.endpoint_id
      order by t.issued_at desc
      limit 120
    `,
  ]);

  const h = health[0];

  return NextResponse.json({
    revenueDaily: daily.map((d) => ({
      day: d.day, gross: d.gross, orders: d.orders, callGross: d.call_gross, calls: d.calls,
    })),
    gatewayHealth: {
      calls7d: h.calls,
      errors7d: h.errors,
      errorRate: h.calls > 0 ? h.errors / h.calls : 0,
      avgMs: h.avg_ms, p50: h.p50, p95: h.p95,
    },
    endpointBoard: board.map((e) => ({
      shortId: e.short_id, name: e.name, status: e.status, price: e.price,
      ownerEmail: maskEmail(e.owner_email),
      purchases: e.purchases, purchaseGross: e.purchase_gross,
      calls: e.calls, callGross: e.call_gross,
      lastCallAt: e.last_call_at, blocked7d: e.blocked7d,
    })),
    tokens: tokens.map((t) => ({
      id: t.id, endpoint: t.endpoint_name, shortId: t.short_id,
      budget: t.budget, spent: t.spent, callsUsed: t.calls_used, maxCalls: t.max_calls,
      status: t.status, buyer: maskEmail(t.buyer_email), purchased: t.purchased,
      issuedAt: t.issued_at, expiresAt: t.expires_at,
    })),
  });
}
