/**
 * /g/[shortId] — production gateway proxy.
 *
 * Buyer-facing:
 *   POST https://www.lemoncake.xyz/g/<shortId>
 *   Authorization: Bearer <Pay-Token-JWT>
 *
 * Behavior:
 *   1. Verify JWT signature (HS256, LC_JWT_SECRET).
 *   2. Look up endpoint by short_id, ensure JWT.sub matches it.
 *   3. Validate Pay Token row: not revoked / expired / exhausted,
 *      budget > price, recent calls < rate_limit.
 *   4. Forward to endpoint.original_url with stored upstream_auth attached.
 *   5. On 2xx-4xx: decrement spend + calls, log lc_test_runs.
 *      On 5xx / network failure: refund, log lc_blocked.upstream_error.
 *   6. Stream the upstream response back with x-lemoncake-* trace headers.
 */

import { NextResponse } from "next/server";
import { backendEnvReady, sql, verifyPayToken, type EndpointRow, type PayTokenRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";
// Pin gateway functions to Tokyo so they sit next to the Supabase DB
// (we picked hnd1 there too). Cuts the per-call DB round-trip latency
// from ~120ms (transpacific) to ~10ms.
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ shortId: string }> };

const STRIP_HEADERS = new Set([
  "host", "connection", "content-length", "transfer-encoding",
  "keep-alive", "proxy-authenticate", "proxy-authorization", "te",
  "trailer", "upgrade",
  "authorization", // replaced with upstream_auth
  "cookie",        // never leak buyer's cookies upstream
]);

// CORS — gateway is meant to be called by buyer agents running anywhere,
// including in-browser. Allow any origin, expose our trace headers.
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": req.headers.get("access-control-request-headers") || "Authorization, Content-Type",
    "Access-Control-Allow-Credentials": "false",
    "Access-Control-Expose-Headers": "x-lemoncake-charge, x-lemoncake-upstream-ms",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonErr(req: Request, status: number, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...extra }, { status, headers: corsHeaders(req) });
}

