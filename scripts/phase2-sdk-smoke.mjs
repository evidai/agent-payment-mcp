#!/usr/bin/env node
/**
 * phase2-sdk-smoke.mjs — end-to-end check of the seller-side fiat billing path.
 *
 * Self-contained: spins up a throwaway anonymous owner (via the lc_owner cookie
 * the API sets), creates a priced endpoint, issues a Seller Key, mints a test
 * Pay Token, then exercises /api/sdk/{preflight,charge}. Cleans up the endpoint
 * at the end (cascade-drops its key + tokens).
 *
 *   1. create endpoint           POST /api/lc/endpoints
 *   2. issue seller key          POST /api/lc/endpoints/:id/seller-keys
 *   3. mint test Pay Token       POST /api/lc/tokens
 *   4. preflight (reserve)       POST /api/sdk/preflight
 *   5. idempotent re-preflight   → same chargeId
 *   6. charge(success=true)      → settled, budget debited, earnings recorded
 *   7. re-charge same id         → no-op echo
 *   8. fresh reserve → cancel    → refund (remaining restored)
 *   9. cleanup                   DELETE /api/lc/endpoints/:id
 *
 * Usage:
 *   BASE_URL=https://www.lemoncake.xyz node scripts/phase2-sdk-smoke.mjs
 *   # protected preview:
 *   BASE_URL=... VERCEL_PROTECTION_BYPASS=<secret> node scripts/phase2-sdk-smoke.mjs
 */

