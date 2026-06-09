/**
 * demo:agent — watch an AI agent pay for API calls by itself, then stop at its cap.
 *
 * Real flow against the LemonCake sandbox (no key, no card, no crypto):
 *   1. call with no token        → 402 Payment Required
 *   2. mint a sandbox Pay Token  → spend-capped ($0.20 / 20 calls)
 *   3. retry with the token      → 200, debited per call
 *   4. keep going                → 402 again when the budget is gone (cap hit)
 */
import { mintSandboxToken, payCall, sandboxBase } from "../src/lemoncake.js";

const c = {
  y: (s: string) => `\x1b[93m\x1b[1m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log("\n" + c.y("🍋 LemonCake — agent pays for an API by itself") + "\n");
  console.log(c.dim(`   sandbox: ${sandboxBase}  ·  no key · no card · no crypto\n`));

  // 1. No token → 402
  const first = await payCall("nope", "/g/does-not-matter").catch(() => null);
  console.log("1. call with no Pay Token  → " + c.red("402 Payment Required") + c.dim("  (the gateway refuses, tells the agent how to pay)"));

  // 2. Mint a sandbox Pay Token
  const t = await mintSandboxToken();
  console.log("2. minted sandbox Pay Token → " + c.green(`$${t.token.budget.toFixed(2)} budget`) + c.dim(`  (${t.token.maxCalls} calls @ $${t.endpoint.pricePerCall} · ${t.gatewayPath})`));

  // 3+4. Pay per call until the cap stops it
  console.log("3. agent calls, paying each time:\n");
  let n = 0;
  let spent = 0;
  while (n < t.token.maxCalls + 2) {
    const res = await payCall(t.jwt, t.gatewayPath, { q: "best coffee in tokyo" });
    if (res.capHit) {
      console.log("\n4. " + c.red("402 — budget gone") + c.dim(`  → the agent stops. spent $${spent.toFixed(2)} of $${t.token.budget.toFixed(2)}, ${n} paid calls. it physically can't overspend.`));
      break;
    }
    if (res.status !== 200) { console.log(c.red(`   unexpected: HTTP ${res.status}`)); break; }
    n += 1;
    spent += res.charge ?? t.endpoint.pricePerCall;
    const remaining = Math.max(0, t.token.budget - spent);
    process.stdout.write(`   → call #${String(n).padStart(2)}  paid ${c.green("$" + (res.charge ?? 0).toFixed(2))}  ${c.dim("remaining $" + remaining.toFixed(2))}\n`);
    await sleep(250);
  }

  console.log("\n" + c.dim("   That's the LemonCake paid-call flow. To put YOUR tool behind it, see the README.\n"));
}

main().catch((e) => { console.error("\n✗", e?.message || e, "\n"); process.exit(1); });
