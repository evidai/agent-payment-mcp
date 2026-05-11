// LemonCake fee policy for xstocks-mcp.
// Same flat $0.10/trade as tokenized-stock-mcp (industry-normal wrapper fee).
// Configurable via LEMONCAKE_STOCK_FEE_USD env var.

const RAW = process.env.LEMONCAKE_STOCK_FEE_USD;
const FALLBACK = 0.10;

export const FEE_USD: number = (() => {
  if (RAW == null) return FALLBACK;
  const n = Number(RAW);
  if (!Number.isFinite(n) || n < 0) return FALLBACK;
  return n;
})();
