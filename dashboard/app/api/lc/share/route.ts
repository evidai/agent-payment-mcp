/**
 * POST /api/lc/share — record a growth/share analytics event.
 *
 * Public + no-auth: the public API page (anonymous visitors) and the
 * authenticated dashboard both POST here. Body:
 *   { shareType: string, endpointId?: string, slug?: string, shortId?: string }
 *
 * endpointId is resolved from slug/shortId when only those are known (the
 * public page knows the slug, not the internal UUID). Always returns 200 with
 * { ok: true } — analytics must never break the caller's flow.
 */

import { NextResponse } from "next/server";
import {
  backendEnvReady,
  ensureGrowthSchema,
  readOwnerId,
  recordShareEvent,
  sql,
} from "@/lib/lc-backend";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const ALLOWED = new Set([
  "copy_gateway_url",
  "copy_curl",
  "copy_readme_badge",
  "copy_x_post",
  "copy_docs_snippet",
  "copy_mcp_listing",
  "view_public_page",
  "submit_directory",
  "click_try_demo_from_public_page",
  "click_create_own_api_from_public_page",
]);

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ ok: false }, { status: 200 });

  let body: { shareType?: string; endpointId?: string; slug?: string; shortId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const shareType = (body.shareType ?? "").trim();
  if (!ALLOWED.has(shareType)) return NextResponse.json({ ok: false }, { status: 200 });

  try {
    await ensureGrowthSchema();

    let endpointId = body.endpointId?.trim() || null;
    if (!endpointId && (body.slug || body.shortId)) {
      const rows = await sql()<{ id: string }[]>`
        select id from lc_endpoints
        where public_slug = ${body.slug ?? null} or short_id = ${body.shortId ?? null}
        limit 1
      `;
      endpointId = rows[0]?.id ?? null;
    }

    const ownerId = await readOwnerId();
    await recordShareEvent({ endpointId, ownerId, shareType });
  } catch {
    // best-effort
  }

  return NextResponse.json({ ok: true });
}
