/**
 * GET /badge/<apiId>.svg — README badge for an endpoint.
 *
 * apiId is the endpoint's short_id. The dynamic segment captures the trailing
 * ".svg" (e.g. "abc123.svg"), so we strip it. Renders the price for a live
 * endpoint, "paused" for a paused one, and a neutral "unknown" badge if the
 * id doesn't resolve (so a README never shows a broken image).
 *
 * Cached at the edge for a few minutes so price/status edits propagate without
 * hammering the DB on every README render.
 */

import {
  backendEnvReady,
  ensureGrowthSchema,
  sql,
  type EndpointRow,
} from "@/lib/lc-backend";
import { badgeSvg } from "@/lib/lc-growth";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ apiId: string }> };

function svgResponse(svg: string, maxAge = 300): Response {
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=60, s-maxage=${maxAge}, stale-while-revalidate=600`,
    },
  });
}

export async function GET(_req: Request, { params }: Ctx) {
  const { apiId } = await params;
  const shortId = apiId.replace(/\.svg$/i, "").trim();

  if (!backendEnvReady() || !shortId) {
    return svgResponse(badgeSvg({ muted: true }), 60);
  }

  try {
    await ensureGrowthSchema();
    const rows = await sql()<EndpointRow[]>`
      select price_per_call, status
      from lc_endpoints where short_id = ${shortId} limit 1
    `;
    if (rows.length === 0) {
      return svgResponse(badgeSvg({ muted: true }), 60);
    }
    const ep = rows[0];
    const paused = ep.status !== "live";
    return svgResponse(badgeSvg({ price: ep.price_per_call, paused }));
  } catch {
    return svgResponse(badgeSvg({ muted: true }), 60);
  }
}
