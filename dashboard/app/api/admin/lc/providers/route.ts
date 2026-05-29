/**
 * Operator console — per-provider rollup over the live lc_* tables.
 *
 * One row per owner who has either an endpoint or a sale, ordered by prepaid
 * gross (biggest sellers first). "gross" counts only Stripe-purchased Pay
 * Tokens (those with a checkout session); test/comp tokens are excluded.
 *
 * Admin-only: reads across ALL owners.
 */

import { NextRequest, NextResponse } from "next/server";
import { backendEnvReady, sql } from "@/lib/lc-backend";
import { requireAdmin } from "@/lib/lc-admin";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const PLATFORM_FEE = 0.03;

type Row = {
  owner_id: string;
  email: string | null;
  created_at: Date;
  stripe_account_id: string | null;
  charges_enabled: boolean;
  endpoints: number;
  sellable: number;
  orders: number;
  gross: number;
  spent: number;
  calls: number;
  last_sale: Date | null;
};

export async function GET(req: NextRequest) {
  if (!backendEnvReady()) {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  }
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = sql();

  const rows = await db<Row[]>`
    select
      o.id                          as owner_id,
      o.email                       as email,
      o.created_at                  as created_at,
      o.stripe_account_id           as stripe_account_id,
      o.stripe_charges_enabled      as charges_enabled,
      (select count(*)::int from lc_endpoints e where e.owner_id = o.id)                       as endpoints,
      (select count(*)::int from lc_endpoints e where e.owner_id = o.id and e.price_per_call > 0) as sellable,
      (select count(*)::int from lc_pay_tokens t
         where t.owner_id = o.id and t.stripe_checkout_session_id is not null)                 as orders,
      (select coalesce(sum(budget), 0)::float8 from lc_pay_tokens t
         where t.owner_id = o.id and t.stripe_checkout_session_id is not null)                 as gross,
      (select coalesce(sum(spent), 0)::float8 from lc_pay_tokens t
         where t.owner_id = o.id and t.stripe_checkout_session_id is not null)                 as spent,
      (select count(*)::int from lc_test_runs r where r.owner_id = o.id)                       as calls,
      (select max(issued_at) from lc_pay_tokens t
         where t.owner_id = o.id and t.stripe_checkout_session_id is not null)                 as last_sale
    from lc_owners o
    where exists (select 1 from lc_endpoints e where e.owner_id = o.id)
       or exists (select 1 from lc_pay_tokens t where t.owner_id = o.id and t.stripe_checkout_session_id is not null)
    order by gross desc, endpoints desc
    limit 200
  `;

  const providers = rows.map((r) => ({
    ownerId: r.owner_id,
    email: r.email,
    createdAt: r.created_at,
    stripeConnected: !!r.stripe_account_id,
    chargesEnabled: r.charges_enabled,
    endpoints: r.endpoints,
    sellable: r.sellable,
    orders: r.orders,
    gross: r.gross,
    fee: r.gross * PLATFORM_FEE,
    net: r.gross - r.gross * PLATFORM_FEE,
    spent: r.spent,
    outstanding: r.gross - r.spent,
    calls: r.calls,
    lastSale: r.last_sale,
  }));

  return NextResponse.json({ providers });
}