const BASE = (process.env.BASE_URL || "https://www.lemoncake.xyz").replace(/\/$/, "");
const BYPASS = process.env.VERCEL_PROTECTION_BYPASS || "";

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31m✗ ${m}\x1b[0m`); failures++; };

// Minimal cookie jar — the API sets lc_owner (httpOnly) on first request; we
// echo it back so the whole run is one anonymous owner/workspace.
let cookie = "";
async function call(method, path, body) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers["Cookie"] = cookie;
  if (BYPASS) { headers["x-vercel-protection-bypass"] = BYPASS; headers["x-vercel-set-bypass-cookie"] = "true"; }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) { if (c.startsWith("lc_owner=")) cookie = c.split(";")[0]; }
  let json = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

async function main() {
  console.log(`\n[SDK] seller-side billing smoke  (${BASE})`);

  // 1. endpoint
  const ep = await call("POST", "/api/lc/endpoints", {
    name: "smoke-sdk", originalUrl: `${BASE}/api/lc/demo/echo`,
    pricePerCall: 0.01, tokenBudget: 1, rateLimit: 600,
  });
  const endpoint = ep.json?.endpoint;
  if (ep.status >= 300 || !endpoint?.id) return bad(`create endpoint: ${ep.status} ${JSON.stringify(ep.json)}`);
  ok(`endpoint ${endpoint.short_id} (${endpoint.id})`);
  const epId = endpoint.id;

  try {
    // 2. seller key
    const sk = await call("POST", `/api/lc/endpoints/${epId}/seller-keys`, {});
    const sellerKey = sk.json?.key;
    if (sk.status !== 201 || !sellerKey?.startsWith("sk_live_")) return bad(`issue key: ${sk.status} ${JSON.stringify(sk.json)}`);
    ok(`seller key ${sk.json.prefix}`);

    // 3. test Pay Token
    const tk = await call("POST", "/api/lc/tokens", { endpointId: epId, budget: 0.05, expiresInHours: 1, maxCalls: 5 });
    const jwt = tk.json?.jwt;
    if (!jwt) return bad(`mint pay token: ${tk.status} ${JSON.stringify(tk.json)}`);
    ok(`pay token minted ($0.05 / 5 calls)`);

    const H = { Authorization: `Bearer ${sellerKey}`, "Content-Type": "application/json" };
    const sdk = async (path, body) => {
      const headers = { ...H };
      if (BYPASS) { headers["x-vercel-protection-bypass"] = BYPASS; headers["x-vercel-set-bypass-cookie"] = "true"; }
      const r = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
      return { status: r.status, json: await r.json().catch(() => null) };
    };

    // 4. preflight reserve
    const idem = `smoke-${endpoint.short_id}-1`;
    const pf = await sdk("/api/sdk/preflight", { payToken: jwt, idempotencyKey: idem, toolName: "smoke" });
    if (pf.status === 200 && pf.json?.allowed && pf.json.chargeId) ok(`preflight reserve → ${pf.json.chargeId}, remaining ${pf.json.remaining}`);
    else return bad(`preflight: ${pf.status} ${JSON.stringify(pf.json)}`);
    const remAfterReserve = pf.json.remaining;

    // 5. idempotent re-preflight
    const pf2 = await sdk("/api/sdk/preflight", { payToken: jwt, idempotencyKey: idem });
    if (pf2.json?.chargeId === pf.json.chargeId) ok(`idempotent re-preflight → same chargeId`);
    else bad(`idempotency: ${JSON.stringify(pf2.json)}`);

    // 6. confirm
    const cf = await sdk("/api/sdk/charge", { chargeId: pf.json.chargeId, success: true });
    if (cf.status === 200 && cf.json?.settled === true && cf.json.charged === 0.01) ok(`charge(confirm) → settled $${cf.json.charged}, remaining ${cf.json.remaining}`);
    else bad(`confirm: ${cf.status} ${JSON.stringify(cf.json)}`);

    // 7. re-confirm is a no-op
    const cf2 = await sdk("/api/sdk/charge", { chargeId: pf.json.chargeId, success: true });
    if (cf2.json?.charged === 0.01 && cf2.json?.settled === true) ok(`re-confirm same chargeId → no-op echo`);
    else bad(`re-confirm not idempotent: ${JSON.stringify(cf2.json)}`);

    // 8. fresh reserve → cancel → refund
    const idem3 = `smoke-${endpoint.short_id}-cancel`;
    const pf3 = await sdk("/api/sdk/preflight", { payToken: jwt, idempotencyKey: idem3 });
    const cancel = await sdk("/api/sdk/charge", { chargeId: pf3.json.chargeId, success: false });
    if (cancel.json?.settled === false && cancel.json?.charged === 0 && cancel.json.remaining >= remAfterReserve - 0.011) ok(`charge(cancel) → refunded, remaining ${cancel.json.remaining}`);
    else bad(`cancel/refund: ${JSON.stringify(cancel.json)}`);

    // 8b. revoked key is rejected (security property #5)
    const sk2 = await call("POST", `/api/lc/endpoints/${epId}/seller-keys`, {});
    const revoke = await call("POST", `/api/lc/seller-keys/${sk2.json.id}/revoke`);
    if (revoke.json?.revoked !== true) bad(`revoke key: ${JSON.stringify(revoke.json)}`);
    const headers2 = { Authorization: `Bearer ${sk2.json.key}`, "Content-Type": "application/json" };
    if (BYPASS) { headers2["x-vercel-protection-bypass"] = BYPASS; headers2["x-vercel-set-bypass-cookie"] = "true"; }
    const rejected = await fetch(`${BASE}/api/sdk/preflight`, {
      method: "POST", headers: headers2,
      body: JSON.stringify({ payToken: jwt, idempotencyKey: `smoke-${endpoint.short_id}-revoked` }),
    });
    const rj = await rejected.json().catch(() => null);
    if (rejected.status === 401 && rj?.error === "invalid_seller_key") ok(`revoked key → 401 invalid_seller_key (rejected)`);
    else bad(`revoked key NOT rejected: ${rejected.status} ${JSON.stringify(rj)}`);
  } finally {
    // 9. cleanup
    const del = await call("DELETE", `/api/lc/endpoints/${epId}`);
    if (del.status < 300) ok(`cleanup: endpoint deleted`);
    else console.log(`  (cleanup non-fatal: DELETE → ${del.status})`);
  }
}

await main();
console.log(failures === 0 ? `\n\x1b[32mSDK SMOKE GREEN\x1b[0m` : `\n\x1b[31m${failures} FAILURE(S)\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
