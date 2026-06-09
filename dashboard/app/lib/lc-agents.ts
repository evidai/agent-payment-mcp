/**
 * lc-agents.ts — Agent Identity (thin layer).
 *
 * A first-class "Agent" entity layered ON TOP of the existing Pay Token /
 * gateway / charge stack — NOT a new balance pool. An Agent owns nothing
 * custodial: its "budget" is just the sum of the spend-capped Pay Tokens bound
 * to it (custody-free, same as the Wallet view). Binding a Pay Token to an
 * agent_id gives per-agent: attribution (charges/usage carry agent_id),
 * spend rollup, and a kill switch (pause / revoke stops the token at the
 * gateway). Price/amount stays server-authoritative — agents change nothing
 * about how money is computed.
 */

import { sql, sanitizeSlug, shortId, type PayTokenRow } from "@/lib/lc-backend";

/* ──────────────── lazy schema ──────────────── */

const AGENTS_DDL = `
create table if not exists lc_agents (
  agent_id        text primary key,
  owner_id        text not null references lc_owners(id) on delete cascade,
  organization_id text,
  display_name    text not null,
  description     text,
  agent_type      text,
  status          text not null default 'active',
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
)
create index if not exists lc_agents_owner_idx on lc_agents(owner_id)
create table if not exists lc_audit_logs (
  id         uuid primary key default gen_random_uuid(),
  owner_id   text not null,
  agent_id   text,
  action     text not null,
  detail     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
)
create index if not exists lc_audit_logs_owner_idx on lc_audit_logs(owner_id, created_at desc)
alter table lc_pay_tokens add column if not exists agent_id text
alter table lc_test_runs  add column if not exists agent_id text
`;
// NOTE: lc_sdk_charges.agent_id is owned by lc-sdk.ts (ensureSdkSchema) to avoid
// a circular import — lc-sdk imports checkAgentForToken from here.

let _agentIdSchemaReady: Promise<void> | null = null;

/** Apply the Agent-Identity DDL once per warm instance (idempotent, gated). */
export function ensureAgentIdentitySchema(): Promise<void> {
  if (!_agentIdSchemaReady) {
    _agentIdSchemaReady = (async () => {
      try {
        const probe = await sql()<{ ready: boolean }[]>`
          select (
            exists(select 1 from information_schema.tables where table_name = 'lc_agents')
            and exists(select 1 from information_schema.columns
                       where table_name = 'lc_pay_tokens' and column_name = 'agent_id')
          ) as ready
        `;
        if (probe[0]?.ready) return;
        const statements = AGENTS_DDL.split("\n").join(" ").split(/(?<=\))\s+(?=create|alter)|(?<=text)\s+(?=alter)/i);
        for (const stmt of statements) {
          const s = stmt.trim();
          if (s) await sql().unsafe(s);
        }
      } catch (err) {
        _agentIdSchemaReady = null;
        throw err;
      }
    })();
  }
  return _agentIdSchemaReady;
}

/* ──────────────── types ──────────────── */

export type AgentStatus = "active" | "paused" | "revoked";

