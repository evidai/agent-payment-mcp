import Link from "next/link";
import type { Metadata } from "next";
import DemoClient from "./DemoClient";
import { softwareAppJsonLd, breadcrumbJsonLd } from "../lib/structured-data";

export const metadata: Metadata = {
  title: "LemonCake Playground — Test a Paid MCP / API Call in 30 Seconds",
  description:
    "Try a sandbox paid MCP/API call in 30 seconds. Mint a spend-capped Pay Token, run a metered $0.01 call through the live x402 gateway, watch the budget drain to an HTTP 402 stop, and copy curl or MCP config. No login, card, or crypto wallet.",
  keywords: [
    "paid MCP server",
    "monetize API",
    "AI agent payments",
    "x402",
    "HTTP 402",
    "Pay Token",
    "usage-based billing",
    "MCP middleware",
    "API monetization sandbox",
    "agent payment demo",
  ],
  // /demo is EN-only by design (no JA variant exists, so no hreflang pair).
  // When localizing, add /demo/ja + a middleware locale rule mirroring /about.
  alternates: { canonical: "https://lemoncake.xyz/demo" },
  openGraph: {
    title: "LemonCake Playground — paid MCP/API calls in 30 seconds",
    description: "Mint a sandbox Pay Token, run a metered call through the live x402 gateway, and inspect the seller ledger. No login, card, or crypto wallet.",
    url: "https://lemoncake.xyz/demo",
    siteName: "LemonCake",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LemonCake Playground — paid MCP/API calls in 30 seconds",
    description: "Mint a sandbox Pay Token, run a metered call, watch the cap enforce a 402 stop. No login, card, or crypto wallet.",
  },
  robots: { index: true, follow: true },
};

// ── AEO: demo-specific Q&A. Rendered visibly below AND emitted as FAQPage
// JSON-LD from the same array, so the structured data always matches the page. ──
const demoFaq = [
  {
    q: "What is the LemonCake Playground?",
    a: "A free sandbox that demonstrates AI-agent payments end to end: it mints a spend-capped Pay Token, runs a metered $0.01 API call through the live LemonCake x402 gateway, and shows the seller ledger updating in real time. There is no login, no credit card, and no crypto wallet — sandbox tokens mirror production behavior without moving real funds.",
  },
  {
    q: "What is a Pay Token?",
    a: "A Pay Token is a spend-limited payment credential a buyer hands to an AI agent — like a prepaid card with a hard budget cap, expiry, and endpoint scope baked in. The gateway verifies it on every call and rejects anything over the cap with HTTP 402, so a runaway agent can never overspend.",
  },
  {
    q: "Is real money involved in this demo?",
    a: "No. The playground uses sandbox Pay Tokens that behave exactly like production ones — budget checks, metering, and 402 enforcement all run on the real gateway — but no card is charged and no funds move.",
  },
  {
    q: "What happens when the Pay Token budget runs out?",
    a: "The gateway returns HTTP 402 Payment Required and blocks the call before it reaches the seller's API. The demo shows this as the cap_enforced event: the agent simply stops, with no surprise bills on either side.",
  },
  {
    q: "How do I make my own API or MCP server paid?",
    a: "Paste your endpoint URL in the LemonCake dashboard (no code changes), or scaffold a new paid MCP server with npx create-lemon-mcp. Set a per-call price — sub-cent from $0.005 works — and share the buy link. Your first 3,000 calls are free, then LemonCake takes 3% and sellers keep 97%, paid out via Stripe.",
  },
  {
    q: "Does the demo work with MCP clients like Claude?",
    a: "Yes. The playground's \"Use it from code\" panel gives you the same call as curl, as an MCP server config you can paste into any MCP client, and as an SDK snippet. LemonCake is drop-in middleware for any MCP server and works with any MCP SDK.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: demoFaq.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

// Single source for the 3 steps: rendered as visible cards below AND emitted
// as HowTo JSON-LD, so structured data can never drift from the page.
const howToSteps = [
  {
    name: "Mint a sandbox Pay Token",
    text: "One click issues a spend-capped sandbox credential. The cap, expiry, and scope are baked into the token itself — the agent holds no wallet and no API key.",
  },
  {
    name: "Run a metered call",
    text: "Fire a $0.01 paid call. The gateway verifies the token, reserves the charge atomically, forwards the request, and settles — each check appears in the live event log.",
  },
  {
    name: "Hit the cap, get a 402",
    text: "Keep calling until the budget drains. The gateway blocks the next call with HTTP 402 (cap_enforced) before it reaches the seller's API; the ledger shows usage and 97% seller revenue per call.",
  },
];

const howToJsonLd = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Try a paid MCP/API call in the LemonCake Playground",
  description: "Run a metered, spend-capped API call through the live LemonCake x402 gateway in about 30 seconds — no login, card, or crypto wallet.",
  totalTime: "PT1M",
  step: howToSteps.map(({ name, text }, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name,
    text,
  })),
};

