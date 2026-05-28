import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql, type PayTokenRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { id } = await params;

  const rows = await sql()<PayTokenRow[]>`
    update lc_pay_tokens
    set status = 'revoked'
    where id = ${id} and owner_id = ${ownerId}
    returning *
  `;
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ token: rows[0] });
}
