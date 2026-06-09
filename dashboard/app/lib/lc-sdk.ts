/**
 * lc-sdk.ts — Phase 2 seller-side fiat billing core.
 *
 * Lets a seller's own MCP/API server charge a buyer's prepaid Pay Token from
 * in-process, via /api/sdk/{preflight,charge}, instead of routing every call
 * through the buyer-facing gateway (/g). Same money model, no per-call Stripe:
 *
 *   buyer prepays (real card, at mint) → Pay Token (budget) → seller decrements
 *
 * Flow (2-call, reserve→confirm so a FAILED tool is never charged):
 *   preflight  = verify seller key + buyer Pay Token, scope-check, RESERVE budget
 *                (atomic CAS so concurrent calls can't oversell), return chargeId.
 *   charge     = confirm  → write lc_test_runs (seller earnings, 3% platform fee)
 *                cancel   → refund the reservation, no earnings row.
 *
 * Seller key (`sk_live_…` / `sk_test_…`) authenticates the SDK and is bound to
 * exactly ONE endpoint (the resource it may bill for). Stored hashed; shown once.
 *
 * Shares ALL spend/fee/rate math with the gateway via lc-meter.ts — no drift.
 */

import { sql, verifyPayToken, type EndpointRow, type PayTokenRow } from "@/lib/lc-backend";
import {
  checkTokenSpendable,
  computeFee,
  isOwnerInFreeTier,
  isRateLimited,
  type TokenRejectReason,
} from "@/lib/lc-meter";
import { checkAgentForToken, type AgentRejectReason } from "@/lib/lc-agents";

const RESERVE_TTL_MS = 60_000; // a reservation auto-expires (budget released) after 60s

/* ──────────────── lazy schema (mirrors ensureAgentSchema) ──────────────── */

const SDK_DDL = `
create table if not exists lc_seller_keys (
  id           text primary key,
  key_hash     text not null unique,
  key_prefix   text not null,
  owner_id     text not null references lc_owners(id) on delete cascade,
  endpoint_id  uuid not null references lc_endpoints(id) on delete cascade,
  env          text not null default 'live',
  label        text,
  status       text not null default 'active',
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
)
create index if not exists lc_seller_keys_owner_idx on lc_seller_keys(owner_id)
create table if not exists lc_sdk_charges (
  id              text primary key,
  idempotency_key text not null,
  seller_key_id   text not null references lc_seller_keys(id) on delete cascade,
  endpoint_id     uuid not null,
  pay_token_id    text not null,
  owner_id        text not null,
  amount          numeric(12,6) not null,
  status          text not null default 'reserved',
  reserved_until  timestamptz not null,
  charge_ref      text,
  tool_name       text,
  agent_id        text,
  created_at      timestamptz not null default now(),
  unique (seller_key_id, idempotency_key)
)
create index if not exists lc_sdk_charges_token_idx on lc_sdk_charges(pay_token_id, status)
alter table lc_sdk_charges add column if not exists agent_id text
`;

let _sdkSchemaReady: Promise<void> | null = null;

/** Apply the Phase-2 DDL once per warm instance (idempotent, gated). */
export function ensureSdkSchema(): Promise<void> {
  if (!_sdkSchemaReady) {
    _sdkSchemaReady = (async () => {
      try {
        const probe = await sql()<{ ready: boolean }[]>`
          select (
            exists(select 1 from information_schema.tables where table_name = 'lc_seller_keys')
            and exists(select 1 from information_schema.tables where table_name = 'lc_sdk_charges')
            and exists(select 1 from information_schema.columns
                       where table_name = 'lc_sdk_charges' and column_name = 'agent_id')
          ) as ready
        `;
        if (probe[0]?.ready) return;
        const statements = SDK_DDL.split("\n").join(" ").split(/(?<=\))\s+(?=create|alter)/i);
        for (const stmt of statements) {
          const s = stmt.trim();
          if (s) await sql().unsafe(s);
        }
      } catch (err) {
        _sdkSchemaReady = null;
        throw err;
      }
    })();
  }
  return _sdkSchemaReady;
}

/* ──────────────── seller-key crypto ──────────────── */

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newSellerKeySecret(env: "live" | "test"): { key: string; prefix: string } {
  const rand = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  const key = `sk_${env}_${rand.slice(0, 40)}`;
  return { key, prefix: `${key.slice(0, 14)}…` };
}

/* ──────────────── types ──────────────── */

export type SellerKeyRow = {
  id: string;
  owner_id: string;
  endpoint_id: string;
  env: "live" | "test";
  status: "active" | "revoked";
};

/* ──────────────── issuance / management (called by the /app UI) ──────────────── */

