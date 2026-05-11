// LemonCake Pay Token integration (NOT YET ACTIVE in v0.1).
//
// The real preflight endpoint (POST /api/pay-tokens/:id/preflight) does not
// exist on the LemonCake API yet. When it does, this module will become the
// primary spending control and capLedger.ts will become the fallback for
// users who don't have a Pay Token set.
//
// For now this module only reports the configuration state via configured()
// so the setup tool can tell users "Pay Token mode is coming; you're on the
// local ledger right now".

const PAY_TOKEN = process.env.LEMON_CAKE_PAY_TOKEN ?? "";

export function configured(): boolean {
  return PAY_TOKEN.length > 0;
}

export function note(): string {
  return configured()
    ? "LEMON_CAKE_PAY_TOKEN is set, but alpaca-guard-mcp v0.1 still uses the local cap ledger. " +
      "LemonCake API preflight integration is tracked at github.com/evidai/lemon-cake/issues/4."
    : "LEMON_CAKE_PAY_TOKEN not set; using local cap ledger (~/.alpaca-guard/cap.json). " +
      "This is fine for paper trading and most agentic workflows.";
}
