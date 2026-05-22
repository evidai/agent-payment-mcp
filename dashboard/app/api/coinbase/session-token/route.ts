/**
 * POST /api/coinbase/session-token
 *
 * Generates a secure-init session token for Coinbase Onramp.
 *
 * Newer CDP projects are configured with "secure initialization"
 * required — the project rejects direct `?appId=...&addresses=...`
 * URLs and demands a server-issued `sessionToken` instead. This route
 * is the server piece: it takes the caller's wallet address + the
 * desired asset/network, signs a JWT with the project's Ed25519
 * secret key, and forwards to Coinbase's `/onramp/v1/token`.
 *
 * Why we keep this server-side:
 *   The CDP secret key must never reach the browser. Putting the
 *   token-mint behind a Next.js API route lets us authenticate via
 *   the user's Privy session (added later) before handing out a
 *   Coinbase session — same pattern Coinbase's own Next.js sample
 *   uses.
 */

import { NextResponse } from "next/server";
import { SignJWT, importJWK } from "jose";

export const runtime = "nodejs";
// Coinbase tokens are short-lived and project-scoped, so caching
// across users would be wrong. Force every call to mint a fresh one.
export const dynamic = "force-dynamic";

const CDP_API_KEY_ID      = process.env.CDP_API_KEY_ID ?? "";
const CDP_API_PRIVATE_KEY = process.env.CDP_API_PRIVATE_KEY ?? "";

// Coinbase's REST host (not pay.coinbase.com — that's the consumer UI).
const COINBASE_API_HOST  = "api.developer.coinbase.com";
const COINBASE_TOKEN_URL = `https://${COINBASE_API_HOST}/onramp/v1/token`;

interface TokenRequestBody {
  address: string;
  network?: string;  // defaults to "base"
  asset?: string;    // defaults to "USDC"
}

// Build the Ed25519 JWK out of the raw 64-byte base64 secret CDP gave
// us. The first 32 bytes are the seed (private key d), the second 32
// bytes are the public key x. Both have to be re-encoded as
// base64url for the JWK to be accepted by `jose`.
function buildJwkFromCdpSecret(base64Secret: string) {
  const raw = Buffer.from(base64Secret, "base64");
  if (raw.length !== 64) {
    throw new Error(
      `Unexpected CDP secret length ${raw.length} (expected 64 for Ed25519 seed+public)`,
    );
  }
  const seed   = raw.subarray(0, 32);
  const pub    = raw.subarray(32, 64);
  const toUrlB64 = (b: Buffer) =>
    b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return {
    kty: "OKP",
    crv: "Ed25519",
    d:   toUrlB64(seed),
    x:   toUrlB64(pub),
  } as const;
}

// Mint a short-lived JWT bound to the specific (method, host, path)
// tuple — Coinbase rejects tokens whose `uri` claim doesn't match the
// request. Spec: https://docs.cdp.coinbase.com/api-reference/v1/authentication
async function buildCdpJwt(method: string, host: string, path: string): Promise<string> {
  const jwk = buildJwkFromCdpSecret(CDP_API_PRIVATE_KEY);
  const key = await importJWK(jwk, "EdDSA");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    iss: "cdp",
    sub: CDP_API_KEY_ID,
    nbf: now,
    exp: now + 120, // 2 minutes — Coinbase caps at 5
    uri: `${method} ${host}${path}`,
  })
    .setProtectedHeader({
      alg: "EdDSA",
      kid: CDP_API_KEY_ID,
      typ: "JWT",
      nonce: crypto.randomUUID().replace(/-/g, ""),
    })
    .sign(key);
}

export async function POST(req: Request) {
  if (!CDP_API_KEY_ID || !CDP_API_PRIVATE_KEY) {
    return NextResponse.json(
      { error: "CDP credentials not configured on the server." },
      { status: 503 },
    );
  }

  let body: TokenRequestBody;
  try {
    body = (await req.json()) as TokenRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const address = body.address?.toString().trim() ?? "";
  const network = (body.network ?? "base").trim();
  const asset   = (body.asset ?? "USDC").trim();

  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  if (network !== "base") {
    return NextResponse.json({ error: "Unsupported network" }, { status: 400 });
  }

  const path = "/onramp/v1/token";
  const jwt  = await buildCdpJwt("POST", COINBASE_API_HOST, path);

  const cbRes = await fetch(COINBASE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      addresses: [{ address, blockchains: [network] }],
      assets: [asset],
    }),
  });

  const cbText = await cbRes.text();
  if (!cbRes.ok) {
    // Bubble the upstream status so the client can show something
    // meaningful (CDP is good about returning descriptive error JSON).
    return NextResponse.json(
      { error: "Coinbase token mint failed", upstream: cbText },
      { status: cbRes.status },
    );
  }

  let parsed: { token?: string; channel_id?: string };
  try {
    parsed = JSON.parse(cbText);
  } catch {
    return NextResponse.json(
      { error: "Unexpected Coinbase response", body: cbText },
      { status: 502 },
    );
  }

  if (!parsed.token) {
    return NextResponse.json(
      { error: "Coinbase did not return a session token", body: cbText },
      { status: 502 },
    );
  }

  return NextResponse.json({ sessionToken: parsed.token });
}
