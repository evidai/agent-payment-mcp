/**
 * Operator console — recent platform activity over the live lc_* tables.
 *
 * Two streams, newest first:
 *   - purchases: Stripe-purchased Pay Tokens (a buyer prepaid a bundle)
 *   - calls:     real metered gateway calls — runs on a purchased Pay Token
 *                (seller self-test runs on comp tokens are excluded)
 *   - blocks:    refused calls (rate-limit / spend-cap / expired / paused …)
 *
 * Admin-only: reads across ALL owners. Buyer emails are masked here so the
 * console doesn't expose full PII in a list view.
 */

import { NextRequest, NextResponse } from "next/server";
import { backendEnvReady, sql } from "@/lib/lc-backend";
import { requireAdmin } from "@/lib/lc-admin";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const PLATFORM_FEE = 0.03;

/** a***@example.com — keep first char + domain, drop the rest. */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  return `${email[0]}***${email.slice(at)}`;
}

type PurchaseRow = {
  id: string;
  budget: number;
  endpoint_name: string | null;
  short_id: string | null;
  buyer_email: string | null;
  status: string;
  issued_at: Date;
};

type CallRow = {
  id: string;
  endpoint_name: string | null;
  short_id: string | null;
  gross: number;
  fee: number;
  net: number;
  upstream_status: number | null;
  upstream_ms: number | null;
  at: Date;
};

type BlockRow = {
  id: string;
  endpoint_name: string | null;
  short_id: string | null;
  reason: string;
  attempted: number;
  at: Date;
};

export async function GET(req: NextRequest) {
  if (!backendEnvReady()) {
    return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  }
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = sql();

  const [purchases, calls, blocks] = await Promise.all([
    db<PurchaseRow[]>`
      select
        t.id                as id,
        t.budget::float8    as budget,
        e.name              as endpoint_name,
        e.short_id          as short_id,
        t.buyer_email       as buyer_email,
        t.status            as status,
        t.issued_at         as issued_at
      from lc_pay_tokens t
      left join lc_endpoints e on e.id = t.endpoint_id
      where t.stripe_checkout_session_id is not null
      order by t.issued_at desc
      limit 50
    `,
    db<CallRow[]>`
      select
        r.id                as id,
        e.name              as endpoint_name,
        e.short_id          as short_id,
        r.gross::float8     as gross,
        r.fee::float8       as fee,
        r.net::float8       as net,
        r.upstream_status   as upstream_status,
        r.upstream_ms       as upstream_ms,
        r.at                as at
      from lc_test_runs r
      join lc_pay_tokens t on t.id = r.pay_token_id
      left join lc_endpoints e on e.id = r.endpoint_id
      where t.stripe_checkout_session_id is not null
      order by r.at desc
      limit 50
    `,
    db<BlockRow[]>`
      select
        b.id                as id,
        e.name              as endpoint_name,
        e.short_id          as short_id,
        b.reason            as reason,
        b.attempted::float8 as attempted,
        b.at                as at
      from lc_blocked b
      left join lc_endpoints e on e.id = b.endpoint_id
      order by b.at desc
      limit 50
    `,
  ]);

  return NextResponse.json({
    purchases: purchases.map((p) => ({
      id: p.id,
      endpoint: p.endpoint_name,
      shortId: p.short_id,
      amount: p.budget,
      fee: p.budget * PLATFORM_FEE,
      buyer: maskEmail(p.buyer_email),
      status: p.status,
      at: p.issued_at,
    })),
    calls: calls.map((c) => ({
      id: c.id,
      endpoint: c.endpoint_name,
      shortId: c.short_id,
      gross: c.gross,
      fee: c.fee,
      net: c.net,
      upstreamStatus: c.upstream_status,
      upstreamMs: c.upstream_ms,
      at: c.at,
    })),
    blocks: blocks.map((b) => ({
      id: b.id,
      endpoint: b.endpoint_name,
      shortId: b.short_id,
      reason: b.reason,
      attempted: b.attempted,
      at: b.at,
    })),
  });
}
