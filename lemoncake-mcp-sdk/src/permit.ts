/**
 * ERC-2612 permit verification for the non-custodial Pay Token replacement.
 *
 * Background:
 *   The 2026-05-21 FSA Q11 ruling confirmed that LemonCake can operate as
 *   a pure SDK provider (no USDC custody, no smart contract operation)
 *   without 電子決済手段等取引業 registration.
 *
 *   The new auth model: instead of LemonCake-issued JWTs ("Pay Tokens"),
 *   buyers sign one ERC-2612 permit (~90 days) that authorises any spender
 *   to pull USDC from their wallet up to a fixed cap. The signed permit
 *   travels with each MCP call as a base64-encoded blob (`LEMON_CAKE_PERMIT`).
 *
 *   This module gives SDK consumers (MCP server authors) a single function
 *   to decode + verify + summarise an incoming permit BEFORE doing the
 *   actual USDC transferFrom() on-chain.
 *
 * Why this matters for sellers:
 *   - You can refuse a permit that's expired, on the wrong chain, or below
 *     your minimum per-call charge, without ever touching the user's wallet.
 *   - You can read `permit.value` and the remaining nonce window to
 *     enforce your own per-buyer rate-limits.
 *   - You can call this in <10ms, no RPC required for verification —
 *     viem's `recoverTypedDataAddress` is pure crypto.
 *
 * What this module does NOT do:
 *   - It does NOT submit the permit on-chain. The seller (or their
 *     paymaster) does that when ready to charge.
 *   - It does NOT validate the buyer actually has USDC balance. That's
 *     a separate `balanceOf` RPC call you make right before transferFrom.
 *   - It does NOT track consumed allowance — once you've pulled some USDC,
 *     remember to subtract from your local counter or call `allowance(...)`.
 */

import {
  type Address,
  type Hex,
  recoverTypedDataAddress,
} from "viem";

// EIP-712 domain shape used by every USDC FiatTokenV2 / FiatTokenV2_2
// deployment we care about. Adding a new chain = add a row here.
const DOMAINS: Record<number, { name: string; version: string }> = {
  8453: { name: "USD Coin",          version: "2" }, // Base mainnet
  137:  { name: "USD Coin (PoS)",    version: "2" }, // Polygon
};

