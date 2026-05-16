// Solana wallet handling for xstocks-mcp.
//
// Three wallet modes (in priority order):
//
//   1. Explicit key (SOLANA_WALLET_PRIVATE_KEY env var)
//      Base58 (Phantom/Solflare export) or JSON [u8;64] (Solana CLI).
//      User manages their own key.
//
//   2. Embedded wallet (~/.xstocks/wallet.json)
//      Auto-generated on first use when no explicit key is set.
//      Key stored locally at 0600 permissions — user owns it, LemonCake never sees it.
//      No Phantom/Solflare required. Fund the generated address with USDC.
//
//   3. Fee payer (FEEPAYER_PRIVATE_KEY env var — LemonCake hot wallet)
//      Separate from the user wallet. Pays SOL gas on the user's behalf.
//      Can be combined with modes 1 or 2 above.
//
// Live trading requires XSTOCKS_ALLOW_LIVE=yes-i-understand in all modes.

import {
  Connection, Keypair, PublicKey, Transaction, VersionedTransaction,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const RAW_KEY      = process.env.SOLANA_WALLET_PRIVATE_KEY ?? "";
const FEEPAYER_KEY = process.env.FEEPAYER_PRIVATE_KEY ?? "";
const RPC_URL      = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const ALLOW_LIVE   = process.env.XSTOCKS_ALLOW_LIVE === "yes-i-understand";

const WALLET_DIR  = process.env.XSTOCKS_LEDGER_DIR ?? join(homedir(), ".xstocks");
const WALLET_FILE = join(WALLET_DIR, "wallet.json");

let cachedKeypair: Keypair | null = null;
let cachedFeePayerKeypair: Keypair | null = null;

// ── Embedded wallet helpers ────────────────────────────────────────────────

export function embeddedWalletPath(): string { return WALLET_FILE; }
export function hasEmbeddedWalletFile(): boolean { return existsSync(WALLET_FILE); }
/** True when no explicit SOLANA_WALLET_PRIVATE_KEY → we use the embedded wallet. */
export function isEmbeddedWallet(): boolean { return !RAW_KEY; }

/** Load existing embedded wallet, or generate + persist a new one. */
function getOrCreateEmbeddedKeypair(): Keypair {
  mkdirSync(WALLET_DIR, { recursive: true });
  if (existsSync(WALLET_FILE)) {
    return loadKeypairFromString(readFileSync(WALLET_FILE, "utf8"), "embedded wallet");
  }
  const kp = Keypair.generate();
  writeFileSync(WALLET_FILE, JSON.stringify(Array.from(kp.secretKey)), { mode: 0o600 });
  return kp;
}

// ── Live mode ──────────────────────────────────────────────────────────────

export function liveMode(): boolean {
  // Wallet is always available (explicit key or auto-generated embedded wallet).
  // Live is gated solely by the explicit opt-in flag.
  return ALLOW_LIVE;
}

export function dryRunReason(): string {
  if (!ALLOW_LIVE) return "XSTOCKS_ALLOW_LIVE not set to 'yes-i-understand'";
  return "live mode is enabled";
}

// ── Keypair loading ────────────────────────────────────────────────────────

export function getKeypair(): Keypair {
  if (cachedKeypair) return cachedKeypair;
  if (RAW_KEY) {
    cachedKeypair = loadKeypairFromString(RAW_KEY, "SOLANA_WALLET_PRIVATE_KEY");
  } else {
    cachedKeypair = getOrCreateEmbeddedKeypair();
  }
  return cachedKeypair;
}

/** Load a keypair from a raw key string (base58 or JSON array). */
function loadKeypairFromString(raw: string, label: string): Keypair {
  const trimmed = raw.trim();
  let secret: Uint8Array;
  if (trimmed.startsWith("[")) {
    const arr = JSON.parse(trimmed) as number[];
    if (!Array.isArray(arr) || arr.length !== 64)
      throw new Error(`${label}: array must be 64 bytes`);
    secret = Uint8Array.from(arr);
  } else {
    try { secret = bs58.decode(trimmed); }
    catch { throw new Error(`${label}: not valid base58`); }
    if (secret.length !== 64)
      throw new Error(`${label}: decoded length ${secret.length}, expected 64`);
  }
  return Keypair.fromSecretKey(secret);
}

/** LemonCake fee-payer keypair — pays SOL gas so users don't need SOL. */
export function getFeePayerKeypair(): Keypair | null {
  if (!FEEPAYER_KEY) return null;
  if (cachedFeePayerKeypair) return cachedFeePayerKeypair;
  cachedFeePayerKeypair = loadKeypairFromString(FEEPAYER_KEY, "FEEPAYER_PRIVATE_KEY");
  return cachedFeePayerKeypair;
}

export function getFeePayerPublicKey(): PublicKey | null {
  return getFeePayerKeypair()?.publicKey ?? null;
}

/** True when a fee payer is configured — users don't need SOL. */
export function hasFeePayerWallet(): boolean {
  return FEEPAYER_KEY.length > 0;
}

export function getPublicKey(): PublicKey | null {
  try { return getKeypair().publicKey; }
  catch { return null; }
}

let cachedConnection: Connection | null = null;
export function getConnection(): Connection {
  if (!cachedConnection) {
    cachedConnection = new Connection(RPC_URL, "confirmed");
  }
  return cachedConnection;
}

/** Returns SOL balance in SOL (not lamports). */
export async function getSolBalance(): Promise<number | null> {
  const pk = getPublicKey();
  if (!pk) return null;
  const lamports = await getConnection().getBalance(pk);
  return lamports / 1e9;
}

/** Returns USDC balance in USD (not micro-USDC). null if no ATA. */
export async function getUsdcBalance(usdcMint: string): Promise<number | null> {
  const pk = getPublicKey();
  if (!pk) return null;
  try {
    const acct = await getConnection().getTokenAccountsByOwner(pk, { mint: new PublicKey(usdcMint) });
    if (!acct.value.length) return 0;
    // sum the lamport balances of all matching token accounts
    let total = 0;
    for (const a of acct.value) {
      const parsed = await getConnection().getParsedAccountInfo(a.pubkey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = parsed.value?.data as any;
      const ui = data?.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof ui === "number") total += ui;
    }
    return total;
  } catch {
    return null;
  }
}

/**
 * Sign + send a Jupiter swap transaction.
 *
 * Two modes:
 *   - Fee payer configured (FEEPAYER_PRIVATE_KEY set):
 *       Jupiter returns a legacy Transaction. We set feePayer = LemonCake hot
 *       wallet, then sign with [feePayerKeypair, userKeypair]. User needs no SOL.
 *   - No fee payer:
 *       Jupiter returns a VersionedTransaction. User signs + pays gas themselves.
 *
 * @param base64Tx  base64-encoded transaction from buildSwapTransaction()
 * @param isLegacy  true when Jupiter was asked for asLegacyTransaction (fee payer mode)
 */
export async function signAndSendSwap(base64Tx: string, isLegacy = false): Promise<string> {
  if (!liveMode()) throw new Error(`Refusing to send: ${dryRunReason()}`);
  const userKp = getKeypair();
  const conn   = getConnection();
  const buf    = Buffer.from(base64Tx, "base64");

  if (isLegacy) {
    // Fee payer mode: legacy transaction, LemonCake pays gas
    const feePayerKp = getFeePayerKeypair();
    if (!feePayerKp) throw new Error("isLegacy=true but FEEPAYER_PRIVATE_KEY not set");

    const tx      = Transaction.from(buf);
    tx.feePayer   = feePayerKp.publicKey;
    // sign() compiles the message with the new feePayer, then signs with both keys
    tx.sign(feePayerKp, userKp);

    const sig = await sendAndConfirmRawTransaction(conn, tx.serialize(), {
      skipPreflight: false,
      commitment:    "confirmed",
      maxRetries:    3,
    });
    return sig;
  } else {
    // Standard mode: versioned transaction, user pays gas
    const tx = VersionedTransaction.deserialize(Uint8Array.from(buf));
    tx.sign([userKp]);

    const sig = await sendAndConfirmRawTransaction(conn, Buffer.from(tx.serialize()), {
      skipPreflight: false,
      commitment:    "confirmed",
      maxRetries:    3,
    });
    return sig;
  }
}
