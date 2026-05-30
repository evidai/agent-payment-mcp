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

-- ───────────────────────────────────────────────────────────────────────
-- Phase 1: Stripe Connect Express
-- ───────────────────────────────────────────────────────────────────────

alter table lc_owners add column if not exists stripe_account_id text;
alter table lc_owners add column if not exists stripe_charges_enabled boolean not null default false;
alter table lc_owners add column if not exists stripe_payouts_enabled boolean not null default false;
alter table lc_owners add column if not exists stripe_details_submitted boolean not null default false;
alter table lc_owners add column if not exists stripe_country text;
create unique index if not exists lc_owners_stripe_account_unq on lc_owners(stripe_account_id) where stripe_account_id is not null;

-- We bypass RLS on the server using SUPABASE_SERVICE_KEY. If you want to
-- expose anon-key reads from the browser later, add RLS policies that
-- match owner_id against a header / auth claim. For now, server-only.

-- ───────────────────────────────────────────────────────────────────────
-- Phase 2: buyer prepaid bundles (Stripe Direct Charge → Pay Token)
-- A buyer pays on /buy/[shortId]; we mint ONE Pay Token whose budget == the
-- amount paid (the 3% platform fee is taken once at Checkout, not per call).
-- Idempotency is keyed by the Stripe Checkout Session id so the success-page
-- fetch and the webhook can't double-mint.
-- ───────────────────────────────────────────────────────────────────────

