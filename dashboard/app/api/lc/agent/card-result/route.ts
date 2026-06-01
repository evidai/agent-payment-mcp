/**
 * GET /api/lc/agent/card-result?session_id=...&key=bk_...
 *
 * Finalize a hosted card-save: pulls the saved PaymentMethod from the completed
 * setup-mode Checkout Session and stores it on the Buyer Key. No bearer auth —
 * knowing the single-use session id (only in the buyer's success URL) is the
 * capability. `key` is the Buyer Key ROW id (not the secret).
 */
import { NextResponse } from "next/server";
import { backendEnvReady } from "@/lib/lc-backend";
import { stripeReady } from "@/lib/lc-stripe";
import { ensureAgentSchema } from "@/lib/lc-agent-wallet";
import { finalizeCardFromSession } from "@/lib/lc-agent-stripe";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function GET(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (!stripeReady()) return NextResponse.json({ error: "stripe_not_configured" }, { status: 503 });
  await ensureAgentSchema();

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session_id");
  const keyId = url.searchParams.get("key");
  if (!sessionId || !keyId) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const r = await finalizeCardFromSession(keyId, sessionId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  return NextResponse.json({ cardSaved: true, paymentMethodId: r.paymentMethodId });
}
