/**
 * ack-demo.mjs — LemonCake × Catena ACK-Pay interop demo.
 *
 * Walks the full ACK-Pay loop against the production gateway:
 *
 *   1. Call a paid endpoint with no credentials → HTTP 402 carrying a SIGNED
 *      ACK-Pay PaymentRequest (JWT).
 *   2. Verify that JWT against did:web:www.lemoncake.xyz with a standard
 *      resolver — no LemonCake SDK, no shared secret.
 *   3. (with PAY_TOKEN set) Exchange the settled Pay Token for a W3C
 *      PaymentReceiptCredential at the receipt service.
 *   4. Verify the receipt credential against the same DID document.
 *
 * Usage:
 *   node scripts/ack-demo.mjs                  # steps 1–2 (no payment needed)
 *   PAY_TOKEN=<jwt> node scripts/ack-demo.mjs  # full loop incl. receipt
 *
 * Requires Node 20+ (global fetch + webcrypto).
 */

import {
  getDidResolver,
  verifyPaymentRequestToken,
  verifyPaymentReceipt,
} from "agentcommercekit";

const ORIGIN = process.env.LC_ORIGIN ?? "https://www.lemoncake.xyz";
const SHORT_ID = process.env.LC_SHORT_ID ?? "9g8qx0d7"; // live FX endpoint
const PAY_TOKEN = process.env.PAY_TOKEN;

const log = (s) => console.log(s);
const ok = (s) => console.log(`  ✅ ${s}`);

log(`\n🍋 LemonCake × ACK-Pay interop demo — ${ORIGIN}\n`);

// ── 1. Unauthenticated call → 402 with ACK-Pay block ────────────────────
log(`1. GET ${ORIGIN}/g/${SHORT_ID} (no credentials)`);
const res = await fetch(`${ORIGIN}/g/${SHORT_ID}`);
if (res.status !== 402) {
  throw new Error(`expected 402, got ${res.status}`);
}
const body = await res.json();
ok(`HTTP 402 returned`);

const ack = body.ackPay;
if (!ack?.paymentRequestToken) {
  throw new Error("402 body has no ackPay block — is the ACK layer deployed?");
}
ok(`ackPay block present (protocol=${ack.protocol}, version=${ack.ackVersion})`);
log(`     payment options: ${ack.paymentRequest.paymentOptions.map((o) => `${o.id} (${o.amount / 10 ** o.decimals} ${o.currency})`).join(", ")}`);

// ── 2. Verify the signed PaymentRequest against did:web ─────────────────
log(`\n2. Verifying paymentRequestToken against did:web (standard resolver)`);
const resolver = getDidResolver();
const { paymentRequest } = await verifyPaymentRequestToken(
  ack.paymentRequestToken,
  { resolver },
);
ok(`signature valid — issuer resolves via ${ORIGIN}/.well-known/did.json`);
ok(`request id: ${paymentRequest.id}`);

if (!PAY_TOKEN) {
  log(`\n(set PAY_TOKEN=<jwt> to run the receipt half of the loop)\n`);
  process.exit(0);
}

// ── 3. Settled Pay Token → verifiable receipt ────────────────────────────
log(`\n3. POST ${ack.receiptService} (Pay Token as settlement proof)`);
const rRes = await fetch(ack.receiptService, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${PAY_TOKEN}`,
  },
  body: JSON.stringify({ paymentRequestToken: ack.paymentRequestToken }),
});
if (!rRes.ok) {
  throw new Error(`receipt service: ${rRes.status} ${await rRes.text()}`);
}
const { receipt, issuer } = await rRes.json();
ok(`PaymentReceiptCredential issued by ${issuer}`);

// ── 4. Verify the receipt like any third party would ────────────────────
log(`\n4. Verifying receipt credential (trustedReceiptIssuers=[${issuer}])`);
await verifyPaymentReceipt(receipt, {
  resolver,
  trustedReceiptIssuers: [issuer],
});
ok(`receipt verified — W3C VC, checkable by anyone, no LemonCake account\n`);

log(`Full ACK-Pay loop complete: 402 → signed request → settlement → verifiable receipt 🍋\n`);
