// Solana wallet handling for xstocks-mcp.
//
// Mode A (dry-run, default): no key needed. We can quote + simulate but
//   never sign or send. Safe to install + inspect without funding.
//
// Mode B (live): user provides SOLANA_WALLET_PRIVATE_KEY as a base58 string
//   (Phantom/Solflare export format) OR a JSON array of 64 bytes (Solana CLI
//   keypair format). We load it into a Keypair and use it to sign swaps.
//   Additionally requires XSTOCKS_ALLOW_LIVE=yes-i-understand (matches the
//   alpaca-guard / tokenized-stock safety pattern).

import {
  Connection, Keypair, PublicKey, VersionedTransaction, sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

const RAW_KEY  = process.env.SOLANA_WALLET_PRIVATE_KEY ?? "";
const RPC_URL  = process.env.SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const ALLOW_LIVE = process.env.XSTOCKS_ALLOW_LIVE === "yes-i-understand";

let cachedKeypair: Keypair | null = null;

export function liveMode(): boolean {
  return RAW_KEY.length > 0 && ALLOW_LIVE;
}

export function dryRunReason(): string {
  if (!RAW_KEY) return "SOLANA_WALLET_PRIVATE_KEY not set";
  if (!ALLOW_LIVE) return "XSTOCKS_ALLOW_LIVE not set to 'yes-i-understand'";
  return "live mode is enabled";
}

export function getKeypair(): Keypair {
  if (!RAW_KEY) throw new Error("SOLANA_WALLET_PRIVATE_KEY not set");
  if (cachedKeypair) return cachedKeypair;

  let secret: Uint8Array;
  const trimmed = RAW_KEY.trim();
  if (trimmed.startsWith("[")) {
    // Solana CLI / id.json array format
    const arr = JSON.parse(trimmed) as number[];
    if (!Array.isArray(arr) || arr.length !== 64) {
      throw new Error("SOLANA_WALLET_PRIVATE_KEY (array) must be 64 bytes");
    }
    secret = Uint8Array.from(arr);
  } else {
    // Base58 (Phantom / Solflare export)
    try {
      secret = bs58.decode(trimmed);
    } catch {
      throw new Error("SOLANA_WALLET_PRIVATE_KEY not valid base58");
    }
    if (secret.length !== 64) {
      throw new Error(`SOLANA_WALLET_PRIVATE_KEY decoded length ${secret.length}, expected 64`);
    }
  }
  cachedKeypair = Keypair.fromSecretKey(secret);
  return cachedKeypair;
}

export function getPublicKey(): PublicKey | null {
  if (!RAW_KEY) return null;
  try {
    return getKeypair().publicKey;
  } catch {
    return null;
  }
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
 * Sign + send a Jupiter-built swap transaction (base64-encoded versioned tx).
 * Returns the transaction signature on success.
 */
export async function signAndSendSwap(base64Tx: string): Promise<string> {
  if (!liveMode()) throw new Error(`Refusing to send: ${dryRunReason()}`);
  const kp   = getKeypair();
  const conn = getConnection();

  const buf  = Uint8Array.from(Buffer.from(base64Tx, "base64"));
  const tx   = VersionedTransaction.deserialize(buf);
  tx.sign([kp]);

  const sig = await sendAndConfirmRawTransaction(conn, Buffer.from(tx.serialize()), {
    skipPreflight:    false,
    commitment:       "confirmed",
    maxRetries:       3,
  });
  return sig;
}
