import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gateway HTTP spec — LemonCake Docs",
  description: "Buyer-facing spec for the LemonCake paid-access gateway: methods, Pay Token bearer auth, trace headers, error codes, CORS.",
  alternates: { canonical: "https://www.lemoncake.xyz/docs/gateway" },
};

export default function GatewayDocs() {
  return (
    <main className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">
      <Header />

      <article className="max-w-[860px] mx-auto px-6 py-12">
        <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-2">Reference · Gateway</p>
        <h1 className="text-[36px] font-black leading-[1.1] tracking-tight mb-4">Gateway HTTP spec</h1>
        <p className="text-[14.5px] text-[#1a0f00]/65 leading-relaxed mb-10 max-w-[640px]">
          What a buyer (or their agent) sends, what the gateway sends back, and exactly what every error code means.
          For the seller-side setup, see <Link href="/app" className="underline">/app</Link>.
        </p>

        <Section title="URL">
          <Code>https://www.lemoncake.xyz/g/&lt;shortId&gt;</Code>
          <P>
            <Hl>shortId</Hl> is the 8-character base32 ID printed in the seller&apos;s Gateway pane on /app.
            The gateway is method-agnostic — <Hl>GET / POST / PUT / PATCH / DELETE</Hl> are all forwarded to the
            seller&apos;s origin URL with the same method and body.
          </P>
        </Section>

        <Section title="Authentication">
          <P>Every paid request must carry a Pay Token JWT:</P>
          <Code>{`POST https://www.lemoncake.xyz/g/abc12345 HTTP/1.1
Host: www.lemoncake.xyz
Authorization: Bearer eyJhbGciOiJIUzI1NiI…
Content-Type: application/json

{ "query": "your upstream payload" }`}</Code>
          <P>
            JWTs are HS256-signed. The gateway verifies the signature, looks up the token row in Postgres,
            and rejects on revoked / expired / exhausted / over-budget. See{" "}
            <Link href="/docs/pay-token" className="underline">Pay Token spec</Link> for the full payload format.
          </P>
        </Section>

        <Section title="Successful response">
          <P>
            The upstream&apos;s body and most headers are streamed back verbatim (hop-by-hop headers are stripped).
            Two LemonCake trace headers are added so buyers can audit charges:
          </P>
          <Code>{`HTTP/2 200 OK
content-type: application/json
x-lemoncake-charge: 0.01
x-lemoncake-upstream-ms: 17

{ "result": "…" }`}</Code>
          <Table
            cols={["Header", "Meaning"]}
            rows={[
              ["x-lemoncake-charge", "USD amount debited from your Pay Token's budget for this call."],
              ["x-lemoncake-upstream-ms", "Time the upstream took to respond. Gateway-side overhead is ~10ms (Tokyo region)."],
            ]}
          />
        </Section>

        <Section title="Error responses">
          <P>All errors return a JSON body of <Hl>{`{ "error": "<code>" }`}</Hl>. No Pay Token charge is recorded on any non-2xx/3xx outcome.</P>
          <Table
            cols={["Status", "error code", "Meaning"]}
            rows={[
              ["401", "missing_pay_token",       "No Authorization header / wrong scheme. Attach `Authorization: Bearer <jwt>`."],
              ["401", "invalid_pay_token",       "JWT signature or claims invalid. Likely tampered or signed with a different LC_JWT_SECRET."],
              ["401", "token_expired",           "The Pay Token's expiry has passed. Ask the seller to issue a fresh one."],
              ["402", "spend_cap_exceeded",      "Pay Token's budget would go negative on this call. Request a top-up."],
              ["402", "token_exhausted",         "Pay Token has hit its max_calls cap."],
              ["403", "token_revoked",           "Seller manually revoked this Pay Token."],
              ["403", "token_endpoint_mismatch", "JWT was issued for a different endpoint than the one you're calling."],
              ["404", "endpoint_not_found",     "shortId doesn't exist (typo, or the seller deleted it)."],
              ["429", "rate_limit_exceeded",   "More than `rate_limit` successful calls in the last 60s for this endpoint."],
              ["503", "endpoint_paused",       "Seller temporarily paused this endpoint. Try again later."],
              ["502", "upstream_unreachable",  "Gateway couldn't reach the seller's origin. Pay Token is NOT debited."],
              ["503", "backend_not_configured",  "Gateway env vars missing on the LemonCake side. Email contact@aievid.com."],
            ]}
          />
        </Section>

        <Section title="Refund semantics">
          <P>
            The gateway only charges your Pay Token when the upstream returns <Hl>2xx / 3xx / 4xx</Hl>.
            On <Hl>5xx</Hl> or network failure, the call is logged in the blocked log under
            {" "}<Hl>upstream_error</Hl> and your token is <strong>not</strong> debited. Buyers never pay for the seller&apos;s origin outage.
          </P>
        </Section>

        <Section title="CORS">
          <P>The gateway returns permissive CORS so browser-side agents work out of the box:</P>
          <Code>{`Access-Control-Allow-Origin: <Origin echo>
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Expose-Headers: x-lemoncake-charge, x-lemoncake-upstream-ms
Access-Control-Max-Age: 86400`}</Code>
          <P>Preflight OPTIONS returns 204 without authentication or DB lookups.</P>
          <Code>{`// Browser-side example
const res = await fetch("https://www.lemoncake.xyz/g/abc12345", {
  method: "POST",
  headers: { "Authorization": "Bearer " + PAY_TOKEN_JWT },
  body: JSON.stringify({ query: "…" }),
});
console.log(res.headers.get("x-lemoncake-charge")); // "0.01"`}</Code>
        </Section>

        <Section title="Header forwarding rules">
          <P>The gateway forwards almost all request headers to the upstream, with these exceptions:</P>
          <Table
            cols={["Behaviour", "Headers"]}
            rows={[
              ["Stripped (hop-by-hop)", "host, connection, content-length, transfer-encoding, keep-alive, proxy-authenticate, proxy-authorization, te, trailer, upgrade"],
              ["Replaced",              "Authorization — your Pay Token JWT is replaced with the seller's stored upstream_auth header (if any)"],
              ["Never forwarded",       "Cookie — buyer-side cookies are not leaked to the seller's origin"],
            ]}
          />
        </Section>

        <Section title="Charging math">
          <P>For every successful call:</P>
          <Code>{`gross = endpoint.price_per_call
fee   = (in the seller's first 3,000 calls / UTC month)  → 0
        (after 3,000)                                    → gross * 0.03
net   = gross - fee`}</Code>
          <P>
            The buyer&apos;s Pay Token decrements by <Hl>gross</Hl> regardless of free-tier state — the free
            tier affects LemonCake&apos;s cut, not the buyer&apos;s spend. Per-call breakdown is logged in
            {" "}<Hl>lc_test_runs</Hl>, visible on the seller&apos;s Usage Ledger pane.
          </P>
        </Section>

        <NextSteps />
      </article>
    </main>
  );
}

/* ── building blocks ── */

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-[20px] font-black tracking-tight mb-3">{title}</h2>
      <div className="space-y-3 text-[14px] text-[#1a0f00]/80 leading-relaxed">{children}</div>
    </section>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="rounded-xl bg-[#1a0f00] text-[#fafaf7] font-mono text-[12.5px] leading-relaxed p-4 overflow-x-auto">
      {children}
    </pre>
  );
}

function Hl({ children }: { children: React.ReactNode }) {
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
        <li><Link href="/docs/pay-token" className="font-semibold text-[#1a0f00] hover:underline">Pay Token spec →</Link> JWT claims, lifecycle, revocation</li>
        <li><Link href="/app" className="font-semibold text-[#1a0f00] hover:underline">Open /app →</Link> Create your own paid-access endpoint</li>
        <li><a href="mailto:contact@aievid.com" className="font-semibold text-[#1a0f00] hover:underline">Email us →</a> for design-partner access or integration help</li>
      </ul>
    </section>
  );
}
