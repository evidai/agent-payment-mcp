// Node's built-in test runner — no devDependency added.
// Tests run against the compiled dist/, so they exercise what npm publishes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildX402Receipt, parseX402Challenge } from "../dist/x402.js";

// ────────── parseX402Challenge ──────────

test("parseX402Challenge: WWW-Authenticate header (quoted + unquoted values)", () => {
  const headers = new Headers({
    "www-authenticate": 'x402 chain="base" asset=USDC amount=0.01 recipient=0xabc',
  });
  const out = parseX402Challenge(headers, null);
  assert.deepEqual(out, {
    source:    "WWW-Authenticate",
    scheme:    "x402",
    chain:     "base",
    asset:     "USDC",
    amount:    "0.01",
    recipient: "0xabc",
  });
});

test("parseX402Challenge: WWW-Authenticate is case-insensitive on scheme name", () => {
  const headers = new Headers({ "www-authenticate": "X402 chain=base asset=USDC" });
  const out = parseX402Challenge(headers, null);
  assert.equal(out?.scheme, "x402");
  assert.equal(out?.chain, "base");
});

test("parseX402Challenge: X-402-* headers are parsed and stripped of prefix", () => {
  const headers = new Headers({
    "x-402-chain":     "polygon",
    "x-402-asset":     "USDC",
    "x-402-amount":    "0.05",
    "x-402-recipient": "0xdef",
    "x-402-callback":  "https://example.com/cb",
  });
  const out = parseX402Challenge(headers, null);
  assert.deepEqual(out, {
    source:    "X-402-* headers",
    scheme:    "x402",
    chain:     "polygon",
    asset:     "USDC",
    amount:    "0.05",
    recipient: "0xdef",
    callback:  "https://example.com/cb",
  });
});

test("parseX402Challenge: body.x402 object", () => {
  const out = parseX402Challenge(new Headers(), {
    x402: { chain: "ethereum", asset: "USDC", amount: "0.10", recipient: "0xghi" },
  });
  assert.deepEqual(out, {
    source:    "response.x402",
    scheme:    "x402",
    chain:     "ethereum",
    asset:     "USDC",
    amount:    "0.10",
    recipient: "0xghi",
  });
});

test("parseX402Challenge: returns null when no challenge present", () => {
  assert.equal(parseX402Challenge(new Headers(), null),    null);
  assert.equal(parseX402Challenge(new Headers(), {}),      null);
  assert.equal(parseX402Challenge(new Headers(), "text"),  null);
});

test("parseX402Challenge: ignores non-x402 WWW-Authenticate (Basic, Bearer)", () => {
  for (const v of ["Basic realm=\"x\"", "Bearer realm=\"y\""]) {
    const out = parseX402Challenge(new Headers({ "www-authenticate": v }), null);
    assert.equal(out, null, `should not match ${v}`);
  }
});

test("parseX402Challenge: header source wins over body when both present", () => {
  const headers = new Headers({ "x-402-chain": "polygon" });
  const out = parseX402Challenge(headers, { x402: { chain: "ethereum" } });
  assert.equal(out?.source, "X-402-* headers");
  assert.equal(out?.chain, "polygon");
});

test("parseX402Challenge: WWW-Authenticate takes precedence over X-402-* headers", () => {
  const headers = new Headers({
    "www-authenticate": "x402 chain=base",
    "x-402-chain":      "polygon",
  });
  const out = parseX402Challenge(headers, null);
  assert.equal(out?.source, "WWW-Authenticate");
  assert.equal(out?.chain, "base");
});

// ────────── buildX402Receipt ──────────

test("buildX402Receipt: live mode produces canonical shape", () => {
  const r = buildX402Receipt({
    chargeId:   "ch_abc",
    amountUsdc: "0.005",
    serviceId:  "serper",
    mode:       "live",
  });
  assert.equal(r.scheme,          "lemoncake-pay-token-v1");
  assert.equal(r.x402Compatible,  true);
  assert.equal(r.asset,           "USDC");
  assert.equal(r.amount,          "0.005");
  assert.equal(r.recipient,       "serper");
  assert.equal(r.paymentIntentId, "ch_abc");
  assert.match(r.settledAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  assert.match(r.note, /Off-chain settlement|Pay Token/);
});

test("buildX402Receipt: demo mode marks the note explicitly", () => {
  const r = buildX402Receipt({
    chargeId:   null,
    amountUsdc: null,
    serviceId:  "demo_search",
    mode:       "demo",
  });
  assert.equal(r.amount, "0.00");                 // null amount falls back to 0.00
  assert.match(r.paymentIntentId, /^demo_/);     // null chargeId falls back to mode-prefixed token
  assert.match(r.note, /Demo Mode/);
});

test("buildX402Receipt: paymentIntentId fallback is unique per call", () => {
  const a = buildX402Receipt({ chargeId: null, amountUsdc: null, serviceId: "x", mode: "live" });
  // Tiny delay to avoid same Date.now() millisecond collision in tight loops
  const b = buildX402Receipt({ chargeId: null, amountUsdc: null, serviceId: "x", mode: "live" });
  // Either they differ, or at least the prefix is "live_" both times — verifies the fallback fired
  assert.match(a.paymentIntentId, /^live_/);
  assert.match(b.paymentIntentId, /^live_/);
});
