/**
 * lc-credits.ts — buyer prepaid-bundle helpers (Phase 2).
 *
 * Model (Option 1, "token = prepaid bundle"):
 *   A buyer pays $X on /buy/[shortId] via a Stripe Direct Charge on the
 *   seller's connected account (3% application fee → LemonCake, taken once
 *   at Checkout). On success we mint ONE Pay Token whose budget == $X.
 *   No buyer accounts, no balance ledger — the token *is* the credit.
 *
 * Idempotency: every mint is keyed by the Stripe Checkout Session id
 * (lc_pay_tokens.stripe_checkout_session_id, unique). Both the success-page
 * fetch and the webhook call mintPrepaidToken(); whichever runs first wins,
 * the other returns the same token. Re-signing the JWT from the stored jti is
 * deterministic (HS256, no nonce), so either path can hand the buyer a token.
 */

import { sql, signPayToken, type PayTokenRow } from "@/lib/lc-backend";

const PREPAID_TOKEN_DAYS = 365;
const MAX_INT4 = 2_000_000_000; // postgres int ceiling guard for max_calls

export type MintResult =
  | { ok: true; row: PayTokenRow; jwt: string }
  | { ok: false; error: string };

async function signFor(row: PayTokenRow): Promise<string> {
  return signPayToken(
    { jti: row.id, sub: row.endpoint_id, own: row.owner_id },
    new Date(row.expires_at).getTime(),
  );
}

/**
 * Idempotently mint a prepaid Pay Token for a paid Checkout Session.
 * Safe to call from both the success-page fetch and the webhook.
 */
export async function mintPrepaidToken(args: {
  sessionId: string;
  endpointId: string;
  ownerId: string;
  creditCents: number;
  buyerEmail: string | null;
}): Promise<MintResult> {
  const { sessionId, endpointId, ownerId, creditCents, buyerEmail } = args;

  if (!sessionId || !endpointId || !ownerId) return { ok: false, error: "missing_fields" };
  if (!(creditCents > 0)) return { ok: false, error: "invalid_amount" };

  // Already minted for this session? Return it (idempotent).
  const existing = await sql()<PayTokenRow[]>`
    select * from lc_pay_tokens where stripe_checkout_session_id = ${sessionId} limit 1
  `;
  if (existing.length > 0) {
    return { ok: true, row: existing[0], jwt: await signFor(existing[0]) };
  }

  // Need the endpoint price to translate budget → max_calls.
  const eps = await sql()<{ id: string; price_per_call: string }[]>`
    select id, price_per_call from lc_endpoints where id = ${endpointId} limit 1
  `;
  if (eps.length === 0) return { ok: false, error: "endpoint_not_found" };
  const price = Number(eps[0].price_per_call);

  const budget = creditCents / 100;
  const maxCalls = price > 0
    ? Math.min(MAX_INT4, Math.max(1, Math.floor(budget / price)))
    : MAX_INT4;
  const jti = `pt_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const expiresAtIso = new Date(Date.now() + PREPAID_TOKEN_DAYS * 24 * 3600 * 1000).toISOString();

  // Race-safe insert: if a concurrent call (webhook vs. result fetch) already
  // inserted for this session, do nothing and re-select the winner.
  const inserted = await sql()<PayTokenRow[]>`
    insert into lc_pay_tokens
      (id, endpoint_id, owner_id, budget, spent, max_calls, calls_used,
       expires_at, status, stripe_checkout_session_id, buyer_email)
    values
      (${jti}, ${endpointId}, ${ownerId}, ${budget}, 0, ${maxCalls}, 0,
       ${expiresAtIso}, 'active', ${sessionId}, ${buyerEmail})
    on conflict (stripe_checkout_session_id) where stripe_checkout_session_id is not null
      do nothing
    returning *
  `;
  if (inserted.length > 0) {
    return { ok: true, row: inserted[0], jwt: await signFor(inserted[0]) };
  }

  // Lost the race — fetch the row the other path inserted.
  const winner = await sql()<PayTokenRow[]>`
    select * from lc_pay_tokens where stripe_checkout_session_id = ${sessionId} limit 1
  `;
  if (winner.length > 0) {
    return { ok: true, row: winner[0], jwt: await signFor(winner[0]) };
  }
  return { ok: false, error: "mint_failed" };
}
