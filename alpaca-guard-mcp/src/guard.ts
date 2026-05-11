// Pre-flight guard logic. Composes price discovery + Pay Token preflight
// into the single decision: should this order be allowed?
//
// The guard is INTENTIONALLY a hard refuser. There is no "warn but allow"
// mode and there is no agent-overridable path. The point of the guard is
// that the agent literally cannot exceed the configured Pay Token cap,
// regardless of how clever the prompt is.

import { preflight } from "./payToken.js";

export type GuardDecision =
  | {
      allowed:           true;
      tradeNotionalUsdc: string;
      remainingUsdc:     string;
    }
  | {
      allowed:           false;
      tradeNotionalUsdc: string;
      remainingUsdc:     string;
      dailyUsedUsdc:     string;
      hint:              string;
      reason:            "BUDGET_EXCEEDED" | "NO_PAY_TOKEN" | "PRICE_LOOKUP_FAILED";
    };

export async function guardOrder(opts: {
  symbol:    string;
  qty:       number;
  side:      "buy" | "sell";
  // limit price if available; otherwise we'll fetch a current quote
  limitPrice: number | null;
  // resolver injected so guard.ts has zero Alpaca-API knowledge
  resolveCurrentPrice: (symbol: string) => Promise<number | null>;
}): Promise<GuardDecision> {
  const price = opts.limitPrice ?? await opts.resolveCurrentPrice(opts.symbol);
  if (price === null) {
    return {
      allowed:           false,
      tradeNotionalUsdc: "0.00",
      remainingUsdc:     "0.00",
      dailyUsedUsdc:     "0.00",
      hint:              `Could not resolve current price for ${opts.symbol}. Refusing the order to avoid an unbounded notional. Try again with an explicit limit_price.`,
      reason:            "PRICE_LOOKUP_FAILED",
    };
  }

  // sells reduce risk in our spending model; we still preflight on notional
  // so a margin sell that opens new exposure is still capped.
  const notional = Math.abs(price * opts.qty);
  const notionalStr = notional.toFixed(2);

  const pf = await preflight({
    notionalUsdc: notionalStr,
    serviceTag:   "alpaca",
    reasonCode:   "place_order",
  });

  if (!pf.allowed) {
    return {
      allowed:           false,
      tradeNotionalUsdc: notionalStr,
      remainingUsdc:     pf.remainingUsdc,
      dailyUsedUsdc:     pf.dailyUsedUsdc,
      hint:              pf.hint,
      reason:            pf.hint.includes("LEMON_CAKE_PAY_TOKEN") ? "NO_PAY_TOKEN" : "BUDGET_EXCEEDED",
    };
  }

  return {
    allowed:           true,
    tradeNotionalUsdc: notionalStr,
    remainingUsdc:     pf.remainingUsdc,
  };
}
