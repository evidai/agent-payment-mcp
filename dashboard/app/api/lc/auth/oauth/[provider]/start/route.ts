/**
 * GET /api/lc/auth/oauth/[provider]/start
 *
 * Kicks off the OAuth Authorization Code flow for `google` | `github`.
 * Sets a one-shot httpOnly state nonce (CSRF guard) and redirects the
 * browser to the provider's consent screen. The matching /callback route
 * finishes the exchange and pins the lc_owner cookie.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { backendEnvReady, ensureOwnerId } from "@/lib/lc-backend";
import { buildAuthorizeUrl, isOAuthProvider, providerConfig } from "@/lib/lc-oauth";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ provider: string }> };

const STATE_COOKIE = "lc_oauth_state";

function bounce(origin: string, reason: string) {
  return NextResponse.redirect(`${origin}/app?auth=${reason}`, { status: 303 });
}

export async function GET(req: Request, { params }: Ctx) {
  const origin = new URL(req.url).origin;
  const { provider } = await params;

  if (!isOAuthProvider(provider)) return bounce(origin, "unknown_provider");
  if (!backendEnvReady()) return bounce(origin, "backend_not_configured");

  const cfg = providerConfig(provider);
  if (!cfg) return bounce(origin, `${provider}_not_configured`);

  // Ensure an owner cookie exists so /callback can claim it if this turns out
  // to be a brand-new social sign-in from an anonymous browser.
  await ensureOwnerId();

  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

  const c = await cookies();
  c.set(STATE_COOKIE, `${provider}:${nonce}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600, // 10 minutes to complete the round-trip
    path: "/",
  });

  return NextResponse.redirect(buildAuthorizeUrl(provider, cfg, origin, nonce), { status: 303 });
}
