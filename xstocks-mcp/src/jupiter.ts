// Jupiter API client (public REST, no auth).
//
// Three endpoints we use:
//   GET  https://lite-api.jup.ag/tokens/v2/search?query=<symbol>
//        → returns candidate mints; filter by tags ["verified","xstocks"]
//   GET  https://lite-api.jup.ag/swap/v1/quote?inputMint=...&outputMint=...&amount=...
//        → returns quote (route, expected output, price impact, etc.)
//   POST https://lite-api.jup.ag/swap/v1/swap
//        body: { quoteResponse, userPublicKey, ... }
//        → returns base64-encoded serialized Versioned Transaction
//
// USDC on Solana mainnet: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
//
// Identifying authentic xStocks among Jupiter search noise:
//   - tags includes BOTH "verified" AND "xstocks"
//   - tokenProgram == TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb (Token-2022)
//   - icon hosted at xstocks-metadata.backed.fi
//   - holders >= 100 (filters out scams)
// Multiple of these conditions must match.

const JUP_API_BASE = (process.env.JUPITER_API_BASE ?? "https://lite-api.jup.ag").replace(/\/$/, "");
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type XStockToken = {
  symbol:    string;
  mint:      string;
  name:      string;
  decimals:  number;
  usdPrice:  number | null;
  holders:   number;
  liquidity: number;
  verified:  boolean;
};

// In-process cache so repeated lookups within one server run don't re-hit
// Jupiter. Cleared on restart.
const tokenCache = new Map<string, XStockToken>();

export async function findXStockBySymbol(symbol: string): Promise<XStockToken | null> {
  const key = symbol.toUpperCase().replace(/X$/, "x");
  const cached = tokenCache.get(key);
  if (cached) return cached;

  // Normalize: AAPLx or AAPL → search "AAPLx"
  const query = key.endsWith("x") ? key : `${key}x`;
  const res = await fetch(`${JUP_API_BASE}/tokens/v2/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) return null;
  const items = await res.json() as Array<Record<string, unknown>>;
  if (!Array.isArray(items)) return null;

  // Pick the one with verified+xstocks tags and Backed metadata
  for (const t of items) {
    const tags = (t.tags as string[] | undefined) ?? [];
    if (!tags.includes("verified") || !tags.includes("xstocks")) continue;
    const icon = String(t.icon ?? "");
    if (!icon.includes("xstocks-metadata.backed.fi")) continue;
    const sym = String(t.symbol ?? "");
    if (sym.toLowerCase() !== query.toLowerCase()) continue;

    const tok: XStockToken = {
      symbol:    sym,
      mint:      String(t.id),
      name:      String(t.name ?? sym),
      decimals:  Number(t.decimals ?? 8),
      usdPrice:  t.usdPrice != null ? Number(t.usdPrice) : null,
      holders:   Number(t.holderCount ?? 0),
      liquidity: Number(t.liquidity   ?? 0),
      verified:  true,
    };
    tokenCache.set(key, tok);
    return tok;
  }
  return null;
}

export type Quote = {
  inputMint:      string;
  inAmount:       string;
  outputMint:     string;
  outAmount:      string;
  priceImpactPct: string;
  slippageBps:    number;
  routePlan:      unknown;
  // raw response stored for use by the swap endpoint
  raw:            unknown;
};

export async function quoteUsdcToXStock(opts: {
  outputMint:  string;
  usdcAmount:  number;     // in USD, will be converted to micro-USDC
  slippageBps?: number;    // 50 = 0.5%
}): Promise<Quote> {
  const microUsdc   = Math.round(opts.usdcAmount * 1_000_000);
  const slippageBps = opts.slippageBps ?? 50;
  const url =
    `${JUP_API_BASE}/swap/v1/quote` +
    `?inputMint=${USDC_MINT}` +
    `&outputMint=${opts.outputMint}` +
    `&amount=${microUsdc}` +
    `&slippageBps=${slippageBps}`;
  const res = await fetch(url);
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Jupiter quote ${res.status}: ${txt.slice(0, 200)}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q: any = await res.json();
  return {
    inputMint:      q.inputMint,
    inAmount:       String(q.inAmount),
    outputMint:     q.outputMint,
    outAmount:      String(q.outAmount),
    priceImpactPct: String(q.priceImpactPct ?? "0"),
    slippageBps:    Number(q.slippageBps ?? slippageBps),
    routePlan:      q.routePlan,
    raw:            q,
  };
}

export async function buildSwapTransaction(opts: {
  quote:                      Quote;
  userPublicKey:              string;
  feePayerPublicKey?:         string;   // if set → asLegacyTransaction=true, fee payer mode
  dynamicComputeUnitLimit?:   boolean;
  prioritizationFeeLamports?: number | "auto";
}): Promise<{ base64Tx: string; isLegacy: boolean }> {
  // Use legacy tx format when a separate fee payer is provided, so we can
  // modify tx.feePayer before signing. VersionedTransaction (V0) doesn't
  // allow fee payer to be changed after construction.
  const isLegacy = !!opts.feePayerPublicKey;
  const body = {
    quoteResponse:               opts.quote.raw,
    userPublicKey:               opts.userPublicKey,
    dynamicComputeUnitLimit:     opts.dynamicComputeUnitLimit ?? true,
    prioritizationFeeLamports:   opts.prioritizationFeeLamports ?? "auto",
    asLegacyTransaction:         isLegacy,
  };
  const res = await fetch(`${JUP_API_BASE}/swap/v1/swap`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Jupiter swap ${res.status}: ${txt.slice(0, 200)}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const r: any = await res.json();
  if (typeof r.swapTransaction !== "string") {
    throw new Error("Jupiter swap response missing swapTransaction");
  }
  return { base64Tx: r.swapTransaction as string, isLegacy };
}
