import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sb, type TestRunRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

function notReady() {
  return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
}

/* GET — list this owner's paid runs, newest first, capped at 500 */
export async function GET() {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { data, error } = await sb()
    .from("lc_test_runs")
    .select("*")
    .eq("owner_id", ownerId)
    .order("at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ runs: data as TestRunRow[] });
}
