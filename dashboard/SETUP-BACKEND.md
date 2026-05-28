# LemonCake backend setup (Supabase) — 10 minutes

This wires `/app` and the real `/g/[shortId]` gateway to a Postgres
database so endpoints, Pay Tokens, paid calls, and blocked attempts
persist server-side instead of in localStorage.

## 1. Create a Supabase project

1. Go to https://supabase.com → sign in → **New project**
2. Name: `lemoncake` (or anything). Region: closest to your users.
3. Set a database password — **save it in 1Password**.
4. Wait ~2 min for provisioning.

## 2. Run the schema

1. Project dashboard → left sidebar → **Database → SQL Editor**
2. **New query** → paste the entire contents of `dashboard/db/schema.sql`
3. Hit **Run**. You should see "Success. No rows returned."

## 3. Grab the keys

1. Left sidebar → **Project Settings → API**
2. Copy the **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy the **`service_role` secret** (NOT the anon key — service_role bypasses RLS, used server-side only)

## 4. Set Vercel env vars

```
vercel env add SUPABASE_URL          # paste Project URL
vercel env add SUPABASE_SERVICE_KEY  # paste service_role secret
vercel env add LC_JWT_SECRET         # paste any 32+ char random string
```

For `LC_JWT_SECRET`, generate one:

```sh
openssl rand -hex 32
```

Add to all three environments (Production / Preview / Development) when prompted.

## 5. Redeploy

```sh
vercel --prod
```

Or just push a commit — Vercel auto-redeploys.

## 6. Verify

Visit https://www.lemoncake.xyz/app. It should detect the backend automatically:
- The form's **Create Gateway Endpoint** button writes to Postgres.
- Pay Tokens are signed as real JWTs.
- The gateway URL (e.g. `https://www.lemoncake.xyz/g/abc12345`) **actually proxies** to your origin and decrements the token's budget.
- localStorage data from before the upgrade stays in your browser as a local fallback — nothing breaks.

If env vars are missing, `/app` falls back to localStorage simulation mode with a banner saying so.
