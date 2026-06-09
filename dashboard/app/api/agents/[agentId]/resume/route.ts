/** POST /api/agents/:agentId/resume — resume a paused agent. */
import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId } from "@/lib/lc-backend";
import { ensureAgentIdentitySchema, setAgentStatus } from "@/lib/lc-agents";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ agentId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  await ensureAgentIdentitySchema();
  const ownerId = await ensureOwnerId();
  const { agentId } = await params;
  const agent = await setAgentStatus(ownerId, agentId, "active");
  if (!agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, agent });
}
