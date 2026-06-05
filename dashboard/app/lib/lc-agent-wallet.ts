/**
 * lc-agent-wallet.ts — Agent Funding API, Phase 0 (mock currency).
 *
 * Closes the autonomous x402 loop WITHOUT touching real money:
 *
 *   Agent → 402 challenge → POST /api/lc/agent/tokens (mint) → Bearer <jwt> → pass
 *                         → POST /api/lc/agent/tokens/:id/topup (refill, same token)
 *
 * Design seams baked in so later phases cost almost nothing:
 *   • PaymentAdapter — StubAdapter now; a StripeOffSessionAdapter slots in for
 *     Phase 1 (real off-session card charge) behind the SAME interface. No real
 *     charging code lives here yet.
 *   • Token strategy — v1 KEEPS the same Pay Token on top-up (budget refilled)
 *     and ALWAYS returns the token to use, so switching to a rolling/rotating
 *     token later is a zero-change for agents that use the returned value.
 *   • Buyer Key provisioning — a single path (issueBuyerKey) that a future
 *     one-click "approve $X for this seller" UI can call unchanged.
 *
 * Custody-free: there is NO pooled balance. "Wallet balance" is virtual = the
 * sum of unspent Pay Tokens. Each mint/top-up is its own charge (Direct Charge
 * to the seller in Phase 1); the platform never holds buyer funds.
 */

import {
  sql,
  signPayToken,
  type PayTokenRow,
} from "@/lib/lc-backend";
import { mintPrepaidToken } from "@/lib/lc-credits";
import { StripeOffSessionAdapter } from "@/lib/lc-agent-stripe";

const MAX_INT4 = 2_000_000_000;
const PREPAID_TOKEN_DAYS = 365;

/* ──────────────── lazy schema (mirrors ensureGrowthSchema) ──────────────── */

const AGENT_DDL = `
create table if not exists lc_wallets (
  id                 text primary key,
  workspace_id       text not null unique references lc_owners(id) on delete cascade,
  per_mint_cap_cents int  not null default 500,
  daily_cap_cents    int  not null default 5000,
  monthly_cap_cents  int  not null default 30000,
  low_threshold_pct  int  not null default 20,
  status             text not null default 'active',
  created_at         timestamptz not null default now()
)
create table if not exists lc_buyer_keys (
  id                 text primary key,
  key_hash           text not null unique,
  key_prefix         text not null,
  wallet_id          text not null references lc_wallets(id) on delete cascade,
  workspace_id       text not null references lc_owners(id) on delete cascade,
  endpoint_id        uuid not null references lc_endpoints(id) on delete cascade,
  seller_owner_id    text not null references lc_owners(id) on delete cascade,
  label              text,
  stripe_customer_id text,
  stripe_pm_id       text,
  status             text not null default 'active',
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz
)
create index if not exists lc_buyer_keys_wallet_idx on lc_buyer_keys(wallet_id)
create table if not exists lc_agent_charges (
  id            uuid primary key default gen_random_uuid(),
  charge_ref    text not null unique,
  buyer_key_id  text references lc_buyer_keys(id) on delete set null,
  wallet_id     text references lc_wallets(id) on delete cascade,
  token_id      text,
  endpoint_id   uuid,
  amount_cents  int  not null,
  kind          text not null,
  adapter       text not null default 'stub',
  created_at    timestamptz not null default now()
)
create index if not exists lc_agent_charges_wallet_time_idx on lc_agent_charges(wallet_id, created_at desc)
alter table lc_pay_tokens add column if not exists buyer_key_id text
`;

let _agentSchemaReady: Promise<void> | null = null;

