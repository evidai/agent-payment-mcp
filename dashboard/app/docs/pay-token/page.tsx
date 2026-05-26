import Link from "next/link";
import type { Metadata } from "next";

// Pay Token JSON spec — the artifact LemonCake hopes will become a
// portable standard. Published as a draft v0.1 so that:
//   1. We can claim category-definer position (HN / Reddit / blog ammo).
//   2. Other facilitators (Coinbase x402, MPP) can be marketed as
//      "verify but don't issue" — we issue, they settle.
//   3. Future Pro tier sellers know what they're paying us to mint.
//
// Spec is intentionally minimal. It will expand. Marked "draft v0.1"
// in the page so we don't owe forward-compat to anyone yet.

export const metadata: Metadata = {
  title: "Pay Token spec — LemonCake Docs",
  description: "Spend-limited Pay Token JSON spec for AI agent API access. Draft v0.1. The portable permission primitive between agents and APIs.",
  alternates: { canonical: "https://lemoncake.xyz/docs/pay-token" },
  openGraph: {
    title: "LemonCake Pay Token — spend-limited permission tokens for AI agents",
    description: "JSON spec, draft v0.1. The permission primitive sitting between AI agents and your API.",
    url: "https://lemoncake.xyz/docs/pay-token",
    type: "article",
  },
};

