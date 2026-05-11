// LemonCake Pay Token API client.
//
// Two endpoints we hit:
//   POST /api/pay-tokens/{id}/preflight  → { allowed, remainingUsdc, dailyUsedUsdc, hint? }
//   POST /api/charges                     → { chargeId, amountUsdc } (idempotent on idempotencyKey)
//
// Both endpoints currently DO NOT EXIST on the LemonCake API. They will be
// added when alpaca-guard-mcp moves from design phase to implementation.
// For now this file documents the contract and is a placeholder so the
// scaffolding compiles.

const API_URL  = (process.env.LEMON_CAKE_API_URL  ?? "https://api.lemoncake.xyz").replace(/\/$/, "");
const PAY_TOKEN = process.env.LEMON_CAKE_PAY_TOKEN ?? "";

export type PreflightResult =
  | { allowed: true;  remainingUsdc: string; dailyUsedUsdc: string }
  | { allowed: false; remainingUsdc: string; dailyUsedUsdc: string; hint: string };

export async function preflight(opts: {
  notionalUsdc: string;
  serviceTag:   "alpaca";
  reasonCode:   "place_order" | "close_position";
}): Promise<PreflightResult> {
  if (!PAY_TOKEN) {
    return {
      allowed:        false,
      remainingUsdc:  "0.00",
      dailyUsedUsdc:  "0.00",
      hint:           "LEMON_CAKE_PAY_TOKEN not set. Issue one at https://lemoncake.xyz/dashboard/tokens and add to MCP client config. There is no override path from the agent side.",
    };
  }
  // TODO(impl): real fetch to /api/pay-tokens/<id>/preflight once endpoint exists.
  // For the scaffolding phase we conservatively reject every trade so the guard
  // never fails OPEN (refusing is the safe default while impl is incomplete).
  return {
    allowed:       false,
    remainingUsdc: "0.00",
    dailyUsedUsdc: "0.00",
    hint:          "alpaca-guard-mcp is in design phase and intentionally refuses all trades. Awaiting Alpaca-side BD signal before shipping the real preflight implementation. Track at github.com/evidai/lemon-cake/tree/main/alpaca-guard-mcp.",
  };
}

export type ChargeResult =
  | { ok: true;  chargeId: string; amountUsdc: string; settledAt: string }
  | { ok: false; reason: string };

export async function charge(opts: {
  notionalUsdc:   string;
  idempotencyKey: string;     // typically the Alpaca order_id
  serviceTag:     "alpaca";
}): Promise<ChargeResult> {
  if (!PAY_TOKEN) {
    return { ok: false, reason: "no LEMON_CAKE_PAY_TOKEN" };
  }
  // TODO(impl): real charge call once endpoint exists.
  return { ok: false, reason: "alpaca-guard-mcp design phase — charge() not yet implemented" };
}

// Used by get_pay_token_status tool (read-only summary for the agent).
export async function status(): Promise<{
  configured:    boolean;
  remainingUsdc: string | null;
  dailyUsedUsdc: string | null;
  kycTier:       string | null;
  apiUrl:        string;
}> {
  return {
    configured:    !!PAY_TOKEN,
    remainingUsdc: null,
    dailyUsedUsdc: null,
    kycTier:       null,
    apiUrl:        API_URL,
  };
}
