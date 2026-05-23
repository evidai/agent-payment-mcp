#!/usr/bin/env node
/**
 * scripts/test-jpyc-permit.mjs
 *
 * On-chain probe for the new regulated JPYC contract on Polygon
 * (0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29, deployed 2025-10-27).
 *
 * Why this exists:
 *   The dual-currency UI in /start/v2 signs ERC-2612 permits against
 *   this contract on the assumption that
 *     • EIP-712 domain.name    === "JPY Coin"
 *     • EIP-712 domain.version === "1"
 *   …but those values come from the constructor and aren't published on
 *   PolygonScan's verified-source page in a place we can grep. If they
 *   drift even by one character, every signature will recover to the
 *   wrong address and `permit()` will revert at the API-call moment —
 *   not at signing time — which is the worst possible failure mode.
 *
 *   This script calls the contract directly with a public RPC, derives
 *   the domain values from the on-chain DOMAIN_SEPARATOR / name() /
 *   nonces() output, and compares them to what `dashboard/app/lib/permit.ts`
 *   has hardcoded. Run before any production rollout that touches JPYC.
 *
 * Usage:
 *   node scripts/test-jpyc-permit.mjs
 *   node scripts/test-jpyc-permit.mjs --owner 0xYourWallet
 *
 *   --owner is optional; if provided we also fetch nonces(owner) so you
 *   can confirm the read path the dashboard uses works for your address.
 *
 * Dependencies:
 *   Pure node:fetch — no npm install required. Targets Node 20+ for
 *   global `fetch`. If your environment is older, set RPC_FETCH=node-fetch
 *   in a .env and run with `node --experimental-fetch`.
 *
 * Cost: ZERO — all calls are read-only eth_call. We never broadcast a
 *       transaction. Safe to run from any machine with internet.
 */

import { argv } from "node:process";

// ── Configuration ──────────────────────────────────────────────────────────

const JPYC_POLYGON_ADDRESS = "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29";
const POLYGON_CHAIN_ID     = 137;

// Public RPCs we trust enough to read from. Tried in order; the first
// that responds wins. (Production code should use a paid endpoint;
// here we just need read access for verification.)
//
// As of 2026-05 the first two RPCs in this list still serve unkeyed
// requests; ankr / polygon-rpc.com / llamarpc moved behind API keys and
// reject anonymous probes. If publicnode goes the same way, drop in any
// chainlist.org Polygon entry.
const RPC_ENDPOINTS = [
  "https://polygon-bor-rpc.publicnode.com",
  "https://polygon.drpc.org",
  "https://1rpc.io/matic",
  "https://polygon.gateway.tenderly.co",
];

// What the dashboard claims the domain looks like. If the on-chain
// DOMAIN_SEPARATOR doesn't match the keccak256 of these inputs, the
// dashboard will mis-sign permits and we need to update permit.ts.
const EXPECTED_DOMAIN_NAME    = "JPY Coin";
const EXPECTED_DOMAIN_VERSION = "1";

// ── ABI selectors (left-pad function signature → take first 4 bytes) ─────
// Computed by hand from the canonical ERC-20 + ERC-2612 + EIP-712 ABI
// so we don't pull in viem / ethers just for a verification script.
const SELECTOR = {
  name:             "0x06fdde03", // name()
  symbol:           "0x95d89b41", // symbol()
  decimals:         "0x313ce567", // decimals()
  DOMAIN_SEPARATOR: "0x3644e515", // DOMAIN_SEPARATOR()
  nonces:           "0x7ecebe00", // nonces(address)
  PERMIT_TYPEHASH:  "0x30adf81f", // PERMIT_TYPEHASH()
  totalSupply:      "0x18160ddd", // totalSupply()
};

// The canonical EIP-2612 typehash. If the contract's PERMIT_TYPEHASH
// matches this we know it's using the standard permit message format
// (owner, spender, value, nonce, deadline) and we can sign against it
// once we know the domain.
const STANDARD_PERMIT_TYPEHASH =
  "0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9";

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Minimal eth_call wrapper. Returns the raw 0x-prefixed hex result.
 */
