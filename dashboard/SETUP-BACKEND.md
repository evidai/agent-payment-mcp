# LemonCake backend setup — ~5 minutes

Wires `/app` and the real `/g/[shortId]` gateway to Postgres so every
endpoint, Pay Token, paid call, and block persists server-side.

Two paths:

- **A. Vercel Marketplace** (recommended, 5 min, no separate signup)
- **B. Standalone Supabase / Neon** (10 min, separate signup)

Either way you end up with the same outcome: `POSTGRES_URL` set in Vercel,
schema run, JWT secret added.

## A. Vercel Marketplace — Supabase or Neon

1. https://vercel.com → your project → **Storage** tab → **Create Database**
2. Pick **Supabase** (or Neon — both are Postgres, both work)
3. Walk through the wizard:
   - Region: Tokyo (closest to JP users; pick whatever's closest to you)
   - Prefix: `NEXT_PUBLIC_` (default)
   - Environments: Production + Preview + Development
4. Vercel auto-injects `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, plus the
   Supabase/Neon-specific keys.
5. Open the database dashboard from Vercel ("Open in Supabase" / "Open in
   Neon"), go to **SQL Editor**, paste the contents of
   `dashboard/db/schema.sql`, hit **Run**. Idempotent — safe to re-run.
6. Add one more env in Vercel for JWT signing:

   ```sh
   vercel env add LC_JWT_SECRET production
   # paste output of: openssl rand -hex 32
   # then add to preview + development too
   ```

7. Push (or `vercel --prod`) — Vercel auto-redeploys with the new env.

## B. Standalone Supabase

1. https://supabase.com → New project → save the DB password.
2. **Project Settings → API**, copy the **Project URL** and the
   **service_role secret**.
3. **SQL Editor → New query**, paste `dashboard/db/schema.sql`, Run.
4. Vercel env vars:

   ```sh
   vercel env add POSTGRES_URL               # use the connection string
                                              # from Supabase → Settings → Database
                                              # (the pooled URL, port 6543)
   vercel env add LC_JWT_SECRET              # openssl rand -hex 32
   ```

5. Redeploy.

## Verify

Visit https://www.lemoncake.xyz/app.

- If `/api/lc/health` returns `{ ready: true }`, the UI loads the real
  dashboard. Create an endpoint, issue a Pay Token, send a real request
  to `/g/<shortId>` — every action persists in Postgres.
- If env vars are missing, `/app` falls back to a setup banner pointing
  here.
