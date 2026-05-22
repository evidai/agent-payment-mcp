#!/usr/bin/env node
/**
 * Trigger Coinbase x402 Bazaar auto-listing for LemonCake.
 *
 * Performs ONE paid request to https://skillful-blessing-production.up.railway.app/api/x402-demo
 * through the CDP facilitator. CDP catalogs the resource URL into the
 * Bazaar discovery index on first successful settle.
 *
 * Usage:
 *   cd /Users/workoutsomehow/adhunt-pro
 *   npm i x402-fetch viem    # one-time install
 *   PRIVATE_KEY=0xabc...  node scripts/trigger-bazaar.mjs
 *
 * Requirements on the buyer wallet:
 *   - Base mainnet
 *   - >= 0.005 USDC (covers a few retries)
 *   - >= ~$0.10 worth of ETH for gas
 *
 * Cost: 0.001 USDC + ~$0.01-0.05 in gas. Total under 10 yen.
 */

import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY = process.env.PRIVATE_KEY;
const URL = process.env.URL ?? "https://skillful-blessing-production.up.railway.app/api/x402-demo";

if (!PRIVATE_KEY) {
  console.error("\n❌ Missing PRIVATE_KEY.\n");
  console.error("Usage:");
  console.error("  PRIVATE_KEY=0x...  node scripts/trigger-bazaar.mjs\n");
  console.error("The wallet needs >= 0.005 USDC and ~$0.05 ETH on Base mainnet.\n");
  process.exit(1);
}

const account = privateKeyToAccount(PRIVATE_KEY);
const fetchWithPayment = wrapFetchWithPayment(fetch, account);

console.log("─".repeat(60));
console.log("🍋 LemonCake x402 Bazaar bootstrap");
console.log("─".repeat(60));
console.log("Target URL :", URL);
console.log("Buyer wallet:", account.address);
console.log("Facilitator :", "Coinbase CDP (so Bazaar catalogs the URL)");
console.log("─".repeat(60));
console.log();

try {
  console.log("→ Sending GET (x402-fetch will auto-detect 402 and pay)...");
  const response = await fetchWithPayment(URL);
  const body = await response.json();

  console.log("\n✅ HTTP", response.status, "received\n");
  console.log("Body:");
  console.log(JSON.stringify(body, null, 2));

  const paymentResponse = response.headers.get("X-Payment-Response");
  if (paymentResponse) {
    console.log("\nX-Payment-Response:", paymentResponse);
  }

  console.log();
  console.log("─".repeat(60));
  console.log("🎉 Bazaar bootstrap settle complete.");
  console.log("─".repeat(60));
  console.log();
  console.log("CDP catalogs the resource URL on the first successful settle,");
  console.log("so the LemonCake x402 demo endpoint should appear in Bazaar");
  console.log("(and therefore AWS Bedrock AgentCore) within a few minutes.");
  console.log();
  console.log("Verify by searching for 'lemoncake' on:");
  console.log("  https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?q=lemoncake");
  console.log();
} catch (err) {
  console.error("\n❌ Failed:");
  console.error(err?.message ?? err);
  if (err?.response) {
    try { console.error("Response body:", await err.response.text()); } catch {}
  }
  process.exit(1);
}
