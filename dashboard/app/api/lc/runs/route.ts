import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql, type TestRunRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

export async function GET() {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const rows = await sql()<TestRunRow[]>`
    select * from lc_test_runs
    where owner_id = ${ownerId}
    order by at desc limit 500
  `;
  return NextResponse.json({ runs: rows });
}
