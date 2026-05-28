import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql, type BlockedRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

export async function GET() {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const rows = await sql()<BlockedRow[]>`
    select * from lc_blocked
    where owner_id = ${ownerId}
    order by at desc limit 500
  `;
  return NextResponse.json({ blocked: rows });
}

export async function DELETE() {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  await sql()`
    delete from lc_blocked where owner_id = ${ownerId}
  `;
  return NextResponse.json({ ok: true });
}
