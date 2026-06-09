#!/usr/bin/env node
/**
 * phase2-regression.mjs — guard the gateway while Phase 2 lands.
 *
 * Run AFTER deploying, against the deployed origin (prod or a preview), because
 * the metering DB only exists there. Two parts:
 *
 *   [A] /g regression (always runs) — proves the meter-lib refactor did NOT
 *       change gateway behaviour:
 *         1. mint a sandbox Pay Token via /api/lc/demo/token  (20 calls / $0.20)
 *         2. hit /g/<shortId> 20×            → every call 200 + x-lemoncake-charge
 *         3. the 21st call                   → 402 (budget gone)
 *       If this is RED, the refactor broke the live demo — do not ship.
 *
 *   [B] /api/sdk smoke (only if SELLER_KEY + PAY_TOKEN env are set) — proves the
 *       new seller-side path: preflight (reserve) → charge(success) decrements,
 *       and charge(cancel) refunds.
 *
 * Usage:
 *   BASE_URL=https://www.lemoncake.xyz node scripts/phase2-regression.mjs
 *   # optional SDK smoke:
 *   BASE_URL=... SELLER_KEY=sk_test_xxx PAY_TOKEN=<jwt> node scripts/phase2-regression.mjs
 */

const BASE = (process.env.BASE_URL || "https://www.lemoncake.xyz").replace(/\/$/, "");
const SELLER_KEY = process.env.SELLER_KEY || "";
const PAY_TOKEN = process.env.PAY_TOKEN || "";

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31m✗ ${m}\x1b[0m`); failures++; };

async function regressionGateway() {
  console.log(`\n[A] /g gateway regression  (${BASE})`);

  const mintRes = await fetch(`${BASE}/api/lc/demo/token`, { method: "POST" });
  if (mintRes.status !== 201) return bad(`mint expected 201, got ${mintRes.status}`);
  const mint = await mintRes.json();
  const jwt = mint.jwt;
  const path = mint.gatewayPath;
  const maxCalls = mint.token?.maxCalls ?? 20;
  if (!jwt || !path) return bad(`mint missing jwt/gatewayPath: ${JSON.stringify(mint)}`);
  ok(`minted sandbox token → ${path}  (${maxCalls} calls)`);

  let paid = 0;
  for (let i = 1; i <= maxCalls; i++) {
    const r = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ping: i }),
    });
    if (r.status === 200 && r.headers.get("x-lemoncake-charge")) paid++;
    else { bad(`call #${i} expected 200+charge, got ${r.status}`); break; }
  }
  if (paid === maxCalls) ok(`${paid}/${maxCalls} paid calls returned 200 + x-lemoncake-charge`);

  const over = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ping: "over" }),
  });
  if (over.status === 402) ok(`call #${maxCalls + 1} → 402 (budget enforced)`);
  else bad(`overage call expected 402, got ${over.status}`);
}

async function smokeSdk() {
  if (!SELLER_KEY || !PAY_TOKEN) {
    console.log(`\n[B] /api/sdk smoke  — skipped (set SELLER_KEY + PAY_TOKEN to run)`);
    return;
  }
  console.log(`\n[B] /api/sdk seller-side smoke`);
  const H = { Authorization: `Bearer ${SELLER_KEY}`, "Content-Type": "application/json" };
  const idem = `smoke-${Date.now()}`;

  // preflight (reserve)
  const pf = await fetch(`${BASE}/api/sdk/preflight`, {
    method: "POST", headers: H,
    body: JSON.stringify({ payToken: PAY_TOKEN, idempotencyKey: idem, toolName: "smoke" }),
  });
  const pfj = await pf.json();
  if (pf.status === 200 && pfj.allowed && pfj.chargeId) ok(`preflight reserved chargeId=${pfj.chargeId} remaining=${pfj.remaining}`);
  else return bad(`preflight failed: ${pf.status} ${JSON.stringify(pfj)}`);

  const remAfterReserve = pfj.remaining;

  // idempotent re-preflight returns same chargeId
  const pf2 = await fetch(`${BASE}/api/sdk/preflight`, {
    method: "POST", headers: H,
    body: JSON.stringify({ payToken: PAY_TOKEN, idempotencyKey: idem }),
  });
  const pf2j = await pf2.json();
  if (pf2j.chargeId === pfj.chargeId) ok(`idempotent re-preflight → same chargeId`);
  else bad(`idempotency broke: ${JSON.stringify(pf2j)}`);

  // charge cancel (refund) — should restore remaining
  const cancel = await fetch(`${BASE}/api/sdk/charge`, {
    method: "POST", headers: H,
    body: JSON.stringify({ chargeId: pfj.chargeId, success: false }),
  });
  const cj = await cancel.json();
  if (cancel.status === 200 && cj.settled === false && cj.charged === 0) ok(`charge(cancel) refunded → remaining=${cj.remaining}`);
  else bad(`cancel failed: ${cancel.status} ${JSON.stringify(cj)}`);
  if (cj.remaining > remAfterReserve) ok(`refund restored budget (was ${remAfterReserve}, now ${cj.remaining})`);

  // fresh reserve → confirm (debit)
  const idem2 = `smoke-${Date.now()}-c`;
  const pf3 = await (await fetch(`${BASE}/api/sdk/preflight`, {
    method: "POST", headers: H, body: JSON.stringify({ payToken: PAY_TOKEN, idempotencyKey: idem2 }),
  })).json();
  const confirm = await fetch(`${BASE}/api/sdk/charge`, {
    method: "POST", headers: H, body: JSON.stringify({ chargeId: pf3.chargeId, success: true }),
  });
  const fj = await confirm.json();
  if (confirm.status === 200 && fj.settled === true && fj.charged > 0) ok(`charge(confirm) settled $${fj.charged} → earnings recorded`);
  else bad(`confirm failed: ${confirm.status} ${JSON.stringify(fj)}`);
}

await regressionGateway();
await smokeSdk();

console.log(failures === 0 ? `\n\x1b[32mALL GREEN\x1b[0m` : `\n\x1b[31m${failures} FAILURE(S)\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
