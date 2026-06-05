import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql, type EndpointRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

export const preferredRegion = "hnd1";

const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

type Ctx = { params: Promise<{ id: string }> };

type PatchBody = {
  status?: "live" | "paused";
  name?: string;
  originalUrl?: string;
  upstreamAuth?: string | null; // "" clears it; omit to leave unchanged
  pricePerCall?: number;
  rateLimit?: number;
};

export async function PATCH(req: Request, { params }: Ctx) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { id } = await params;

  let body: PatchBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  // Build the editable field set. Unprovided fields fall through to coalesce →
  // unchanged. This makes an endpoint editable in place (fix a typo'd upstream
  // key, change price/url) instead of forcing delete-and-recreate — which used
  // to cascade-delete the endpoint's Buyer Keys.
  const has = (k: keyof PatchBody) => Object.prototype.hasOwnProperty.call(body, k);

  if (has("status") && body.status !== "live" && body.status !== "paused") {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }
  if (has("name") && !String(body.name ?? "").trim()) {
    return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  }
  if (has("originalUrl") && !/^https?:\/\//.test(String(body.originalUrl ?? ""))) {
    return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  }
  if (has("pricePerCall") && !(Number(body.pricePerCall) > 0)) {
    return NextResponse.json({ error: "invalid_price" }, { status: 400 });
  }
  if (has("rateLimit") && !(Math.floor(Number(body.rateLimit)) >= 1)) {
    return NextResponse.json({ error: "invalid_rate_limit" }, { status: 400 });
  }
  if (!["status", "name", "originalUrl", "upstreamAuth", "pricePerCall", "rateLimit"].some((k) => has(k as keyof PatchBody))) {
    return NextResponse.json({ error: "no_updates" }, { status: 400 });
  }

  // The id column is a uuid — reject non-uuid ids up front so a bad path param
  // is a clean 404, not a uuid-cast 500.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Per-field values: the new value when provided, else null → coalesce keeps the
  // current column. upstreamAuth is special: an explicit "" means "clear it".
  // NOTE: each null param is explicitly cast so Postgres can infer its type
  // (an untyped NULL inside coalesce() errors with "could not determine data type").
  const status = has("status") ? body.status! : null;
  const name = has("name") ? String(body.name).trim() : null;
  const originalUrl = has("originalUrl") ? String(body.originalUrl).trim() : null;
  const pricePerCall = has("pricePerCall") ? Number(body.pricePerCall) : null;
  const rateLimit = has("rateLimit") ? Math.floor(Number(body.rateLimit)) : null;
  const upstreamProvided = has("upstreamAuth");
  const upstreamAuth = upstreamProvided ? (String(body.upstreamAuth ?? "").trim() || null) : null;

  const rows = await sql()<EndpointRow[]>`
    update lc_endpoints set
      status         = coalesce(${status}::text, status),
      name           = coalesce(${name}::text, name),
      original_url   = coalesce(${originalUrl}::text, original_url),
      price_per_call = coalesce(${pricePerCall}::numeric, price_per_call),
      rate_limit     = coalesce(${rateLimit}::int, rate_limit),
      upstream_auth  = case when ${upstreamProvided}::boolean then ${upstreamAuth}::text else upstream_auth end
    where id = ${id} and owner_id = ${ownerId}
    returning *
  `;
  if (rows.length === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Mask the secret in the response (mirrors the list endpoint).
  const ep = rows[0] as EndpointRow & { upstream_auth?: string | null };
  return NextResponse.json({ endpoint: { ...ep, upstream_auth: ep.upstream_auth ? "••••" : null } });
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
