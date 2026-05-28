import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs — LemonCake",
  description: "How to monetize an API with LemonCake: seller-side /app workflow, buyer-side gateway HTTP spec, Pay Token JWT, REST API.",
  alternates: { canonical: "https://www.lemoncake.xyz/docs" },
};

type Item = { title: string; desc: string; href: string; external?: boolean; badge?: string };
type Section = { heading: string; sub?: string; items: Item[] };

const SECTIONS: Section[] = [
  {
    heading: "Get started",
    sub: "From zero to a paid request — both sides.",
    items: [
      {
        title: "Quickstart",
        desc:  "Open /app → fill the form → click Create → curl the gateway URL with the Pay Token JWT. ~60 seconds.",
        href:  "/docs/quickstart",
      },
      {
        title: "Open the app",
        desc:  "The real workspace: create endpoints, issue Pay Tokens, send test requests, watch the usage ledger.",
        href:  "/app",
      },
    ],
  },
  {
    heading: "Reference",
    sub: "What the gateway accepts, what it returns, how the Pay Token is structured.",
    items: [
      {
        title: "Gateway HTTP spec",
        desc:  "Methods, Pay Token bearer auth, x-lemoncake-* trace headers, full error code table, refund semantics, CORS, header forwarding rules.",
        href:  "/docs/gateway",
        badge: "NEW",
      },
      {
        title: "Pay Token spec",
        desc:  "HS256-signed JWT format. Claims (jti / sub / own), spend cap, expiry, revocation. The token a buyer attaches as Bearer auth.",
        href:  "/docs/pay-token",
      },
      {
        title: "ERC-2612 permit (legacy)",
        desc:  "Original v1 buyer-side permit model. Still supported by the SDK but superseded by Pay Token JWT for the gateway flow.",
        href:  "/docs/permit",
      },
    ],
  },
  {
    heading: "Migration",
    sub: "Drop-in replacements for Stripe MPP and Coinbase x402.",
    items: [
      {
        title: "From Coinbase x402",
        desc:  "Swap facilitator URL → keep your existing MPP-signed flow → gain JP onramp + free first 3k calls.",
        href:  "/docs/migrate-from-coinbase",
      },
      {
        title: "From Stripe MPP",
        desc:  "Run LemonCake as the Base/USDC settlement layer alongside Stripe MPP. Non-custodial, micro-payment friendly.",
        href:  "/docs/migrate-from-stripe-mpp",
      },
      {
        title: "x402 hybrid mode",
        desc:  "Use @lemon-cake/x402-server in your existing CDP pipeline. LemonCake metering + Bazaar / AgentCore visibility.",
        href:  "/docs/x402-hybrid",
      },
    ],
  },
  {
    heading: "Source",
    items: [
      {
        title: "GitHub repo",
        desc:  "agent-payment-mcp monorepo: SDK, gateway, dashboard. MIT.",
        href:  "https://github.com/evidai/agent-payment-mcp",
        external: true,
      },
      {
        title: "npm packages",
        desc:  "All 6 public packages under @evidai_lemoncake.",
        href:  "https://www.npmjs.com/~evidai_lemoncake",
        external: true,
      },
    ],
  },
];

export default function DocsHubPage() {
  return (
    <main className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">
      <header className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
        <div className="max-w-[1400px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/about/en" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-md object-cover" />
            <span className="text-[14px] font-bold tracking-tight">LemonCake</span>
            <span className="ml-2 px-2.5 py-1 bg-[#1a0f00]/6 text-[#1a0f00]/65 rounded-full text-[9.5px] font-bold uppercase tracking-widest">Private Beta</span>
          </Link>
          <nav className="flex items-center gap-5 text-[13px]">
            <Link href="/pricing"   className="text-[#1a0f00]/60 hover:text-[#1a0f00]">Pricing</Link>
            <Link href="/about/en"  className="text-[#1a0f00]/60 hover:text-[#1a0f00]">About</Link>
            <Link href="/app"       className="font-semibold text-[#1a0f00]">Open app →</Link>
          </nav>
        </div>
      </header>

      <div className="max-w-[960px] mx-auto px-6 py-12">

        <div className="mb-10">
          <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-2">Docs</p>
          <h1 className="text-[36px] md:text-[44px] font-black leading-[1.05] tracking-tight">
            How LemonCake works
          </h1>
          <p className="mt-4 text-[14.5px] text-[#1a0f00]/65 leading-relaxed max-w-[640px]">
            Sellers wrap an HTTP API in a paid-access gateway in {"<"} 60s. Buyers (or their agents) attach
            a signed Pay Token and pay only for what they actually consume. Backend is live; settlement
            layer comes later. Anything not here →{" "}
            <a href="mailto:contact@aievid.com" className="underline">contact@aievid.com</a>.
          </p>
        </div>

        {SECTIONS.map((sec) => (
          <section key={sec.heading} className="mb-10">
            <div className="mb-3">
              <h2 className="text-[20px] font-black tracking-tight">{sec.heading}</h2>
              {sec.sub && <p className="text-[12.5px] text-[#1a0f00]/55 mt-0.5">{sec.sub}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sec.items.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener" : undefined}
                  className="group relative rounded-2xl border border-[#1a0f00]/10 bg-white p-5 hover:border-[#1a0f00]/25 transition-colors"
                >
                  {item.badge && (
                    <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-widest bg-[#1a0f00] text-white px-1.5 py-0.5 rounded">
                      {item.badge}
                    </span>
                  )}
                  <p className="font-bold text-[14px] text-[#1a0f00] group-hover:underline">
                    {item.title}
                    {item.external && <span className="ml-1 text-[11px] text-[#1a0f00]/40">↗</span>}
                  </p>
                  <p className="mt-1.5 text-[12.5px] text-[#1a0f00]/55 leading-relaxed">{item.desc}</p>
                </a>
              ))}
            </div>
          </section>
        ))}

        <section className="mt-12 rounded-2xl bg-[#1a0f00] text-white p-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#fffd43]/80 mb-2">Try it now</p>
          <p className="text-[15px] leading-relaxed mb-4 max-w-[520px]">
            The dashboard creates a real endpoint backed by Postgres in Tokyo. Pay Token JWTs are signed with HS256.
            Curl works from anywhere — server, browser, edge function.
          </p>
          <Link href="/app" className="inline-flex items-center gap-2 px-4 py-2 bg-[#fffd43] hover:bg-[#fff070] text-[#1a0f00] font-bold text-[13px] rounded-lg transition-colors">
            Open /app →
          </Link>
        </section>

        <p className="mt-8 text-center text-[11px] text-[#1a0f00]/40">
          Stuck? <a href="mailto:contact@aievid.com" className="underline hover:text-[#1a0f00]/65">contact@aievid.com</a>{" "}·{" "}
          <a href="https://github.com/evidai/agent-payment-mcp/issues" target="_blank" rel="noopener" className="underline hover:text-[#1a0f00]/65">GitHub issues</a>
        </p>
      </div>
    </main>
  );
}
