import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql, type EndpointRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

export const preferredRegion = "hnd1";

const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { id } = await params;

  let body: { status?: "live" | "paused" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  if (body.status !== "live" && body.status !== "paused") {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }
  const status = body.status;

  const rows = await sql()<EndpointRow[]>`
    update lc_endpoints
    set status = ${status}
    where id = ${id} and owner_id = ${ownerId}
    returning *
  `;
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ endpoint: rows[0] });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { id } = await params;
  await sql()`
    delete from lc_endpoints
    where id = ${id} and owner_id = ${ownerId}
  `;
  return NextResponse.json({ ok: true });
}
