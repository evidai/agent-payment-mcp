/**
 * smoke — verify your PRODUCTION billing wiring end to end.
 *
 *   LEMONCAKE_SELLER_KEY  your sk_live_… (from LemonCake /app → endpoint → Seller Key)
 *   LEMONCAKE_PAY_TOKEN   a test Pay Token for that endpoint (issue one in /app)
 *
 * Runs the same lc.charge() path your server uses against a no-op tool and
 * confirms a real charge settled. In sandbox mode (no seller key) it points you
 * at `npm run demo:agent` instead.
 */
import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

const sellerKey = process.env.LEMONCAKE_SELLER_KEY;
const payToken = process.env.LEMONCAKE_PAY_TOKEN;
const price = Number(process.env.PRICE_PER_CALL || 0.05);

if (!sellerKey) {
  console.log("Sandbox mode — set LEMONCAKE_SELLER_KEY to smoke-test production billing.");
  console.log("Meanwhile, see the live paid-call flow with:  npm run demo:agent");
  process.exit(0);
}
if (!payToken) {
  console.error(red("Set LEMONCAKE_PAY_TOKEN (a test Pay Token for your endpoint) to smoke the charge path."));
  console.error("Issue one in LemonCake /app → your endpoint → Issue test token.");
  process.exit(1);
}

const lc = createLemonCakeSDK({ sellerKey, defaultPayToken: payToken });
console.log(`SDK mode: ${lc.isDemo ? "demo" : "production"} · ${lc.apiUrl}`);

const wrapped = lc.charge({ price, toolName: "smoke" })(async () => ({
  content: [{ type: "text", text: "ok" }],
}));

const res = await wrapped({}, {});
const text = res.content.map((c) => c.text).join(" ");

if (!res.isError && /Charged \$/.test(text)) {
  console.log(green("✓ production charge settled — ") + text.replace(/\s+/g, " ").trim());
  process.exit(0);
}
console.error(red("✗ charge did not settle:"), JSON.stringify(res));
process.exit(1);
