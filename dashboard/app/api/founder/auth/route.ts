/**
 * Founder PIN check — server-side.
 *
 * Why server-side: NEXT_PUBLIC_ env vars are baked into the client bundle
 * at build time. Vercel's build cache sometimes doesn't refresh them
 * reliably. Server-side env vars are read at runtime, so changes take
 * effect immediately without rebuilds. Bonus: PIN never appears in
 * the client JS bundle.
 *
 * Auth flow:
 *   client POST /api/founder/auth { pin } → 200 if match, 401 if not
 *   On 200, client sets sessionStorage flag and shows the cockpit.
 */

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

const PIN = process.env.FOUNDER_PIN ?? process.env.NEXT_PUBLIC_FOUNDER_PIN ?? "";

function safeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) {
    // Still run a constant-time compare so timing is uniform.
    const padded = Buffer.alloc(aBuf.length);
    bBuf.copy(padded, 0, 0, Math.min(aBuf.length, bBuf.length));
    timingSafeEqual(aBuf, padded);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export async function POST(req: NextRequest) {
  if (!PIN) {
    return NextResponse.json(
      { error: "FOUNDER_PIN env var not configured." },
      { status: 503 }
    );
  }
  let body: { pin?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (typeof body.pin !== "string" || !body.pin) {
    return NextResponse.json({ error: "Missing pin" }, { status: 400 });
  }
  if (!safeEq(PIN, body.pin)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