const demoBreadcrumbJsonLd = breadcrumbJsonLd([
  { name: "LemonCake", path: "/" },
  { name: "Playground", path: "/demo" },
]);

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-[#f6f7f0] text-[#1a0f00] font-sans antialiased">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(demoBreadcrumbJsonLd) }} />

      <nav className="sticky top-0 z-20 border-b border-[#1a0f00]/8 bg-[#f6f7f0]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="h-7 w-7 rounded-md object-cover" />
            <span className="text-[15px] font-black">LemonCake</span>
            <span className="hidden rounded-full border border-[#1a0f00]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#1a0f00]/42 sm:inline">
              Playground
            </span>
          </Link>
          <div className="hidden items-center gap-5 text-[13px] font-semibold text-[#1a0f00]/55 md:flex">
            <Link href="/pricing" className="hover:text-[#1a0f00]">Pricing</Link>
            <Link href="/docs" className="hover:text-[#1a0f00]">Docs</Link>
            <Link href="/about/en" className="hover:text-[#1a0f00]">About</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/app" className="hidden text-[13px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] sm:inline">
              Dashboard
            </Link>
            <Link href="/app" className="rounded-md bg-[#1a0f00] px-3 py-2 text-[12px] font-black text-[#fffd43] hover:bg-[#1a0f00]/88 sm:px-4">
              Monetize API
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <DemoClient />

        {/* ── AEO: server-rendered, crawlable explanation of what the demo proves.
             Quotable answer blocks for AI search engines; matches the JSON-LD above. ── */}
        <section className="mx-auto mt-12 max-w-5xl border-t border-[#1a0f00]/8 pt-10">
          <h2 className="text-[20px] font-black tracking-tight">How this playground works</h2>
          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-[#1a0f00]/62">
            The playground runs the same three-step flow a real AI agent uses to pay for an API with LemonCake:
            it mints a <strong>spend-capped Pay Token</strong> (a prepaid-card-like credential with a hard budget,
            expiry, and endpoint scope), pays <strong>$0.01 per call</strong> through the live x402 gateway, and
            stops with <strong>HTTP 402</strong> the moment the budget runs out. Everything is sandboxed — no
            login, no card, no crypto wallet — but the gateway checks are the production code path.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {howToSteps.map(({ name, text }, i) => (
              <div key={name} className="rounded-xl border border-[#1a0f00]/8 bg-white p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1a0f00]/38">Step {i + 1}</p>
                <h3 className="mt-1 text-[14.5px] font-black leading-tight">{name}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#1a0f00]/62">{text}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-10 text-[20px] font-black tracking-tight">Frequently asked questions</h2>
          <div className="mt-4 space-y-2.5">
            {demoFaq.map(({ q, a }) => (
              <details key={q} className="group rounded-xl border border-[#1a0f00]/8 bg-white open:border-[#1a0f00]/20">
                <summary className="cursor-pointer list-none px-4 py-3 text-[13.5px] font-bold [&::-webkit-details-marker]:hidden">
                  {q}
                </summary>
                <p className="px-4 pb-4 text-[13px] leading-relaxed text-[#1a0f00]/62">{a}</p>
              </details>
            ))}
          </div>

          <p className="mt-8 text-[13px] leading-relaxed text-[#1a0f00]/62">
            Ready to charge for your own endpoint?{" "}
            <Link href="/app" className="font-bold underline underline-offset-2 hover:text-[#1a0f00]">Paste your URL in the dashboard</Link>{" "}
            or scaffold a paid MCP server with{" "}
            <code className="rounded bg-[#1a0f00]/6 px-1.5 py-0.5 font-mono text-[12px]">npx create-lemon-mcp</code>.
            First 3,000 calls free, then 3% — see <Link href="/pricing" className="font-bold underline underline-offset-2 hover:text-[#1a0f00]">pricing</Link>{" "}
            and <Link href="/about/en" className="font-bold underline underline-offset-2 hover:text-[#1a0f00]">how LemonCake works</Link>.
          </p>
        </section>
      </main>

      <footer className="border-t border-[#1a0f00]/8 bg-[#f6f7f0]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-6 text-[11px] text-[#1a0f00]/42 sm:px-6 md:flex-row md:items-center md:justify-between">
          <p>© 2026 evidai · LemonCake</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/pricing" className="hover:text-[#1a0f00]">Pricing</Link>
            <Link href="/docs" className="hover:text-[#1a0f00]">Docs</Link>
            <Link href="/about/en" className="hover:text-[#1a0f00]">About</Link>
            <a href="mailto:contact@aievid.com" className="hover:text-[#1a0f00]">contact@aievid.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
