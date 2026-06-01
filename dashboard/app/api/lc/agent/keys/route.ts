/**
 * POST /api/lc/agent/keys — provision a Buyer Key (Agent Funding API, Phase 0).
 *
 * The current workspace (owner cookie) is the BUYER workspace. This issues a
 * `bk_...` secret scoped to one seller endpoint, with spend caps, and creates
 * the workspace wallet if needed. Plaintext key is returned ONCE.
 *
 * This is the single provisioning path (design seam ②): a future one-click
 * "approve $X for this seller" UI calls the same issueBuyerKey() unchanged.
 */
import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId } from "@/lib/lc-backend";
import { ensureAgentSchema, issueBuyerKey } from "@/lib/lc-agent-wallet";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  await ensureAgentSchema();
  const workspaceId = await ensureOwnerId();

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty body */ }

  const endpointShortId = String(body.endpointShortId ?? "").trim();
  if (!endpointShortId) return NextResponse.json({ error: "missing_endpoint" }, { status: 400 });

  const caps = {
    perMintCents: body.perMintCapCents != null ? Math.floor(Number(body.perMintCapCents)) : undefined,
    dailyCents: body.dailyCapCents != null ? Math.floor(Number(body.dailyCapCents)) : undefined,
    monthlyCents: body.monthlyCapCents != null ? Math.floor(Number(body.monthlyCapCents)) : undefined,
    lowThresholdPct: body.lowThresholdPct != null ? Math.floor(Number(body.lowThresholdPct)) : undefined,
  };

  const r = await issueBuyerKey({ workspaceId, endpointShortId, label: body.label != null ? String(body.label) : null, caps });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.error === "endpoint_not_found" ? 404 : 400 });

  return NextResponse.json({
    buyerKey: r.key, // shown ONCE — store it now
    prefix: r.prefix,
    walletId: r.walletId,
    scope: { endpointShortId: r.endpointShortId },
    caps: r.caps,
    note: "Store buyerKey now — it is shown only once. Use it as `Authorization: Bearer <buyerKey>` against /api/lc/agent/tokens.",
  });
}