async function handle(req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return jsonErr(req, 503, "backend_not_configured");

  const { shortId } = await params;

  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return jsonErr(req, 401, "missing_pay_token");
  const jwt = m[1].trim();

  const claims = await verifyPayToken(jwt);
  if (!claims) return jsonErr(req, 401, "invalid_pay_token");

  const eps = await sql()<EndpointRow[]>`
    select * from lc_endpoints where short_id = ${shortId} limit 1
  `;
  if (eps.length === 0) return jsonErr(req, 404, "endpoint_not_found");
  const ep = eps[0];

  if (claims.sub !== ep.id) return jsonErr(req, 403, "token_endpoint_mismatch");

  const charge = Number(ep.price_per_call);

  if (ep.status !== "live") {
    await sql()`
      insert into lc_blocked (endpoint_id, pay_token_id, owner_id, reason, attempted)
      values (${ep.id}, ${claims.jti}, ${ep.owner_id}, 'endpoint_paused', ${charge})
    `;
    return jsonErr(req, 503, "endpoint_paused");
  }

  const tokens = await sql()<PayTokenRow[]>`
    select * from lc_pay_tokens where id = ${claims.jti} limit 1
  `;
  if (tokens.length === 0) return jsonErr(req, 401, "pay_token_not_found");
  const tok = tokens[0];

  if (tok.status === "revoked") {
    await sql()`
      insert into lc_blocked (endpoint_id, pay_token_id, owner_id, reason, attempted)
      values (${ep.id}, ${tok.id}, ${ep.owner_id}, 'token_revoked', ${charge})
    `;
    return jsonErr(req, 403, "token_revoked");
  }
  if (new Date(tok.expires_at).getTime() < Date.now() || tok.status === "expired") {
    if (tok.status !== "expired") {
      await sql()`update lc_pay_tokens set status = 'expired' where id = ${tok.id}`;
    }
    await sql()`
      insert into lc_blocked (endpoint_id, pay_token_id, owner_id, reason, attempted)
      values (${ep.id}, ${tok.id}, ${ep.owner_id}, 'token_expired', ${charge})
    `;
    return jsonErr(req, 401, "token_expired");
  }
  if (tok.calls_used >= tok.max_calls) {
    if (tok.status !== "exhausted") {
      await sql()`update lc_pay_tokens set status = 'exhausted' where id = ${tok.id}`;
    }
    await sql()`
      insert into lc_blocked (endpoint_id, pay_token_id, owner_id, reason, attempted)
      values (${ep.id}, ${tok.id}, ${ep.owner_id}, 'spend_cap_exceeded', ${charge})
    `;
    return jsonErr(req, 402, "token_exhausted");
  }
  if (Number(tok.spent) + charge > Number(tok.budget)) {
    await sql()`
      insert into lc_blocked (endpoint_id, pay_token_id, owner_id, reason, attempted)
      values (${ep.id}, ${tok.id}, ${ep.owner_id}, 'spend_cap_exceeded', ${charge})
    `;
    return jsonErr(req, 402, "spend_cap_exceeded");
  }

  // Rate limit: paid calls for this endpoint in the last 60s
  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const recent = await sql()<{ count: string }[]>`
    select count(*)::text as count from lc_test_runs
    where endpoint_id = ${ep.id} and at >= ${sinceIso}
  `;
  if (Number(recent[0]?.count ?? 0) >= ep.rate_limit) {
    await sql()`
      insert into lc_blocked (endpoint_id, pay_token_id, owner_id, reason, attempted)
      values (${ep.id}, ${tok.id}, ${ep.owner_id}, 'rate_limit_exceeded', ${charge})
    `;
    return jsonErr(req, 429, "rate_limit_exceeded");
  }

  // Build upstream request
  const fwdHeaders = new Headers();
  req.headers.forEach((v, k) => {
    if (!STRIP_HEADERS.has(k.toLowerCase())) fwdHeaders.set(k, v);
  });
  if (ep.upstream_auth) {
    const idx = ep.upstream_auth.indexOf(":");
    if (idx > 0) {
      fwdHeaders.set(ep.upstream_auth.slice(0, idx).trim(), ep.upstream_auth.slice(idx + 1).trim());
    }
  }

  const body = req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS"
    ? undefined
    : await req.arrayBuffer();

  const t0 = performance.now();
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(ep.original_url, {
      method: req.method,
      headers: fwdHeaders,
      body,
      redirect: "follow",
    });
  } catch (err) {
    await sql()`
      insert into lc_blocked (endpoint_id, pay_token_id, owner_id, reason, attempted)
      values (${ep.id}, ${tok.id}, ${ep.owner_id}, 'upstream_error', ${charge})
    `;
    return jsonErr(req, 502, "upstream_unreachable", {
      detail: err instanceof Error ? err.message : "unknown",
    });
  }
  const ms = Math.round(performance.now() - t0);

  if (upstreamRes.status >= 500) {
    await sql()`
      insert into lc_blocked (endpoint_id, pay_token_id, owner_id, reason, attempted)
      values (${ep.id}, ${tok.id}, ${ep.owner_id}, 'upstream_error', ${charge})
    `;
  } else {
    // Free tier: first 3,000 paid calls per owner per UTC calendar month
    // have fee = 0. Buyer still pays `charge` to the seller; LemonCake's cut
    // just doesn't kick in until call 3,001.
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const usedRow = await sql()<{ count: string }[]>`
      select count(*)::text as count from lc_test_runs
      where owner_id = ${ep.owner_id} and at >= ${monthStart.toISOString()}
    `;
    const usedThisMonth = Number(usedRow[0]?.count ?? 0);
    const FREE_TIER = 3000;
    const inFreeTier = usedThisMonth < FREE_TIER;

    const fee = inFreeTier ? 0 : charge * 0.03;
    const net = charge - fee;
    const newCalls = tok.calls_used + 1;
    const newSpent = Number(tok.spent) + charge;
    const newStatus = newCalls >= tok.max_calls ? "exhausted" : tok.status;

    await Promise.all([
      sql()`
        update lc_pay_tokens
        set calls_used = ${newCalls}, spent = ${newSpent}, status = ${newStatus}
        where id = ${tok.id}
      `,
      sql()`
        insert into lc_test_runs (endpoint_id, pay_token_id, owner_id, gross, fee, net, upstream_status, upstream_ms)
        values (${ep.id}, ${tok.id}, ${ep.owner_id}, ${charge}, ${fee}, ${net}, ${upstreamRes.status}, ${ms})
      `,
    ]);
  }

  // Buffer the upstream body before relaying it. We must NOT stream
  // undici's response body straight through: fetch() transparently
  // decompresses the payload, so the bytes we hold are already plain even
  // though upstream's `content-encoding: gzip/br` header is still present.
  // Re-emitting that header over plain bytes makes Vercel's edge and HTTP
  // clients try to decode them again and end up with an empty/corrupt body.
  // Buffering + dropping content-encoding/content-length guarantees the
  // buyer receives exactly the bytes we actually have.
  const nullBody =
    upstreamRes.status === 101 ||
    upstreamRes.status === 204 ||
    upstreamRes.status === 205 ||
    upstreamRes.status === 304;
  const outBody = nullBody ? null : await upstreamRes.arrayBuffer();

  // Relay response back to buyer (with CORS so browser-side agents work)
  const outHeaders = new Headers();
  upstreamRes.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (lk === "content-length" || lk === "transfer-encoding" || lk === "connection") return;
    // Body is already decoded by fetch() — never re-advertise an encoding.
    if (lk === "content-encoding") return;
    // Don't echo upstream's own ACAO — we set our own below to keep
    // the gateway's CORS policy consistent regardless of origin behaviour.
    if (lk.startsWith("access-control-")) return;
    outHeaders.set(k, v);
  });
  outHeaders.set("x-lemoncake-charge", String(charge));
  outHeaders.set("x-lemoncake-upstream-ms", String(ms));
  for (const [k, v] of Object.entries(corsHeaders(req))) outHeaders.set(k, v);

  return new Response(outBody, {
    status: upstreamRes.status,
    headers: outHeaders,
  });
}

/** Preflight — return CORS headers immediately, no DB / auth required. */
async function preflight(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export const GET     = handle;
export const POST    = handle;
export const PUT     = handle;
export const PATCH   = handle;
export const DELETE  = handle;
export const OPTIONS = preflight;
