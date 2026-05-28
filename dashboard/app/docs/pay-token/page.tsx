import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Pay Token spec — LemonCake Docs",
  description: "HS256-signed JWT a buyer attaches as Bearer auth to call a LemonCake paid-access gateway. Claims, lifecycle, server-side enforcement, issuance via /api/lc/tokens, revocation.",
  alternates: { canonical: "https://www.lemoncake.xyz/docs/pay-token" },
  openGraph: {
    title: "Pay Token — LemonCake's signed permission ticket for paid APIs",
    description: "HS256 JWT. Bearer-attached. Server-side enforcement of budget, calls, expiry, rate limit. Revocable.",
    url: "https://www.lemoncake.xyz/docs/pay-token",
    type: "article",
  },
};

export default function PayTokenPage() {
  return (
    <main className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">
      <Header />

      <article className="max-w-[860px] mx-auto px-6 py-12">
        <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-2">Reference · Pay Token</p>
        <h1 className="text-[36px] font-black leading-[1.1] tracking-tight mb-4">Pay Token spec</h1>
        <p className="text-[14.5px] text-[#1a0f00]/65 leading-relaxed mb-10 max-w-[640px]">
          The HS256-signed JWT a buyer (or their agent) attaches as <Hl>Authorization: Bearer</Hl> when calling
          a LemonCake gateway URL. Server-side enforcement of budget, call count, expiry, and rate limit happens
          on every paid request — see <Link href="/docs/gateway" className="underline">Gateway HTTP spec</Link>.
        </p>

        <Section title="Why a Pay Token?">
          <P>
            An AI agent that calls a paid API has three bad options: share the operator&apos;s API key, hold a long-lived
            wallet, or tunnel every call through the operator&apos;s server. All three are either insecure or
            operationally expensive.
          </P>
          <P>
            A Pay Token is the fourth option: the seller mints a <Hl>narrow, time-bound, spend-capped, rate-limited</Hl>{" "}
            permission for a specific endpoint. The agent attaches the token. The gateway verifies the signature,
            looks up server-side state, decrements the budget on success. The agent never sees the seller&apos;s
            upstream credential.
          </P>
        </Section>

        <Section title="The shape">
          <P>A Pay Token is a standard JWT. Three encoded parts joined by dots:</P>
          <Code>{`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.eyJvd24iOiJvX2FiYzEyMyIsImp0aSI6InB0X2RlZjQ1NiIs
InN1YiI6IjQwNjY0YjA2LWFmYjctNGFlMC1hZjFkLWFjZGUxNiIs
ImlhdCI6MTcxNjgwMDAwMCwiZXhwIjoxNzE2ODg2NDAwfQ
.GJoo3p6ZVGWEvMCvtMXBUa1Ov9YdXTQuZykIlHbNWJk`}</Code>
          <P>Decoded:</P>
          <Code>{`// header
{ "alg": "HS256", "typ": "JWT" }

// payload
{
  "jti": "pt_27788b295d72499fabf5f5d9",   // Pay Token ID (DB primary key)
  "sub": "40664b06-afb7-4ae0-af1d-...",   // endpoint UUID this token can call
  "own": "o_4e48c8bfc7934957",            // owner ID that issued the token
  "iat": 1716800000,                       // issued at (epoch seconds)
  "exp": 1716886400                        // expires at (epoch seconds)
}

// signature
HMAC-SHA256(base64url(header) + "." + base64url(payload), LC_JWT_SECRET)`}</Code>
        </Section>

        <Section title="Claims">
          <Table
            cols={["Claim", "Type", "Required", "Meaning"]}
            rows={[
              ["jti", "string",         "yes", "Pay Token ID. Doubles as the primary key in lc_pay_tokens — the gateway uses it to look up live state."],
              ["sub", "string (UUID)",  "yes", "Endpoint the token is scoped to. JWT.sub must match the endpoint resolved from the URL's shortId, otherwise 403 token_endpoint_mismatch."],
              ["own", "string",         "yes", "Owner ID (lc_owner cookie) that minted the token. Used for traceability; the gateway doesn't compare it to anything on the request path."],
              ["iat", "number (epoch s)", "yes", "Issued-at. Set by /api/lc/tokens on POST."],
              ["exp", "number (epoch s)", "yes", "Expiry. After this, the gateway returns 401 token_expired and the row's status flips to expired."],
            ]}
          />
          <P>
            <Hl>jti</Hl>, <Hl>sub</Hl>, and <Hl>own</Hl> are the only application-meaningful claims.{" "}
            <Hl>iat</Hl> / <Hl>exp</Hl> follow{" "}
            <a href="https://datatracker.ietf.org/doc/html/rfc7519#section-4.1" className="underline" target="_blank" rel="noopener">RFC 7519</a>.
          </P>
        </Section>

        <Section title="Server-side state">
          <P>
            Spend cap, call cap, rate limit — the things that make a Pay Token <em>useful</em> — are{" "}
            <strong>not in the JWT</strong>. They live in Postgres next to the token ID so the seller can revoke,
            top up, or adjust without re-issuing the JWT to the buyer.
          </P>
          <Code>{`-- lc_pay_tokens
id          text primary key,             -- = JWT.jti
endpoint_id uuid references lc_endpoints, -- = JWT.sub
owner_id    text references lc_owners,    -- = JWT.own
budget      numeric(12, 6),               -- USD spend cap
spent       numeric(12, 6) default 0,     -- decremented on each successful call
max_calls   int,                          -- per-token call cap
calls_used  int default 0,                -- incremented on each successful call
expires_at  timestamptz,                  -- mirrors JWT.exp
status      text   -- 'active' | 'expired' | 'exhausted' | 'revoked'
issued_at   timestamptz default now()`}</Code>
          <Table
            cols={["Rule", "Source of truth", "When checked"]}
            rows={[
              ["JWT signature valid",     "LC_JWT_SECRET",                     "every gateway call"],
              ["JWT not expired",         "JWT.exp",                            "every gateway call"],
              ["Token status = active",   "lc_pay_tokens.status",               "every gateway call"],
              ["Budget covers this call", "lc_pay_tokens.spent + endpoint.price_per_call ≤ budget", "every gateway call"],
              ["Calls remaining",         "lc_pay_tokens.calls_used < max_calls", "every gateway call"],
              ["Rate limit not breached", "count(lc_test_runs WHERE endpoint_id=? AND at >= now-60s) < endpoint.rate_limit", "every gateway call"],
            ]}
          />
        </Section>

        <Section title="Lifecycle">
          <Code>{`active
  │
  │  POST /g/<shortId> with Bearer <jwt>
  │  ──── decrement spent / increment calls_used ────►
  │
  ├── exp passed                     ──► status = "expired"  (401 token_expired)
  ├── calls_used >= max_calls        ──► status = "exhausted" (402 token_exhausted)
  ├── DELETE /api/lc/tokens/<jti>    ──► status = "revoked"   (403 token_revoked)
  └── budget exceeded on next call   ──► 402 spend_cap_exceeded (status stays active until exhausted by call cap)
`}</Code>
          <P>
            Status is a one-way ratchet — once flipped to <Hl>expired / exhausted / revoked</Hl>, the token never
            comes back. Top-ups happen by issuing a fresh token, not by reactivating an old one.
          </P>
        </Section>

        <Section title="Issue a Pay Token">
          <P>Sellers mint tokens via the REST API or via the Pay Token pane on <Link href="/app" className="underline">/app</Link>.</P>
          <Code>{`POST https://www.lemoncake.xyz/api/lc/tokens
Content-Type: application/json
Cookie: lc_owner=<your owner cookie>     // sent automatically from /app

{
  "endpointId":     "40664b06-afb7-4ae0-af1d-...",
  "budget":         5.00,
  "expiresInHours": 24,
  "maxCalls":       100
}`}</Code>
          <Code>{`// 201 Created
{
  "token": {
    "id":          "pt_27788b295d72499fabf5f5d9",
    "endpoint_id": "40664b06-afb7-4ae0-af1d-...",
    "budget":      "5.000000",
    "spent":       "0.000000",
    "max_calls":   100,
    "calls_used":  0,
    "expires_at":  "2026-05-29T05:18:42Z",
    "status":      "active",
    ...
  },
  "jwt": "eyJhbGciOiJIUzI1NiI…"      // give this to your buyer
}`}</Code>
          <P>
            The <Hl>jwt</Hl> is only returned on issuance — the server never echoes it back later. Hand it to
            your buyer (Slack DM, email, in-band over your own API), they attach it to gateway calls.
          </P>
          <P>
            <strong>Budget guardrail:</strong> <Hl>budget</Hl> may not exceed 5× the endpoint&apos;s{" "}
            <Hl>token_budget</Hl> setting, returning 400 <Hl>budget_exceeds_endpoint_cap</Hl> if it does. This
            keeps a stolen seller cookie from minting an unlimited-spend token.
          </P>
        </Section>

        <Section title="Revoke a Pay Token">
          <Code>{`DELETE https://www.lemoncake.xyz/api/lc/tokens/pt_27788b295d72499fabf5f5d9
Cookie: lc_owner=<your owner cookie>`}</Code>
          <P>
            Takes effect on the very next gateway call (no cache). The JWT itself remains cryptographically valid —
            the gateway rejects it because the DB row says <Hl>status = revoked</Hl>. This is intentional: we wanted
            instant revocation, not waiting for short expiries to roll over.
          </P>
        </Section>

        <Section title="Why HS256 instead of EIP-712 / Ed25519?">
          <P>
            Pay Tokens are issued <em>and</em> verified by the same LemonCake gateway. There&apos;s no third party
            that needs to verify the signature without trusting us. HS256 with a shared secret (<Hl>LC_JWT_SECRET</Hl>)
            is the simplest thing that meets that bar.
          </P>
          <P>
            When the day comes that a third-party verifier wants to check a Pay Token without calling LemonCake
            (a Coinbase x402 facilitator wrapping ours, for example), we&apos;ll add a second alg (RS256 or
            Ed25519) under the same <Hl>jti</Hl> identity — the JWT format already supports per-token alg negotiation
            via the header.
          </P>
        </Section>

        <Section title="Buyer-side usage">
          <P>The whole interaction from the buyer&apos;s side is two HTTP requests their server / agent already knows how to make:</P>
          <Code>{`// Node.js
const res = await fetch(\`https://www.lemoncake.xyz/g/\${shortId}\`, {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + PAY_TOKEN_JWT,
    "Content-Type":  "application/json",
  },
  body: JSON.stringify({ query: "…" }),
});

console.log(res.headers.get("x-lemoncake-charge"));     // "0.01"
console.log(res.headers.get("x-lemoncake-upstream-ms")); // "17"`}</Code>
          <P>
            CORS is permissive — works from server, edge function, or browser. See{" "}
            <Link href="/docs/gateway" className="underline">Gateway HTTP spec</Link> for the full error table.
          </P>
        </Section>

        <Section title="What's intentionally NOT in the token">
          <P>
            The original v0.1 draft of this spec carried <Hl>allowed_paths</Hl>, <Hl>allowed_methods</Hl>,{" "}
            <Hl>price_per_call</Hl>, <Hl>rate_limit</Hl>, <Hl>metadata</Hl>, and <Hl>nonce</Hl> inside the JWT.
            We dropped them all. Reasons:
          </P>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Server-side state is more flexible</strong> than a signed payload. The seller can adjust price or rate without re-issuing JWTs to every buyer.</li>
            <li><strong>Replay defence comes from the DB</strong>, not a nonce. <Hl>spent</Hl> only goes up, so a replayed request that pushed past <Hl>budget</Hl> simply fails.</li>
            <li><strong>Smaller tokens</strong> compress better in HTTP headers and survive a wider range of HTTP clients (some have header-size limits).</li>
          </ul>
          <P>
            The current token is intentionally minimal — just enough for a verifier to look up the right row and
            confirm the signature. Everything operational is in Postgres.
          </P>
        </Section>

        <Section title="Future">
          <P>Fields likely to grow into the spec as integrations demand:</P>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><Hl>scope</Hl> — path / method allowlist enforced at the gateway, for sellers whose origin exposes multiple sensitive operations.</li>
            <li><Hl>aud</Hl> — facilitator identifier so the same JWT can be honored by a non-LemonCake verifier (x402-compatible mode).</li>
            <li>Alternative <Hl>alg</Hl> — RS256 / Ed25519 for cross-verifier scenarios where shared-secret HS256 isn&apos;t acceptable.</li>
          </ul>
          <P>
            Anything we add will follow a single rule: <strong>never remove a field</strong>. Existing JWTs
            keep verifying as long as the secret is rotated forward with overlap.
          </P>
        </Section>

        <NextSteps />
      </article>
    </main>
  );
}

