/**
 * POST /api/lc/seller-keys/:keyId/revoke — revoke a Seller SDK Key.
 *
 * Owner-authenticated (lc_owner cookie). A revoked key fails resolveSellerKey
 * immediately, so /api/sdk/{preflight,charge} reject it. `keyId` is the seller
 * key ROW id (skid_…) from GET .../seller-keys.
 */
import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId } from "@/lib/lc-backend";
import { ensureSdkSchema, revokeSellerKey } from "@/lib/lc-sdk";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ keyId: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  await ensureSdkSchema();
  const ownerId = await ensureOwnerId();
  const { keyId } = await params;

  const r = await revokeSellerKey(ownerId, keyId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 404 });
  return NextResponse.json({ ok: true, revoked: true });
}
