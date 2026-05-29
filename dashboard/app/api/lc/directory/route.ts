/**
 * POST /api/lc/directory — submit an endpoint to the LemonCake Directory.
 *
 * Owner-scoped (uses the lc_owner cookie). Upserts one submission per
 * endpoint (status reset to 'pending' on re-submit), mirrors the chosen
 * category/description onto the endpoint, and flips its directory_status to
 * 'pending'. Admin approval (status → 'approved') is done out-of-band.
 *
 * Body: { endpointId: string, category: string, description?: string }
 */

import { NextResponse } from "next/server";
import {
  backendEnvReady,
  ensureGrowthSchema,
  ensureOwnerId,
  recordShareEvent,
  sql,
  type DirectorySubmissionRow,
  type EndpointRow,
} from "@/lib/lc-backend";
import { isValidCategory } from "@/lib/lc-growth";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function POST(req: Request) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  await ensureGrowthSchema();
  const ownerId = await ensureOwnerId();

  let body: { endpointId?: string; category?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const endpointId = (body.endpointId ?? "").trim();
  const category = (body.category ?? "").trim();
  const description = (body.description ?? "").trim() || null;

  if (!endpointId) return NextResponse.json({ error: "endpoint_required" }, { status: 400 });
  if (!isValidCategory(category)) return NextResponse.json({ error: "invalid_category" }, { status: 400 });

  // Verify ownership.
  const eps = await sql()<EndpointRow[]>`
    select * from lc_endpoints where id = ${endpointId} and owner_id = ${ownerId} limit 1
  `;
  if (eps.length === 0) return NextResponse.json({ error: "endpoint_not_found" }, { status: 404 });

  // Upsert the submission (one per endpoint), resetting to pending review.
  const [sub] = await sql()<DirectorySubmissionRow[]>`
    insert into lc_directory_submissions (endpoint_id, owner_id, category, description, status)
    values (${endpointId}, ${ownerId}, ${category}, ${description}, 'pending')
    on conflict (endpoint_id) do update
      set category = excluded.category,
          description = excluded.description,
          status = 'pending',
          submitted_at = now(),
          reviewed_at = null,
          reviewed_by = null
    returning *
  `;

  // Mirror onto the endpoint so the public page can render category/desc and
  // show the "Pending review" state without a join.
  await sql()`
    update lc_endpoints
    set category = ${category},
        public_description = coalesce(${description}, public_description),
        directory_status = 'pending'
    where id = ${endpointId}
  `;

  await recordShareEvent({ endpointId, ownerId, shareType: "submit_directory" });

  return NextResponse.json({ submission: sub }, { status: 201 });
}
