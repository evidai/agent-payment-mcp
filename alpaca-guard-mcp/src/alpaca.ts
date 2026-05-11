// Thin Alpaca REST client. Talks directly to Alpaca's HTTP API (no Python
// upstream dependency). Paper trading is the default and the safe option.
//
// Endpoints:
//   Trading:    https://paper-api.alpaca.markets/v2/   (paper)
//               https://api.alpaca.markets/v2/         (live)
//   Market data: https://data.alpaca.markets/v2/

const ALPACA_API_KEY    = process.env.ALPACA_API_KEY    ?? "";
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY ?? "";
const PAPER             = process.env.ALPACA_PAPER_TRADE !== "false";
const ALLOW_LIVE        = process.env.ALPACA_GUARD_ALLOW_LIVE === "yes-i-understand";

const TRADING_BASE = PAPER
  ? "https://paper-api.alpaca.markets/v2"
  : "https://api.alpaca.markets/v2";
const DATA_BASE = "https://data.alpaca.markets/v2";

export function authHeaders(): Record<string, string> {
  return {
    "APCA-API-KEY-ID":     ALPACA_API_KEY,
    "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
    "Content-Type":        "application/json",
  };
}

export function hasCredentials(): boolean {
  return ALPACA_API_KEY.length > 0 && ALPACA_SECRET_KEY.length > 0;
}

export function paperMode(): boolean {
  return PAPER;
}

export function liveAllowed(): boolean {
  return !PAPER && ALLOW_LIVE;
}

/** Raise if user is attempting live trading without the explicit opt-in. */
export function assertSafeMode(): void {
  if (!PAPER && !ALLOW_LIVE) {
    throw new Error(
      "ALPACA_PAPER_TRADE=false but ALPACA_GUARD_ALLOW_LIVE is not set to " +
      "'yes-i-understand'. Refusing to send real-money orders. Either set " +
      "ALPACA_PAPER_TRADE=true (paper mode) or explicitly opt into live " +
      "trading with ALPACA_GUARD_ALLOW_LIVE=yes-i-understand."
    );
  }
}

async function alpacaFetch(base: string, path: string, init: RequestInit = {}): Promise<unknown> {
  const url = `${base}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  const body: unknown = text ? safeJson(text) : null;
  if (!res.ok) {
    throw new Error(`alpaca ${res.status} ${path}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

function safeJson(t: string): unknown {
  try { return JSON.parse(t); } catch { return t; }
}

// ───── account / positions / market data (read-only, no spending) ─────

export type AlpacaAccount = {
  id:           string;
  status:       string;
  currency:     string;
  buying_power: string;
  cash:         string;
  equity:       string;
  portfolio_value: string;
  pattern_day_trader: boolean;
};

export function getAccount(): Promise<AlpacaAccount> {
  return alpacaFetch(TRADING_BASE, "/account") as Promise<AlpacaAccount>;
}

export type AlpacaPosition = {
  asset_id:        string;
  symbol:          string;
  qty:             string;
  side:            "long" | "short";
  avg_entry_price: string;
  market_value:    string;
  current_price:   string;
  unrealized_pl:   string;
  unrealized_plpc: string;
};

export function getPositions(): Promise<AlpacaPosition[]> {
  return alpacaFetch(TRADING_BASE, "/positions") as Promise<AlpacaPosition[]>;
}

export type LatestQuote = {
  symbol:   string;
  bidPrice: number;
  askPrice: number;
  mid:      number;
  asOf:     string;
};

/** Get the latest mid price for a symbol. Used by the guard to estimate notional. */
export async function getLatestQuote(symbol: string): Promise<LatestQuote | null> {
  // Alpaca's market-data quote endpoint
  const data = await alpacaFetch(
    DATA_BASE,
    `/stocks/${encodeURIComponent(symbol)}/quotes/latest`,
  ).catch(() => null) as { quote?: { bp?: number; ap?: number; t?: string } } | null;

  if (!data?.quote) return null;
  const bidPrice = data.quote.bp ?? 0;
  const askPrice = data.quote.ap ?? 0;
  if (!askPrice && !bidPrice) return null;
  const mid = (bidPrice + askPrice) / 2 || askPrice || bidPrice;
  return { symbol, bidPrice, askPrice, mid, asOf: data.quote.t ?? "" };
}

// ───── orders (the actually-spending tools) ─────

export type PlaceOrderInput = {
  symbol:     string;
  qty:        number;
  side:       "buy" | "sell";
  type:       "market" | "limit";
  limitPrice?: number;
  tif:        "day" | "gtc" | "ioc" | "fok";
};

export type AlpacaOrder = {
  id:           string;
  client_order_id: string;
  status:       string;
  symbol:       string;
  qty:          string;
  filled_qty:   string;
  side:         "buy" | "sell";
  type:         "market" | "limit" | string;
  limit_price:  string | null;
  created_at:   string;
};

export async function placeOrder(o: PlaceOrderInput): Promise<AlpacaOrder> {
  assertSafeMode();
  const body: Record<string, unknown> = {
    symbol:        o.symbol,
    qty:           String(o.qty),
    side:          o.side,
    type:          o.type,
    time_in_force: o.tif,
  };
  if (o.type === "limit") {
    if (o.limitPrice == null) {
      throw new Error("limit order requires limitPrice");
    }
    body.limit_price = String(o.limitPrice);
  }
  return alpacaFetch(TRADING_BASE, "/orders", {
    method: "POST",
    body:   JSON.stringify(body),
  }) as Promise<AlpacaOrder>;
}

export async function closePosition(symbol: string, qty?: number): Promise<unknown> {
  assertSafeMode();
  const path = qty != null
    ? `/positions/${encodeURIComponent(symbol)}?qty=${encodeURIComponent(String(qty))}`
    : `/positions/${encodeURIComponent(symbol)}`;
  return alpacaFetch(TRADING_BASE, path, { method: "DELETE" });
}