export default function PayTokenPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <div className="!mt-4 mb-4 flex items-center gap-2 flex-wrap">
          <span className="inline-block text-[10px] font-mono uppercase tracking-widest text-amber-800 bg-amber-100 px-2 py-0.5 rounded">Draft v0.1</span>
          <span className="text-[11px] text-gray-500">Stabilizing in Q3 2026</span>
        </div>

        <h1 className="!mt-0 !mb-2 text-3xl font-bold text-gray-900">Pay Token spec</h1>
        <p className="text-sm text-gray-500 !mt-0">
          The permission primitive between an AI agent and your API. JSON, signable, scoped, expiring, and rate-limited at issuance time.
        </p>

        {/* Honesty banner — what's spec vs what's shipped. Surface this loudly
            because the page reads like it might already be running in prod,
            and design partners deserve to know it's a forward-looking spec. */}
        <div className="not-prose mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold mb-1">⚠ Status: spec only.</p>
          <p className="leading-relaxed">
            This page documents a <strong>forward-looking JSON spec</strong>. The reference issuance + verification implementation lands in <strong>Q3 2026</strong> as part of the hosted Gateway. Today the SDK (<code className="text-xs bg-amber-100 px-1 rounded">@lemon-cake/mcp-sdk@0.3.0</code>) ships a simpler pre-flight / charge flow that pre-dates this spec. Design partners get early access to the v0.5 reference impl when it lands.
          </p>
        </div>

        <hr className="my-8 border-gray-200" />

        {/* ── Why this exists ── */}
        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Why a Pay Token?</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Today an AI agent that calls a paid API has three bad options: (a) share the operator&apos;s API key, (b) hold a long-lived wallet private key, (c) tunnel every call through the operator&apos;s server. All three are either insecure or operationally expensive.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          A Pay Token is a fourth option: the operator hands the agent a <em>narrow, time-bound, spend-capped, rate-limited</em> permission to call a specific API. The agent presents the Pay Token at the gateway; the gateway verifies and meters. The agent never sees the underlying credential or wallet key.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          This is the same shape as <code className="text-xs bg-gray-100 px-1 rounded">macaroons</code>, <code className="text-xs bg-gray-100 px-1 rounded">biscuits</code>, or a permission-narrowed OAuth scope — but with <strong>spend semantics</strong> built in.
        </p>

        {/* ── The spec ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">The shape</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`{
  "v":              "0.1",                            // spec version
  "iss":            "lc_seller_aBc123...",            // who minted it
  "sub":            "agent:abc-uuid",                 // who it's for (optional)
  "iat":            1716800000,                       // issued at (epoch s)
  "exp":            1716803600,                       // expires at (epoch s)
  "allowed_api":    "search-api",                     // scoped to one API
  "allowed_paths":  ["/v1/search", "/v1/autocomplete"],// or a path allowlist
  "allowed_methods":["GET", "POST"],                   // method allowlist
  "max_spend":      5.00,                              // hard cap in USDC
  "price_per_call": 0.01,                              // unit price (overrides server default)
  "rate_limit":     "10/min",                          // rate window
  "success_only":   true,                              // only charge on 2xx/3xx
  "metadata":       { "purpose": "weekend research" },// opaque, echoed in logs
  "nonce":          "n1Q9xS...",                       // anti-replay
  "sig":            "0x..."                            // EIP-712 signature over the rest
}`}</pre>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          The signature is over the canonical JSON form excluding the <code className="text-xs bg-gray-100 px-1 rounded">sig</code> field itself. Verifiers can use <code className="text-xs bg-gray-100 px-1 rounded">@lemon-cake/mcp-sdk</code>&apos;s <code className="text-xs bg-gray-100 px-1 rounded">verifyPayToken()</code> in &lt; 10 ms with no network call.
        </p>

        {/* ── Field reference ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Field reference</h2>
        <div className="not-prose my-5 overflow-x-auto">
          <table className="w-full text-[12px] border border-gray-200 rounded-xl">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Field</th>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Type</th>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Required</th>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Meaning</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {[
                ["v",               "string",          "yes", "Spec version. Currently \"0.1\"."],
                ["iss",              "string",          "yes", "Seller key prefix (lc_seller_…). Identifies who can verify the sig."],
                ["sub",              "string",          "no",  "Optional agent identifier. Used for per-agent throttling and analytics."],
                ["iat / exp",        "number (epoch s)", "yes", "Token validity window. Short windows (≤ 1h) are recommended for agents."],
                ["allowed_api",      "string",          "yes", "Logical API name as registered with LemonCake (e.g. \"search-api\")."],
                ["allowed_paths",    "string[]",        "no",  "Path allowlist. If omitted, all paths under allowed_api are allowed."],
                ["allowed_methods",  "string[]",        "no",  "HTTP method allowlist. Defaults to [\"GET\", \"POST\"]."],
                ["max_spend",        "number (USDC)",   "yes", "Hard cap on cumulative USDC chargeable through this token."],
                ["price_per_call",   "number (USDC)",   "no",  "Override the server&apos;s default unit price. Cannot exceed it."],
                ["rate_limit",       "string",          "no",  "Format: \"N/window\" where window ∈ {sec, min, hour, day}."],
                ["success_only",     "boolean",         "no",  "If true, only charge on 2xx/3xx responses. Default true."],
                ["metadata",         "object",          "no",  "Opaque key/value. Echoed in usage logs. Not signed by issuer for tampering."],
                ["nonce",            "string",          "yes", "Random per-token. Replay protection — verifier remembers used nonces."],
                ["sig",              "string (hex)",    "yes", "EIP-712 signature over the rest of the token."],
              ].map(([f, t, r, m]) => (
                <tr key={f as string} className="border-t border-gray-100">
                  <td className="py-2 px-3 font-mono">{f}</td>
                  <td className="py-2 px-3 text-gray-500">{t}</td>
                  <td className={`py-2 px-3 ${r === "yes" ? "text-amber-700 font-semibold" : "text-gray-400"}`}>{r}</td>
                  <td className="py-2 px-3" dangerouslySetInnerHTML={{ __html: m as string }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Examples ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Three scenarios</h2>

        <h3 className="text-base font-bold mt-6 mb-2 text-gray-900">1. Weekend research agent</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          Operator hands a research agent a token for one weekend. Caps spend at $5, allows only the search-api, 10 calls per minute. If the agent loops infinitely, the worst case is $5.
        </p>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`{
  "allowed_api":    "search-api",
  "exp":            <epoch + 60h>,
  "max_spend":      5.00,
  "price_per_call": 0.01,
  "rate_limit":     "10/min",
  "success_only":   true
}`}</pre>

        <h3 className="text-base font-bold mt-6 mb-2 text-gray-900">2. Long-running data enrichment</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          Pipeline that enriches one record at a time, sub-cent per call. 24h window, $50 cap, no rate limit (the pipeline self-throttles).
        </p>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`{
  "allowed_api":    "enrichment-api",
  "exp":            <epoch + 24h>,
  "max_spend":      50.00,
  "price_per_call": 0.002,
  "success_only":   true
}`}</pre>

        <h3 className="text-base font-bold mt-6 mb-2 text-gray-900">3. Customer-facing demo</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          A prospect tries your agent on your site. Token caps everything tight so a curious user can&apos;t drain the demo budget.
        </p>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`{
  "allowed_api":    "voice-api",
  "allowed_paths":  ["/v1/tts"],
  "allowed_methods":["POST"],
  "exp":            <epoch + 600>,
  "max_spend":      0.10,
  "rate_limit":     "5/min"
}`}</pre>

        {/* ── Where it sits ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Where Pay Token sits</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed font-mono">{`
   Agent operator    →   issues Pay Token   →    Agent
                                                      ↓ (presents Pay Token in Authorization header)
                                              LemonCake Gateway
                                                      ↓
                                          API Provider (charged USDC)
`}</pre>

        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          The Pay Token is the <em>off-chain</em> permission layer. The <em>on-chain</em> enforcement (ERC-2612 permit, the operator&apos;s actual USDC ceiling) sits one level lower. A Pay Token can never exceed what its issuer&apos;s permit allows; the spend cap on the Pay Token is a <em>narrower</em> ceiling drawn from a wider one.
        </p>

        {/* ── Interop ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Interop with x402 and MPP</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          A LemonCake Pay Token can be wrapped in an x402 challenge response (<code className="text-xs bg-gray-100 px-1 rounded">HTTP 402 Payment Required</code>) so any x402-aware client can pay through it. It can also be presented to a Stripe MPP facilitator if you want MPP-signed settlement instead of direct USDC.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          The spec is deliberately small so other facilitators can issue or verify it without buying the whole LemonCake stack. We&apos;d rather be the inventor of a standard than the sole vendor.
        </p>

        {/* ── Status / changelog ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Status &amp; changelog</h2>
        <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1.5">
          <li><strong className="text-gray-900">2026-05-27 — Draft v0.1.</strong> Published as a forward-looking spec. Fields, signing curve, replay protection are not yet frozen.</li>
          <li><strong className="text-gray-900">Q3 2026 — v0.5 stable.</strong> Field set frozen. Reference implementations in TypeScript, Python, Go. Optional alignment with x402 payload schema.</li>
          <li><strong className="text-gray-900">Q4 2026 — v1.0.</strong> Long-lived support promise. Spec versions thereafter only add fields, never remove.</li>
        </ul>

        {/* ── Try it ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Try it</h2>
        <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1.5">
          <li>Issue a Pay Token from a seller account at <Link href="/start/free" className="text-amber-700 underline-offset-2 hover:underline">/start/free</Link></li>
          <li>Verify one in your code: <code className="text-xs bg-gray-100 px-1 rounded">npm i @lemon-cake/mcp-sdk@latest</code></li>
          <li>Working example MCP server: <a href="https://github.com/evidai/agent-payment-mcp/tree/main/examples/mcp-monetization-starter" className="text-amber-700 underline-offset-2 hover:underline">examples/mcp-monetization-starter</a></li>
          <li>Spec questions: <a href="mailto:contact@aievid.com?subject=Pay%20Token%20spec%20feedback" className="text-amber-700 underline-offset-2 hover:underline">contact@aievid.com</a></li>
        </ul>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-400">
          Spec is in the public domain (CC0). The reference SDK is MIT. <Link href="/" className="underline hover:text-amber-700">lemoncake.xyz</Link>
        </p>
      </article>
    </main>
  );
}
