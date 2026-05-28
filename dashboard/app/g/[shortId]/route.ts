/**
 * /g/[shortId] — production gateway proxy.
 *
 * This is the real LemonCake gateway. A buyer agent sends:
 *
 *   POST https://www.lemoncake.xyz/g/abc12345
 *   Authorization: Bearer <Pay-Token-JWT>
 *
 * We:
 *   1. Verify JWT signature (HS256, LC_JWT_SECRET)
 *   2. Look up endpoint by shortId
 *   3. Confirm the JWT's `sub` matches the endpoint
 *   4. Check Pay Token DB row: not revoked/expired/exhausted, has budget,
 *      not over rate limit
 *   5. Forward to endpoint.originalUrl with the seller's stored upstream
 *      auth header attached
 *   6. On 2xx/3xx upstream response: charge (decrement budget + calls in
 *      DB, log lc_test_runs), return upstream body to buyer
 *   7. On block: log lc_blocked, return 402/403/429 with a JSON reason
 *   8. On upstream 5xx / network error: log lc_blocked (upstream_error),
 *      do NOT charge, return 502 to buyer
 */

import { NextResponse } from "next/server";
import { backendEnvReady, sb, verifyPayToken } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ shortId: string }> };

const ALL_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

/** Headers we strip when forwarding (hop-by-hop or LC-specific). */
const STRIP_HEADERS = new Set([
  "host", "connection", "content-length", "transfer-encoding",
  "keep-alive", "proxy-authenticate", "proxy-authorization", "te",
  "trailer", "upgrade",
  "authorization", // replaced with upstream_auth
  "cookie",        // never leak buyer's cookies upstream
]);

function jsonErr(status: number, code: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...extra }, { status });
}

async function handle(req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return jsonErr(503, "backend_not_configured");

  const { shortId } = await params;

  // 1. Pull bearer token
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return jsonErr(401, "missing_pay_token");
  const jwt = m[1].trim();

  // 2. Verify JWT
  const claims = await verifyPayToken(jwt);
  if (!claims) return jsonErr(401, "invalid_pay_token");

  // 3. Load endpoint by shortId
  const { data: ep, error: epErr } = await sb()
    .from("lc_endpoints")
    .select("*")
    .eq("short_id", shortId)
    .single();
  if (epErr || !ep) return jsonErr(404, "endpoint_not_found");

  // 4. JWT sub must match the endpoint
  if (claims.sub !== ep.id) return jsonErr(403, "token_endpoint_mismatch");

  // 5. Endpoint must be live
  if (ep.status !== "live") {
    await sb().from("lc_blocked").insert({
      endpoint_id: ep.id, pay_token_id: claims.jti, owner_id: ep.owner_id,
      reason: "endpoint_paused", attempted: ep.price_per_call,
    });
    return jsonErr(503, "endpoint_paused");
  }

  // 6. Load Pay Token row
  const { data: tok, error: tokErr } = await sb()
    .from("lc_pay_tokens")
    .select("*")
    .eq("id", claims.jti)
    .single();
  if (tokErr || !tok) return jsonErr(401, "pay_token_not_found");

  const charge = Number(ep.price_per_call);

  if (tok.status === "revoked") {
    await sb().from("lc_blocked").insert({
      endpoint_id: ep.id, pay_token_id: tok.id, owner_id: ep.owner_id,
      reason: "token_revoked", attempted: charge,
    });
    return jsonErr(403, "token_revoked");
  }
  if (new Date(tok.expires_at).getTime() < Date.now() || tok.status === "expired") {
    if (tok.status !== "expired") {
      await sb().from("lc_pay_tokens").update({ status: "expired" }).eq("id", tok.id);
    }
    await sb().from("lc_blocked").insert({
      endpoint_id: ep.id, pay_token_id: tok.id, owner_id: ep.owner_id,
      reason: "token_expired", attempted: charge,
    });
    return jsonErr(401, "token_expired");
  }
  if (tok.calls_used >= tok.max_calls) {
    if (tok.status !== "exhausted") {
      await sb().from("lc_pay_tokens").update({ status: "exhausted" }).eq("id", tok.id);
    }
    await sb().from("lc_blocked").insert({
      endpoint_id: ep.id, pay_token_id: tok.id, owner_id: ep.owner_id,
      reason: "spend_cap_exceeded", attempted: charge,
    });
    return jsonErr(402, "token_exhausted");
  }
  if (Number(tok.spent) + charge > Number(tok.budget)) {
    await sb().from("lc_blocked").insert({
      endpoint_id: ep.id, pay_token_id: tok.id, owner_id: ep.owner_id,
      reason: "spend_cap_exceeded", attempted: charge,
    });
    return jsonErr(402, "spend_cap_exceeded");
  }

  // 7. Rate-limit check (paid calls in the last 60s for this endpoint)
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count: recentCount } = await sb()
    .from("lc_test_runs")
    .select("id", { count: "exact", head: true })
    .eq("endpoint_id", ep.id)
    .gte("at", since);
  if ((recentCount ?? 0) >= ep.rate_limit) {
    await sb().from("lc_blocked").insert({
      endpoint_id: ep.id, pay_token_id: tok.id, owner_id: ep.owner_id,
      reason: "rate_limit_exceeded", attempted: charge,
    });
    return jsonErr(429, "rate_limit_exceeded");
  }

  // 8. Build upstream request
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

  const body =
    req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS"
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
    await sb().from("lc_blocked").insert({
      endpoint_id: ep.id, pay_token_id: tok.id, owner_id: ep.owner_id,
      reason: "upstream_error", attempted: charge,
    });
    return jsonErr(502, "upstream_unreachable", {
      detail: err instanceof Error ? err.message : "unknown",
    });
  }
  const ms = Math.round(performance.now() - t0);

  // 9. Only charge if upstream returned a non-5xx response. 5xx → buyer
  //    doesn't pay for our origin's outage.
  if (upstreamRes.status >= 500) {
    await sb().from("lc_blocked").insert({
      endpoint_id: ep.id, pay_token_id: tok.id, owner_id: ep.owner_id,
      reason: "upstream_error", attempted: charge,
    });
  } else {
    const fee = charge * 0.03;
    const net = charge - fee;
    const newCalls = tok.calls_used + 1;
    const newSpent = Number(tok.spent) + charge;
    const newStatus = newCalls >= tok.max_calls ? "exhausted" : tok.status;

    await Promise.all([
      sb().from("lc_pay_tokens").update({
        calls_used: newCalls,
        spent: newSpent,
        status: newStatus,
      }).eq("id", tok.id),
      sb().from("lc_test_runs").insert({
        endpoint_id: ep.id,
        pay_token_id: tok.id,
        owner_id: ep.owner_id,
        gross: charge,
        fee,
        net,
        upstream_status: upstreamRes.status,
        upstream_ms: ms,
      }),
    ]);
  }

  // 10. Pipe response back to buyer
  const outHeaders = new Headers();
  upstreamRes.headers.forEach((v, k) => {
    const lk = k.toLowerCase();
    if (lk === "content-length" || lk === "transfer-encoding" || lk === "connection") return;
    outHeaders.set(k, v);
  });
  outHeaders.set("x-lemoncake-charge", String(charge));
  outHeaders.set("x-lemoncake-upstream-ms", String(ms));

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: outHeaders,
  });
}

export const GET     = handle;
export const POST    = handle;
export const PUT     = handle;
export const PATCH   = handle;
export const DELETE  = handle;
export const OPTIONS = handle;

// satisfy linter
export const _supportedMethods = ALL_METHODS;
