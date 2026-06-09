/**
 * /api/agents — Agent Identity (thin layer).
 *   GET  → list the owner's agents (with custody-free spend rollup).
 *   POST → create an agent. Body: { displayName, description?, agentType?, organizationId?, agentId? }
 *
 * Owner-authenticated via the lc_owner cookie. Agents own nothing custodial —
 * their "budget" is the sum of the Pay Tokens bound to them.
 */
import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId } from "@/lib/lc-backend";
import { ensureAgentIdentitySchema, listAgents, createAgent } from "@/lib/lc-agents";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

export async function GET() {
  if (!backendEnvReady()) return notReady();
  await ensureAgentIdentitySchema();
  const ownerId = await ensureOwnerId();
  return NextResponse.json({ agents: await listAgents(ownerId) });
}

export async function POST(req: Request) {
  if (!backendEnvReady()) return notReady();
  await ensureAgentIdentitySchema();
  const ownerId = await ensureOwnerId();

  let body: Record<string, unknown> = {};
  try { body = (await req.json()) as Record<string, unknown>; } catch { /* empty */ }

  const displayName = String(body.displayName ?? "").trim();
  if (!displayName) return NextResponse.json({ error: "display_name_required" }, { status: 400 });

  const agent = await createAgent({
    ownerId,
    displayName,
    description: body.description != null ? String(body.description) : null,
    agentType: body.agentType != null ? String(body.agentType) : null,
    organizationId: body.organizationId != null ? String(body.organizationId) : null,
    handle: body.agentId != null ? String(body.agentId) : null,
  });
  return NextResponse.json({ agent }, { status: 201 });
}