/**
 * Issue a seller key bound to one endpoint the owner controls. Returns the
 * plaintext `sk_live_…` ONCE — only its hash is stored. The owner is verified
 * to own the endpoint before issuing.
 */
export async function issueSellerKey(args: {
  ownerId: string;
  endpointShortId: string;
  env?: "live" | "test";
  label?: string | null;
}): Promise<
  | { ok: true; key: string; prefix: string; id: string; endpointShortId: string; env: "live" | "test" }
  | { ok: false; error: string }
> {
  const { ownerId, endpointShortId, label } = args;
  const env = args.env ?? "live";

  const eps = await sql()<{ id: string; owner_id: string }[]>`
    select id, owner_id from lc_endpoints where short_id = ${endpointShortId} limit 1
  `;
  if (eps.length === 0) return { ok: false, error: "endpoint_not_found" };
  const ep = eps[0];
  if (ep.owner_id !== ownerId) return { ok: false, error: "not_endpoint_owner" };

  const { key, prefix } = newSellerKeySecret(env);
  const keyHash = await sha256hex(key);
  const id = `skid_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

  await sql()`
    insert into lc_seller_keys (id, key_hash, key_prefix, owner_id, endpoint_id, env, label)
    values (${id}, ${keyHash}, ${prefix}, ${ownerId}, ${ep.id}, ${env}, ${label ?? null})
  `;
  return { ok: true, key, prefix, id, endpointShortId, env };
}

/** List an owner's seller keys (for the /app management UI). */
export async function listSellerKeys(ownerId: string): Promise<
  { id: string; prefix: string; endpointShortId: string; env: string; status: string; createdAt: Date; lastUsedAt: Date | null }[]
> {
  const rows = await sql()<{
    id: string; key_prefix: string; endpoint_short_id: string; env: string;
    status: string; created_at: Date; last_used_at: Date | null;
  }[]>`
    select k.id, k.key_prefix, e.short_id as endpoint_short_id, k.env,
           k.status, k.created_at, k.last_used_at
    from lc_seller_keys k join lc_endpoints e on e.id = k.endpoint_id
    where k.owner_id = ${ownerId}
    order by k.created_at desc limit 50
  `;
  return rows.map((r) => ({
    id: r.id, prefix: r.key_prefix, endpointShortId: r.endpoint_short_id, env: r.env,
    status: r.status, createdAt: r.created_at, lastUsedAt: r.last_used_at,
  }));
}

/** Revoke a seller key the owner controls. Revoked keys fail auth immediately. */
export async function revokeSellerKey(
  ownerId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await sql()<{ id: string }[]>`
    update lc_seller_keys set status = 'revoked'
    where id = ${id} and owner_id = ${ownerId} and status = 'active'
    returning id
  `;
  if (r.length === 0) return { ok: false, error: "not_found_or_not_owner" };
  return { ok: true };
}

/** Resolve a `sk_…` bearer secret on a request to its active key. */
export async function resolveSellerKey(req: Request): Promise<SellerKeyRow | null> {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(sk_(?:live|test)_[A-Za-z0-9]+)\s*$/i);
  if (!m) return null;
  const keyHash = await sha256hex(m[1]);
  const rows = await sql()<{ id: string; owner_id: string; endpoint_id: string; env: string; status: string }[]>`
    select id, owner_id, endpoint_id, env, status from lc_seller_keys where key_hash = ${keyHash} limit 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  if (r.status !== "active") return null;
  await sql()`update lc_seller_keys set last_used_at = now() where id = ${r.id}`;
  return { id: r.id, owner_id: r.owner_id, endpoint_id: r.endpoint_id, env: r.env as "live" | "test", status: "active" };
}

/* ──────────────── stale-reservation sweep (budget-leak guard) ──────────────── */

/**
 * Release reservations that were never confirmed within the TTL: refund the
 * optimistically-debited budget + call back to the token, mark the row expired.
 * Scoped to one token so it's a cheap, lazy sweep on the hot path. Without this
 * a crashed/abandoned preflight would lock budget forever (falling hazard #3).
 */
async function expireStaleReservations(payTokenId: string): Promise<void> {
  const stale = await sql()<{ id: string; amount: string }[]>`
    update lc_sdk_charges
       set status = 'expired'
     where pay_token_id = ${payTokenId}
       and status = 'reserved'
       and reserved_until < now()
    returning id, amount::text as amount
  `;
  for (const s of stale) {
    await sql()`
      update lc_pay_tokens
         set spent = greatest(0, spent - ${Number(s.amount)}),
             calls_used = greatest(0, calls_used - 1),
             status = case when status in ('exhausted','expired') then 'active' else status end
       where id = ${payTokenId}
    `;
  }
}

/* ──────────────── preflight (validate + reserve) ──────────────── */

