/**
 * GET /api/lc/agent/wallet — wallet summary for a Buyer Key.
 *
 * Auth: `Authorization: Bearer bk_...`.
 * Returns the VIRTUAL balance (= sum of unspent Pay Tokens — no custodial
 * pool), spend windows, caps, and the low-balance threshold. The Wallet SDK
 * uses `lowThresholdPct` to decide when to top up (client-side; the server
 * never auto-charges).
 */
import { NextResponse } from "next/server";
import { backendEnvReady } from "@/lib/lc-backend";
import { ensureAgentSchema, authBuyerKey, walletSummary } from "@/lib/lc-agent-wallet";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function GET(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  await ensureAgentSchema();

  const auth = await authBuyerKey(req);
  if (!auth) return NextResponse.json({ error: "invalid_buyer_key" }, { status: 401 });

  return NextResponse.json({ wallet: await walletSummary(auth.wallet) });
}
