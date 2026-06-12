#!/usr/bin/env node
/**
 * verify_gated_fixture.mjs — byte-verifiable conformance check for the LemonCake
 * gateway preflight with the OPTIONAL pre-execution `verifier_attestation` gate
 * (A2A #1920, the gateway-side half of the three-part seam).
 *
 * Zero dependencies (Node built-ins only). For every vector it:
 *   - verifies the attestation's compact JWS (EdDSA) against the embedded JWKS,
 *   - recomputes `binding_digest` from scratch (JCS + SHA-256) and binds it to
 *     THIS charge,
 *   - replays the six gateway preflight checks and asserts the admission outcome,
 *     the clamped effective budget = min(static_cap, dynamic_limit_usd), and the
 *     resulting reserve state / spend.
 *
 *   node docs/conformance/verify_gated_fixture.mjs
 *
 * Exit 0 = all assertions pass. Pairs with:
 *   - reserve-confirm-v1 (this repo) — settlement + idempotency,
 *   - azender1/SafeAgent exactly-once-v1 — action_ref guard,
 *   - haroldmalikfrimpong-ops/agentid ctef-verifier-attestation-v0.1 — verifier side.
 * Same byte-match bar: identical JCS + SHA-256 binding_digest construction across
 * all four; the verifier_attestation field is optional and backward-compatible
 * (absent ⇒ ungated reserve).
 */
import { createHash, createPublicKey, verify as edVerify } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, "gated-preflight-v1.json"), "utf8"));

/** Recursive RFC 8785-style JCS: sort keys at every level, compact, JSON numbers as-is. */
const jcs = (o) => {
  if (Array.isArray(o)) return "[" + o.map(jcs).join(",") + "]";
  if (o && typeof o === "object")
    return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + jcs(o[k])).join(",") + "}";
  return JSON.stringify(o);
};
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const b64uJson = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log(`  ✗ ${msg}`); } };

// Resolve the verifier's public key from the embedded JWKS (by kid).
const jwkByKid = new Map(fx.verifier_jwks.keys.map((k) => [k.kid, k]));
const evalAt = Date.parse(fx.evaluated_at); // fixed reference clock → deterministic expiry checks

/**
 * Gateway preflight gate. Returns { admitted, reject_code?, effective_budget_usd?, gated }.
 * Mirrors the live gateway: the field is checked BEFORE the reserve; absent ⇒ ungated.
 */
function gate(v) {
  const staticCap = v.input.static_cap_usd;
  if (v.verifier_attestation == null) {
    // Invariant: absent ⇒ ungated reserve, effective budget = static cap.
    return { admitted: true, gated: false, effective_budget_usd: staticCap };
  }
  const [h, p, s] = v.verifier_attestation.split(".");
  // (1) verify JWS against the verifier's JWKS.
  let header, payload;
  try { header = b64uJson(h); payload = b64uJson(p); } catch { return { admitted: false, gated: true, reject_code: "malformed_attestation" }; }
  const jwk = jwkByKid.get(header.kid);
  if (!jwk) return { admitted: false, gated: true, reject_code: "unknown_kid" };
  const pub = createPublicKey({ key: jwk, format: "jwk" });
  const sigOK = edVerify(null, Buffer.from(h + "." + p), pub, Buffer.from(s, "base64url"));
  if (!sigOK) return { admitted: false, gated: true, reject_code: "bad_signature" };
  // (2) recompute binding_digest, must match THIS charge.
  const b = payload.binding;
  const recomputed = sha256(jcs({
    amount_usd: b.amount_usd, charge_ref: b.charge_ref, nonce: b.nonce, subject_did: payload.subject_did,
  }));
  if (recomputed !== b.binding_digest) return { admitted: false, gated: true, reject_code: "binding_digest_mismatch" };
  // amount in the signed binding must match the charge being reserved.
  if (round6(b.amount_usd) !== round6(v.input.amount_usd)) return { admitted: false, gated: true, reject_code: "amount_mismatch" };
  // (5) freshness: evaluated_at must be within [issued_at, expires_at].
  if (evalAt > Date.parse(payload.expires_at)) return { admitted: false, gated: true, reject_code: "attestation_expired" };
  // (3) verdict must be admit.
  if (payload.admission.verdict !== "admit") return { admitted: false, gated: true, reject_code: "admission_denied" };
  // (4) effective budget = min(static_cap, dynamic_limit_usd).
  const eff = Math.min(staticCap, payload.admission.dynamic_limit_usd);
  if (round6(v.input.amount_usd) > round6(eff)) return { admitted: false, gated: true, reject_code: "dynamic_limit_exceeded", effective_budget_usd: eff };
  return { admitted: true, gated: true, effective_budget_usd: eff };
}

// ── Replay every vector ─────────────────────────────────────────────────────
let spent = 0;
const byIdem = new Set();
for (const v of fx.vectors) {
  const r = gate(v);
  const e = v.expect;
  ok(r.admitted === e.admitted, `${v.name}: admitted == ${e.admitted}`);
  if (!e.admitted) {
    ok(r.reject_code === e.reject_code, `${v.name}: reject_code == ${e.reject_code} (got ${r.reject_code})`);
  }
  if (e.effective_budget_usd != null) {
    ok(round6(r.effective_budget_usd) === e.effective_budget_usd, `${v.name}: effective_budget == ${e.effective_budget_usd} (got ${r.effective_budget_usd})`);
  }
  if (e.gated === false) ok(r.gated === false, `${v.name}: ungated passthrough`);

  // Only admitted preflights reserve (atomic compare-and-set against budget); rejects never debit.
  if (r.admitted) {
    ok(!byIdem.has(v.input.idempotency_key), `${v.name}: fresh idempotency_key`);
    byIdem.add(v.input.idempotency_key);
    spent = round6(spent + v.input.amount_usd);
  }
  ok(round6(spent) === e.spent_after, `${v.name}: spent_after == ${e.spent_after} (got ${spent})`);
  ok((r.admitted ? "reserved" : "none") === e.state_out, `${v.name}: state_out == ${e.state_out}`);
}

console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass}/${pass + fail} assertions pass — ${fx.spec}`);
process.exit(fail === 0 ? 0 : 1);