export type AgentRow = {
  agent_id: string;
  owner_id: string;
  organization_id: string | null;
  display_name: string;
  description: string | null;
  agent_type: string | null;
  status: AgentStatus;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export type AgentSummary = {
  agentId: string;
  displayName: string;
  description: string | null;
  agentType: string | null;
  status: AgentStatus;
  organizationId: string | null;
  tokenCount: number;
  totalBudget: number;
  totalSpent: number;
  remaining: number;
  totalCalls: number;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

/* ──────────────── id generation ──────────────── */

/** Build a globally-unique agent_id from a handle or display name. */
async function newAgentId(handle: string | undefined, displayName: string): Promise<string> {
  const root = sanitizeSlug(handle || displayName) || "agent";
  // Try the bare slug first, then suffix to guarantee global uniqueness.
  for (const candidate of [root, ...Array.from({ length: 5 }, () => `${root}-${shortId().slice(0, 6)}`)]) {
    const hit = await sql()<{ one: number }[]>`select 1 as one from lc_agents where agent_id = ${candidate} limit 1`;
    if (hit.length === 0) return candidate;
  }
  return `${root}-${shortId()}`;
}

/* ──────────────── audit ──────────────── */

export async function logAudit(ownerId: string, agentId: string | null, action: string, detail: Record<string, unknown> = {}): Promise<void> {
  try {
    await sql()`
      insert into lc_audit_logs (owner_id, agent_id, action, detail)
      values (${ownerId}, ${agentId}, ${action}, ${JSON.stringify(detail)}::jsonb)
    `;
  } catch { /* audit is best-effort, never block the action */ }
}

/* ──────────────── CRUD ──────────────── */

export async function createAgent(args: {
  ownerId: string;
  displayName: string;
  description?: string | null;
  agentType?: string | null;
  organizationId?: string | null;
  handle?: string | null;
}): Promise<AgentRow> {
  const { ownerId, displayName, description = null, agentType = null, organizationId = null, handle } = args;
  const agentId = await newAgentId(handle ?? undefined, displayName);
  const [row] = await sql()<AgentRow[]>`
    insert into lc_agents (agent_id, owner_id, organization_id, display_name, description, agent_type, status)
    values (${agentId}, ${ownerId}, ${organizationId}, ${displayName}, ${description}, ${agentType}, 'active')
    returning *
  `;
  await logAudit(ownerId, agentId, "agent.create", { displayName });
  return row;
}

export async function getAgent(ownerId: string, agentId: string): Promise<AgentRow | null> {
  const rows = await sql()<AgentRow[]>`
    select * from lc_agents where agent_id = ${agentId} and owner_id = ${ownerId} limit 1
  `;
  return rows[0] ?? null;
}

/** List an owner's agents with a custody-free spend rollup (Σ bound Pay Tokens). */
export async function listAgents(ownerId: string): Promise<AgentSummary[]> {
  const rows = await sql()<{
    agent_id: string; display_name: string; description: string | null; agent_type: string | null;
    status: AgentStatus; organization_id: string | null; created_at: Date; updated_at: Date;
    token_count: string; total_budget: string; total_spent: string; total_calls: string; last_used: Date | null;
  }[]>`
    select a.agent_id, a.display_name, a.description, a.agent_type, a.status, a.organization_id,
           a.created_at, a.updated_at,
           coalesce(pt.token_count, 0) as token_count,
           coalesce(pt.total_budget, 0) as total_budget,
           coalesce(pt.total_spent, 0)  as total_spent,
           coalesce(pt.total_calls, 0)  as total_calls,
           tr.last_used
    from lc_agents a
    left join (
      select agent_id, count(*) as token_count, sum(budget) as total_budget,
             sum(spent) as total_spent, sum(calls_used) as total_calls
      from lc_pay_tokens where owner_id = ${ownerId} and agent_id is not null
      group by agent_id
    ) pt on pt.agent_id = a.agent_id
    left join (
      select agent_id, max(at) as last_used
      from lc_test_runs where owner_id = ${ownerId} and agent_id is not null
      group by agent_id
    ) tr on tr.agent_id = a.agent_id
    where a.owner_id = ${ownerId}
    order by a.created_at desc
    limit 200
  `;
  return rows.map((r) => {
    const totalBudget = Number(r.total_budget);
    const totalSpent = Number(r.total_spent);
    return {
      agentId: r.agent_id, displayName: r.display_name, description: r.description, agentType: r.agent_type,
      status: r.status, organizationId: r.organization_id,
      tokenCount: Number(r.token_count), totalBudget, totalSpent,
      remaining: Math.max(0, totalBudget - totalSpent), totalCalls: Number(r.total_calls),
      lastUsedAt: r.last_used, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  });
}

export async function updateAgent(ownerId: string, agentId: string, patch: {
  displayName?: string; description?: string | null; status?: AgentStatus;
}): Promise<AgentRow | null> {
  if (patch.status && !["active", "paused", "revoked"].includes(patch.status)) return null;
  const rows = await sql()<AgentRow[]>`
    update lc_agents set
      display_name = coalesce(${patch.displayName ?? null}, display_name),
      description  = case when ${patch.description !== undefined} then ${patch.description ?? null} else description end,
      status       = coalesce(${patch.status ?? null}, status),
      updated_at   = now()
    where agent_id = ${agentId} and owner_id = ${ownerId}
    returning *
  `;
  if (rows[0] && patch.status) await logAudit(ownerId, agentId, `agent.${patch.status}`, {});
  else if (rows[0]) await logAudit(ownerId, agentId, "agent.update", { fields: Object.keys(patch) });
  return rows[0] ?? null;
}

/** Set status (pause/resume/revoke). Returns null if the owner doesn't own it. */
export async function setAgentStatus(ownerId: string, agentId: string, status: AgentStatus): Promise<AgentRow | null> {
  const rows = await sql()<AgentRow[]>`
    update lc_agents set status = ${status}, updated_at = now()
    where agent_id = ${agentId} and owner_id = ${ownerId}
    returning *
  `;
  if (rows[0]) await logAudit(ownerId, agentId, `agent.${status}`, {});
  return rows[0] ?? null;
}

/* ──────────────── gateway / preflight check ──────────────── */

export type AgentRejectReason = "AGENT_NOT_FOUND" | "AGENT_TOKEN_MISMATCH" | "AGENT_PAUSED" | "AGENT_REVOKED";
export type AgentCheck = { ok: true } | { ok: false; reason: AgentRejectReason };

/**
 * If a Pay Token is bound to an agent, verify the agent is usable. No-op for
 * unbound tokens. Called by /g and /api/sdk/preflight before charging.
 */
export async function checkAgentForToken(tok: { agent_id?: string | null; owner_id: string }): Promise<AgentCheck> {
  const agentId = tok.agent_id;
  if (!agentId) return { ok: true };
  const rows = await sql()<{ owner_id: string; status: AgentStatus }[]>`
    select owner_id, status from lc_agents where agent_id = ${agentId} limit 1
  `;
  if (rows.length === 0) return { ok: false, reason: "AGENT_NOT_FOUND" };
  if (rows[0].owner_id !== tok.owner_id) return { ok: false, reason: "AGENT_TOKEN_MISMATCH" };
  if (rows[0].status === "paused") return { ok: false, reason: "AGENT_PAUSED" };
  if (rows[0].status === "revoked") return { ok: false, reason: "AGENT_REVOKED" };
  return { ok: true };
}

/** Validate that `agentId` is an active/paused (not revoked) agent the owner owns — for Pay Token issuance binding. */
export async function assertAgentBindable(ownerId: string, agentId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await getAgent(ownerId, agentId);
  if (!a) return { ok: false, error: "agent_not_found" };
  if (a.status === "revoked") return { ok: false, error: "agent_revoked" };
  return { ok: true };
}

export type { PayTokenRow };