/** Apply the Agent-Funding DDL once per warm instance (idempotent, gated). */
export function ensureAgentSchema(): Promise<void> {
  if (!_agentSchemaReady) {
    _agentSchemaReady = (async () => {
      try {
        // Fast path: skip the DDL once applied so we don't flood NOTICE logs.
        const probe = await sql()<{ ready: boolean }[]>`
          select (
            exists(select 1 from information_schema.tables where table_name = 'lc_wallets')
            and exists(select 1 from information_schema.columns
                       where table_name = 'lc_pay_tokens' and column_name = 'buyer_key_id')
          ) as ready
        `;
        if (probe[0]?.ready) return;
        // Statements are newline-separated, no embedded semicolons — same trick
        // as GROWTH_DDL. pgbouncer can't run multi-statement strings.
        const statements = AGENT_DDL.split("\n").join(" ").split(/(?<=\))\s+(?=create|alter)/i);
        for (const stmt of statements) {
          const s = stmt.trim();
          if (s) await sql().unsafe(s);
        }
      } catch (err) {
        _agentSchemaReady = null;
        throw err;
      }
    })();
  }
  return _agentSchemaReady;
}

/* ──────────────── PaymentAdapter (swap Stub → Stripe in Phase 1) ──────────────── */

export type ChargeArgs = {
  walletId: string;
  buyerKeyId: string;
  endpointId: string;
  sellerOwnerId: string;
  amountCents: number;
  idempotencyKey: string;
};
export type ChargeResult =
  | { ok: true; chargeRef: string; adapter: string }
  | { ok: false; error: string; requiresAction?: boolean };

export interface PaymentAdapter {
  readonly name: string;
  charge(args: ChargeArgs): Promise<ChargeResult>;
}

/**
 * Phase 0 mock currency. No real money moves. The chargeRef is derived from the
 * caller's idempotencyKey so repeated calls dedupe (mintPrepaidToken keys on it).
 */
export const StubAdapter: PaymentAdapter = {
  name: "stub",
  async charge({ idempotencyKey, buyerKeyId }) {
    return { ok: true, chargeRef: `stub_${buyerKeyId}_${idempotencyKey}`, adapter: "stub" };
  },
};

/**
 * Adapter selection. Default = Stub (mock currency). Set env
 * `LC_PAYMENT_ADAPTER=stripe` to switch to real off-session card charges
 * (Phase 1). Until that flag is set, nothing charges a real card — so this
 * file can ship/deploy with zero behaviour change.
 */
export function getPaymentAdapter(): PaymentAdapter {
  if (process.env.LC_PAYMENT_ADAPTER === "stripe") return StripeOffSessionAdapter;
  return StubAdapter;
}

/* ──────────────── Buyer Key crypto ──────────────── */

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function newBuyerKeySecret(): { key: string; prefix: string } {
  const rand = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
  const key = `bk_${rand.slice(0, 40)}`;
  return { key, prefix: `${key.slice(0, 11)}…` };
}

/* ──────────────── types ──────────────── */

export type WalletRow = {
  id: string;
  workspace_id: string;
  per_mint_cap_cents: number;
  daily_cap_cents: number;
  monthly_cap_cents: number;
  low_threshold_pct: number;
  status: "active" | "frozen";
};
export type BuyerKeyRow = {
  id: string;
  wallet_id: string;
  workspace_id: string;
  endpoint_id: string;
  seller_owner_id: string;
  status: "active" | "revoked";
};

/* ──────────────── provisioning (the single Buyer-Key path; seam ②) ──────────────── */

/**
 * Create (or reuse) the workspace's wallet and issue a Buyer Key scoped to one
 * seller endpoint. Returns the plaintext `bk_...` ONCE. A future "approve $X for
 * this seller" UI calls this same function — nothing else changes.
 */
export async function issueBuyerKey(args: {
  workspaceId: string;
  endpointShortId: string;
  label?: string | null;
  caps?: { perMintCents?: number; dailyCents?: number; monthlyCents?: number; lowThresholdPct?: number };
}): Promise<
  | { ok: true; key: string; prefix: string; walletId: string; endpointShortId: string; caps: { perMintCents: number; dailyCents: number; monthlyCents: number; lowThresholdPct: number } }
  | { ok: false; error: string }
