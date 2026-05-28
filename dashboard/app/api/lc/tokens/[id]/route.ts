import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sb } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

function notReady() {
  return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
}

type Ctx = { params: Promise<{ id: string }> };

/* DELETE — revoke a Pay Token (status → revoked) */
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { id } = await params;

  const { data, error } = await sb()
    .from("lc_pay_tokens")
    .update({ status: "revoked" })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === "PGRST116" ? 404 : 500 });
  return NextResponse.json({ token: data });
}
