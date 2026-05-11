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

export async function listSupportedStocks(): Promise<DShareTicker[]> {
  if (!hasCredentials()) return SAMPLE_TICKERS;
  try {
    // The SDK's stock listing endpoint. We map to our minimal shape so the
    // tool surface stays stable even if Dinari adjusts their schema.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = getClient() as any;
    const result = await c.v2.marketData.stocks.list();
    if (!Array.isArray(result?.data) && !Array.isArray(result)) return SAMPLE_TICKERS;
    const items = Array.isArray(result) ? result : result.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return items.map((s: any) => ({
      symbol:      s.symbol     ?? s.token_symbol ?? "",
      underlying:  s.underlying ?? s.ticker       ?? "",
      name:        s.name       ?? s.display_name ?? "",
      asset_class: s.asset_class === "ETF" ? "ETF" : "EQUITY",
      tradable:    s.tradable   ?? true,
    })).filter((t: DShareTicker) => t.symbol);
  } catch {
    return SAMPLE_TICKERS;
  }
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  if (!hasCredentials()) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = getClient() as any;
    const q = await c.v2.marketData.stocks.quote.retrieve(symbol);
    const bid = Number(q?.bid ?? q?.bid_price ?? 0);
    const ask = Number(q?.ask ?? q?.ask_price ?? 0);
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
  recipientWallet: string;
}): Promise<DinariOrder> {
  assertSafeMode();
  if (!hasCredentials()) throw new Error("Dinari credentials required to place orders");
  if (!DINARI_ACCOUNT_ID || !DINARI_ENTITY_ID) {
    throw new Error("DINARI_ACCOUNT_ID + DINARI_ENTITY_ID required to scope the order");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = getClient() as any;
  const o = await c.v2.entities.accounts.orders.create({
    entity_id:  DINARI_ENTITY_ID,
    account_id: DINARI_ACCOUNT_ID,
    side:       "buy",
    symbol:     opts.symbol,
    amount_usd: opts.amountUsd,
    recipient:  opts.recipientWallet,
  });
  return mapOrder(o);
}

export async function placeSellOrder(opts: {
  symbol:       string;
  qty:          number;
  sourceWallet: string;
}): Promise<DinariOrder> {
  assertSafeMode();
  if (!hasCredentials()) throw new Error("Dinari credentials required to place orders");
  if (!DINARI_ACCOUNT_ID || !DINARI_ENTITY_ID) {
    throw new Error("DINARI_ACCOUNT_ID + DINARI_ENTITY_ID required to scope the order");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = getClient() as any;
  const o = await c.v2.entities.accounts.orders.create({
    entity_id:  DINARI_ENTITY_ID,
    account_id: DINARI_ACCOUNT_ID,
    side:       "sell",
    symbol:     opts.symbol,
    qty:        opts.qty,
    source:     opts.sourceWallet,
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
