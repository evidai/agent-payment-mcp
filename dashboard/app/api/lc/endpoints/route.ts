import { NextResponse } from "next/server";
import {
  backendEnvReady,
  ensureOwnerId,
  ensureGrowthSchema,
  generatePublicSlug,
  sql,
  shortId,
  type EndpointRow,
} from "@/lib/lc-backend";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

export async function GET() {
  if (!backendEnvReady()) return notReady();
  await ensureGrowthSchema();
  const ownerId = await ensureOwnerId();
  const rows = await sql()<EndpointRow[]>`
    select * from lc_endpoints
    where owner_id = ${ownerId}
    order by created_at desc
  `;
  return NextResponse.json({ endpoints: rows });
}

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
  await ensureGrowthSchema();
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
  const used = await sql()<{ slug: string }[]>`
    select slug from lc_endpoints where owner_id = ${ownerId}
  `;
  const usedSet = new Set(used.map((r) => r.slug));
  let slug = slugCandidate;
  if (usedSet.has(slug)) {
    let i = 2;
    while (usedSet.has(`${slugCandidate}-${i}`)) i++;
    slug = `${slugCandidate}-${i}`;
  }

  // short_id with collision retry
  let sid = shortId();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await sql()<{ id: string }[]>`
      select id from lc_endpoints where short_id = ${sid} limit 1
    `;
    if (existing.length === 0) break;
    sid = shortId();
  }

  const upstreamAuth = body.upstreamAuth?.trim() || null;

  // Globally-unique public handle for /api/<public_slug>. The per-owner `slug`
  // can collide across owners, so the public page needs its own namespace.
  const publicSlug = await generatePublicSlug(name);

  const [row] = await sql()<EndpointRow[]>`
    insert into lc_endpoints (
      short_id, owner_id, name, slug, original_url, upstream_auth,
      price_per_call, token_budget, rate_limit, status,
      public_slug, public_title, public_page_enabled, badge_enabled, directory_status
    )
    values (
      ${sid}, ${ownerId}, ${name}, ${slug}, ${originalUrl}, ${upstreamAuth},
      ${pricePerCall}, ${tokenBudget}, ${rateLimit}, 'live',
      ${publicSlug}, ${name}, true, true, 'none'
    )
    returning *
  `;
  return NextResponse.json({ endpoint: row }, { status: 201 });
}
