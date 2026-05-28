-- LemonCake backend schema
-- Run this in Supabase SQL editor (Database → SQL Editor → New query → paste → Run).
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- Owners: anonymous IDs persisted in localStorage. No real auth yet.
-- A row is created lazily the first time an owner submits anything.
create table if not exists lc_owners (
  id           text primary key,
  created_at   timestamptz not null default now()
);

create table if not exists lc_endpoints (
  id            uuid primary key default gen_random_uuid(),
  short_id      text not null unique,
  owner_id      text not null references lc_owners(id) on delete cascade,
  name          text not null,
  slug          text not null,
  original_url  text not null,
  upstream_auth text,
  price_per_call numeric(12, 6) not null,
  token_budget   numeric(12, 6) not null,
  rate_limit     int not null,
  status         text not null default 'live' check (status in ('live', 'paused')),
  created_at     timestamptz not null default now(),
  unique (owner_id, slug)
);
create index if not exists lc_endpoints_owner_idx on lc_endpoints(owner_id);

create table if not exists lc_pay_tokens (
  id           text primary key,                 -- "pt_xxx", also used as JWT jti
  endpoint_id  uuid not null references lc_endpoints(id) on delete cascade,
  owner_id     text not null references lc_owners(id) on delete cascade,
  budget       numeric(12, 6) not null,
  spent        numeric(12, 6) not null default 0,
  max_calls    int not null,
  calls_used   int not null default 0,
  expires_at   timestamptz not null,
  status       text not null default 'active' check (status in ('active', 'expired', 'exhausted', 'revoked')),
  issued_at    timestamptz not null default now()
);
create index if not exists lc_pay_tokens_endpoint_idx on lc_pay_tokens(endpoint_id);
create index if not exists lc_pay_tokens_owner_idx on lc_pay_tokens(owner_id);

create table if not exists lc_test_runs (
  id            uuid primary key default gen_random_uuid(),
  endpoint_id   uuid not null references lc_endpoints(id) on delete cascade,
  pay_token_id  text not null,
  owner_id      text not null references lc_owners(id) on delete cascade,
  gross         numeric(12, 6) not null,
  fee           numeric(12, 6) not null,
  net           numeric(12, 6) not null,
  upstream_status int,
  upstream_ms    int,
  at            timestamptz not null default now()
);
create index if not exists lc_test_runs_owner_idx on lc_test_runs(owner_id, at desc);
create index if not exists lc_test_runs_endpoint_idx on lc_test_runs(endpoint_id, at desc);

create table if not exists lc_blocked (
  id            uuid primary key default gen_random_uuid(),
  endpoint_id   uuid not null references lc_endpoints(id) on delete cascade,
  pay_token_id  text,
  owner_id      text not null references lc_owners(id) on delete cascade,
  reason        text not null check (reason in ('rate_limit_exceeded', 'spend_cap_exceeded', 'token_expired', 'token_revoked', 'endpoint_paused', 'upstream_error')),
  attempted     numeric(12, 6) not null,
  at            timestamptz not null default now()
);
create index if not exists lc_blocked_owner_idx on lc_blocked(owner_id, at desc);

-- ───────────────────────────────────────────────────────────────────────
-- Phase 0a: email magic-link auth (Stripe Connect prereq)
-- ───────────────────────────────────────────────────────────────────────

alter table lc_owners add column if not exists email text;
alter table lc_owners add column if not exists email_verified_at timestamptz;
create unique index if not exists lc_owners_email_unq on lc_owners(email) where email is not null;

create table if not exists lc_magic_links (
  token         text primary key,
  email         text not null,
  prev_owner_id text references lc_owners(id) on delete set null,
  expires_at    timestamptz not null,
  used_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists lc_magic_links_email_idx on lc_magic_links(email);

-- We bypass RLS on the server using SUPABASE_SERVICE_KEY. If you want to
-- expose anon-key reads from the browser later, add RLS policies that
-- match owner_id against a header / auth claim. For now, server-only.
