/**
 * /api/agents/:agentId — Agent detail + update.
 *   GET   → the agent (owner-scoped).
 *   PATCH → update display_name / description / status. Body: { displayName?, description?, status? }
 */
import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId } from "@/lib/lc-backend";
import { ensureAgentIdentitySchema, getAgent, updateAgent, type AgentStatus } from "@/lib/lc-agents";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ agentId: string }> };
const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

export async function GET(_req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  await ensureAgentIdentitySchema();
  const ownerId = await ensureOwnerId();
  const { agentId } = await params;
  const agent = await getAgent(ownerId, agentId);
  if (!agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
  return NextResponse.json({ agent });
}

export async function PATCH(req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  await ensureAgentIdentitySchema();
  const ownerId = await ensureOwnerId();
  const { agentId } = await params;

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty */ }

  const patch: { displayName?: string; description?: string | null; status?: AgentStatus } = {};
  if (body.displayName != null) {
    const dn = String(body.displayName).trim();
    if (!dn) return NextResponse.json({ error: "invalid_display_name" }, { status: 400 });
    patch.displayName = dn;
  }
  if (Object.prototype.hasOwnProperty.call(body, "description")) {
    patch.description = body.description != null ? String(body.description) : null;
  }
  if (body.status != null) {
    const s = String(body.status);
    if (!["active", "paused", "revoked"].includes(s)) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    patch.status = s as AgentStatus;
  }

  const agent = await updateAgent(ownerId, agentId, patch);
  if (!agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
  return NextResponse.json({ agent });
}
