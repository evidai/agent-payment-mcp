import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sb, shortId, type EndpointRow } from "@/lib/lc-backend";

export const dynamic = "force-dynamic";

function notReady() {
  return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
}

/* GET — list this owner's endpoints */
export async function GET() {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();
  const { data, error } = await sb()
    .from("lc_endpoints")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ endpoints: data as EndpointRow[] });
}

/* POST — create a new endpoint */
type CreateBody = {
  name?: string;
  slug?: string;
  originalUrl?: string;
  upstreamAuth?: string | null;
  pricePerCall?: number;
  tokenBudget?: number;
  rateLimit?: number;
};

function sanitizeSlug(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32);
}

export async function POST(req: Request) {
  if (!backendEnvReady()) return notReady();
  const ownerId = await ensureOwnerId();

  let body: CreateBody;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const name = (body.name ?? "").trim();
  const originalUrl = (body.originalUrl ?? "").trim();
  const slugCandidate = sanitizeSlug(body.slug || name);
  const pricePerCall = Number(body.pricePerCall);
  const tokenBudget = Number(body.tokenBudget);
  const rateLimit = Math.max(1, Math.floor(Number(body.rateLimit)));

  if (!name) return NextResponse.json({ error: "name_required" }, { status: 400 });
  if (!/^https?:\/\//.test(originalUrl)) return NextResponse.json({ error: "invalid_url" }, { status: 400 });
  if (!slugCandidate) return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  if (!(pricePerCall > 0)) return NextResponse.json({ error: "invalid_price" }, { status: 400 });
  if (!(tokenBudget > 0)) return NextResponse.json({ error: "invalid_budget" }, { status: 400 });
  if (!(rateLimit > 0)) return NextResponse.json({ error: "invalid_rate_limit" }, { status: 400 });

  // Auto-resolve slug conflict within this owner
  const existing = await sb()
    .from("lc_endpoints")
    .select("slug")
    .eq("owner_id", ownerId);
  if (existing.error) return NextResponse.json({ error: existing.error.message }, { status: 500 });
  const used = new Set((existing.data ?? []).map((r: { slug: string }) => r.slug));
  let slug = slugCandidate;
  if (used.has(slug)) {
    let i = 2;
    while (used.has(`${slugCandidate}-${i}`)) i++;
    slug = `${slugCandidate}-${i}`;
  }

  // Short ID for gateway URL — retry on collision (vanishingly rare)
  let sid = shortId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { count } = await sb().from("lc_endpoints").select("id", { count: "exact", head: true }).eq("short_id", sid);
    if (!count) break;
    sid = shortId();
  }

  const insert = {
    short_id: sid,
    owner_id: ownerId,
    name,
    slug,
    original_url: originalUrl,
    upstream_auth: body.upstreamAuth?.trim() || null,
    price_per_call: pricePerCall,
    token_budget: tokenBudget,
    rate_limit: rateLimit,
    status: "live" as const,
  };

  const { data, error } = await sb()
    .from("lc_endpoints")
    .insert(insert)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ endpoint: data as EndpointRow }, { status: 201 });
}
