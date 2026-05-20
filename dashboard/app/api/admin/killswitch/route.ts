/**
 * Server-side proxy for the m2m-payment killswitch endpoint.
 *
 * Why this exists:
 *   The admin dashboard had an "Emergency Halt" button that only flipped
 *   a local React useState — it never reached the backend. (Reported as
 *   C-06 in the 2026-05 @kleosr forensic audit.)
 *
 * Why proxy server-side instead of calling m2m-payment from the browser:
 *   The m2m-payment killswitch requires an X-Admin-Key header. We don't
 *   want that key exposed to the browser. The Next.js route runs server-
 *   side and forwards the call using ADMIN_API_KEY from the environment.
 *
 * Auth model (defence-in-depth):
 *   1. Next.js route checks the dashboard session cookie via the existing
 *      /api/auth/me check (same pattern as other admin endpoints).
 *   2. If the user is an admin, the route forwards to m2m-payment using
 *      the server-side ADMIN_API_KEY.
 *   3. m2m-payment's requireAdmin middleware re-validates the key with
 *      a timing-safe compare.
 */

import { NextRequest, NextResponse } from "next/server";

const M2M_URL = process.env.M2M_URL ?? "http://localhost:3003";
const ADMIN_KEY = process.env.ADMIN_API_KEY;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

async function requireDashboardAdmin(req: NextRequest): Promise<boolean> {
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

export async function POST(req: NextRequest) {
  if (!ADMIN_KEY) {
    return NextResponse.json(
      { error: "Admin key not configured on server." },
      { status: 503 }
    );
  }
  if (!(await requireDashboardAdmin(req))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { halt?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (typeof body.halt !== "boolean") {
    return NextResponse.json(
      { error: '"halt" must be a boolean.' },
      { status: 400 }
    );
  }

  const upstream = await fetch(`${M2M_URL}/api/killswitch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": ADMIN_KEY,
    },
    body: JSON.stringify({ halt: body.halt }),
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}

export async function GET() {
  // Public read-only state (m2m-payment GET is also unauthenticated).
  const upstream = await fetch(`${M2M_URL}/api/killswitch`);
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
