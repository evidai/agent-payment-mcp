// Dinari API client. Uses the official @dinari/api-sdk for auth + API calls.
//
// Environment variables (matching the SDK's expected names):
//   DINARI_API_KEY_ID      — public key identifier
//   DINARI_API_SECRET_KEY  — private auth secret
//   DINARI_ACCOUNT_ID      — trading account UUID (Dinari onboarding)
//   DINARI_ENTITY_ID       — KYB'd legal entity UUID (Dinari onboarding)
//   DINARI_SANDBOX         — "true" (default) → SDK environment "sandbox"
//                             "false"          → SDK environment "production"
//   TOKENIZED_STOCK_ALLOW_LIVE — must literally be "yes-i-understand"
//                                to allow real-money orders
//
// Sandbox is the default. Live trading is blocked at two layers (SDK env
// + our explicit opt-in flag) so the user has to pass both to send real money.

import Dinari from "@dinari/api-sdk";

const DINARI_API_KEY_ID     = process.env.DINARI_API_KEY_ID     ?? "";
const DINARI_API_SECRET_KEY = process.env.DINARI_API_SECRET_KEY ?? "";
const DINARI_ACCOUNT_ID     = process.env.DINARI_ACCOUNT_ID     ?? "";
const DINARI_ENTITY_ID      = process.env.DINARI_ENTITY_ID      ?? "";
const SANDBOX               = process.env.DINARI_SANDBOX !== "false";
const ALLOW_LIVE            = process.env.TOKENIZED_STOCK_ALLOW_LIVE === "yes-i-understand";

export function hasCredentials(): boolean {
  return DINARI_API_KEY_ID.length > 0 && DINARI_API_SECRET_KEY.length > 0;
}

export function sandboxMode(): boolean {
  return SANDBOX;
}

export function liveAllowed(): boolean {
  return !SANDBOX && ALLOW_LIVE;
}

export function assertSafeMode(): void {
  if (!SANDBOX && !ALLOW_LIVE) {
    throw new Error(
      "DINARI_SANDBOX=false but TOKENIZED_STOCK_ALLOW_LIVE is not set to " +
      "'yes-i-understand'. Refusing to send real-money orders.",
    );
  }
}

export function credentialStatus() {
  return {
    apiKeyID:     DINARI_API_KEY_ID     ? "✓" : "✗ NOT SET — get from partners.dinari.com (issued as 'API Key ID' alongside the secret)",
    apiSecretKey: DINARI_API_SECRET_KEY ? "✓" : "✗ NOT SET — get from partners.dinari.com (the auth secret)",
    accountId:    DINARI_ACCOUNT_ID     ? "✓" : "✗ NOT SET — your trading-account UUID from Dinari onboarding",
    entityId:     DINARI_ENTITY_ID      ? "✓" : "✗ NOT SET — your KYB'd legal-entity UUID from Dinari onboarding",
    allReady:     !!(DINARI_API_KEY_ID && DINARI_API_SECRET_KEY && DINARI_ACCOUNT_ID && DINARI_ENTITY_ID),
  };
}

// Lazy client init: only constructed once we know creds are present.
let client: Dinari | null = null;

function getClient(): Dinari {
  if (!hasCredentials()) {
    throw new Error("Dinari credentials missing — set DINARI_API_KEY_ID + DINARI_API_SECRET_KEY");
  }
  if (!client) {
    client = new Dinari({
      apiKeyID:     DINARI_API_KEY_ID,
      apiSecretKey: DINARI_API_SECRET_KEY,
      environment:  SANDBOX ? "sandbox" : "production",
    });
  }
  return client;
}

export function sandboxNote(): string {
  return SANDBOX
    ? "🧪 SANDBOX mode (safe default). Set DINARI_SANDBOX=false + TOKENIZED_STOCK_ALLOW_LIVE=yes-i-understand for real-money orders."
    : (ALLOW_LIVE ? "🔴 LIVE mode (explicit opt-in)." : "⚠️ Live mode requested but TOKENIZED_STOCK_ALLOW_LIVE not set — orders will refuse.");
}

