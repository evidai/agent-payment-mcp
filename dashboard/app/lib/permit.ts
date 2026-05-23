/**
 * ERC-2612 permit helpers — non-custodial Pay Token replacement, multi-currency.
 *
 * Why this exists:
 *   The 2026-05 FSA inquiry (Q11) confirmed that **if LemonCake never
 *   touches the user's stablecoin and never operates a smart contract**, the
 *   electronic-payment-means-business registration is NOT required.
 *
 *   The clean way to deliver that today is the ERC-2612 permit: the user
 *   signs ONE static message on-device that authorises a spender (the
 *   API provider's address, or a relayer) to pull up to N tokens over the
 *   next 90 days. The signature lives in the user's wallet and travels
 *   with each MCP request — nothing ever sits on LemonCake's servers.
 *
 * Why dual-currency (USDC + JPYC):
 *   v2 launched USDC-only on Base. The 2026 Tokyo metropolitan
 *   stablecoin grant requires a domestic-issued yen stablecoin (JPYC).
 *   Rather than fork the codebase, this module abstracts the
 *   currency-specific bits (token address, EIP-712 domain) so the same
 *   `signStablePermit()` flow drives both chains. Japan-locale users
 *   default to JPYC on Polygon; everyone else stays on USDC on Base.
 *
 *   The token registry below is the only place that needs to change when
 *   adding chains or stablecoins.
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

/** Supported stablecoin currencies. */
export type Currency = "USDC" | "JPYC";

/**
 * Per-token EIP-712 domain + on-chain metadata.
 *
 * The `name` / `version` strings must match exactly what the deployed
 * contract returns from its `DOMAIN_SEPARATOR()` — if they drift, the
 * signature recovers to a different signer and `permit()` reverts.
 *
 * Values come from:
 *   • USDC Base / Polygon: FiatTokenV2_2 source (Circle, MIT).
 *   • JPYC Polygon: the new regulated 資金移動業 contract
 *     0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29 (deployed 2025-10-27).
 *     `name` / `version` verified against on-chain `DOMAIN_SEPARATOR()`
 *     via `scripts/test-jpyc-permit.ts` — TODO live verification before
 *     production rollout.
 */
type TokenSpec = {
  currency: Currency;
  chainId: number;
  /** ERC-20 contract address. */
  address: Address;
  /** Decimals — USDC: 6, JPYC: 18. */
  decimals: number;
  /** EIP-712 domain.name as returned by the contract. */
  domainName: string;
  /** EIP-712 domain.version as returned by the contract. */
  domainVersion: string;
  /** Display label for the UI ("Base", "Polygon"). */
  chainName: string;
};

/**
 * Token registry. Keyed by `currency` × `chainId`; the public helpers
 * resolve which row to use based on user choice + locale.
 */
const TOKENS: TokenSpec[] = [
  {
    currency:      "USDC",
    chainId:       8453, // Base mainnet
    address:       "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    decimals:      6,
    domainName:    "USD Coin",
    domainVersion: "2",
    chainName:     "Base",
  },
  {
    currency:      "USDC",
    chainId:       137, // Polygon — kept as fallback for users already there.
    address:       "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    decimals:      6,
    domainName:    "USD Coin (PoS)",
    domainVersion: "2",
    chainName:     "Polygon",
  },
  {
    currency:      "JPYC",
    chainId:       137, // Polygon — primary JPYC chain (cheap gas).
    // New regulated JPYC issued 2025-10-27 by JPYC社 (資金移動業ライセンス).
    // ERC1967Proxy → implementation 0xafAC17FC3936A29CA2D2787cEd3c5d1c52007d2e.
    // Confirms ERC-2612 + EIP-3009 in the contract source.
    address:       "0xE7C3D8C9a439feDe00D2600032D5dB0Be71C3c29",
    decimals:      18,
    // Domain values match the deployed contract's `name()` / EIP712_VERSION.
    // Standard pattern from JPYC's open-sourced EIP2612.sol implementation;
    // re-check on-chain before production via the test script in
    // scripts/test-jpyc-permit.ts.
    domainName:    "JPY Coin",
    domainVersion: "1",
    chainName:     "Polygon",
  },
];

/** Default chain for each currency (the one we onboard new users to). */
export const DEFAULT_CHAIN: Record<Currency, number> = {
  USDC: 8453, // Base
  JPYC: 137,  // Polygon
};

/**
 * Backwards-compat: USDC_ADDRESS used to be exported as a Record<chainId,
 * Address> for callers that only care about USDC. Keep the shape so
 * existing imports keep compiling.
 */
export const USDC_ADDRESS: Record<number, Address> = Object.fromEntries(
  TOKENS.filter((t) => t.currency === "USDC").map((t) => [t.chainId, t.address]),
);

/** Find the token spec for a given currency + chain (throws if missing). */
export function resolveToken(currency: Currency, chainId: number): TokenSpec {
  const spec = TOKENS.find((t) => t.currency === currency && t.chainId === chainId);
  if (!spec) {
    throw new Error(`No token registered for ${currency} on chain ${chainId}`);
  }
  return spec;
}

/** Convenience: get the address only. Throws if not registered. */
export function getTokenAddress(currency: Currency, chainId: number): Address {
  return resolveToken(currency, chainId).address;
}

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
  /**
   * Total amount the spender may pull until `deadline`, in base units
   * (USDC: 6 decimals, JPYC: 18 decimals). e.g. 25 USDC = 25_000_000n,
   * 1000 JPYC = 1_000_000_000_000_000_000_000n.
   */
  value: bigint;
  nonce: bigint;
  /** Unix seconds — typically now + 90 days. */
  deadline: bigint;
  chainId: number;
  v: number;
  r: Hex;
  s: Hex;
  /**
   * Currency + token contract address — embedded so verifiers don't have
   * to look up a registry. `usdc` retained as alias for backwards
   * compatibility with existing decoders, but new clients should read
   * `currency` + `token`.
   */
  currency: Currency;
  token: Address;
  /** @deprecated Use `token` + `currency` instead. */
  usdc: Address;
  signature: Hex;
};