> {
  const { workspaceId, endpointShortId, label, caps } = args;

  const eps = await sql()<{ id: string; owner_id: string }[]>`
    select id, owner_id from lc_endpoints where short_id = ${endpointShortId} limit 1
  `;
  if (eps.length === 0) return { ok: false, error: "endpoint_not_found" };
  const ep = eps[0];

  const walletId = `wlt_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const perMint = caps?.perMintCents ?? 500;
  const daily = caps?.dailyCents ?? 5000;
  const monthly = caps?.monthlyCents ?? 30000;
  const threshold = caps?.lowThresholdPct ?? 20;

  // One wallet per workspace. Insert-or-update caps.
  const wRows = await sql()<WalletRow[]>`
    insert into lc_wallets (id, workspace_id, per_mint_cap_cents, daily_cap_cents, monthly_cap_cents, low_threshold_pct)
    values (${walletId}, ${workspaceId}, ${perMint}, ${daily}, ${monthly}, ${threshold})
    on conflict (workspace_id) do update set
      per_mint_cap_cents = excluded.per_mint_cap_cents,
      daily_cap_cents    = excluded.daily_cap_cents,
      monthly_cap_cents  = excluded.monthly_cap_cents,
      low_threshold_pct  = excluded.low_threshold_pct
    returning *
  `;
  const wallet = wRows[0];

  const { key, prefix } = newBuyerKeySecret();
  const keyHash = await sha256hex(key);
  const keyId = `bk_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

  await sql()`
    insert into lc_buyer_keys
      (id, key_hash, key_prefix, wallet_id, workspace_id, endpoint_id, seller_owner_id, label)
    values
      (${keyId}, ${keyHash}, ${prefix}, ${wallet.id}, ${workspaceId}, ${ep.id}, ${ep.owner_id}, ${label ?? null})
  `;

  // Card inheritance — the buyer's saved card is a Customer+PM on the SELLER's
  // connected account, so it's reusable across every key for the same
  // (wallet, seller). Copy it onto the new key so a second endpoint from a
  // seller you've already funded works immediately — no re-entering the card
  // per key. (No-op when the wallet has no card yet for this seller.)
  await sql()`
    update lc_buyer_keys nk
       set stripe_customer_id = src.stripe_customer_id,
           stripe_pm_id       = src.stripe_pm_id
      from (
        select stripe_customer_id, stripe_pm_id
          from lc_buyer_keys
         where wallet_id = ${wallet.id}
           and seller_owner_id = ${ep.owner_id}
           and id <> ${keyId}
           and stripe_customer_id is not null
           and stripe_pm_id is not null
         order by last_used_at desc nulls last, created_at desc
         limit 1
      ) src
     where nk.id = ${keyId}
  `;

  return {
    ok: true,
    key,
    prefix,
    walletId: wallet.id,
    endpointShortId,
    caps: { perMintCents: wallet.per_mint_cap_cents, dailyCents: wallet.daily_cap_cents, monthlyCents: wallet.monthly_cap_cents, lowThresholdPct: wallet.low_threshold_pct },
  };
}

/** List a workspace's Buyer Keys (for the /app revoke UI). */
export async function listKeysForWorkspace(workspaceId: string): Promise<
  { id: string; prefix: string; endpointShortId: string; status: string; cardSaved: boolean; createdAt: Date; lastUsedAt: Date | null }[]
> {
  const rows = await sql()<{
    id: string; key_prefix: string; endpoint_short_id: string; status: string;
    has_card: boolean; created_at: Date; last_used_at: Date | null;
  }[]>`
    select k.id, k.key_prefix, e.short_id as endpoint_short_id, k.status,
           (k.stripe_pm_id is not null) as has_card, k.created_at, k.last_used_at
    from lc_buyer_keys k
    join lc_endpoints e on e.id = k.endpoint_id
    where k.workspace_id = ${workspaceId}
    order by k.created_at desc
    limit 50
  `;
  return rows.map((r) => ({
    id: r.id, prefix: r.key_prefix, endpointShortId: r.endpoint_short_id,
    status: r.status, cardSaved: r.has_card, createdAt: r.created_at, lastUsedAt: r.last_used_at,
  }));
}

