/**
 * GET /api/lc/auth/providers
 *
 * Tells the dashboard which social sign-in buttons to render. A provider is
 * "on" only when its OAuth client id + secret are configured in env, so the
 * UI never shows a button that would dead-end at a not-configured redirect.
 */

import { NextResponse } from "next/server";
import { configuredProviders } from "@/lib/lc-oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(configuredProviders());
}
