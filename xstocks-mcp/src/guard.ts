// Composes ledger preflight with the Jupiter quote.
// Fail-CLOSED: any quote/preflight error refuses the swap.

import { findXStockBySymbol, quoteUsdcToXStock, USDC_MINT, type XStockToken, type Quote } from "./jupiter.js";
import * as ledger from "./capLedger.js";

export type GuardDecision =
  | {
      allowed:           true;
      notionalUsd:       number;
      remainingUsd:      number;
      limitUsd:          number;
      token:             XStockToken;
      quote:             Quote;
      expectedOutAmount: string;
      priceImpactPct:    string;
    }
  | {
      allowed:      false;
      reason:       "INVALID_INPUT" | "TOKEN_NOT_FOUND" | "QUOTE_FAILED" | "BUDGET_EXCEEDED" | "PRICE_IMPACT_TOO_HIGH";
      notionalUsd:  number;
      remainingUsd: number;
      limitUsd:     number;
      hint:         string;
    };

const MAX_PRICE_IMPACT_PCT = Number(process.env.XSTOCKS_MAX_PRICE_IMPACT_PCT ?? 2);  // 2% default

export async function guardBuy(opts: {
  symbol:      string;
  amountUsd:   number;
  slippageBps?: number;
}): Promise<GuardDecision> {
  if (!opts.symbol || !Number.isFinite(opts.amountUsd) || opts.amountUsd <= 0) {
    return {
      allowed: false, reason: "INVALID_INPUT",
      notionalUsd: 0, remainingUsd: 0, limitUsd: 0,
      hint: `Invalid input: symbol="${opts.symbol}", amountUsd=${opts.amountUsd}`,
    };
  }

  // Resolve symbol to mint (with verification it's the Backed-issued xStock)
  const token = await findXStockBySymbol(opts.symbol);
  if (!token) {
    const st = await ledger.status().catch(() => ({ dailyLimitUsd: 0, todayUsedUsd: 0, remainingUsd: 0 } as never));
    return {
      allowed: false, reason: "TOKEN_NOT_FOUND",
      notionalUsd: 0, remainingUsd: st.remainingUsd, limitUsd: st.dailyLimitUsd,
      hint: `Could not find a verified xStock for "${opts.symbol}". Jupiter search returned no result with tags ["verified","xstocks"]. Make sure the ticker exists on xStocks (e.g. AAPLx, TSLAx, SPYx).`,
    };
  }

  // Preflight cap
  const pf = await ledger.preflight(opts.amountUsd);
  if (!pf.allowed) {
    return { allowed: false, reason: "BUDGET_EXCEEDED", notionalUsd: opts.amountUsd, remainingUsd: pf.remainingUsd, limitUsd: pf.limitUsd, hint: pf.hint };
  }

  // Get Jupiter quote
  let quote: Quote;
  try {
    quote = await quoteUsdcToXStock({
      outputMint:  token.mint,
      usdcAmount:  opts.amountUsd,
      slippageBps: opts.slippageBps,
    });
  } catch (e) {
    return {
      allowed: false, reason: "QUOTE_FAILED",
      notionalUsd: opts.amountUsd, remainingUsd: pf.remainingUsd, limitUsd: pf.limitUsd,
      hint: `Jupiter quote failed: ${e instanceof Error ? e.message : String(e)}. The token may have insufficient liquidity right now. Try a smaller amount or a more popular ticker.`,
    };
  }

  // Price-impact safety. >2% by default is "the agent is moving the market" — refuse.
  const pi = Math.abs(parseFloat(quote.priceImpactPct));
  if (Number.isFinite(pi) && pi > MAX_PRICE_IMPACT_PCT) {
    return {
      allowed: false, reason: "PRICE_IMPACT_TOO_HIGH",
      notionalUsd: opts.amountUsd, remainingUsd: pf.remainingUsd, limitUsd: pf.limitUsd,
      hint: `Quote shows ${pi.toFixed(2)}% price impact, above the ${MAX_PRICE_IMPACT_PCT}% safety threshold. Split into a smaller order or raise XSTOCKS_MAX_PRICE_IMPACT_PCT (not recommended).`,
    };
  }

  return {
    allowed:           true,
    notionalUsd:       opts.amountUsd,
    remainingUsd:      pf.remainingUsd,
    limitUsd:          pf.limitUsd,
    token,
    quote,
    expectedOutAmount: quote.outAmount,
    priceImpactPct:    quote.priceImpactPct,
  };
}

export async function recordTrade(opts: {
  notionalUsd: number;
  feeUsd:      number;
  txSig:       string;
  symbol:      string;
  side:        "buy" | "sell";
}) {
  await ledger.recordTrade(opts);
}

export const status        = ledger.status;
export const setDailyLimit = ledger.setDailyLimit;
