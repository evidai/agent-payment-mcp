/**
 * /api/lc/ack/receipt — ACK-Pay Receipt Service.
 *
 * POST { paymentRequestToken, paymentOptionId?, payerDid? }
 *      Authorization: Bearer <Pay-Token-JWT>
 *
 * In ACK-Pay, a Receipt Service verifies proof-of-payment and returns a
 * signed PaymentReceiptCredential. For LemonCake's prepaid model the Pay
 * Token IS the settlement proof — it only exists because a Stripe payment
 * settled — so presenting a valid, live Pay Token earns a verifiable
 * receipt bound to that purchase. Agents can hand the receipt to any
 * third party (auditor, counterparty, Catena-style governance layer) and
 * it verifies against did:web:www.lemoncake.xyz with a standard resolver.
 *
 * GET returns service metadata (spec compliance + discovery).
 */

import { NextResponse } from "next/server";
import { backendEnvReady, sql, verifyPayToken, type PayTokenRow } from "@/lib/lc-backend";
import { ackIdentity, ackIssueReceipt } from "@/lib/lc-ack";
import { isDidUri } from "agentcommercekit";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function err(status: number, code: string) {
  return NextResponse.json({ error: code }, { status, headers: cors });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

export async function GET() {
  if (!process.env.LC_JWT_SECRET) return err(503, "not_configured");
  const { did } = await ackIdentity();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.lemoncake.xyz";
  return NextResponse.json(
    {
      service: "LemonCake ACK-Pay Receipt Service",
      protocol: "ACK-Pay",
      ackVersion: "2025-05-04",
      issuer: did,
      didDocument: `${origin}/.well-known/did.json`,
      usage:
        "POST { paymentRequestToken, payerDid? } with `Authorization: Bearer <Pay-Token-JWT>` to receive a PaymentReceiptCredential for a settled prepaid purchase.",
    },
    { headers: cors },
  );
}

export async function POST(req: Request) {
  if (!backendEnvReady()) return err(503, "backend_not_configured");

  // 1. Proof of payment = a valid, live Pay Token.
  const auth = req.headers.get("authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return err(401, "missing_pay_token");
  const claims = await verifyPayToken(m[1].trim());
  if (!claims) return err(401, "invalid_pay_token");

  const tokens = await sql()<PayTokenRow[]>`
    select * from lc_pay_tokens where id = ${claims.jti} limit 1
  `;
  if (tokens.length === 0) return err(401, "pay_token_not_found");
  const tok = tokens[0];
  if (tok.status === "revoked") return err(403, "token_revoked");

  // 2. The ACK-Pay request being settled.
  let body: { paymentRequestToken?: string; paymentOptionId?: string; payerDid?: string };
  try {
    body = await req.json();
  } catch {
    return err(400, "invalid_json");
  }
  if (!body.paymentRequestToken || typeof body.paymentRequestToken !== "string") {
    return err(400, "missing_payment_request_token");
  }
  if (body.payerDid !== undefined && !isDidUri(body.payerDid)) {
    return err(400, "invalid_payer_did");
  }

  // 3. Issue the verifiable receipt.
  const { receipt, issuer } = await ackIssueReceipt({
    paymentRequestToken: body.paymentRequestToken,
    paymentOptionId: body.paymentOptionId,
    payerDid: body.payerDid,
    payTokenId: tok.id,
  });

  return NextResponse.json(
    {
      receipt,
      issuer,
      payTokenId: tok.id,
      note: "Verify with @agentcommercekit/ack-pay verifyPaymentReceipt() against our did:web document.",
    },
    { headers: cors },
  );
}
