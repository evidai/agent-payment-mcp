/**
 * POST /api/lc/demo/token — login-free sandbox Pay Token for the public /demo.
 *
 * Unlike /api/lc/tokens (which is scoped to the visitor's owner cookie), this
 * route uses a single fixed DEMO_OWNER and a single shared demo endpoint, so
 * anyone can try the gateway without signing up.
 *
 * Safety: there is NO real money in this path — the dashboard gateway
 * (/g/<shortId>) only meters gross/fee/net into lc_test_runs; no on-chain USDC
 * moves. Tokens are still tightly bounded (small budget, few calls, 1h TTL) to
 * keep the ledger tidy.
 *
 * Idempotent: lazily ensures the demo owner + demo endpoint exist on first hit.
 */

import { NextResponse } from "next/server";
import {
  backendEnvReady,
  sql,
  shortId,
  signPayToken,
  type EndpointRow,
  type PayTokenRow,
} from "@/lib/lc-backend";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

// ── Fixed demo identity (shared across all visitors) ──────────────
const DEMO_OWNER = "o_lemoncake_demo";
const DEMO_SLUG = "demo";
const DEMO_NAME = "LemonCake Demo API";

// ── Demo economics / bounds ───────────────────────────────────────
const DEMO_PRICE = 0.01; // $/call
const DEMO_TOKEN_BUDGET = 0.2; // $ per issued token → 20 calls @ $0.01
const DEMO_MAX_CALLS = 20;
const DEMO_TTL_HOURS = 1;
const DEMO_RATE_LIMIT = 600; // generous: endpoint rate limit is shared by all visitors
const DEMO_ENDPOINT_BUDGET = 1.0; // token_budget reference for the endpoint row

const notReady = () =>
  NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

async function ensureDemoOwner(): Promise<void> {
  await sql()`insert into lc_owners (id) values (${DEMO_OWNER}) on conflict (id) do nothing`;
}

async function selectDemoEndpoint(): Promise<EndpointRow | null> {
  const rows = await sql()<EndpointRow[]>`
    select * from lc_endpoints
    where owner_id = ${DEMO_OWNER} and slug = ${DEMO_SLUG}
    order by created_at asc limit 1
  `;
  return rows[0] ?? null;
}

async function ensureDemoEndpoint(origin: string): Promise<EndpointRow> {
  const existing = await selectDemoEndpoint();
  if (existing) return existing;

  const originalUrl = `${origin}/api/lc/demo/echo`;

  let sid = shortId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await sql()<{ id: string }[]>`
      select id from lc_endpoints where short_id = ${sid} limit 1
    `;
    if (clash.length === 0) break;
    sid = shortId();
  }

  await sql()`
    insert into lc_endpoints
      (short_id, owner_id, name, slug, original_url, upstream_auth, price_per_call, token_budget, rate_limit, status)
    values
      (${sid}, ${DEMO_OWNER}, ${DEMO_NAME}, ${DEMO_SLUG}, ${originalUrl}, null,
       ${DEMO_PRICE}, ${DEMO_ENDPOINT_BUDGET}, ${DEMO_RATE_LIMIT}, 'live')
  `;

  // Re-select the canonical row (handles the rare concurrent-create race).
  const canonical = await selectDemoEndpoint();
  if (!canonical) throw new Error("demo_endpoint_create_failed");
  return canonical;
}

export async function POST(req: Request) {
  if (!backendEnvReady()) return notReady();

  await ensureDemoOwner();
  const origin = new URL(req.url).origin;
  const ep = await ensureDemoEndpoint(origin);

  // Keep the upstream URL in sync with the current origin (prod vs preview vs
  // local) so the gateway never tries to fetch a stale host.
  const wantUrl = `${origin}/api/lc/demo/echo`;
  if (ep.original_url !== wantUrl) {
    await sql()`update lc_endpoints set original_url = ${wantUrl} where id = ${ep.id}`;
    ep.original_url = wantUrl;
  }

  const jti = `pt_demo_${crypto.randomUUID().replace(/-/g, "").slice(0, 18)}`;
  const expiresAt = Date.now() + DEMO_TTL_HOURS * 3600 * 1000;

  await sql()<PayTokenRow[]>`
    insert into lc_pay_tokens
      (id, endpoint_id, owner_id, budget, spent, max_calls, calls_used, expires_at, status)
    values
      (${jti}, ${ep.id}, ${DEMO_OWNER}, ${DEMO_TOKEN_BUDGET}, 0, ${DEMO_MAX_CALLS}, 0,
       ${new Date(expiresAt).toISOString()}, 'active')
  `;

  const jwt = await signPayToken({ jti, sub: ep.id, own: DEMO_OWNER }, expiresAt);

  return NextResponse.json(
    {
      jwt,
      shortId: ep.short_id,
      gatewayPath: `/g/${ep.short_id}`,
      endpoint: { name: ep.name, pricePerCall: Number(ep.price_per_call) },
      token: {
        jti,
        budget: DEMO_TOKEN_BUDGET,
        maxCalls: DEMO_MAX_CALLS,
        expiresAt: new Date(expiresAt).toISOString(),
      },
    },
    { status: 201 },
  );
}
