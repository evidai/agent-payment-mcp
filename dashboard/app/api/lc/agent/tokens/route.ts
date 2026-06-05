/**
 * POST /api/lc/agent/tokens — mint a funded Pay Token (Agent Funding API, Phase 0).
 *
 * Auth: `Authorization: Bearer bk_...` (a Buyer Key).
 * Body: { endpointShortId, amountCents, idempotencyKey }
 *
 * Charges via the PaymentAdapter (StubAdapter in Phase 0 = mock currency, no
 * real money), enforces the wallet's spend caps server-side, then mints a Pay
 * Token. This is the `mintUrl` the gateway's x402 challenge advertises.
 */
import { NextResponse } from "next/server";
import { backendEnvReady, isGatewayHalted } from "@/lib/lc-backend";
import { ensureAgentSchema, authBuyerKey, mintViaWallet, tokenView, walletSummary } from "@/lib/lc-agent-wallet";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (await isGatewayHalted()) return NextResponse.json({ error: "gateway_halted" }, { status: 503 });
  await ensureAgentSchema();

  const auth = await authBuyerKey(req);
  if (!auth) return NextResponse.json({ error: "invalid_buyer_key" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const endpointShortId = String(body.endpointShortId ?? "").trim();
  const amountCents = Math.floor(Number(body.amountCents ?? 0));
  const idempotencyKey = String(body.idempotencyKey ?? "").trim();
  if (!endpointShortId) return NextResponse.json({ error: "missing_endpoint" }, { status: 400 });

  const r = await mintViaWallet({ key: auth.key, wallet: auth.wallet, endpointShortId, amountCents, idempotencyKey });
  if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: r.status });

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return NextResponse.json({
    jwt: r.jwt,
    token: tokenView(r.row),
    gatewayUrl: `${origin}/g/${endpointShortId}`,
    wallet: await walletSummary(auth.wallet),
  });
}
