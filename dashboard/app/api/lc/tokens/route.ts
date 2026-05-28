import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sb, signPayToken, type PayTokenRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

function notReady() {
  return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
}

/* GET — list this owner's Pay Tokens, optionally filtered by endpoint */
export async function GET(req: Request) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const url = new URL(req.url);
  const endpointId = url.searchParams.get("endpointId");

  let q = sb()
    .from("lc_pay_tokens")
    .select("*")
    .eq("owner_id", ownerId)
    .order("issued_at", { ascending: false })
    .limit(200);
  if (endpointId) q = q.eq("endpoint_id", endpointId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Auto-recompute stale active tokens to expired
  const now = Date.now();
  const rows = (data as PayTokenRow[]).map((r) => {
    if (r.status === "active" && new Date(r.expires_at).getTime() < now) {
      return { ...r, status: "expired" as const };
    }
    return r;
  });

  return NextResponse.json({ tokens: rows });
}

/* POST — issue a new Pay Token, returns the signed JWT */
type IssueBody = {
  endpointId?: string;
  budget?: number;
  expiresInHours?: number;
  maxCalls?: number;
};

export async function POST(req: Request) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();

  let body: IssueBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const endpointId = body.endpointId;
  const budget = Number(body.budget);
  const hours = Math.max(1, Math.floor(Number(body.expiresInHours)));
  const maxCalls = Math.max(1, Math.floor(Number(body.maxCalls)));

  if (!endpointId) return NextResponse.json({ error: "endpoint_required" }, { status: 400 });
  if (!(budget > 0)) return NextResponse.json({ error: "invalid_budget" }, { status: 400 });
  if (!(maxCalls > 0)) return NextResponse.json({ error: "invalid_max_calls" }, { status: 400 });

  // Verify the endpoint belongs to this owner
  const { data: ep, error: epErr } = await sb()
    .from("lc_endpoints")
    .select("id, owner_id, token_budget")
    .eq("id", endpointId)
    .eq("owner_id", ownerId)
    .single();
  if (epErr || !ep) return NextResponse.json({ error: "endpoint_not_found" }, { status: 404 });

  if (budget > Number(ep.token_budget) * 5) {
    return NextResponse.json({ error: "budget_exceeds_endpoint_cap" }, { status: 400 });
  }

  const jti = `pt_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const expiresAt = Date.now() + hours * 3600 * 1000;

  const insert = {
    id: jti,
    endpoint_id: endpointId,
    owner_id: ownerId,
    budget,
    spent: 0,
    max_calls: maxCalls,
    calls_used: 0,
    expires_at: new Date(expiresAt).toISOString(),
    status: "active" as const,
  };

  const { data, error } = await sb()
    .from("lc_pay_tokens")
    .insert(insert)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sign the JWT — caller hands this to the buyer
  const jwt = await signPayToken({ jti, sub: endpointId, own: ownerId }, expiresAt);

  return NextResponse.json({ token: data as PayTokenRow, jwt }, { status: 201 });
}
