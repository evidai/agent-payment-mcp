// Pre-flight guard. Composes quote lookup + cap-ledger preflight + margin
// calculation into one decision.
//
// Fail-CLOSED: any error during quote lookup or preflight refuses the order.

import { getQuote } from "./dinari.js";
import * as ledger from "./capLedger.js";
import { buildFeeBreakdown } from "./margin.js";

export type GuardDecision =
  | {
      allowed:    true;
      notionalUsd: number;
      effectivePriceUsd: number;
      priceSource: "amount_usd_input" | "latest_quote";
      remainingUsd: number;
      limitUsd:     number;
      fee:          ReturnType<typeof buildFeeBreakdown>;
    }
  | {
      allowed:     false;
      reason:      "BUDGET_EXCEEDED" | "PRICE_LOOKUP_FAILED" | "INVALID_INPUT";
      notionalUsd: number;
      remainingUsd: number;
      limitUsd:     number;
      hint:         string;
    };

export async function guardBuy(opts: {
  symbol:    string;
  amountUsd: number;                      // user-specified dollar amount; preferred
  dinariFeeEstimateUsd: number | null;    // for fee transparency; not used in cap math
}): Promise<GuardDecision> {
  if (!opts.symbol || !Number.isFinite(opts.amountUsd) || opts.amountUsd <= 0) {
    return {
      allowed: false, reason: "INVALID_INPUT",
      notionalUsd: 0, remainingUsd: 0, limitUsd: 0,
      hint: `Invalid buy input: symbol="${opts.symbol}", amountUsd=${opts.amountUsd}. Both must be non-empty / positive.`,
    };
  }

  // For buys we trust the user-specified dollar amount as the notional.
  // (Dollar-denominated buys are the canonical Dinari path — share count
  //  is derived at execution time.)
  const notional = opts.amountUsd;
  const pf = await ledger.preflight(notional);
  if (!pf.allowed) {
    return { allowed: false, reason: "BUDGET_EXCEEDED", notionalUsd: notional, remainingUsd: pf.remainingUsd, limitUsd: pf.limitUsd, hint: pf.hint };
  }

  return {
    allowed:           true,
    notionalUsd:       notional,
    effectivePriceUsd: notional,
    priceSource:       "amount_usd_input",
    remainingUsd:      pf.remainingUsd,
    limitUsd:          pf.limitUsd,
    fee:               buildFeeBreakdown({ notionalUsd: notional, dinariFeeUsd: opts.dinariFeeEstimateUsd }),
  };
}

export async function guardSell(opts: {
  symbol: string;
  qty:    number;
}): Promise<GuardDecision> {
  if (!opts.symbol || !Number.isFinite(opts.qty) || opts.qty <= 0) {
    return {
      allowed: false, reason: "INVALID_INPUT",
      notionalUsd: 0, remainingUsd: 0, limitUsd: 0,
      hint: `Invalid sell input: symbol="${opts.symbol}", qty=${opts.qty}.`,
    };
  }
  // For sells we need a price to compute notional → quote lookup.
  const q = await getQuote(opts.symbol).catch(() => null);
  if (!q || !q.mid) {
    const st = await ledger.status().catch(() => ({ dailyLimitUsd: 0, todayUsedUsd: 0, remainingUsd: 0 } as never));
    return {
      allowed: false, reason: "PRICE_LOOKUP_FAILED",
      notionalUsd: 0, remainingUsd: st.remainingUsd, limitUsd: st.dailyLimitUsd,
      hint: `Could not resolve a current quote for ${opts.symbol}. This is typical when DINARI_API_KEY is not set (sandbox install). Set the API key and retry, or pass amountUsd directly via guarded_buy_stock for a buy.`,
    };
  }
  const notional = Math.abs(q.mid * opts.qty);
  const pf = await ledger.preflight(notional);
  if (!pf.allowed) {
    return { allowed: false, reason: "BUDGET_EXCEEDED", notionalUsd: notional, remainingUsd: pf.remainingUsd, limitUsd: pf.limitUsd, hint: pf.hint };
  }
  return {
    allowed:           true,
    notionalUsd:       notional,
    effectivePriceUsd: q.mid,
    priceSource:       "latest_quote",
    remainingUsd:      pf.remainingUsd,
    limitUsd:          pf.limitUsd,
    fee:               buildFeeBreakdown({ notionalUsd: notional, dinariFeeUsd: null }),
  };
}

export async function recordTradeCharge(opts: {
  notionalUsd: number;
  feeUsd:      number;
  orderId:     string;
  symbol:      string;
  side:        "buy" | "sell";
}) {
  await ledger.recordCharge(opts);
}

export const status = ledger.status;
export const setDailyLimit = ledger.setDailyLimit;
