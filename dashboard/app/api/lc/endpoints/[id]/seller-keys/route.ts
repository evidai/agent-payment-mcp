/**
 * /api/lc/endpoints/[id]/seller-keys — manage Seller SDK Keys for one endpoint.
 *
 *   GET  → list this endpoint's keys (prefix / status / timestamps; NEVER the
 *          full secret — only its hash is stored).
 *   POST → issue a new sk_live_… bound to this endpoint. The plaintext key is
 *          returned ONCE in this response and never again.
 *
 * Owner-authenticated via the lc_owner cookie; the endpoint must belong to the
 * caller. `[id]` is the endpoint UUID (same segment the PATCH route uses).
 */
import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql } from "@/lib/lc-backend";
import { ensureSdkSchema, issueSellerKey, listSellerKeys } from "@/lib/lc-sdk";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

/** Resolve the endpoint UUID to its short_id, asserting the caller owns it. */
async function ownEndpoint(id: string, ownerId: string): Promise<{ shortId: string } | null> {
  if (!UUID_RE.test(id)) return null;
  const rows = await sql()<{ short_id: string }[]>`
    select short_id from lc_endpoints where id = ${id} and owner_id = ${ownerId} limit 1
  `;
  return rows[0] ? { shortId: rows[0].short_id } : null;
}

export async function GET(_req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  await ensureSdkSchema();
  const ownerId = await ensureOwnerId();
  const { id } = await params;

  const ep = await ownEndpoint(id, ownerId);
  if (!ep) return NextResponse.json({ error: "endpoint_not_found" }, { status: 404 });

  const all = await listSellerKeys(ownerId);
  const keys = all.filter((k) => k.endpointShortId === ep.shortId);
  return NextResponse.json({ keys });
}

export async function POST(req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  await ensureSdkSchema();
  const ownerId = await ensureOwnerId();
  const { id } = await params;

  const ep = await ownEndpoint(id, ownerId);
  if (!ep) return NextResponse.json({ error: "endpoint_not_found" }, { status: 404 });

  let label: string | null = null;
  try {
    const body = (await req.json()) as { label?: string };
    if (body?.label) label = String(body.label).slice(0, 80);
  } catch { /* no body */ }

  // Live keys only in v1 (sandbox is the separate /api/lc/demo path).
  const r = await issueSellerKey({ ownerId, endpointShortId: ep.shortId, env: "live", label });
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  // The ONLY response that includes the plaintext key.
  return NextResponse.json({ key: r.key, prefix: r.prefix, id: r.id, env: r.env }, { status: 201 });
}
