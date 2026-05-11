// Dinari API client wrapper.
//
// In v0.1 (this release) we keep the integration narrow:
//   - read-only methods (list_supported, get_quote) use the public REST API
//     where available; otherwise return a graceful "needs partner credentials"
//     payload so the MCP is installable + inspectable without keys.
//   - write methods (place_order, cancel_order) require DINARI_API_KEY and
//     refuse if LIVE flag is not explicitly set, mirroring the alpaca-guard
//     safety pattern.
//
// The official TS SDK (@dinari/api-sdk) is loaded only when DINARI_API_KEY is
// present, so just running `npx -y tokenized-stock-mcp` to look at the tool
// surface does not error on missing creds.

const DINARI_API_KEY     = process.env.DINARI_API_KEY     ?? "";
const DINARI_API_BASE    = process.env.DINARI_API_BASE    ?? "https://api-enterprise.sbt.dinari.com/api/v1";
const DINARI_ACCOUNT_ID  = process.env.DINARI_ACCOUNT_ID  ?? "";
const DINARI_ENTITY_ID   = process.env.DINARI_ENTITY_ID   ?? "";
// DINARI_PARTNER_ID kept as alias for backward-compat with v0.1.0 docs;
// in v0.1.1+ the canonical name is DINARI_ENTITY_ID (matches Dinari's term).
const DINARI_PARTNER_ID  = process.env.DINARI_PARTNER_ID  ?? DINARI_ENTITY_ID;
const SANDBOX            = process.env.DINARI_SANDBOX !== "false";  // default sandbox
const ALLOW_LIVE         = process.env.TOKENIZED_STOCK_ALLOW_LIVE === "yes-i-understand";

export function hasCredentials(): boolean {
  return DINARI_API_KEY.length > 0;
}

export function credentialStatus() {
  return {
    apiKey:    DINARI_API_KEY    ? "✓"   : "✗ NOT SET — get from partners.dinari.com dashboard",
    accountId: DINARI_ACCOUNT_ID ? "✓"   : "✗ NOT SET — found in Dinari onboarding email or dashboard",
    entityId:  DINARI_ENTITY_ID  ? "✓"   : "✗ NOT SET — your KYB'd legal entity ID from Dinari",
    allReady:  !!(DINARI_API_KEY && DINARI_ACCOUNT_ID && DINARI_ENTITY_ID),
  };
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
      "'yes-i-understand'. Refusing to send real-money orders. Either set " +
      "DINARI_SANDBOX=true (sandbox mode) or explicitly opt into live trading " +
      "with TOKENIZED_STOCK_ALLOW_LIVE=yes-i-understand."
    );
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────

async function api(path: string, init: RequestInit = {}): Promise<unknown> {
  if (!DINARI_API_KEY) {
    throw new Error("DINARI_API_KEY not set — apply for partner access at https://partners.dinari.com");
  }
  // Dinari scopes most resource endpoints by entity / account. We pass them
  // as headers when set; the API also accepts them in the path on some routes
  // but headers are simpler for a single client wrapper.
  const headers: Record<string, string> = {
    "Authorization":  `Bearer ${DINARI_API_KEY}`,
    "Content-Type":   "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (DINARI_ENTITY_ID)  headers["X-Dinari-Entity-Id"]  = DINARI_ENTITY_ID;
  if (DINARI_ACCOUNT_ID) headers["X-Dinari-Account-Id"] = DINARI_ACCOUNT_ID;

  const res = await fetch(`${DINARI_API_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) {
    throw new Error(`dinari ${res.status} ${path}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

// ─── shapes ───────────────────────────────────────────────────────────────

export type DShareTicker = {
  symbol:     string;   // e.g. "AAPL.d"
  underlying: string;   // "AAPL"
  name:       string;   // "Apple Inc."
  asset_class: "EQUITY" | "ETF";
  tradable:   boolean;
};

export type Quote = {
  symbol:     string;
  bid:        number;
  ask:        number;
  mid:        number;
  asOf:       string;
};

export type DinariOrder = {
  id:         string;
  status:     "PENDING" | "FILLED" | "CANCELED" | "REJECTED";
  symbol:     string;
  side:       "buy" | "sell";
  qty:        string;
  fillPrice:  string | null;
  feeUsd:     string | null;
  createdAt:  string;
};

// ─── read-only ────────────────────────────────────────────────────────────

export async function listSupportedStocks(): Promise<DShareTicker[]> {
  // Hardcoded high-confidence subset for v0.1 so the tool is useful without
  // partner credentials. The real list will be fetched from Dinari API when
  // DINARI_API_KEY is set. Keeps the MCP installable + inspectable.
  if (!DINARI_API_KEY) {
    return SAMPLE_TICKERS;
  }
  return api("/assets") as Promise<DShareTicker[]>;
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  if (!DINARI_API_KEY) {
    // Without credentials we cannot get a real quote. Return null so the
    // guard reports PRICE_LOOKUP_FAILED with a helpful hint.
    return null;
  }
  try {
    return await api(`/quotes/${encodeURIComponent(symbol)}/latest`) as Quote;
  } catch {
    return null;
  }
}

// ─── orders ───────────────────────────────────────────────────────────────

function orderContext(): Record<string, string> {
  const ctx: Record<string, string> = {};
  if (DINARI_ACCOUNT_ID) ctx.account_id = DINARI_ACCOUNT_ID;
  if (DINARI_ENTITY_ID)  ctx.entity_id  = DINARI_ENTITY_ID;
  // partner_id retained for Dinari analytics attribution; falls back to entity_id
  if (DINARI_PARTNER_ID) ctx.partner_id = DINARI_PARTNER_ID;
  return ctx;
}

export async function placeBuyOrder(opts: {
  symbol:          string;
  amountUsd:       number;
  recipientWallet: string;  // user's wallet address (pass-through model)
}): Promise<DinariOrder> {
  assertSafeMode();
  if (!DINARI_API_KEY) throw new Error("DINARI_API_KEY required to place orders");
  return api("/orders", {
    method: "POST",
    body:   JSON.stringify({
      ...orderContext(),
      side:        "buy",
      symbol:      opts.symbol,
      amount_usd:  opts.amountUsd,
      recipient:   opts.recipientWallet,
    }),
  }) as Promise<DinariOrder>;
}

export async function placeSellOrder(opts: {
  symbol:       string;
  qty:          number;
  sourceWallet: string;
}): Promise<DinariOrder> {
  assertSafeMode();
  if (!DINARI_API_KEY) throw new Error("DINARI_API_KEY required to place orders");
  return api("/orders", {
    method: "POST",
    body:   JSON.stringify({
      ...orderContext(),
      side:    "sell",
      symbol:  opts.symbol,
      qty:     opts.qty,
      source:  opts.sourceWallet,
    }),
  }) as Promise<DinariOrder>;
}

// ─── sample tickers (v0.1 fallback when no creds) ─────────────────────────
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

export function sandboxNote(): string {
  return SANDBOX
    ? "🧪 SANDBOX mode (safe default). Set DINARI_SANDBOX=false + TOKENIZED_STOCK_ALLOW_LIVE=yes-i-understand for real-money orders."
    : (ALLOW_LIVE ? "🔴 LIVE mode (explicit opt-in)." : "⚠️ Live mode requested but TOKENIZED_STOCK_ALLOW_LIVE not set — orders will refuse.");
}
