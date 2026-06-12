/**
 * /.well-known/did.json — DID document for did:web:www.lemoncake.xyz.
 *
 * Publishing this makes every ACK-Pay artifact we sign (payment requests in
 * 402 challenges, PaymentReceiptCredentials) independently verifiable by any
 * agent with a did:web resolver — no API key, no out-of-band trust.
 */

import { NextResponse } from "next/server";
import { ackIdentity } from "@/lib/lc-ack";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!process.env.LC_JWT_SECRET) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const { didDocument } = await ackIdentity();
  return NextResponse.json(didDocument, {
    headers: {
      "Content-Type": "application/did+json",
      // The key only changes when LC_JWT_SECRET rotates — cache generously.
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
