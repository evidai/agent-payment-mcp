/**
 * Admin auth guard for the operator console's cross-owner aggregate routes.
 *
 * Why this exists:
 *   The post-pivot /admin console needs to read across ALL owners' lc_*
 *   data (prepaid sales, per-provider rollups, recent activity). Those
 *   routes bypass the owner-cookie scoping that the public /api/lc/* routes
 *   use, so they MUST be gated to operators only.
 *
 * Auth model:
 *   The browser holds an admin session token (localStorage.admin_token,
 *   issued by the Express backend's POST /api/auth/login → signAdminToken,
 *   signed with ADMIN_JWT_SECRET, iss "kyapay-admin", { role: "admin" }).
 *   It is sent as a Bearer header.
 *
 *   We validate it server-side by probing an admin-gated Express endpoint
 *   (GET /api/admin/stats), which runs the backend's verifyAdminToken()
 *   guard. A 2xx means the token is a valid admin token; anything else
 *   (401/403/network) means it is not. Express is the single source of
 *   truth for the admin secret, so the secret never has to be mirrored
 *   onto Vercel and the two can never drift out of sync.
 *
 *   NOTE: we deliberately do NOT use /api/auth/me — that endpoint verifies
 *   *buyer* tokens (verifyBuyerToken / JWT_SECRET) and never returns a
 *   `role`, so an admin token can never pass it. Validating against it was
 *   the reason the operator console always 401'd.
 */

import { NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

/** Returns true only when the request carries a valid admin Bearer token. */
export async function requireAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  try {
    const probe = await fetch(`${API_URL}/api/admin/stats`, {
      headers: { Authorization: auth },
      // never cache the auth probe
      cache: "no-store",
    });
    return probe.ok;
  } catch {
    return false;
  }
}