alter table lc_pay_tokens add column if not exists stripe_checkout_session_id text;
alter table lc_pay_tokens add column if not exists buyer_email text;
create unique index if not exists lc_pay_tokens_session_unq
  on lc_pay_tokens(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

-- ───────────────────────────────────────────────────────────────────────
-- Phase 3: social sign-in (Google / GitHub OAuth)
-- Self-hosted OAuth 2.0 Authorization Code flow. A social sign-in resolves
-- to the SAME lc_owners row model as the email magic-link: an identity is
-- recorded here so a returning user lands on their existing workspace no
-- matter which provider (or magic link) they use. Owner email/cookie logic
-- is unchanged — this table just maps (provider, subject) → owner_id.
-- ───────────────────────────────────────────────────────────────────────

create table if not exists lc_oauth_identities (
  provider    text not null,            -- 'google' | 'github'
  subject     text not null,            -- provider's stable user id (Google sub / GitHub numeric id)
  owner_id    text not null references lc_owners(id) on delete cascade,
  email       text,                     -- email seen at sign-in (may be unverified / null)
  created_at  timestamptz not null default now(),
  primary key (provider, subject)
);
create index if not exists lc_oauth_identities_owner_idx on lc_oauth_identities(owner_id);

-- ───────────────────────────────────────────────────────────────────────
-- Phase 4: Developer Growth Loop
-- Public API pages (/api/[slug]), README badges (/badge/[apiId].svg),
-- a LemonCake Directory, and share/analytics events. These columns are
-- ALSO applied lazily from the server (ensureGrowthSchema in lc-backend.ts),
-- so a fresh deploy works even before this file is re-run in Supabase.
-- ───────────────────────────────────────────────────────────────────────

-- Public-page / sharing metadata on each endpoint.
alter table lc_endpoints add column if not exists public_slug         text;
alter table lc_endpoints add column if not exists public_title        text;
alter table lc_endpoints add column if not exists public_description  text;
alter table lc_endpoints add column if not exists category            text;
alter table lc_endpoints add column if not exists seller_display_name text;
alter table lc_endpoints add column if not exists public_page_enabled boolean not null default true;
alter table lc_endpoints add column if not exists badge_enabled       boolean not null default true;
alter table lc_endpoints add column if not exists directory_status    text not null default 'none';
alter table lc_endpoints add column if not exists share_count         int  not null default 0;
alter table lc_endpoints add column if not exists public_page_views   int  not null default 0;
-- public_slug is the human-readable handle in /api/<slug>; globally unique.
create unique index if not exists lc_endpoints_public_slug_unq
  on lc_endpoints(public_slug) where public_slug is not null;

-- One directory submission per endpoint. Admin flips status to approved.
create table if not exists lc_directory_submissions (
  id           uuid primary key default gen_random_uuid(),
  endpoint_id  uuid not null unique references lc_endpoints(id) on delete cascade,
  owner_id     text not null references lc_owners(id) on delete cascade,
  category     text not null,
  description  text,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at  timestamptz,
  reviewed_by  text
);
create index if not exists lc_directory_submissions_status_idx on lc_directory_submissions(status);

-- Share / growth analytics. share_type is a free-text event name; the app
-- writes: copy_gateway_url, copy_curl, copy_readme_badge, copy_x_post,
-- copy_docs_snippet, copy_mcp_listing, view_public_page, submit_directory,
-- click_try_demo_from_public_page, click_create_own_api_from_public_page.
create table if not exists lc_share_events (
  id          uuid primary key default gen_random_uuid(),
  endpoint_id uuid references lc_endpoints(id) on delete cascade,
  owner_id    text,
  share_type  text not null,
  created_at  timestamptz not null default now()
);
create index if not exists lc_share_events_endpoint_idx on lc_share_events(endpoint_id, created_at desc);
create index if not exists lc_share_events_type_idx on lc_share_events(share_type, created_at desc);

-- ───────────────────────────────────────────────────────────────────────
-- Phase 5: provider usage billing (Pattern 4)
-- A SaaS gateway-usage fee charged to the PROVIDER (lc_owner): the first
-- FREE_CALLS_PER_MONTH (3,000) metered gateway calls per owner per UTC month
-- are free, then a small per-call overage (default $0.001/call, env
-- LC_OVERAGE_RATE_USD) is invoiced via Stripe by a month-end Vercel cron
-- (/api/lc/billing/rollup). This is DISTINCT from the 3% buyer take-rate
-- collected at prepaid Stripe Connect checkout (lc_test_runs.fee) — we never
-- re-bill that fee here, or buyers would be double-charged.
--
-- These columns/tables are ALSO applied lazily from the server
-- (ensureBillingSchema in lc-billing.ts), so a fresh deploy works even before
-- this file is re-run in Supabase. Every statement is idempotent.
-- ───────────────────────────────────────────────────────────────────────

-- Provider-as-payer Stripe state on each owner. Distinct from the
-- stripe_account_id (Connect, seller-RECEIVES) columns: stripe_customer_id is
-- the platform Customer whose saved card LemonCake CHARGES for overage.
alter table lc_owners add column if not exists stripe_customer_id   text;
alter table lc_owners add column if not exists billing_status       text not null default 'none';
alter table lc_owners add column if not exists billing_method_saved boolean not null default false;
alter table lc_owners add column if not exists billing_setup_at      timestamptz;
create unique index if not exists lc_owners_stripe_customer_unq
  on lc_owners(stripe_customer_id) where stripe_customer_id is not null;

-- One billing run per owner per month (period_start). Idempotent upsert keyed
-- (owner_id, period_start) so a cron retry never double-charges. status:
-- pending → invoiced → paid (via webhook), or skipped_no_method / failed / error.
create table if not exists lc_billing_runs (
  id                uuid primary key default gen_random_uuid(),
  owner_id          text not null references lc_owners(id) on delete cascade,
  period_start      date not null,
  period_end        date not null,
  calls             int not null default 0,
  free_calls        int not null default 0,
  billable_calls    int not null default 0,
  rate_usd          numeric(12,6) not null default 0,
  amount_usd        numeric(12,6) not null default 0,
  stripe_invoice_id text,
  status            text not null default 'pending',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index if not exists lc_billing_runs_owner_period_unq on lc_billing_runs(owner_id, period_start);
create index if not exists lc_billing_runs_owner_idx on lc_billing_runs(owner_id, period_start desc);
create index if not exists lc_billing_runs_invoice_idx on lc_billing_runs(stripe_invoice_id) where stripe_invoice_id is not null;
