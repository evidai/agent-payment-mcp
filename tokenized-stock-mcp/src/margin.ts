// LemonCake margin policy for tokenized-stock-mcp.
//
// Decision: flat $0.10 USD per trade.
// (See docs/research/2026-05-11-tokenized-stocks-feasibility.md for the
//  reasoning — covers the ~$0.05 LemonCake variable cost per trade and is
//  industry-normal for wrapper/aggregator services like Plaid / Stripe
//  Connect / Lightspeed. Avoids the "10% sounds expensive" framing of a
//  percentage of Dinari's fee.)
//
// Configurable via env var so we can change it without re-publishing.

const RAW = process.env.LEMONCAKE_STOCK_FEE_USD;
const FALLBACK = 0.10;

export const FEE_USD: number = (() => {
  if (RAW == null) return FALLBACK;
  const n = Number(RAW);
  if (!Number.isFinite(n) || n < 0) return FALLBACK;
  return n;
})();

export function buildFeeBreakdown(opts: {
  notionalUsd:   number;
  dinariFeeUsd:  number | null;
}): {
  notionalUsd:        number;
  dinariFeeUsd:       number | null;
  lemoncakeFeeUsd:    number;
  totalUserPaysUsd:   number;
  effectiveBpsOnNotional: number;
} {
  const dinari      = opts.dinariFeeUsd ?? 0;
  const total       = opts.notionalUsd + dinari + FEE_USD;
  const effectiveBps = opts.notionalUsd > 0
    ? Math.round((FEE_USD / opts.notionalUsd) * 10000)
    : 0;
  return {
    notionalUsd:        opts.notionalUsd,
    dinariFeeUsd:       opts.dinariFeeUsd,
    lemoncakeFeeUsd:    FEE_USD,
    totalUserPaysUsd:   total,
    effectiveBpsOnNotional: effectiveBps,
  };
}