// ─── shapes ───────────────────────────────────────────────────────────────

export type DShareTicker = {
  symbol:      string;
  underlying:  string;
  name:        string;
  asset_class: "EQUITY" | "ETF";
  tradable:    boolean;
  /** Dinari internal stock ID (UUID). Required for order creation. */
  stockId?:    string;
};

export type Quote = {
  symbol: string;
  bid:    number;
  ask:    number;
  mid:    number;
  asOf:   string;
};

export type DinariOrder = {
  id:         string;
  status:     string;
  symbol:     string;
  side:       "buy" | "sell";
  qty:        string;
  fillPrice:  string | null;
  feeUsd:     string | null;
  createdAt:  string;
};

// ─── read-only ────────────────────────────────────────────────────────────

const SAMPLE_TICKERS: DShareTicker[] = [
  { symbol: "AAPL.d",  underlying: "AAPL",  name: "Apple Inc.",                  asset_class: "EQUITY", tradable: true },
  { symbol: "MSFT.d",  underlying: "MSFT",  name: "Microsoft Corporation",       asset_class: "EQUITY", tradable: true },
  { symbol: "NVDA.d",  underlying: "NVDA",  name: "NVIDIA Corporation",          asset_class: "EQUITY", tradable: true },
  { symbol: "TSLA.d",  underlying: "TSLA",  name: "Tesla, Inc.",                 asset_class: "EQUITY", tradable: true },
  { symbol: "GOOGL.d", underlying: "GOOGL", name: "Alphabet Inc.",               asset_class: "EQUITY", tradable: true },
  { symbol: "AMZN.d",  underlying: "AMZN",  name: "Amazon.com Inc.",             asset_class: "EQUITY", tradable: true },
  { symbol: "META.d",  underlying: "META",  name: "Meta Platforms Inc.",         asset_class: "EQUITY", tradable: true },
  { symbol: "SPY.d",   underlying: "SPY",   name: "SPDR S&P 500 ETF",            asset_class: "ETF",    tradable: true },
  { symbol: "QQQ.d",   underlying: "QQQ",   name: "Invesco QQQ Trust",           asset_class: "ETF",    tradable: true },
  { symbol: "MSTR.d",  underlying: "MSTR",  name: "MicroStrategy Inc.",          asset_class: "EQUITY", tradable: true },
];

// Symbol → stockId cache. Populated on first listSupportedStocks() call.
// Required because Dinari order endpoints expect stock_id (UUID), not symbol.
let stockIdCache: Map<string, string> | null = null;

export async function listSupportedStocks(): Promise<DShareTicker[]> {
  if (!hasCredentials()) return SAMPLE_TICKERS;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = getClient() as any;
    const result = await c.v2.marketData.stocks.list();
    if (!Array.isArray(result?.data) && !Array.isArray(result)) return SAMPLE_TICKERS;
    const items = Array.isArray(result) ? result : result.data;

    // Build / refresh the symbol→id cache
    const cache = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped = items.map((s: any) => {
      const sym = s.symbol ?? s.token_symbol ?? "";
      const id  = s.id     ?? s.stock_id     ?? "";
      if (sym && id) cache.set(sym.toUpperCase(), id);
      return {
        symbol:      sym,
        underlying:  s.underlying ?? s.ticker       ?? "",
        name:        s.name       ?? s.display_name ?? "",
        asset_class: s.asset_class === "ETF" ? "ETF" : "EQUITY",
        tradable:    s.tradable   ?? true,
        stockId:     id || undefined,
      } as DShareTicker;
    }).filter((t: DShareTicker) => t.symbol);
    stockIdCache = cache;
    return mapped;
  } catch {
    return SAMPLE_TICKERS;
  }
}

