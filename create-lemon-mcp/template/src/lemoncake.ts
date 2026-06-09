/**
 * LemonCake sandbox client — login-free, no card, no crypto.
 *
 * v0.1 talks ONLY to the LemonCake sandbox (a shared demo endpoint):
 *   POST /api/lc/demo/token  → a spend-capped sandbox Pay Token
 *   POST /g/<shortId>        → a metered call (the token is debited)
 *
 * It does NOT use the legacy seller SDK / api.lemoncake.xyz, and never settles
 * real money. Production seller billing (charge YOUR endpoint) lands in Phase 2.
 */

const SANDBOX_BASE = process.env.LEMONCAKE_SANDBOX_BASE || "https://www.lemoncake.xyz";

export interface SandboxToken {
  jwt: string;
  shortId: string;
  gatewayPath: string; // e.g. "/g/s5cv2m90"
  endpoint: { name: string; pricePerCall: number };
  token: { jti: string; budget: number; maxCalls: number; expiresAt: string };
}

/** Mint a fresh sandbox Pay Token (no auth, no card). */
export async function mintSandboxToken(): Promise<SandboxToken> {
  const r = await fetch(`${SANDBOX_BASE}/api/lc/demo/token`, { method: "POST" });
  if (!r.ok) throw new Error(`sandbox mint failed: HTTP ${r.status}`);
  return (await r.json()) as SandboxToken;
}

export interface PaidCallResult {
  status: number;
  charge: number | null; // USD debited (from x-lemoncake-charge header)
  body: unknown;
  capHit: boolean; // true when the gateway returns 402 (budget exhausted)
}

/** Make one metered call through the gateway with a Pay Token. */
export async function payCall(jwt: string, gatewayPath: string, body?: unknown): Promise<PaidCallResult> {
  const r = await fetch(`${SANDBOX_BASE}${gatewayPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const chargeHeader = r.headers.get("x-lemoncake-charge");
  const raw = await r.text();
  let parsed: unknown = raw;
  try { parsed = JSON.parse(raw); } catch { /* keep raw */ }
  return {
    status: r.status,
    charge: chargeHeader ? Number(chargeHeader) : null,
    body: parsed,
    capHit: r.status === 402,
  };
}

export const sandboxBase = SANDBOX_BASE;
