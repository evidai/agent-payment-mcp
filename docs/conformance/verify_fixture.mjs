#!/usr/bin/env node
/**
 * verify_fixture.mjs — byte-verifiable conformance check for the LemonCake
 * gateway/SDK charge state machine (reserve-confirm-v1).
 *
 * Zero dependencies (Node built-ins only). Reproduces every binding_digest from
 * scratch and replays the reserve → confirm / cancel state machine, asserting
 * the budget + idempotency invariants. Run on a fresh clone:
 *
 *   node docs/conformance/verify_fixture.mjs
 *
 * Exit 0 = all assertions pass. Same substrate bar as
 * github.com/azender1/SafeAgent/tree/main/docs/conformance (the two fixtures
 * describe the same state machine; idempotency_key ↔ request_id, reserve ↔
 * PENDING, confirm ↔ COMMITTED, identical JCS+SHA-256 binding_digest).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(readFileSync(join(here, "reserve-confirm-v1.json"), "utf8"));

/** RFC 8785-style canonicalization for our flat binding object (sorted keys, compact). */
const jcs = (o) => JSON.stringify(Object.keys(o).sort().reduce((a, k) => ((a[k] = o[k]), a), {}));
const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const round6 = (n) => Math.round(n * 1e6) / 1e6;

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log(`  ✗ ${msg}`); } };

// ── Replay the state machine ────────────────────────────────────────────────
const token = { spent: fx.pay_token.spent_usd_start, budget: fx.pay_token.budget_usd };
const charges = new Map();              // charge_id -> { state, amount }
const byIdem = new Map();               // (seller_key|idem) -> charge_id
const feeRate = fx.pay_token.in_free_tier ? 0 : fx.construction.fee.rate_after_free_tier;

for (const v of fx.vectors) {
  if (v.op === "preflight") {
    const key = `${v.input.seller_key}|${v.input.idempotency_key}`;
    if (byIdem.has(key)) {
      // RETRY: must return the SAME charge id and NOT re-debit.
      const existing = byIdem.get(key);
      ok(existing === v.expect_same_charge_id, `${v.name}: retry returns original charge_id`);
      ok(round6(token.spent) === v.spent_after, `${v.name}: no re-debit (spent ${token.spent} == ${v.spent_after})`);
    } else {
      // RESERVE: atomic debit (compare-and-set against budget), create PENDING.
      ok(round6(token.spent + v.input.amount_usd) <= token.budget, `${v.name}: reserve within budget`);
      token.spent = round6(token.spent + v.input.amount_usd);
      charges.set(v.charge_id, { state: "reserved", amount: v.input.amount_usd, charge_ref: v.charge_ref });
      byIdem.set(key, v.charge_id);
      ok(round6(token.spent) === v.spent_after, `${v.name}: spent debited to ${v.spent_after}`);
      // binding_digest reproduced from scratch.
      const digest = sha256(jcs({
        amount_usd: v.input.amount_usd, charge_ref: v.charge_ref,
        nonce: v.nonce, subject_did: fx.subject_did,
      }));
      ok(digest === v.binding_digest, `${v.name}: binding_digest reproduces (${digest.slice(0, 12)}…)`);
    }
  } else if (v.op === "charge") {
    const c = charges.get(v.input.charge_id);
    ok(!!c, `${v.name}: charge exists`);
    if (!c) continue;
    if (v.noop) {
      // RECONFIRM: terminal state, no-op echo, no double-charge.
      ok(c.state === "charged", `${v.name}: already charged → no-op`);
      ok(round6(token.spent) === v.spent_after, `${v.name}: not double-charged`);
    } else if (v.input.success) {
      // CONFIRM: reserved → charged; budget already debited at reserve; record earnings.
      ok(c.state === "reserved", `${v.name}: confirm from reserved`);
      c.state = "charged";
      const fee = round6(v.earnings.gross * feeRate);
      const net = round6(v.earnings.gross - fee);
      ok(fee === v.earnings.fee, `${v.name}: fee = gross*${feeRate} = ${v.earnings.fee}`);
      ok(net === v.earnings.net, `${v.name}: net (97%) = ${v.earnings.net}`);
      ok(round6(token.spent) === v.spent_after, `${v.name}: no extra debit on confirm`);
    } else {
      // CANCEL: reserved → canceled; refund the reservation. A failed tool isn't charged.
      ok(c.state === "reserved", `${v.name}: cancel from reserved`);
      c.state = "canceled";
      token.spent = round6(token.spent - c.amount);
      ok(round6(token.spent) === v.spent_after, `${v.name}: refunded → spent ${v.spent_after}`);
    }
  }
  // Every vector declares the resulting charge state; assert it matches.
  if (v.state_out && v.charge_id && charges.has(v.charge_id)) {
    ok(charges.get(v.charge_id).state === v.state_out, `${v.name}: state_out == ${v.state_out}`);
  }
}

console.log(`\n${fail === 0 ? "✓" : "✗"} ${pass}/${pass + fail} assertions pass — ${fx.spec}`);
process.exit(fail === 0 ? 0 : 1);
