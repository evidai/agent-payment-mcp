/**
 * Admin auth guard for the operator console's cross-owner aggregate routes.
 *
 * Why this exists:
 *   The post-pivot /admin console needs to read across ALL owners' lc_*
 *   data (prepaid sales, per-provider rollups, recent activity). Those
 *   routes bypass the owner-cookie scoping that the public /api/lc/* routes
 *   use, so they MUST be gated to operators only.
 *
 * Auth model (same pattern as /api/admin/killswitch):
 *   The browser holds an admin session token (localStorage.admin_token,
 *   issued by the Express backend's /api/auth/login). It is sent as a
 *   Bearer header. We validate it server-side against the Express
 *   /api/auth/me endpoint and require role === "admin". The token is never
 *   trusted on its own — Express is the source of truth for the role.
 */

import { NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

/** Returns true only when the request carries a valid admin Bearer token. */
export async function requireAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  try {
    const me = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: auth },
    });
    if (!me.ok) return false;
    const data = (await me.json()) as { role?: string };
    return data.role === "admin";
  } catch {
    return false;
  }
}