/* ── building blocks (kept inline to keep the page self-contained) ── */

function Header() {
  return (
    <header className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
      <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/about/en" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-md object-cover" />
          <span className="text-[14px] font-bold tracking-tight">LemonCake</span>
        </Link>
        <nav className="flex items-center gap-5 text-[13px]">
          <Link href="/docs" className="text-[#1a0f00]/60 hover:text-[#1a0f00]">Docs</Link>
          <Link href="/pricing" className="text-[#1a0f00]/60 hover:text-[#1a0f00]">Pricing</Link>
          <Link href="/app" className="font-semibold text-[#1a0f00]">Open app →</Link>
        </nav>
      </div>
    </header>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-[20px] font-black tracking-tight mb-3">{title}</h2>
      <div className="space-y-3 text-[14px] text-[#1a0f00]/80 leading-relaxed">{children}</div>
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="rounded-xl bg-[#1a0f00] text-[#fafaf7] font-mono text-[12.5px] leading-relaxed p-4 overflow-x-auto">
      {children}
    </pre>
  );
}

function Hl({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[12.5px] bg-[#1a0f00]/6 text-[#1a0f00] px-1.5 py-0.5 rounded">{children}</code>;
}

function Table({ cols, rows }: { cols: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#1a0f00]/10">
      <table className="w-full text-[13px]">
        <thead className="bg-[#fafaf7] border-b border-[#1a0f00]/8 text-[10.5px] uppercase tracking-widest text-[#1a0f00]/55">
          <tr>{cols.map((c) => <th key={c} className="text-left px-3 py-2 font-semibold">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[#1a0f00]/6 last:border-0 align-top">
              {r.map((cell, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? "font-mono text-[12px] font-semibold whitespace-nowrap" : "text-[#1a0f00]/75"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NextSteps() {
  return (
    <section className="mt-12 rounded-2xl bg-white border border-[#1a0f00]/10 p-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-2">Next</p>
      <ul className="space-y-1.5 text-[13px]">
        <li><Link href="/docs/gateway" className="font-semibold text-[#1a0f00] hover:underline">Gateway HTTP spec →</Link> What the buyer sends, what the gateway returns</li>
        <li><Link href="/app" className="font-semibold text-[#1a0f00] hover:underline">Open /app →</Link> Issue your first Pay Token in 30 seconds</li>
        <li><a href="mailto:contact@aievid.com?subject=Pay%20Token%20spec%20feedback" className="font-semibold text-[#1a0f00] hover:underline">Spec feedback →</a> contact@aievid.com</li>
      </ul>
    </section>
  );
}
