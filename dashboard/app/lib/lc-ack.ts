/**
 * lc-ack.ts — Catena Labs ACK-Pay compatibility layer.
 *
 * ACK-Pay (Agent Commerce Kit, MIT, agentcommercekit.com) is Catena Labs'
 * W3C-standards payment protocol for agents: a 402 carries a *signed*
 * PaymentRequest (JWT), and settled payments yield a verifiable
 * PaymentReceiptCredential any third party can check against our DID.
 *
 * LemonCake speaks it natively:
 *   • /g/<shortId> 402 bodies embed an ACK-Pay `paymentRequest` +
 *     `paymentRequestToken` alongside our existing x402 `accepts[]`.
 *   • /api/lc/ack/receipt issues a PaymentReceiptCredential for any live
 *     Pay Token (the prepaid purchase IS the settlement proof).
 *   • /.well-known/did.json publishes did:web:www.lemoncake.xyz so receipts
 *     and requests verify with zero out-of-band trust.
 *
 * Key material: the Ed25519 signing key is derived deterministically from
 * LC_JWT_SECRET (HKDF-style SHA-256 with a fixed context label). No new env
 * var, no key file, identical key on every warm/cold start, and the DID
 * document always matches the signer. Rotating LC_JWT_SECRET rotates the DID
 * key with it.
 */

import { createHash } from "node:crypto";
import {
  createDidWebDocumentFromKeypair,
  createJwtSigner,
  createPaymentReceipt,
  createSignedPaymentRequest,
  curveToJwtAlgorithm,
  generateKeypair,
  signCredential,
  type DidDocument,
  type DidUri,
  type JwtAlgorithm,
} from "agentcommercekit";

const ACK_SEED_CONTEXT = "lemoncake-ack-ed25519-v1";

function baseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://www.lemoncake.xyz";
}

type AckIdentity = {
  did: DidUri;
  didDocument: DidDocument;
  signer: ReturnType<typeof createJwtSigner>;
  algorithm: JwtAlgorithm;
};

// Module-scope cache — derivation is cheap but the keypair never changes
// within a deployment, so do it once per lambda.
let _identity: AckIdentity | null = null;

export async function ackIdentity(): Promise<AckIdentity> {
  if (_identity) return _identity;
  const secret = process.env.LC_JWT_SECRET;
  if (!secret) throw new Error("LC_JWT_SECRET not configured");

  const seed = createHash("sha256")
    .update(`${secret}:${ACK_SEED_CONTEXT}`)
    .digest();
  const keypair = await generateKeypair("Ed25519", seed);
  const { did, didDocument } = createDidWebDocumentFromKeypair({
    keypair,
    baseUrl: baseUrl(),
  });

  _identity = {
    did,
    didDocument,
    signer: createJwtSigner(keypair),
    algorithm: curveToJwtAlgorithm(keypair.curve),
  };
  return _identity;
}

/**
 * Build the ACK-Pay payment-request block embedded in our 402 challenge.
 * `priceUsd` is the per-call price in dollars (lc_endpoints.price_per_call).
 */
export async function ackPaymentRequest(shortId: string, priceUsd: number) {
  const { did, signer, algorithm } = await ackIdentity();
  const origin = baseUrl();
  const cents = Math.round(priceUsd * 100);

  const { paymentRequest, paymentRequestToken } = await createSignedPaymentRequest(
    {
      id: `lc-${shortId}-${crypto.randomUUID()}`,
      description: `LemonCake paid API call — /g/${shortId}`,
      serviceCallback: `${origin}/g/${shortId}`,
      paymentOptions: [
        {
          id: "lemoncake-prepaid-usd",
          amount: cents,
          decimals: 2,
          currency: "USD",
          recipient: did,
          paymentService: `${origin}/buy/${shortId}`,
          receiptService: `${origin}/api/lc/ack/receipt`,
        },
      ],
    },
    { issuer: did, signer, algorithm },
  );

  return { paymentRequest, paymentRequestToken };
}

/**
 * Issue a PaymentReceiptCredential for a settled prepaid purchase.
 *
 * In ACK-Pay terms LemonCake is both Payment Service and Receipt Service:
 * the Pay Token only exists because the buyer's Stripe payment settled, so a
 * live Pay Token row IS the proof-of-payment. `payerDid` identifies the
 * holder; we accept the caller's DID or fall back to an opaque
 * did:lemoncake URI naming the Pay Token itself.
 */
export async function ackIssueReceipt(opts: {
  paymentRequestToken: string;
  paymentOptionId?: string;
  payerDid?: DidUri;
  payTokenId: string;
}) {
  const { did, signer, algorithm } = await ackIdentity();

  const receipt = createPaymentReceipt({
    paymentRequestToken: opts.paymentRequestToken,
    paymentOptionId: opts.paymentOptionId ?? "lemoncake-prepaid-usd",
    issuer: did,
    payerDid: opts.payerDid ?? (`did:lemoncake:pay-token-${opts.payTokenId}` as DidUri),
  });

  const jwt = await signCredential(receipt, { did, signer, alg: algorithm });
  return { receipt: jwt, issuer: did };
}
