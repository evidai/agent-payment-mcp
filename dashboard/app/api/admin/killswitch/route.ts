/**
 * Emergency kill switch for the LIVE money path (Vercel x402 gateway + Stripe).
 *
 * Previously this proxied the old m2m-payment (Railway) service — which is NOT
 * the current charging path, so the button gave a false sense of safety. It now
 * flips a runtime DB flag (`gateway_halted`) that BOTH the gateway (/g/<id>) and
 * the mint endpoint (/api/lc/agent/tokens) check on every request: halting it
 * stops all new charges and funding instantly. (LC_KILL_SWITCH=1 env is a second,
 * redeploy-level trigger that also halts the path.)
 *
 * Auth: admin = a signed-in owner whose verified email is in ADMIN_EMAILS
 * (httpOnly cookie session; see lib/lc-admin). No Bearer token, no Railway.
 */

import { NextRequest, NextResponse } from "next/server";
import { backendEnvReady, getFlag, setFlag } from "@/lib/lc-backend";
import { requireAdmin } from "@/lib/lc-admin";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const FLAG = "gateway_halted";

export async function GET() {
  if (!backendEnvReady()) return NextResponse.json({ halted: false, configured: false });
  const halted = (await getFlag(FLAG)) === "1" || process.env.LC_KILL_SWITCH === "1";
  return NextResponse.json({ halted, envForced: process.env.LC_KILL_SWITCH === "1" });
}

export async function POST(req: NextRequest) {
  if (!backendEnvReady()) return NextResponse.json({ error: "backend_not_configured" }, { status: 503 });
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { halt?: boolean } = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (typeof body.halt !== "boolean") {
    return NextResponse.json({ error: '"halt" must be a boolean.' }, { status: 400 });
  }

  await setFlag(FLAG, body.halt ? "1" : "0");
  return NextResponse.json({ halted: body.halt, envForced: process.env.LC_KILL_SWITCH === "1" });
}
