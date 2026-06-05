/**
 * POST /api/lc/auth/logout — clear the (httpOnly) owner cookie.
 *
 * The lc_owner cookie is httpOnly, so the dashboard can't clear it in JS.
 * This drops it server-side; the next request mints a fresh anonymous owner
 * (for a signed-in user, this is sign-out; for anon, it starts a clean slate).
 */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const OWNER_COOKIE = "lc_owner";

export async function POST() {
  const c = await cookies();
  c.set(OWNER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/",
  });
  return NextResponse.json({ ok: true });
}
