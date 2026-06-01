/**
 * POST /api/lc/agent/tokens/:id/topup — refill an existing Pay Token.
 *
 * Auth: `Authorization: Bearer bk_...`.
 * Body: { amountCents, idempotencyKey }
 *
 * Phase 0: same-token top-up (budget refilled, JWT stays valid). The response
 * ALWAYS returns the token to use (design seam ① — switching to a rolling token
 * later is a no-op for agents that use the returned value).
 */
import { NextResponse } from "next/server";
import { backendEnvReady } from "@/lib/lc-backend";
import { ensureAgentSchema, authBuyerKey, topupViaWallet, tokenView, walletSummary } from "@/lib/lc-agent-wallet";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  await ensureAgentSchema();

  const auth = await authBuyerKey(req);
  if (!auth) return NextResponse.json({ error: "invalid_buyer_key" }, { status: 401 });

  const { id } = await params;
  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const amountCents = Math.floor(Number(body.amountCents ?? 0));
  const idempotencyKey = String(body.idempotencyKey ?? "").trim();

  const r = await topupViaWallet({ key: auth.key, wallet: auth.wallet, tokenId: id, amountCents, idempotencyKey });
  if (!r.ok) return NextResponse.json({ error: r.error, detail: r.detail }, { status: r.status });

  return NextResponse.json({
    jwt: r.jwt,
    token: tokenView(r.row),
    wallet: await walletSummary(auth.wallet),
  });
}
