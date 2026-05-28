import { NextResponse } from "next/server";
import { backendEnvReady } from "@/lib/lc-backend";

// Cheap probe for the /app client: "is the real backend wired up, or do I
// fall back to localStorage simulation mode?"
export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export async function GET() {
  return NextResponse.json({ ready: backendEnvReady() });
}
