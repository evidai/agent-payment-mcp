// Pre-flight guard. Composes price discovery + the local cap ledger.
//
// v0.1 design choice: we use the LOCAL ledger (capLedger.ts). When the
// LemonCake API exposes the real Pay Token preflight endpoint, payToken.ts
// will take precedence and this file will fall back to the ledger only when
// LEMON_CAKE_PAY_TOKEN is not set.
//
// The guard is INTENTIONALLY fail-CLOSED. Any error during price lookup
// or preflight refuses the order. There is no agent-overridable path.

import { getLatestQuote } from "./alpaca.js";
import * as ledger from "./capLedger.js";

export type GuardDecision =
  | {
      allowed:           true;
      tradeNotionalUsd:  number;
      remainingUsd:      number;
      limitUsd:          number;
      priceSource:       "limit_input" | "latest_quote";
      effectivePriceUsd: number;
    }
  | {
      allowed:           false;
      reason:            "BUDGET_EXCEEDED" | "PRICE_LOOKUP_FAILED" | "NO_CREDENTIALS" | "INVALID_INPUT";
      tradeNotionalUsd:  number;
      remainingUsd:      number;
      limitUsd:          number;
      hint:              string;
    };

export async function guardOrder(opts: {
  symbol:     string;
  qty:        number;
  side:       "buy" | "sell";
  limitPrice: number | null;   // null = market order; we'll fetch the quote
}): Promise<GuardDecision> {
  if (!opts.symbol || !Number.isFinite(opts.qty) || opts.qty <= 0) {
    return {
      allowed:          false,
      reason:           "INVALID_INPUT",
      tradeNotionalUsd: 0,
      remainingUsd:     0,
      limitUsd:         0,
      hint: `Invalid order input: symbol="${opts.symbol}", qty=${opts.qty}. Both must be non-empty / positive.`,
    };
  }

  let effectivePrice: number;
  let priceSource: "limit_input" | "latest_quote";
  if (opts.limitPrice != null && Number.isFinite(opts.limitPrice) && opts.limitPrice > 0) {
    effectivePrice = opts.limitPrice;
    priceSource    = "limit_input";
  } else {
    const q = await getLatestQuote(opts.symbol).catch(() => null);
    if (!q || !q.mid || q.mid <= 0) {
      const st = await ledger.status().catch(() => ({ dailyLimitUsd: 0, todayUsedUsd: 0, remainingUsd: 0 } as never));
      return {
        allowed:          false,
        reason:           "PRICE_LOOKUP_FAILED",
        tradeNotionalUsd: 0,
        remainingUsd:     st.remainingUsd,
        limitUsd:         st.dailyLimitUsd,
        hint: `Could not resolve a current quote for ${opts.symbol}. Either pass an explicit limit_price (so the notional is bounded), or check that the symbol is tradable on Alpaca and the data API is reachable.`,
      };
    }
    effectivePrice = q.mid;
    priceSource    = "latest_quote";
  }

  const notional = Math.abs(effectivePrice * opts.qty);
  const pf = await ledger.preflight(notional);
  if (!pf.allowed) {
    return {
      allowed:          false,
      reason:           "BUDGET_EXCEEDED",
      tradeNotionalUsd: notional,
      remainingUsd:     pf.remainingUsd,
      limitUsd:         pf.limitUsd,
      hint:             pf.hint,
    };
  }

  return {
    allowed:           true,
    tradeNotionalUsd:  notional,
    remainingUsd:      pf.remainingUsd,
    limitUsd:          pf.limitUsd,
    priceSource,
    effectivePriceUsd: effectivePrice,
  };
}

/** Record that a guarded order actually filled (called after Alpaca accepts the order). */
export async function recordOrderCharge(opts: {
  notionalUsd: number;
  orderId:     string;
  symbol:      string;
  side:        "buy" | "sell";
}): Promise<void> {
  await ledger.recordCharge(opts);
}

export async function guardStatus() {
  return ledger.status();
}

export async function guardSetLimit(limitUsd: number) {
  return ledger.setDailyLimit(limitUsd);
}
