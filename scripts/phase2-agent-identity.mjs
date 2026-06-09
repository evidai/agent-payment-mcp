#!/usr/bin/env node
/**
 * phase2-agent-identity.mjs — verify the Agent Identity thin layer end-to-end.
 *
 * Demo 1: create agent → bind a $0.20/20-call Pay Token → 20× 200, 21st 402,
 *         agent rollup reflects the spend (agent_id recorded on usage).
 * Demo 2: pause agent → a fresh bound token (budget remaining) is rejected with
 *         AGENT_PAUSED; resume → it works again.
 * Demo 3: revoke agent → bound token rejected with AGENT_REVOKED.
 * Demo 4: SDK idempotency with an agent-bound token (same idempotencyKey →
 *         same chargeId, one charge).
 *
 * Usage:
 *   BASE_URL=https://www.lemoncake.xyz node scripts/phase2-agent-identity.mjs
 *   # protected preview: add VERCEL_PROTECTION_BYPASS=<secret>
 */

const BASE = (process.env.BASE_URL || "https://www.lemoncake.xyz").replace(/\/$/, "");
const BYPASS = process.env.VERCEL_PROTECTION_BYPASS || "";

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31m✗ ${m}\x1b[0m`); failures++; };

let cookie = "";
function hdrs(extra = {}) {
  const h = { "Content-Type": "application/json", ...extra };
  if (cookie) h.Cookie = cookie;
  if (BYPASS) { h["x-vercel-protection-bypass"] = BYPASS; h["x-vercel-set-bypass-cookie"] = "true"; }
  return h;
}
async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, { method, headers: hdrs(), body: body ? JSON.stringify(body) : undefined });
  for (const c of (r.headers.getSetCookie?.() ?? [])) if (c.startsWith("lc_owner=")) cookie = c.split(";")[0];
  return { status: r.status, json: await r.json().catch(() => null) };
}
async function gw(path, jwt, body) {
  const r = await fetch(`${BASE}${path}`, { method: "POST", headers: hdrs({ Authorization: `Bearer ${jwt}` }), body: JSON.stringify(body ?? {}) });
  return { status: r.status, json: await r.json().catch(() => null) };
}

async function main() {
  console.log(`\n[Agent Identity] ${BASE}`);

  // setup: endpoint + agent
  const ep = (await api("POST", "/api/lc/endpoints", { name: "agent-id-smoke", originalUrl: `${BASE}/api/lc/demo/echo`, pricePerCall: 0.01, tokenBudget: 1, rateLimit: 600 })).json?.endpoint;
  if (!ep?.id) return bad("create endpoint");
  const agentRes = await api("POST", "/api/agents", { displayName: "Sales Agent", agentId: "sales-agent-001" });
  const agent = agentRes.json?.agent;
  if (agentRes.status !== 201 || !agent?.agent_id) return bad(`create agent: ${agentRes.status} ${JSON.stringify(agentRes.json)}`);
  ok(`agent ${agent.agent_id} created`);

  // ── Demo 1: bound token, 20×200, 21st 402, rollup ──
  const t1 = await api("POST", "/api/lc/tokens", { endpointId: ep.id, budget: 0.20, expiresInHours: 1, maxCalls: 20, agentId: agent.agent_id });
  const jwt1 = t1.json?.jwt;
  const gwPath = `/g/${ep.short_id}`;
  if (!jwt1) return bad(`issue bound token: ${JSON.stringify(t1.json)}`);
  if (t1.json.token?.agent_id === agent.agent_id) ok("Pay Token bound to agent (agent_id on row)");
  else bad(`token not bound: ${JSON.stringify(t1.json.token)}`);

  let paid = 0;
  for (let i = 1; i <= 20; i++) { const r = await gw(gwPath, jwt1, { i }); if (r.status === 200) paid++; else { bad(`call #${i} → ${r.status}`); break; } }
  if (paid === 20) ok("20/20 paid calls → 200");
  const over = await gw(gwPath, jwt1, {});
  if (over.status === 402) ok("call #21 → 402 (cap)"); else bad(`#21 expected 402, got ${over.status}`);

  const list = (await api("GET", "/api/agents")).json?.agents ?? [];
  const a = list.find((x) => x.agentId === agent.agent_id);
  if (a && a.totalCalls >= 20 && Math.abs(a.totalSpent - 0.20) < 0.001) ok(`agent rollup: ${a.totalCalls} calls, $${a.totalSpent} spent (agent_id recorded on usage)`);
  else bad(`rollup wrong: ${JSON.stringify(a)}`);

  // ── Demo 2: pause → AGENT_PAUSED on a budget-remaining token ──
  const t2 = await api("POST", "/api/lc/tokens", { endpointId: ep.id, budget: 0.05, expiresInHours: 1, maxCalls: 5, agentId: agent.agent_id });
  const jwt2 = t2.json?.jwt;
  await api("POST", `/api/agents/${agent.agent_id}/pause`);
  const paused = await gw(gwPath, jwt2, {});
  if (paused.status === 403 && paused.json?.error === "AGENT_PAUSED") ok("paused agent → 403 AGENT_PAUSED (budget remaining)"); else bad(`pause expected AGENT_PAUSED, got ${paused.status} ${JSON.stringify(paused.json)}`);
  await api("POST", `/api/agents/${agent.agent_id}/resume`);
  const resumed = await gw(gwPath, jwt2, {});
  if (resumed.status === 200) ok("resumed → 200"); else bad(`resume expected 200, got ${resumed.status}`);

  // ── Demo 3: revoke → AGENT_REVOKED ──
  await api("POST", `/api/agents/${agent.agent_id}/revoke`);
  const revoked = await gw(gwPath, jwt2, {});
  if (revoked.status === 403 && revoked.json?.error === "AGENT_REVOKED") ok("revoked agent → 403 AGENT_REVOKED"); else bad(`revoke expected AGENT_REVOKED, got ${revoked.status} ${JSON.stringify(revoked.json)}`);

  // ── Demo 4: SDK idempotency with an agent-bound token ──
  // fresh agent (active) + seller key + bound token
  const agent2 = (await api("POST", "/api/agents", { displayName: "SDK Agent" })).json?.agent;
  const sk = (await api("POST", `/api/lc/endpoints/${ep.id}/seller-keys`, {})).json?.key;
  const t3 = await api("POST", "/api/lc/tokens", { endpointId: ep.id, budget: 0.05, expiresInHours: 1, maxCalls: 5, agentId: agent2.agent_id });
  const jwt3 = t3.json?.jwt;
  const sdk = async (path, body) => {
    const r = await fetch(`${BASE}${path}`, { method: "POST", headers: hdrs({ Authorization: `Bearer ${sk}` }), body: JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const idem = `agent-idem-${ep.short_id}`;
  const pf1 = await sdk("/api/sdk/preflight", { payToken: jwt3, idempotencyKey: idem });
  const pf2 = await sdk("/api/sdk/preflight", { payToken: jwt3, idempotencyKey: idem });
  if (pf1.json?.chargeId && pf1.json.chargeId === pf2.json?.chargeId) ok("SDK idempotency: same idempotencyKey → same chargeId"); else bad(`idempotency: ${JSON.stringify([pf1.json, pf2.json])}`);
  const cf = await sdk("/api/sdk/charge", { chargeId: pf1.json.chargeId, success: true });
  if (cf.json?.settled) ok(`SDK confirm settled $${cf.json.charged} (agent-bound)`); else bad(`confirm: ${JSON.stringify(cf.json)}`);

  // cleanup
  await api("DELETE", `/api/lc/endpoints/${ep.id}`);
  ok("cleanup: endpoint deleted");
}

await main();
console.log(failures === 0 ? `\n\x1b[32mAGENT IDENTITY GREEN\x1b[0m` : `\n\x1b[31m${failures} FAILURE(S)\x1b[0m`);
process.exit(failures === 0 ? 0 : 1);
