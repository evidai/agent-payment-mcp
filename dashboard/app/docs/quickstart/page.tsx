import Link from "next/link";
import type { Metadata } from "next";

// Rewritten 2026-05-27 to be SDK-first, not MCP-config-first. The previous
// version walked through Claude Desktop config files and Demo Mode tools.
// That positioned LemonCake as "an MCP server you install" — useful for
// the buyer-side audience, but the seller-side audience (the one we're
// actually monetizing) needs to see "how do I add billing to my own tool"
// in the first 30 seconds. Vercel / Supabase / Resend style: install,
// import, one line, done.

export const metadata: Metadata = {
  title: "Quickstart — LemonCake Docs",
  description: "Add usage billing to your MCP server or AI API in under 5 minutes. Three lines of code, demo mode out of the box, MIT-licensed SDK.",
  alternates: { canonical: "https://lemoncake.xyz/docs/quickstart" },
};

export default function QuickstartPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">Quickstart</h1>
        <p className="text-sm text-gray-500 !mt-0">
          Add usage billing to your tool in 3 lines of code. Demo mode is the default — no signup, no card, no env vars required.
        </p>

        <hr className="my-8 border-gray-200" />

        {/* ── Install ── */}
        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">1 · Install</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`npm install @lemon-cake/mcp-sdk
# or pnpm / yarn / bun — works with all of them`}</pre>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          MIT licensed, ~12kB gzipped, zero runtime dependencies. Source at{" "}
          <a href="https://github.com/evidai/agent-payment-mcp/tree/main/lemoncake-mcp-sdk" className="text-amber-700 underline-offset-2 hover:underline">github.com/evidai/agent-payment-mcp</a>.
        </p>

        {/* ── Wrap your tool ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">2 · Wrap your tool</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Import the SDK, create a client, wrap each tool handler with{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">lc.charge()</code>. That&apos;s the entire integration.
        </p>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";

const lc = createLemonCakeSDK();        // demo mode without env vars

server.tool(
  "search",
  lc.charge({ price: 0.02 }),           // ← the one line you add
  async ({ query }) => {
    return await myActualSearch(query);
  },
);`}</pre>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          The wrapper handles: pre-flight budget check, charge recording, idempotency, and error formatting. If the buyer&apos;s budget is exhausted, the handler never runs — no compute wasted on uncollectable calls.
        </p>

        {/* ── Run in demo ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">3 · Run it</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`$ node server.js
[lemoncake] demo mode — charges logged to stderr, no real funds move
[lemoncake]   search       $0.02
[lemoncake]   summarize    $0.05
[lemoncake]   → set LEMONCAKE_SELLER_KEY to go live`}</pre>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          That&apos;s it. The server is now metering every call. Demo mode is local-only — no telemetry leaves your machine.
        </p>

        {/* ── Go live ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">4 · Go live (when ready)</h2>
        <ol className="text-sm text-gray-700 leading-relaxed list-decimal pl-5 space-y-2">
          <li>
            Grab a seller key at{" "}
            <Link href="/app" className="text-amber-700 underline-offset-2 hover:underline font-semibold">/start/free</Link>
            {" "}(3 fields, no card, manual provisioning within 24h while inbound is small).
          </li>
          <li>Export the key as an env var:
            <pre className="bg-gray-950 text-gray-300 rounded-xl p-3 text-xs mt-2 leading-relaxed">{`export LEMONCAKE_SELLER_KEY="lc_seller_..."`}</pre>
          </li>
          <li>Restart your server. The SDK auto-detects the key and switches to live mode. Real charges are handled through LemonCake&apos;s Stripe-backed gateway.</li>
        </ol>

        {/* ── Complete example ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Complete working example</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          A full runnable MCP server with 2 paid tools lives at{" "}
          <a href="https://github.com/evidai/agent-payment-mcp/tree/main/examples/mcp-monetization-starter" className="text-amber-700 underline-offset-2 hover:underline font-semibold">examples/mcp-monetization-starter</a>:
        </p>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`git clone https://github.com/evidai/agent-payment-mcp
cd agent-payment-mcp/examples/mcp-monetization-starter
npm install && npm start
# → boots a working MCP server with billing in demo mode`}</pre>

        {/* ── HTTP API ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Not an MCP server? HTTP works too</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          For regular HTTP APIs (Express, Hono, Next.js Route Handlers, Cloudflare Workers, etc.), use{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">@lemon-cake/x402-server</code>:
        </p>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`import { paymentMiddleware } from "@lemon-cake/x402-server";

app.use("/api/search", paymentMiddleware({ pricePerCallUsd: 0.02 }));
app.get("/api/search", async (req, res) => {
  return res.json(await myActualSearch(req.query.q));
});`}</pre>
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">
          x402-compatible — any agent that speaks the{" "}
          <a href="https://www.x402.org/" className="text-amber-700 underline-offset-2 hover:underline">x402 protocol</a>{" "}
          (Coinbase Bazaar, AWS Bedrock AgentCore, Anthropic Connectors) can pay your endpoint directly.
        </p>

        {/* ── What next ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">What to read next</h2>
        <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-2">
          <li><Link href="/pricing" className="text-amber-700 underline-offset-2 hover:underline">Pricing</Link> — free tier limits, Pro tier rates, Enterprise terms</li>
          <li><Link href="/docs/pay-token" className="text-amber-700 underline-offset-2 hover:underline">Pay Token guide</Link> — how spend-capped agent credentials work</li>
          <li><Link href="/docs/x402-hybrid" className="text-amber-700 underline-offset-2 hover:underline">x402 hybrid mode</Link> — auto-listing on Coinbase Bazaar + AgentCore directories</li>
          <li><Link href="/docs/migrate-from-coinbase" className="text-amber-700 underline-offset-2 hover:underline">Migrating from Coinbase x402</Link> — drop-in middleware swap</li>
          <li><Link href="/docs/migrate-from-stripe-mpp" className="text-amber-700 underline-offset-2 hover:underline">Coexisting with Stripe MPP</Link> — when to route which way</li>
        </ul>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-400">
          SDK source · MIT · <a href="https://github.com/evidai/agent-payment-mcp" className="underline hover:text-amber-700">github.com/evidai/agent-payment-mcp</a> · Questions: <a href="mailto:contact@aievid.com" className="underline hover:text-amber-700">contact@aievid.com</a>
        </p>
      </article>
    </main>
  );
}
