/**
 * ERC-2612 permit helpers — the non-custodial Pay Token replacement.
 *
 * Why this exists:
 *   The 2026-05 FSA inquiry (Q11) confirmed that **if LemonCake never
 *   touches the user's USDC and never operates a smart contract**, the
 *   electronic-payment-means-business registration is NOT required.
 *
 *   The clean way to deliver that today is the ERC-2612 permit: the user
 *   signs ONE static message on-device that authorises a spender (the
 *   API provider's address, or a relayer) to pull up to N USDC over the
 *   next 90 days. The signature lives in the user's wallet and travels
 *   with each MCP request — nothing ever sits on LemonCake's servers.
 *
 *   This module is intentionally small and dependency-light because it
 *   ships to clients and we want the JS bundle to stay tiny.
 */

import {
  type Address,
  type Hex,
  type WalletClient,
  hexToSignature,
} from "viem";

// USDC contract addresses (only chains we ship today).
export const USDC_ADDRESS: Record<number, Address> = {
  // Base mainnet — first-class USDC, native ERC-2612 support, cheap.
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  // Polygon — also native ERC-2612 support, kept as fallback.
  137:  "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
};

// EIP-712 domain used by the USDC permit contract on each chain.
// Pulled from the deployed USDC contracts (FiatTokenV2 / FiatTokenV2_2).
const DOMAINS: Record<number, { name: string; version: string }> = {
  8453: { name: "USD Coin", version: "2" },
  137:  { name: "USD Coin (PoS)", version: "2" },
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

export type SignedPermit = {
  owner: Address;
  spender: Address;
  // Total USDC amount the spender may pull until `deadline`, in base
  // units (6 decimals). e.g. 25 USDC = 25_000_000n.
  value: bigint;
  nonce: bigint;
  // Unix seconds — typically now + 90 days.
  deadline: bigint;
  chainId: number;
  v: number;
  r: Hex;
  s: Hex;
  // Convenience: USDC contract address and signature in compact form.
  usdc: Address;
  signature: Hex;
};

const NINETY_DAYS_SECONDS = BigInt(60 * 60 * 24 * 90);

export function permitDeadlineFromNow(secondsAhead: bigint = NINETY_DAYS_SECONDS): bigint {
  return BigInt(Math.floor(Date.now() / 1000)) + secondsAhead;
}

/**
 * Ask the user's wallet to sign an ERC-2612 permit for USDC.
 *
 * The signature can then be sent to the spender (or a relayer) which
 * calls `USDC.permit(...)` to register the allowance, then `transferFrom`
 * to pull funds. LemonCake never sees or holds the USDC.
 *
 * @param walletClient   viem WalletClient bound to the user's wallet.
 * @param chainId        8453 (Base) or 137 (Polygon).
 * @param owner          User's wallet address (must match walletClient).
 * @param spender        Address allowed to pull USDC — e.g. an API
 *                       provider's wallet or a paymaster contract.
 * @param value          Max USDC (base units) the spender can pull.
 * @param nonce          Current `nonces(owner)` from the USDC contract.
 * @param deadline       Unix seconds when the permit expires.
 */
export async function signUsdcPermit(args: {
  walletClient: WalletClient;
  chainId: number;
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  deadline?: bigint;
}): Promise<SignedPermit> {
  const { walletClient, chainId, owner, spender, value, nonce } = args;
  const deadline = args.deadline ?? permitDeadlineFromNow();

  const usdc = USDC_ADDRESS[chainId];
  const domainBase = DOMAINS[chainId];
  if (!usdc || !domainBase) {
    throw new Error(`Unsupported chainId ${chainId} for USDC permit`);
  }

  const domain = {
    name: domainBase.name,
    version: domainBase.version,
    chainId,
    verifyingContract: usdc,
  } as const;

  const message = { owner, spender, value, nonce, deadline };

  const signature = await walletClient.signTypedData({
    account: owner,
    domain,
    types: PERMIT_TYPES,
    primaryType: "Permit",
    message,
  });

  const { r, s, v } = hexToSignature(signature);

  return {
    owner,
    spender,
    value,
    nonce,
    deadline,
    chainId,
    v: Number(v),
    r,
    s,
    usdc,
    signature,
  };
}

/**
 * Serialise a permit into a single base64url string that can travel as
 * an HTTP header / env var / Pay-Token replacement. The format is
 * intentionally a plain JSON-then-base64 so any language can decode it.
 *
 * (This is the new "Pay Token" — but it's the user's signature, not a
 * LemonCake-issued JWT. LemonCake never sees the underlying USDC.)
 */
export function encodePermit(p: SignedPermit): string {
  const payload = {
    owner:     p.owner,
    spender:   p.spender,
    value:     p.value.toString(),
    nonce:     p.nonce.toString(),
    deadline:  p.deadline.toString(),
    chainId:   p.chainId,
    v:         p.v,
    r:         p.r,
    s:         p.s,
    usdc:      p.usdc,
    signature: p.signature,
  };
  const json = JSON.stringify(payload);
  return Buffer.from(json, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function decodePermit(token: string): SignedPermit {
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
}

/**
 * Human-readable summary for the UI ("$25 / 90 days / Base").
 */
export function describePermit(p: SignedPermit): {
  amountUsdc: string;
  daysRemaining: number;
  chainName: string;
} {
  const amountUsdc = (Number(p.value) / 1_000_000).toFixed(2);
  const remainingSec = Number(p.deadline) - Math.floor(Date.now() / 1000);
  const daysRemaining = Math.max(0, Math.ceil(remainingSec / 86400));
  const chainName =
    p.chainId === 8453 ? "Base" : p.chainId === 137 ? "Polygon" : `chain ${p.chainId}`;
  return { amountUsdc, daysRemaining, chainName };
}
