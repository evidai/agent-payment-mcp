/**
 * /api/lc/demo/echo — self-hosted "hello world" upstream for the public /demo.
 *
 * The /demo page mints a sandbox Pay Token and calls the production gateway
 * (/g/<shortId>). That gateway forwards to a real `original_url`, so the demo
 * endpoint points here. This keeps the whole demo self-contained — no external
 * API dependency, no cost, nothing to break.
 *
 * Returns a small JSON payload that makes it obvious the call was metered &
 * "paid for" through LemonCake.
 */

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

async function handle(req: Request) {
  let youSent: unknown = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      youSent = await req.json();
    } catch {
      youSent = null;
    }
  }

  return NextResponse.json({
    ok: true,
    service: "LemonCake Demo API",
    message: "This response was paid for with a LemonCake Pay Token.",
    method: req.method,
    youSent,
    servedAt: new Date().toISOString(),
    pricePerCall: "$0.01",
    docs: "https://www.lemoncake.xyz/docs",
  });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