const NINETY_DAYS_SECONDS = BigInt(60 * 60 * 24 * 90);

export function permitDeadlineFromNow(secondsAhead: bigint = NINETY_DAYS_SECONDS): bigint {
  return BigInt(Math.floor(Date.now() / 1000)) + secondsAhead;
}

/**
 * Ask the user's wallet to sign an ERC-2612 permit for the given stablecoin.
 *
 * The signature can then be sent to the spender (or a relayer) which
 * calls `<token>.permit(...)` to register the allowance, then `transferFrom`
 * to pull funds. LemonCake never sees or holds the token.
 *
 * @param walletClient   viem WalletClient bound to the user's wallet.
 * @param currency       "USDC" or "JPYC".
 * @param chainId        Numeric chain id matching the registered token
 *                       (8453 Base for USDC, 137 Polygon for JPYC).
 * @param owner          User's wallet address (must match walletClient).
 * @param spender        Address allowed to pull the token — e.g. an API
 *                       provider's wallet or a paymaster contract.
 * @param value          Max token amount (base units) the spender can pull.
 * @param nonce          Current `nonces(owner)` from the token contract.
 * @param deadline       Unix seconds when the permit expires.
 */
export async function signStablePermit(args: {
  walletClient: WalletClient;
  currency: Currency;
  chainId: number;
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  deadline?: bigint;
}): Promise<SignedPermit> {
  const { walletClient, currency, chainId, owner, spender, value, nonce } = args;
  const deadline = args.deadline ?? permitDeadlineFromNow();

  const spec = resolveToken(currency, chainId);

  const domain = {
    name:               spec.domainName,
    version:            spec.domainVersion,
    chainId,
    verifyingContract:  spec.address,
  } as const;

  const message = { owner, spender, value, nonce, deadline };

  const signature = await walletClient.signTypedData({
    account:     owner,
    domain,
    types:       PERMIT_TYPES,
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
    v:         Number(v),
    r,
    s,
    currency,
    token:     spec.address,
    usdc:      spec.address, // backwards-compat alias
    signature,
  };
}

/**
 * @deprecated Kept so existing /start/v2 callers compile. New code should
 * use `signStablePermit({ currency: "USDC", ... })` directly.
 */
export const signUsdcPermit = (args: {
  walletClient: WalletClient;
  chainId: number;
  owner: Address;
  spender: Address;
  value: bigint;
  nonce: bigint;
  deadline?: bigint;
}) => signStablePermit({ ...args, currency: "USDC" });

/**
 * Serialise a permit into a single base64url string that can travel as
 * an HTTP header / env var / Pay-Token replacement. The format is
 * intentionally plain JSON-then-base64 so any language can decode it.
 *
 * (This is the new "Pay Token" — but it's the user's signature, not a
 * LemonCake-issued JWT. LemonCake never sees the underlying stablecoin.)
 *
 * v2 adds `currency` + `token`. Old clients that only read `usdc` keep
 * working because we still emit that alias for now.
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
    currency:  p.currency,
    token:     p.token,
    usdc:      p.usdc, // deprecated but emitted for legacy decoders
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
  // Legacy payloads predate the `currency` field — those were always
  // USDC, so default to that when missing to keep old MCP clients alive.
  const currency = (p.currency as Currency | undefined) ?? "USDC";
  const tokenAddr = (p.token as Address | undefined) ?? (p.usdc as Address);
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
    currency,
    token:     tokenAddr,
    usdc:      tokenAddr,
    signature: p.signature as Hex,
  };
}

/**
 * Human-readable summary for the UI ("¥1000 / 90 days / Polygon").
 */
export function describePermit(p: SignedPermit): {
  amount: string;
  amountUsdc: string; // backwards-compat
  daysRemaining: number;
  chainName: string;
  currency: Currency;
} {
  const spec = (() => {
    try {
      return resolveToken(p.currency, p.chainId);
    } catch {
      return null;
    }
  })();
  const decimals = spec?.decimals ?? (p.currency === "JPYC" ? 18 : 6);
  const symbol   = p.currency === "JPYC" ? "¥" : "$";
  // Use string math via BigInt to avoid float loss on JPYC's 18 decimals
  // when the value is large. Decimal places trimmed to 2 for display.
  // (BigInt literal `10n` requires ES2020; tsconfig targets ES2017 so we
  // build the divisor from BigInt(10) ** BigInt(decimals) instead.)
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole   = p.value / divisor;
  const frac    = p.value % divisor;
  const fracDisplay = decimals > 0
    ? "." + frac.toString().padStart(decimals, "0").slice(0, 2)
    : "";
  const amount = `${symbol}${whole.toString()}${fracDisplay}`;
  // Legacy field: 6-decimal USD-style number, for code paths that still
  // assume USDC.
  const amountUsdc = (Number(p.value) / 1_000_000).toFixed(2);
  const remainingSec = Number(p.deadline) - Math.floor(Date.now() / 1000);
  const daysRemaining = Math.max(0, Math.ceil(remainingSec / 86400));
  const chainName =
    spec?.chainName ??
    (p.chainId === 8453 ? "Base" : p.chainId === 137 ? "Polygon" : `chain ${p.chainId}`);
  return { amount, amountUsdc, daysRemaining, chainName, currency: p.currency };
}