/** Revoke a Buyer Key the workspace owns. Revoked keys fail auth immediately. */
export async function revokeKeyForWorkspace(
  workspaceId: string,
  keyId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await sql()<{ id: string }[]>`
    update lc_buyer_keys set status = 'revoked'
    where id = ${keyId} and workspace_id = ${workspaceId} and status = 'active'
    returning id
  `;
  if (r.length === 0) return { ok: false, error: "not_found_or_not_owner" };
  return { ok: true };
}

/** Resolve a `bk_...` bearer secret to its active key + wallet. */
export async function authBuyerKey(req: Request): Promise<{ key: BuyerKeyRow; wallet: WalletRow } | null> {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(bk_[A-Za-z0-9]+)\s*$/i);
  if (!m) return null;
  const keyHash = await sha256hex(m[1]);
  const rows = await sql()<{
    key_id: string;
    wallet_id: string;
    workspace_id: string;
    endpoint_id: string;
    seller_owner_id: string;
    key_status: string;
    per_mint_cap_cents: number;
    daily_cap_cents: number;
    monthly_cap_cents: number;
    low_threshold_pct: number;
    wallet_status: string;
  }[]>`
    select k.id as key_id, k.wallet_id, k.workspace_id, k.endpoint_id, k.seller_owner_id,
           k.status as key_status,
           w.per_mint_cap_cents, w.daily_cap_cents, w.monthly_cap_cents,
           w.low_threshold_pct, w.status as wallet_status
    from lc_buyer_keys k join lc_wallets w on w.id = k.wallet_id
    where k.key_hash = ${keyHash} limit 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  if (r.key_status !== "active" || r.wallet_status !== "active") return null;
  await sql()`update lc_buyer_keys set last_used_at = now() where id = ${r.key_id}`;
  return {
    key: { id: r.key_id, wallet_id: r.wallet_id, workspace_id: r.workspace_id, endpoint_id: r.endpoint_id, seller_owner_id: r.seller_owner_id, status: "active" },
    wallet: { id: r.wallet_id, workspace_id: r.workspace_id, per_mint_cap_cents: r.per_mint_cap_cents, daily_cap_cents: r.daily_cap_cents, monthly_cap_cents: r.monthly_cap_cents, low_threshold_pct: r.low_threshold_pct, status: "active" },
  };
}

/* ──────────────── caps (server-side hard backstop; ⑦) ──────────────── */

export type CapCheck = { ok: true } | { ok: false; error: "cap_exceeded"; cap: "per_mint" | "daily" | "monthly"; limitCents: number; wouldBeCents: number };

async function capsCheck(wallet: WalletRow, amountCents: number): Promise<CapCheck> {
  if (amountCents > wallet.per_mint_cap_cents) {
    return { ok: false, error: "cap_exceeded", cap: "per_mint", limitCents: wallet.per_mint_cap_cents, wouldBeCents: amountCents };
  }
  const dayStart = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const monStart = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const rows = await sql()<{ day: string; mon: string }[]>`
    select
      coalesce(sum(amount_cents) filter (where created_at >= ${dayStart}), 0)::text as day,
      coalesce(sum(amount_cents) filter (where created_at >= ${monStart}), 0)::text as mon
    from lc_agent_charges where wallet_id = ${wallet.id}
  `;
  const spentDay = Number(rows[0]?.day ?? 0);
  const spentMon = Number(rows[0]?.mon ?? 0);
  if (spentDay + amountCents > wallet.daily_cap_cents) {
    return { ok: false, error: "cap_exceeded", cap: "daily", limitCents: wallet.daily_cap_cents, wouldBeCents: spentDay + amountCents };
  }
  if (spentMon + amountCents > wallet.monthly_cap_cents) {
    return { ok: false, error: "cap_exceeded", cap: "monthly", limitCents: wallet.monthly_cap_cents, wouldBeCents: spentMon + amountCents };
  }
  return { ok: true };
}

/* ──────────────── virtual wallet balance (= Σ unspent tokens; no custody) ──────────────── */

export async function walletSummary(wallet: WalletRow): Promise<{
  balanceCents: number;
  activeTokens: number;
  spentTodayCents: number;
  spentMonthCents: number;
  caps: { perMintCents: number; dailyCents: number; monthlyCents: number };
  lowThresholdPct: number;
}> {
  const dayStart = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const monStart = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const bal = await sql()<{ cents: string; n: string }[]>`
    select coalesce(sum((budget - spent) * 100), 0)::text as cents, count(*)::text as n
    from lc_pay_tokens t
    join lc_buyer_keys k on k.id = t.buyer_key_id
    where k.wallet_id = ${wallet.id} and t.status = 'active'
  `;
  const win = await sql()<{ day: string; mon: string }[]>`
    select
      coalesce(sum(amount_cents) filter (where created_at >= ${dayStart}), 0)::text as day,
      coalesce(sum(amount_cents) filter (where created_at >= ${monStart}), 0)::text as mon
    from lc_agent_charges where wallet_id = ${wallet.id}
  `;
  return {
    balanceCents: Math.round(Number(bal[0]?.cents ?? 0)),
    activeTokens: Number(bal[0]?.n ?? 0),
    spentTodayCents: Number(win[0]?.day ?? 0),
    spentMonthCents: Number(win[0]?.mon ?? 0),
    caps: { perMintCents: wallet.per_mint_cap_cents, dailyCents: wallet.daily_cap_cents, monthlyCents: wallet.monthly_cap_cents },
    lowThresholdPct: wallet.low_threshold_pct,
  };
}

/* ──────────────── mint (new funded token) ──────────────── */

export type WalletMintResult =
  | { ok: true; jwt: string; row: PayTokenRow; chargeRef: string }
  | { ok: false; error: string; status: number; detail?: unknown };

export async function mintViaWallet(args: {
  key: BuyerKeyRow;
  wallet: WalletRow;
  endpointShortId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<WalletMintResult> {
  const { key, wallet, endpointShortId, amountCents, idempotencyKey } = args;
  if (!(amountCents > 0)) return { ok: false, error: "invalid_amount", status: 400 };
  if (!idempotencyKey) return { ok: false, error: "missing_idempotency_key", status: 400 };

  const eps = await sql()<{ id: string; owner_id: string }[]>`
    select id, owner_id from lc_endpoints where short_id = ${endpointShortId} limit 1
  `;
  if (eps.length === 0) return { ok: false, error: "endpoint_not_found", status: 404 };
  const ep = eps[0];
  if (ep.id !== key.endpoint_id) return { ok: false, error: "endpoint_out_of_scope", status: 403 };

  const caps = await capsCheck(wallet, amountCents);
  if (!caps.ok) return { ok: false, error: caps.error, status: 403, detail: caps };

  const adapter = getPaymentAdapter();
  const charged = await adapter.charge({ walletId: wallet.id, buyerKeyId: key.id, endpointId: ep.id, sellerOwnerId: ep.owner_id, amountCents, idempotencyKey });
  if (!charged.ok) return { ok: false, error: charged.error, status: 402 };

  // Idempotent token mint keyed on the charge ref (re-POST returns same token).
  const minted = await mintPrepaidToken({
    sessionId: charged.chargeRef,
    endpointId: ep.id,
    ownerId: ep.owner_id, // token.owner_id = seller (free-tier/revenue accounting), same as checkout path
    creditCents: amountCents,
    buyerEmail: null,
  });
  if (!minted.ok) return { ok: false, error: minted.error, status: 500 };

  await sql()`update lc_pay_tokens set buyer_key_id = ${key.id} where id = ${minted.row.id} and buyer_key_id is null`;
  await sql()`
    insert into lc_agent_charges (charge_ref, buyer_key_id, wallet_id, token_id, endpoint_id, amount_cents, kind, adapter)
    values (${charged.chargeRef}, ${key.id}, ${wallet.id}, ${minted.row.id}, ${ep.id}, ${amountCents}, 'mint', ${charged.adapter})
    on conflict (charge_ref) do nothing
  `;

  return { ok: true, jwt: minted.jwt, row: minted.row, chargeRef: charged.chargeRef };
}

/* ──────────────── top-up (same token; budget refilled; seam ①) ──────────────── */

export async function topupViaWallet(args: {
  key: BuyerKeyRow;
  wallet: WalletRow;
  tokenId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<WalletMintResult> {
  const { key, wallet, tokenId, amountCents, idempotencyKey } = args;
  if (!(amountCents > 0)) return { ok: false, error: "invalid_amount", status: 400 };
  if (!idempotencyKey) return { ok: false, error: "missing_idempotency_key", status: 400 };

  const rows = await sql()<PayTokenRow[]>`
    select * from lc_pay_tokens where id = ${tokenId} and buyer_key_id = ${key.id} limit 1
  `;
  if (rows.length === 0) return { ok: false, error: "token_not_found", status: 404 };
  let tok = rows[0];
  if (tok.status === "revoked") return { ok: false, error: "token_revoked", status: 403 };

  const adapter = getPaymentAdapter();
  const chargeRef = `stub_${key.id}_${idempotencyKey}`;
  // Idempotency: if this charge ref already applied, return current token unchanged.
  const seen = await sql()<{ id: string }[]>`select id from lc_agent_charges where charge_ref = ${chargeRef} limit 1`;
  if (seen.length > 0) {
    return { ok: true, jwt: await signFor(tok), row: tok, chargeRef };
  }

  const caps = await capsCheck(wallet, amountCents);
  if (!caps.ok) return { ok: false, error: caps.error, status: 403, detail: caps };

  const charged = await adapter.charge({ walletId: wallet.id, buyerKeyId: key.id, endpointId: tok.endpoint_id, sellerOwnerId: tok.owner_id, amountCents, idempotencyKey });
  if (!charged.ok) return { ok: false, error: charged.error, status: 402 };

  // Endpoint price → recompute max_calls headroom.
  const eps = await sql()<{ price_per_call: string }[]>`
    select price_per_call from lc_endpoints where id = ${tok.endpoint_id} limit 1
  `;
  const price = Number(eps[0]?.price_per_call ?? 0);
  const addBudget = amountCents / 100;
  const newBudget = Number(tok.budget) + addBudget;
  const newMaxCalls = price > 0 ? Math.min(MAX_INT4, Math.max(tok.max_calls, Math.floor(newBudget / price))) : MAX_INT4;
  const newExpiry = new Date(Date.now() + PREPAID_TOKEN_DAYS * 24 * 3600 * 1000).toISOString();

  const updated = await sql()<PayTokenRow[]>`
    update lc_pay_tokens
    set budget = ${newBudget}, max_calls = ${newMaxCalls},
        status = 'active', expires_at = ${newExpiry}
    where id = ${tok.id}
    returning *
  `;
  tok = updated[0];

  await sql()`
    insert into lc_agent_charges (charge_ref, buyer_key_id, wallet_id, token_id, endpoint_id, amount_cents, kind, adapter)
    values (${charged.chargeRef}, ${key.id}, ${wallet.id}, ${tok.id}, ${tok.endpoint_id}, ${amountCents}, 'topup', ${charged.adapter})
    on conflict (charge_ref) do nothing
  `;

  // Seam ①: always return the token to use (same JWT in v1; rotating later).
  return { ok: true, jwt: await signFor(tok), row: tok, chargeRef: charged.chargeRef };
}

/* Re-sign a JWT from a token row (HS256, deterministic — mirrors lc-credits). */
async function signFor(row: PayTokenRow): Promise<string> {
  return signPayToken({ jti: row.id, sub: row.endpoint_id, own: row.owner_id }, new Date(row.expires_at).getTime());
}

/** Shape a token row for API responses. */
export function tokenView(row: PayTokenRow) {
  return {
    id: row.id,
    budget: Number(row.budget),
    spent: Number(row.spent),
    remaining: Math.max(0, Number(row.budget) - Number(row.spent)),
    maxCalls: row.max_calls,
    callsUsed: row.calls_used,
    expiresAt: row.expires_at,
    status: row.status,
  };
}