async function resolveStockId(symbolOrId: string): Promise<string | null> {
  // If it already looks like a UUID, pass through.
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(symbolOrId)) {
    return symbolOrId;
  }
  // Otherwise treat it as a symbol — normalize and look up.
  const key = symbolOrId.replace(/\.d$/i, "").toUpperCase();
  if (!stockIdCache) {
    // First-use cache miss: populate.
    await listSupportedStocks();
  }
  return stockIdCache?.get(key) ?? null;
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  if (!hasCredentials()) return null;
  try {
    const stockId = await resolveStockId(symbol);
    if (!stockId) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = getClient() as any;
    const q = await c.v2.marketData.stocks.retrieveCurrentQuote(stockId);
    const bid = Number(q?.bid_price ?? q?.bid ?? 0);
    const ask = Number(q?.ask_price ?? q?.ask ?? 0);
    if (!bid && !ask) return null;
    return {
      symbol,
      bid,
      ask,
      mid: (bid + ask) / 2 || ask || bid,
      asOf: q?.timestamp ?? q?.as_of ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ─── orders ───────────────────────────────────────────────────────────────

export async function placeBuyOrder(opts: {
  symbol:          string;
  amountUsd:       number;
  recipientWallet: string;  // currently ignored in managed-account mode; kept for v0.2+ self-custody flow
}): Promise<DinariOrder> {
  assertSafeMode();
  if (!hasCredentials()) throw new Error("Dinari credentials required to place orders");
  if (!DINARI_ACCOUNT_ID) throw new Error("DINARI_ACCOUNT_ID required");

  const stockId = await resolveStockId(opts.symbol);
  if (!stockId) {
    throw new Error(`Symbol "${opts.symbol}" not found in Dinari supported list. Call list_supported_stocks first.`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = getClient() as any;
  // v0.1.3: use the official OrderRequests path with createMarketBuy.
  // Managed-account mode → dShare lands in DINARI_ACCOUNT_ID itself.
  // Self-custody (EIP-712 permit) flow planned for v0.2.
  const o = await c.v2.accounts.orderRequests.createMarketBuy(DINARI_ACCOUNT_ID, {
    payment_amount:       Math.round(opts.amountUsd * 100) / 100,
    stock_id:             stockId,
    recipient_account_id: DINARI_ACCOUNT_ID,
  });
  return mapOrder(o);
}

export async function placeSellOrder(opts: {
  symbol:       string;
  qty:          number;
  sourceWallet: string;  // currently ignored in managed-account mode
}): Promise<DinariOrder> {
  assertSafeMode();
  if (!hasCredentials()) throw new Error("Dinari credentials required to place orders");
  if (!DINARI_ACCOUNT_ID) throw new Error("DINARI_ACCOUNT_ID required");

  const stockId = await resolveStockId(opts.symbol);
  if (!stockId) {
    throw new Error(`Symbol "${opts.symbol}" not found in Dinari supported list. Call list_supported_stocks first.`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = getClient() as any;
  const o = await c.v2.accounts.orderRequests.createMarketSell(DINARI_ACCOUNT_ID, {
    asset_quantity: Math.round(opts.qty * 1_000_000) / 1_000_000,
    stock_id:       stockId,
  });
  return mapOrder(o);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapOrder(o: any): DinariOrder {
  return {
    id:        String(o?.id ?? o?.order_id ?? ""),
    status:    String(o?.status ?? "PENDING"),
    symbol:    String(o?.symbol ?? ""),
    side:      (o?.side === "sell" ? "sell" : "buy") as "buy" | "sell",
    qty:       String(o?.qty ?? o?.quantity ?? "0"),
    fillPrice: o?.fill_price != null ? String(o.fill_price) : null,
    feeUsd:    o?.fee_usd    != null ? String(o.fee_usd)    : null,
    createdAt: String(o?.created_at ?? o?.createdAt ?? new Date().toISOString()),
  };
}