export type PreflightResult =
  | { allowed: true; chargeId: string; currency: "usd"; required: number; remaining: number; alreadyReserved?: boolean }
  | { allowed: false; reason: PreflightReason; status: number };

export type PreflightReason =
  | "invalid_token"
  | "token_endpoint_mismatch"
  | "endpoint_not_found"
  | "endpoint_paused"
  | "env_mismatch"
  | "amount_mismatch"
  | "rate_limit_exceeded"
  | TokenRejectReason
  | AgentRejectReason;

const REJECT_STATUS: Record<TokenRejectReason, number> = {
  token_revoked: 403,
  token_expired: 402,
  token_exhausted: 402,
  spend_cap_exceeded: 402,
};

const AGENT_REJECT_STATUS: Record<AgentRejectReason, number> = {
  AGENT_NOT_FOUND: 404,
  AGENT_TOKEN_MISMATCH: 403,
  AGENT_PAUSED: 403,
  AGENT_REVOKED: 403,
};

export async function preflight(args: {
  sellerKey: SellerKeyRow;
  payToken: string; // buyer Pay Token JWT
  amount?: number; // optional; server price is authoritative
  idempotencyKey: string;
  toolName?: string | null;
}): Promise<PreflightResult> {
  const { sellerKey, payToken, idempotencyKey, toolName } = args;

  // 1. Verify the buyer Pay Token signature.
  const claims = await verifyPayToken(payToken);
  if (!claims) return { allowed: false, reason: "invalid_token", status: 401 };

  // 2. Scope: the token MUST be for this seller key's endpoint AND owner.
  if (claims.sub !== sellerKey.endpoint_id || claims.own !== sellerKey.owner_id) {
    return { allowed: false, reason: "token_endpoint_mismatch", status: 403 };
  }

  // 3. Load the endpoint → authoritative price + status.
  const eps = await sql()<EndpointRow[]>`select * from lc_endpoints where id = ${sellerKey.endpoint_id} limit 1`;
  if (eps.length === 0) return { allowed: false, reason: "endpoint_not_found", status: 404 };
  const ep = eps[0];
  if (ep.status !== "live") return { allowed: false, reason: "endpoint_paused", status: 503 };
  const charge = Number(ep.price_per_call);

  // Server price is authoritative; if the caller asserted an amount it must match.
  if (typeof args.amount === "number" && Math.abs(args.amount - charge) > 1e-9) {
    return { allowed: false, reason: "amount_mismatch", status: 400 };
  }

  // 4. Idempotency: a repeat of the same (seller key, idempotencyKey) returns
  //    the existing reservation rather than reserving twice.
  const existing = await sql()<{ id: string; status: string; amount: string }[]>`
    select id, status, amount::text as amount from lc_sdk_charges
    where seller_key_id = ${sellerKey.id} and idempotency_key = ${idempotencyKey} limit 1
  `;
  if (existing.length > 0) {
    const e = existing[0];
    if (e.status === "reserved" || e.status === "charged") {
      const remaining = await tokenRemaining(claims.jti);
      return { allowed: true, chargeId: e.id, currency: "usd", required: Number(e.amount), remaining, alreadyReserved: true };
    }
    // canceled/expired → fall through and re-reserve under a fresh row id below
  }

  // 5. Release any stale reservations on this token before checking headroom.
  await expireStaleReservations(claims.jti);

  // 6. Load token + pure spendability check (shared with the gateway).
  const toks = await sql()<PayTokenRow[]>`select * from lc_pay_tokens where id = ${claims.jti} limit 1`;
  if (toks.length === 0) return { allowed: false, reason: "invalid_token", status: 401 };
  const tok = toks[0];

  // Agent Identity kill switch — bound token's agent must be usable.
  const agentCheck = await checkAgentForToken(tok);
  if (!agentCheck.ok) return { allowed: false, reason: agentCheck.reason, status: AGENT_REJECT_STATUS[agentCheck.reason] };

  const spend = checkTokenSpendable(tok, charge, Date.now());
  if (!spend.ok) return { allowed: false, reason: spend.reason, status: REJECT_STATUS[spend.reason] };

  // 7. Rate limit (same trailing-60s window as the gateway).
  if (await isRateLimited(ep.id, ep.rate_limit)) {
    return { allowed: false, reason: "rate_limit_exceeded", status: 429 };
  }

  // 8. RESERVE atomically: debit budget + a call under a compare-and-set so two
  //    concurrent preflights can't both pass the headroom check (hazard #1).
  const reserved = await sql()<{ id: string }[]>`
    update lc_pay_tokens
       set spent = spent + ${charge}, calls_used = calls_used + 1,
           status = case when calls_used + 1 >= max_calls then 'exhausted' else status end
     where id = ${tok.id}
       and status = 'active'
       and spent + ${charge} <= budget
       and calls_used < max_calls
    returning id
  `;
  if (reserved.length === 0) {
    // Lost the race / just crossed a cap.
    return { allowed: false, reason: "spend_cap_exceeded", status: 402 };
  }

  const chargeId = `chg_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const reservedUntil = new Date(Date.now() + RESERVE_TTL_MS).toISOString();
  await sql()`
    insert into lc_sdk_charges
      (id, idempotency_key, seller_key_id, endpoint_id, pay_token_id, owner_id, amount, status, reserved_until, tool_name, agent_id)
    values
      (${chargeId}, ${idempotencyKey}, ${sellerKey.id}, ${ep.id}, ${tok.id}, ${ep.owner_id}, ${charge}, 'reserved', ${reservedUntil}, ${toolName ?? null}, ${tok.agent_id ?? null})
  `;

  const remaining = await tokenRemaining(tok.id);
  return { allowed: true, chargeId, currency: "usd", required: charge, remaining };
}

/* ──────────────── charge (confirm or cancel) ──────────────── */

export type ChargeOutcome =
  | { ok: true; charged: number; remaining: number; chargeRef: string; settled: boolean }
  | { ok: false; error: string; status: number };

export async function settleCharge(args: {
  sellerKey: SellerKeyRow;
  chargeId: string;
  success: boolean;
}): Promise<ChargeOutcome> {
  const { sellerKey, chargeId, success } = args;

  const rows = await sql()<{
    id: string; seller_key_id: string; endpoint_id: string; pay_token_id: string;
    owner_id: string; amount: string; status: string; charge_ref: string | null; agent_id: string | null;
  }[]>`select * from lc_sdk_charges where id = ${chargeId} limit 1`;
  if (rows.length === 0) return { ok: false, error: "charge_not_found", status: 404 };
  const c = rows[0];

  // Must belong to the authenticating seller key.
  if (c.seller_key_id !== sellerKey.id) return { ok: false, error: "charge_not_owned", status: 403 };

  const amount = Number(c.amount);

  // Idempotent terminal states: re-confirm / re-cancel is a no-op that echoes.
  if (c.status === "charged") {
    const remaining = await tokenRemaining(c.pay_token_id);
    return { ok: true, charged: amount, remaining, chargeRef: c.charge_ref ?? chargeId, settled: true };
  }
  if (c.status === "canceled" || c.status === "expired") {
    const remaining = await tokenRemaining(c.pay_token_id);
    return { ok: true, charged: 0, remaining, chargeRef: c.charge_ref ?? chargeId, settled: false };
  }
  // status === 'reserved' from here.

  if (success) {
    // CONFIRM: budget was already debited at reserve; just record earnings.
    const inFree = await isOwnerInFreeTier(c.owner_id);
    const { fee, net } = computeFee(amount, inFree);
    const chargeRef = `sdk_${chargeId}`;
    await Promise.all([
      sql()`
        insert into lc_test_runs (endpoint_id, pay_token_id, owner_id, gross, fee, net, upstream_status, upstream_ms, agent_id)
        values (${c.endpoint_id}, ${c.pay_token_id}, ${c.owner_id}, ${amount}, ${fee}, ${net}, 200, null, ${c.agent_id ?? null})
      `,
      sql()`update lc_sdk_charges set status = 'charged', charge_ref = ${chargeRef} where id = ${chargeId} and status = 'reserved'`,
    ]);
    const remaining = await tokenRemaining(c.pay_token_id);
    return { ok: true, charged: amount, remaining, chargeRef, settled: true };
  }

  // CANCEL: refund the reservation (no earnings row) — a failed tool isn't charged.
  await sql()`
    update lc_pay_tokens
       set spent = greatest(0, spent - ${amount}),
           calls_used = greatest(0, calls_used - 1),
           status = case when status in ('exhausted','expired') then 'active' else status end
     where id = ${c.pay_token_id}
  `;
  await sql()`update lc_sdk_charges set status = 'canceled' where id = ${chargeId} and status = 'reserved'`;
  const remaining = await tokenRemaining(c.pay_token_id);
  return { ok: true, charged: 0, remaining, chargeRef: chargeId, settled: false };
}

/* ──────────────── helpers ──────────────── */

async function tokenRemaining(payTokenId: string): Promise<number> {
  const r = await sql()<{ budget: string; spent: string }[]>`
    select budget::text as budget, spent::text as spent from lc_pay_tokens where id = ${payTokenId} limit 1
  `;
  if (r.length === 0) return 0;
  return Math.max(0, Number(r[0].budget) - Number(r[0].spent));
}
