/**
 * GET /api/lc/auth/oauth/[provider]/callback?code=...&state=...
 *
 * Finishes the OAuth flow:
 *   1. Verify the one-shot state nonce (CSRF).
 *   2. Exchange the code for an access token and fetch the identity.
 *   3. Resolve/create the lc_owners row (same model as the magic link).
 *   4. Pin the lc_owner cookie and redirect back to /app.
 *
 * On any failure, redirect to /app?auth=<reason> so the dashboard can show
 * a friendly message rather than a raw error page.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendEnvReady, readOwnerId } from "@/lib/lc-backend";
import {
  exchangeCodeForIdentity,
  isOAuthProvider,
  providerConfig,
  resolveOwnerForOAuth,
} from "@/lib/lc-oauth";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ provider: string }> };

const OWNER_COOKIE = "lc_owner";
const STATE_COOKIE = "lc_oauth_state";

function bounce(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/app?auth=${reason}`, { status: 303 });
}

export async function GET(req: Request, { params }: Ctx) {
  const url = new URL(req.url);
  const origin = url.origin;
  const { provider } = await params;

  if (!isOAuthProvider(provider)) return bounce(origin, "unknown_provider");
  if (!backendEnvReady()) return bounce(origin, "backend_not_configured");

  const cfg = providerConfig(provider);
  if (!cfg) return bounce(origin, `${provider}_not_configured`);

  // Provider-side error (user denied consent, etc.)
  if (url.searchParams.get("error")) return bounce(origin, "oauth_denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return bounce(origin, "missing_code");

  // CSRF: the state param must match the per-provider nonce we set at /start.
  const c = await cookies();
  const stateCookie = c.get(STATE_COOKIE)?.value ?? "";
  c.set(STATE_COOKIE, "", { path: "/", maxAge: 0 }); // one-shot — clear regardless
  if (!stateCookie || stateCookie !== `${provider}:${state}`) {
    return bounce(origin, "bad_state");
  }

  let identity;
  try {
    identity = await exchangeCodeForIdentity(provider, cfg, origin, code);
  } catch {
    return bounce(origin, "oauth_exchange_failed");
  }

  const prevOwnerId = await readOwnerId();
  let ownerId: string;
  try {
    ownerId = await resolveOwnerForOAuth({ provider, identity, prevOwnerId });
  } catch {
    return bounce(origin, "owner_resolve_failed");
  }

  c.set(OWNER_COOKIE, ownerId, {
    httpOnly: true, // server-only; the dashboard reads its owner id via /api/lc/me
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return bounce(origin, "signed_in");
}
