# Non-Custodial Migration Plan (v2)

**Trigger event:** Fintech Support Desk Q11 reply (2026-05-21, 白岩朋也).
**Goal:** Move every paying user off the legacy custody model onto the
permit-based non-custodial flow so LemonCake can operate without
電子決済手段等取引業 registration.

## The two architectures side-by-side

| | Legacy (current) | v2 (target) |
|---|---|---|
| USDC location | LemonCake address | User's own wallet |
| Auth credential | `LEMON_CAKE_PAY_TOKEN` JWT | `LEMON_CAKE_PERMIT` (ERC-2612 signed blob) |
| Signing events | One per top-up | One per ~90 days |
| Server-side state | Balance, charges, JWTs | None — stateless verification |
| FSA position | 電子決済手段等取引業 登録必要 | 登録不要 (Q11 ruling) |
| Code paths | `mcp-server/src/index.ts` `withPayment.ts` `LemonCakeClient.charge()` | `permit.ts` (both dashboard + sdk), `verifyPermitToken()` |

## Code surface area shipped so far

- `dashboard/app/lib/permit.ts` — typed ERC-2612 signer / encoder.
- `dashboard/app/start/v2/page.tsx` — onboarding flow prototype.
- `lemoncake-mcp-sdk/src/permit.ts` — server-side verifier.
- `mcp-server/src/index.ts` — recognises `LEMON_CAKE_PERMIT` env var.
- `dashboard/app/start/page.tsx` — banner pointing legacy users at v2.

## What is still required to flip the switch

1. **Wallet provider integration.** Replace the mocked sign step in
   `start/v2/page.tsx` with a real `WalletClient.signTypedData()` call
   via Privy. Needs `NEXT_PUBLIC_PRIVY_APP_ID` set and a `<PrivyProvider>`
   wrapper in `app/layout.tsx`.

2. **USDC on-ramp.** Wire Stripe Crypto (or Coinbase Pay) on the
   Step 2 button so users can buy USDC into their Privy wallet directly.

3. **Per-call permit pull.** Today the MCP server only reads the permit
   env var — it does not yet submit `USDC.permit(...)` + `transferFrom`
   on-chain. The next step is a thin paymaster (Pimlico) the seller
   contracts call to settle each charge against the buyer's signature.

4. **Marketplace spender addresses.** Each paid service needs a
   receiver address that becomes the `spender` in the permit. Either:
   a) seller chooses their own and registers it,
   b) LemonCake provides a per-service paymaster contract address that
      forwards to the seller (but does NOT custody — passthrough only).
   Option (b) keeps UX simple but needs review against the FSA wording
   "soft ware の展開又は使用に一切関与しない" — leaning toward (a).

5. **Legacy buyer wind-down.** Every account with a non-zero USDC
   balance on LemonCake's address needs:
   - Email asking them to withdraw USDC to their own wallet, OR
   - Auto-refund script that ships the balance back to the deposit
     source address.
   No new Pay Tokens issued after T-day. Existing tokens honoured until
   their stated expiry; balance reduces toward zero naturally.

## Sequencing

| Phase | What | Gating signal |
|---|---|---|
| ✅ Already done | v2 prototype + SDK verifier shipped | — |
| 1 | Privy + signTypedData wired up | `NEXT_PUBLIC_PRIVY_APP_ID` set in Vercel |
| 2 | Paymaster + on-chain transferFrom path | Pimlico account or Base Account ABI in place |
| 3 | v2 marked GA on /start, banner removed | Internal end-to-end test green |
| 4 | Email existing buyers, freeze new top-ups | T-7 day announcement |
| 5 | Refund residual balances, decommission custody endpoints | All accounts drained |

## Marketing rewrite (when GA)

- /hire — add "FSA Q1-Q11 完了 + 非カストディ設計" to the proof section.
- npm README of agent-payment-mcp — replace top "Try in 30 seconds"
  example to use `LEMON_CAKE_PERMIT`.
- X / LinkedIn — announce "FSA 照会済み・非カストディ AI 決済 SDK v1.0".
- Roy Meshulam follow-up — "we now satisfy the same control objectives
  Agent Pay solves (cap + revoke + audit) WITHOUT custody."

## Why we're keeping the legacy path alive in parallel for now

- No paying users yet, so no one's actively affected — but Glama
  inspector traffic still hits demo mode and we don't want to break it.
- The new path needs at least a Privy app ID + paymaster contract
  deployment before it can settle real charges.
- A working two-rail SDK ("set PERMIT for v2, set PAY_TOKEN for legacy")
  makes the migration message simple: "swap one env var".

The legacy path will be removed entirely once paying buyers (if any) have
migrated and Glama / Cursor Directory listings have been updated to point
at the v2 install snippet.
