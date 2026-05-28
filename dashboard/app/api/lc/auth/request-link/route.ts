/**
 * POST /api/lc/auth/request-link
 *   body: { email: string }
 *
 * Generates a magic link, stores it in lc_magic_links keyed to (optionally)
 * the requester's current anonymous owner cookie, and emails it. If
 * RESEND_API_KEY is not set, returns the link directly in the response
 * (dev / first-deploy fallback).
 */

import { NextResponse } from "next/server";
import { backendEnvReady, ensureOwnerId, sql } from "@/lib/lc-backend";
import { sendMagicLink } from "@/lib/lc-mail";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

const notReady = () => NextResponse.json({ error: "backend_not_configured" }, { status: 503 });

// Basic email shape check. Real validation happens when Stripe / inbox bounces.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  if (!backendEnvReady()) return notReady();

  let body: { email?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const prevOwnerId = await ensureOwnerId();

  // Random URL-safe token. 32 bytes hex = 256 bits, comfortably collision-resistant.
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  await sql()`
    insert into lc_magic_links (token, email, prev_owner_id, expires_at)
    values (${token}, ${email}, ${prevOwnerId}, ${expiresAt})
  `;

  const origin = new URL(req.url).origin;
  const link = `${origin}/api/lc/auth/verify?token=${token}`;

  const result = await sendMagicLink(email, link);

  return NextResponse.json({
    sent: result.sent,
    // Dev fallback: surface the link in the response so the caller can show
    // it in the UI when no email backend is configured.
    previewUrl: result.previewUrl ?? null,
    email,
  });
}
