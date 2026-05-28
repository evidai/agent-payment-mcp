import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql, signPayToken, type PayTokenRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

export async function GET(req: Request) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const url = new URL(req.url);
  const endpointId = url.searchParams.get("endpointId");

  const rows = endpointId
    ? await sql()<PayTokenRow[]>`
        select * from lc_pay_tokens
        where owner_id = ${ownerId} and endpoint_id = ${endpointId}
        order by issued_at desc limit 200
      `
    : await sql()<PayTokenRow[]>`
        select * from lc_pay_tokens
        where owner_id = ${ownerId}
        order by issued_at desc limit 200
      `;

  // Lazy "expired" recompute for stale-active rows
  const now = Date.now();
  const refreshed = rows.map((r) => {
    if (r.status === "active" && new Date(r.expires_at).getTime() < now) {
      return { ...r, status: "expired" as const };
    }
    return r;
  });

  return NextResponse.json({ tokens: refreshed });
}

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

  const eps = await sql()<{ id: string; token_budget: string }[]>`
    select id, token_budget from lc_endpoints
    where id = ${endpointId} and owner_id = ${ownerId} limit 1
  `;
  if (eps.length === 0) return NextResponse.json({ error: "endpoint_not_found" }, { status: 404 });
  const epCap = Number(eps[0].token_budget) * 5;
  if (budget > epCap) {
    return NextResponse.json({ error: "budget_exceeds_endpoint_cap", maxAllowed: epCap }, { status: 400 });
  }

  const jti = `pt_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const expiresAt = Date.now() + hours * 3600 * 1000;

  const [row] = await sql()<PayTokenRow[]>`
    insert into lc_pay_tokens (id, endpoint_id, owner_id, budget, spent, max_calls, calls_used, expires_at, status)
    values (${jti}, ${endpointId}, ${ownerId}, ${budget}, 0, ${maxCalls}, 0, ${new Date(expiresAt).toISOString()}, 'active')
    returning *
  `;
  const jwt = await signPayToken({ jti, sub: endpointId, own: ownerId }, expiresAt);
  return NextResponse.json({ token: row, jwt }, { status: 201 });
}
