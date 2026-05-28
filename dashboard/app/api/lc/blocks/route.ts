import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sb, type BlockedRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

function notReady() {
  return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
}

/* GET — list blocked attempts for this owner */
export async function GET() {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { data, error } = await sb()
    .from("lc_blocked")
    .select("*")
    .eq("owner_id", ownerId)
    .order("at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ blocked: data as BlockedRow[] });
}

/* DELETE — clear this owner's blocked log */
export async function DELETE() {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { error } = await sb()
    .from("lc_blocked")
    .delete()
    .eq("owner_id", ownerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
