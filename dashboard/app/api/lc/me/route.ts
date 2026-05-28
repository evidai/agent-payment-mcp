import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

type OwnerRow = {
  id: string;
  email: string | null;
  email_verified_at: string | null;
  created_at: string;
};

/** GET — current owner profile (cookie-resolved, lazily upserted) */
export async function GET() {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const [row] = await sql()<OwnerRow[]>`
    select id, email, email_verified_at, created_at
    from lc_owners where id = ${ownerId} limit 1
  `;
  return NextResponse.json({ owner: row ?? { id: ownerId, email: null, email_verified_at: null, created_at: new Date().toISOString() } });
}