const PERMIT_TYPES = {
  Permit: [
    { name: "owner",    type: "address" },
    { name: "spender",  type: "address" },
    { name: "value",    type: "uint256" },
    { name: "nonce",    type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export type DecodedPermit = {
  owner: Address;
  spender: Address;
  value: bigint;          // USDC, 6 decimals
  nonce: bigint;
  deadline: bigint;       // unix seconds
  chainId: number;
  v: number;
  r: Hex;
  s: Hex;
  usdc: Address;
  signature: Hex;
};

export class PermitVerificationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MALFORMED"
      | "UNSUPPORTED_CHAIN"
      | "EXPIRED"
      | "BAD_SIGNATURE"
      | "WRONG_SPENDER"
      | "INSUFFICIENT_ALLOWANCE",
  ) {
    super(message);
    this.name = "PermitVerificationError";
  }
}

/**
 * Decode a base64url-encoded permit token issued by the LemonCake
 * dashboard (see /start/v2). Throws PermitVerificationError("MALFORMED")
 * on parse failure.
 */
export function decodePermitToken(token: string): DecodedPermit {
  try {
    const padded = token + "==".slice(0, (4 - (token.length % 4)) % 4);
    const json = Buffer.from(
      padded.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf8");
    const p = JSON.parse(json) as Record<string, string | number>;
    return {
      owner:     p.owner as Address,
      spender:   p.spender as Address,
      value:     BigInt(p.value as string),
      nonce:     BigInt(p.nonce as string),
      deadline:  BigInt(p.deadline as string),
      chainId:   Number(p.chainId),
      v:         Number(p.v),
      r:         p.r as Hex,
      s:         p.s as Hex,
      usdc:      p.usdc as Address,
      signature: p.signature as Hex,
    };
  } catch (e) {
    throw new PermitVerificationError(
      `Failed to decode permit token: ${e instanceof Error ? e.message : String(e)}`,
      "MALFORMED",
    );
  }
}

/**
 * Full verification: decode, check the chain is supported, check it
 * hasn't expired, recover the signer address and ensure it matches the
 * declared owner, and (optionally) check the spender matches your
 * service's expected receiver address and the value covers `minValue`.
 *
 * Returns the decoded permit on success. Throws PermitVerificationError
 * with a specific `code` on failure so callers can branch on UI.
 */
export async function verifyPermitToken(
  token: string,
  opts: {
    /**
     * If set, require permit.spender === expectedSpender (case-insensitive).
     * Use this when each service has a dedicated receiver address.
     */
    expectedSpender?: Address;
    /**
     * If set, require permit.value >= minValue (in USDC base units,
     * 6 decimals).
     */
    minValueBaseUnits?: bigint;
    /**
     * If set, require permit.chainId === expectedChainId.
     */
    expectedChainId?: number;
    /**
     * Override "now" for deterministic testing.
     */
    nowUnixSeconds?: number;
  } = {},
): Promise<DecodedPermit> {
  const permit = decodePermitToken(token);

  // Chain check.
  if (!DOMAINS[permit.chainId]) {
    throw new PermitVerificationError(
      `Unsupported chainId ${permit.chainId}`,
      "UNSUPPORTED_CHAIN",
    );
  }
  if (opts.expectedChainId !== undefined && opts.expectedChainId !== permit.chainId) {
    throw new PermitVerificationError(
      `Wrong chain (got ${permit.chainId}, expected ${opts.expectedChainId})`,
      "UNSUPPORTED_CHAIN",
    );
  }

  // Expiry check.
  const now = BigInt(opts.nowUnixSeconds ?? Math.floor(Date.now() / 1000));
  if (permit.deadline < now) {
    throw new PermitVerificationError(
      `Permit expired at ${permit.deadline}, now is ${now}`,
      "EXPIRED",
    );
  }

  // Spender check.
  if (opts.expectedSpender !== undefined) {
    if (permit.spender.toLowerCase() !== opts.expectedSpender.toLowerCase()) {
      throw new PermitVerificationError(
        `Wrong spender ${permit.spender}, expected ${opts.expectedSpender}`,
        "WRONG_SPENDER",
      );
    }
  }

  // Value check.
  if (opts.minValueBaseUnits !== undefined && permit.value < opts.minValueBaseUnits) {
    throw new PermitVerificationError(
      `Permit value ${permit.value} below minimum ${opts.minValueBaseUnits}`,
      "INSUFFICIENT_ALLOWANCE",
    );
  }

  // Signature check — most expensive, do it last.
  const { name, version } = DOMAINS[permit.chainId];
  const recovered = await recoverTypedDataAddress({
    domain: { name, version, chainId: permit.chainId, verifyingContract: permit.usdc },
    types: PERMIT_TYPES,
    primaryType: "Permit",
    message: {
      owner:    permit.owner,
      spender:  permit.spender,
      value:    permit.value,
      nonce:    permit.nonce,
      deadline: permit.deadline,
    },
    signature: permit.signature,
  });

  if (recovered.toLowerCase() !== permit.owner.toLowerCase()) {
    throw new PermitVerificationError(
      `Signature recovers to ${recovered}, but owner claims ${permit.owner}`,
      "BAD_SIGNATURE",
    );
  }

  return permit;
}

/**
 * Convenience helper for tool handlers: read LEMON_CAKE_PERMIT from a
 * known source (env var, MCP _meta, etc.) and verify it. Returns the
 * decoded permit or null if not present.
 *
 * Throws on a present-but-invalid permit so callers can decide whether
 * to surface the failure to the agent or fall back to demo mode.
 */
export async function readPermitFromEnv(
  envVarName = "LEMON_CAKE_PERMIT",
  opts?: Parameters<typeof verifyPermitToken>[1],
): Promise<DecodedPermit | null> {
  const raw = typeof process !== "undefined" ? process.env[envVarName] : undefined;
  if (!raw) return null;
  return verifyPermitToken(raw, opts);
}

/**
 * Pretty-print a permit's economic shape for logs / receipts.
 */
export function summarisePermit(p: DecodedPermit): {
  owner: Address;
  spender: Address;
  amountUsdc: string;
  daysRemaining: number;
  chain: string;
} {
  const amountUsdc = (Number(p.value) / 1_000_000).toFixed(2);
  const remainingSec = Number(p.deadline) - Math.floor(Date.now() / 1000);
  const daysRemaining = Math.max(0, Math.ceil(remainingSec / 86400));
  const chain =
    p.chainId === 8453 ? "Base" :
    p.chainId === 137 ? "Polygon" :
    `chain ${p.chainId}`;
  return {
    owner:    p.owner,
    spender:  p.spender,
    amountUsdc,
    daysRemaining,
    chain,
  };
}
