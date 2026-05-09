// x402 互換ユーティリティ。Pay Token モデル（off-chain pre-auth）で動作するが、
// レスポンス形は x402 spec と互換性を保つ。エージェントが書く処理ロジックは
// on-chain x402 と同じで OK になる。実 on-chain 送金は HOT_WALLET 解放後
// （issue #4 Phase B）。

export type X402Receipt = {
  scheme:           "lemoncake-pay-token-v1";
  x402Compatible:   true;
  chain:            string;
  asset:            string;
  amount:           string;
  recipient:        string;
  paymentIntentId:  string;
  settledAt:        string;
  note:             string;
};

export function buildX402Receipt(opts: {
  chargeId:   string | null;
  amountUsdc: string | null;
  serviceId:  string;
  mode:       "demo" | "live";
}): X402Receipt {
  return {
    scheme:          "lemoncake-pay-token-v1",
    x402Compatible:  true,
    chain:           "off-chain (LemonCake Pay Token)",
    asset:           "USDC",
    amount:          opts.amountUsdc ?? "0.00",
    recipient:       opts.serviceId,
    paymentIntentId: opts.chargeId ?? `${opts.mode}_${Date.now().toString(36)}`,
    settledAt:       new Date().toISOString(),
    note:            opts.mode === "demo"
      ? "Demo Mode: receipt shape is illustrative, no actual settlement."
      : "Off-chain settlement via Pay Token. On-chain x402 receipt mode is gated (HOT_WALLET).",
  };
}

/**
 * Parse an x402 challenge from upstream response. Precedence:
 *   1. `WWW-Authenticate: x402 chain=... asset=... amount=... recipient=...`
 *   2. `X-402-Chain` / `X-402-Asset` / `X-402-Amount` / `X-402-Recipient` / `X-402-Callback` headers
 *   3. JSON body with a top-level `x402` object
 * Returns null when no challenge is detected so the caller can fall back to a generic 402 hint.
 */
export function parseX402Challenge(headers: Headers, body: unknown): Record<string, string> | null {
  const wwwAuth = headers.get("www-authenticate");
  if (wwwAuth && /^\s*x402\b/i.test(wwwAuth)) {
    const params: Record<string, string> = { source: "WWW-Authenticate", scheme: "x402" };
    const re = /(\w+)=("([^"]*)"|(\S+))/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(wwwAuth))) params[m[1]] = m[3] ?? m[4];
    return params;
  }
  const headerKeys = ["x-402-chain", "x-402-asset", "x-402-amount", "x-402-recipient", "x-402-callback"];
  const fromHeaders: Record<string, string> = {};
  for (const k of headerKeys) {
    const v = headers.get(k);
    if (v) fromHeaders[k.replace(/^x-402-/, "")] = v;
  }
  if (Object.keys(fromHeaders).length > 0) {
    return { source: "X-402-* headers", scheme: "x402", ...fromHeaders };
  }
  if (body && typeof body === "object" && body !== null && "x402" in (body as object)) {
    const inner = (body as Record<string, unknown>).x402;
    if (inner && typeof inner === "object") {
      const flat: Record<string, string> = { source: "response.x402", scheme: "x402" };
      for (const [k, v] of Object.entries(inner as Record<string, unknown>)) flat[k] = String(v);
      return flat;
    }
  }
  return null;
}
