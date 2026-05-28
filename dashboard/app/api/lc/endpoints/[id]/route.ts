import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sb } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

function notReady() {
  return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
}

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { id } = await params;

  let body: { status?: "live" | "paused" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  if (body.status === "live" || body.status === "paused") updates.status = body.status;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "no_updates" }, { status: 400 });

  const { data, error } = await sb()
    .from("lc_endpoints")
    .update(updates)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  return NextResponse.json({ endpoint: data });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { id } = await params;

  const { error } = await sb()
    .from("lc_endpoints")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