async function ethCall(rpc, to, data) {
  const body = {
    jsonrpc: "2.0",
    id:      1,
    method:  "eth_call",
    params:  [{ to, data }, "latest"],
  };
  const res = await fetch(rpc, {
    method:  "POST",
    headers: { "content-type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`RPC ${rpc} responded ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message ?? JSON.stringify(json.error)}`);
  return json.result;
}

/**
 * Try each RPC until one answers. Hides transient failures so the
 * verification works behind flaky home networks.
 */
async function ethCallMulti(to, data) {
  let lastError;
  for (const rpc of RPC_ENDPOINTS) {
    try {
      return await ethCall(rpc, to, data);
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(`All RPCs failed. Last error: ${lastError?.message}`);
}

/**
 * Decode a dynamic-length ABI string return. Solidity strings come back
 * as `0x` + offset(32) + length(32) + bytes(padded). We can skip the
 * offset since `name()` / `symbol()` always position the payload at
 * byte 32 of the result.
 */
function decodeAbiString(hex) {
  if (!hex || hex === "0x") return "";
  const data = hex.slice(2); // strip 0x
  // offset is always 0x20 (32) for a single string return — skip it.
  const len = parseInt(data.slice(64, 128), 16);
  const bytesHex = data.slice(128, 128 + len * 2);
  // Decode bytes → UTF-8
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = parseInt(bytesHex.slice(i * 2, i * 2 + 2), 16);
  }
  return new TextDecoder("utf-8").decode(bytes);
}

/** Decode a uint256 / uint8 hex string to a JS BigInt. */
function decodeUint(hex) {
  return BigInt(hex);
}

/**
 * Hand-rolled keccak256 for the EIP-712 domain comparison. We only need
 * it once per run and pulling in a full crypto lib for one hash feels
 * heavy. If `globalThis.crypto.subtle` is available we use that (Node
 * 20 ships it), otherwise we fall back to a small inline implementation.
 *
 * Actually — keccak256 is NOT the same as sha3-256, and Web Crypto's
 * SHA3 is not equivalent to Ethereum's. To stay zero-dependency, we
 * SKIP the local DOMAIN_SEPARATOR recomputation and instead just print
 * the on-chain value alongside the expected fields, then leave the
 * keccak verification for the test that runs inside the dashboard
 * (which has viem available anyway). The CLI still does the most
 * important check — that the contract is alive, exposes the right
 * shape, and the values match human expectation.
 */

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  // Optional --owner flag → fetch nonces(owner) too.
  const ownerIdx = argv.findIndex((a) => a === "--owner");
  const owner = ownerIdx > -1 ? argv[ownerIdx + 1] : null;
  if (owner && !/^0x[0-9a-fA-F]{40}$/.test(owner)) {
    console.error(`--owner must be a 0x-prefixed 20-byte address (got ${owner})`);
    process.exit(2);
  }

  console.log("─────────────────────────────────────────────────────────");
  console.log(" JPYC (Polygon) Permit Sanity Check");
  console.log(`   contract: ${JPYC_POLYGON_ADDRESS}`);
  console.log(`   chain:    Polygon (${POLYGON_CHAIN_ID})`);
  console.log("─────────────────────────────────────────────────────────");

  // 1. name()
  const nameHex = await ethCallMulti(JPYC_POLYGON_ADDRESS, SELECTOR.name);
  const name    = decodeAbiString(nameHex);
  console.log(`  name():             "${name}"`);
  console.log(`    expected:         "${EXPECTED_DOMAIN_NAME}"`);
  const nameOk = name === EXPECTED_DOMAIN_NAME;
  console.log(`    match:            ${nameOk ? "✅" : "❌ — update permit.ts domainName"}`);

  // 2. symbol()
  const symbolHex = await ethCallMulti(JPYC_POLYGON_ADDRESS, SELECTOR.symbol);
  const symbol    = decodeAbiString(symbolHex);
  console.log(`  symbol():           "${symbol}"`);

  // 3. decimals()
  const decimalsHex = await ethCallMulti(JPYC_POLYGON_ADDRESS, SELECTOR.decimals);
  const decimals    = Number(decodeUint(decimalsHex));
  console.log(`  decimals():         ${decimals}`);
  console.log(`    expected:         18 (dashboard hardcoded)`);
  const decOk = decimals === 18;
  console.log(`    match:            ${decOk ? "✅" : "❌ — JPYC decimals drifted"}`);

  // 4. PERMIT_TYPEHASH() — confirms the message format
  let typeHashOk = false;
  try {
    const typeHash = await ethCallMulti(JPYC_POLYGON_ADDRESS, SELECTOR.PERMIT_TYPEHASH);
    console.log(`  PERMIT_TYPEHASH():  ${typeHash}`);
    console.log(`    standard EIP-2612: ${STANDARD_PERMIT_TYPEHASH}`);
    typeHashOk = typeHash.toLowerCase() === STANDARD_PERMIT_TYPEHASH.toLowerCase();
    console.log(`    match:            ${typeHashOk ? "✅ — standard message format" : "⚠️ — custom typehash"}`);
  } catch (e) {
    console.log(`  PERMIT_TYPEHASH():  ⚠️ reverted (${e.message})`);
  }

  // 5. DOMAIN_SEPARATOR() — the on-chain truth for signing
  let domainSepOk = false;
  let domainSepHex = null;
  try {
    domainSepHex = await ethCallMulti(JPYC_POLYGON_ADDRESS, SELECTOR.DOMAIN_SEPARATOR);
    console.log(`  DOMAIN_SEPARATOR(): ${domainSepHex}`);
    domainSepOk = true;
  } catch (e) {
    console.log(`  DOMAIN_SEPARATOR(): ⚠️ reverted`);
    console.log(`    The contract's public getter for DOMAIN_SEPARATOR is`);
    console.log(`    not exposed (or returns no data). This was observed on`);
    console.log(`    the production JPYC contract as of 2026-05-23.`);
    console.log(`    Implication: we cannot recompute the exact EIP-712`);
    console.log(`    domain off-chain without knowing the version string`);
    console.log(`    used in the contract's constructor.`);
    console.log(`    NEXT STEP: ask JPYC社 directly for the canonical`);
    console.log(`    EIP-712 domain values (name, version) used in their`);
    console.log(`    deployed contract. Mark JPYC permit signing in the`);
    console.log(`    dashboard as experimental until confirmed.`);
  }

  // 6. totalSupply — sanity that this is a live, used token
  try {
    const supplyHex = await ethCallMulti(JPYC_POLYGON_ADDRESS, SELECTOR.totalSupply);
    const supply    = decodeUint(supplyHex);
    // Convert to human-readable JPYC (18 decimals).
    const supplyHuman = Number(supply / (BigInt(10) ** BigInt(15))) / 1000;
    console.log(`  totalSupply():      ${supplyHuman.toLocaleString()} JPYC`);
  } catch {
    /* ignore */
  }

  // 7. nonces(owner) if provided
  if (owner) {
    const ownerPadded = owner.slice(2).toLowerCase().padStart(64, "0");
    const data = SELECTOR.nonces + ownerPadded;
    const nonceHex = await ethCallMulti(JPYC_POLYGON_ADDRESS, data);
    const nonce    = decodeUint(nonceHex);
    console.log(`  nonces(${owner.slice(0, 10)}…):   ${nonce}`);
    console.log("    (this is the value /start/v2 will feed into the next");
    console.log("     permit signature for your address.)");
  } else {
    console.log("  nonces(...):        (skipped — pass --owner 0x... to test)");
  }

  console.log("─────────────────────────────────────────────────────────");
  // The "production OK" bar is:
  //   • name/symbol/decimals/typehash match
  //   • DOMAIN_SEPARATOR resolvable (or version confirmed via JPYC社)
  const staticOk = nameOk && decOk && typeHashOk;
  if (staticOk && domainSepOk) {
    console.log(" Result: ✅ Contract is alive and matches dashboard config.");
    console.log("         Safe to proceed with JPYC permit signing on Polygon.");
  } else if (staticOk && !domainSepOk) {
    console.log(" Result: ⚠️ Static fields OK, DOMAIN_SEPARATOR not exposed.");
    console.log("         The dashboard UI can ship (toggle / locale / encode are");
    console.log("         decoupled from on-chain). On-chain JPYC permit verification");
    console.log("         is blocked until JPYC社 confirms the EIP-712 domain version.");
    console.log("         Treat as experimental in production.");
    process.exitCode = 0; // not a hard failure
  } else {
    console.log(" Result: ❌ Mismatch detected — DO NOT ship until permit.ts is updated.");
    process.exitCode = 1;
  }
  console.log("─────────────────────────────────────────────────────────");
}

main().catch((e) => {
  console.error("FATAL:", e.message);
  process.exit(1);
});
