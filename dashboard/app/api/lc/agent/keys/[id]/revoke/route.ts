/**
 * POST /api/lc/agent/keys/:id/revoke — revoke a Buyer Key (owner-authenticated).
 *
 * The current workspace (owner cookie) can revoke a key it owns. A revoked key
 * fails authBuyerKey immediately, so it can no longer mint/top-up (charge the
 * saved card). `id` is the Buyer Key ROW id (from GET /api/lc/agent/keys).
 */
import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId } from "@/lib/lc-backend";
import { ensureAgentSchema, revokeKeyForWorkspace } from "@/lib/lc-agent-wallet";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  await ensureAgentSchema();
  const workspaceId = await ensureOwnerId();
  const { id } = await params;

  const r = await revokeKeyForWorkspace(workspaceId, id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 404 });
  return NextResponse.json({ ok: true, revoked: true });
}
