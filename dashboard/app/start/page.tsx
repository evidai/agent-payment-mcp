import type { Metadata } from "next";
import Link from "next/link";
import { CopyCommand } from "./CopyCommand";
import { TerminalDemo } from "./TerminalDemo";
import { DemoPlayground } from "./DemoPlayground";
import { LangSwitcher } from "@/components/LangSwitcher";

const NPM_COMMAND = "npx -y agent-payment-mcp";
const NPM_URL     = "https://www.npmjs.com/package/agent-payment-mcp";
const GLAMA_URL   = "https://glama.ai/mcp/servers/evidai/lemon-cake";
const GITHUB_URL  = "https://github.com/evidai/lemon-cake";

const OG_TITLE = "agent-payment-mcp — Pay-per-call USDC for any HTTP API";
const OG_DESC  = "Give your AI agent a wallet. One npm command, no signup, no API keys. Demo Mode hits real Wikipedia / FX / httpbin in 30 seconds.";

export const metadata: Metadata = {
  title:       OG_TITLE,
  description: OG_DESC,
  openGraph: {
    title:       OG_TITLE,
    description: OG_DESC,
    url:         "https://www.lemoncake.xyz/start",
    siteName:    "LemonCake",
    type:        "website",
  },
  twitter: {
    card:        "summary_large_image",
    title:       OG_TITLE,
    description: OG_DESC,
  },
  alternates: { canonical: "https://www.lemoncake.xyz/start" },
};

// schema.org JSON-LD: SoftwareApplication + Offer + FAQ.
// Used by Google for rich-result eligibility (price, features, FAQ snippets)
// and by LinkedIn / Slack for richer URL unfurls.
const JSON_LD = {
  "@context":  "https://schema.org",
  "@graph": [
    {
      "@type":            "SoftwareApplication",
      "@id":              "https://www.lemoncake.xyz/start#app",
      "name":             "agent-payment-mcp",
      "alternateName":    "LemonCake MCP server",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem":  "macOS, Linux, Windows (Node.js 20+)",
      "description":      OG_DESC,
      "url":              "https://www.lemoncake.xyz/start",
      "downloadUrl":      NPM_URL,
      "softwareVersion":  "0.5.1",
      "license":          "https://opensource.org/licenses/MIT",
      "softwareRequirements": "Node.js 20+, MCP-compatible client (Claude Desktop, Cursor, Cline)",
      "featureList": [
        "Pay-per-call USDC billing for any HTTP API",
        "Demo Mode runs without signup",
        "x402-compatible interface (receipt + 402 challenge parser)",
        "6 pre-written MCP prompts",
        "Built-in Japan tax APIs (NTA invoice, gBizINFO, e-Gov)",
      ],
      "offers": {
        "@type":         "Offer",
        "price":         "0.001",
        "priceCurrency": "USD",
        "description":   "x402 baseline per-call price; first 1,000 calls/month free; non-custodial USDC on Base via ERC-2612 permit",
        "availability":  "https://schema.org/InStock",
      },
      "publisher": {
        "@type":  "Organization",
        "name":   "LemonCake",
        "url":    "https://www.lemoncake.xyz",
      },
    },
    {
      "@type":  "FAQPage",
      "mainEntity": [
        {
          "@type":         "Question",
          "name":          "Do I need to sign up to try it?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":  "No. Run npx -y agent-payment-mcp with no env vars and Demo Mode hits real Wikipedia / FX / httpbin without an account. The /start landing page also has an in-browser playground that works with zero setup.",
          },
        },
        {
          "@type":         "Question",
          "name":          "How is this different from Cursor / Cline / official MCP servers?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":  "agent-payment-mcp is a non-custodial billing proxy: it lets your agent call paid APIs (Tavily, Serper, Hunter.io, gBizINFO, the Japanese NTA invoice API) without you handing over per-vendor API keys. One ERC-2612 permit signature (90 days, $25/day hard cap) covers all of them — USDC stays in your own wallet.",
          },
        },
        {
          "@type":         "Question",
          "name":          "Is it x402 compatible?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text":  "Yes — natively. LemonCake operates an x402 facilitator on Base USDC: POST /api/x402/verify accepts ERC-3009 signatures, hybrid 'both' mode in @lemon-cake/x402-server routes through Coinbase CDP for x402 Bazaar / AWS Bedrock AgentCore discovery, then mirrors metering to LemonCake for invoicing + JPY off-ramp.",
          },
        },
      ],
    },
  ],
};

export default function StartPage() {
  return (
    <main className="min-h-screen bg-[#06060a] text-white antialiased">
      <script
        type="application/ld+json"
        // Next.js requires dangerouslySetInnerHTML for raw script content
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* ───── Non-custodial banner — permit is the only flow ───── */}
      <div className="bg-[#fffd43] text-[#06060a] border-b border-yellow-500">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4 text-sm">
          <span>
            🍋 <strong>非カストディ</strong>：USDC はあなたのウォレットに残ったまま、ERC-2612 permit 1 署名で 90 日有効。FSA 確認済（登録不要）。
          </span>
          <Link
            href="/start/v2"
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#06060a] text-[#fffd43] px-3 py-1 text-xs font-bold hover:bg-gray-800 transition"
          >
            1 分で開始 →
          </Link>
        </div>
      </div>

      {/* ───── Top strip ───── */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#06060a]/85 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[#fffd43] text-xl">🍋</span>
            <span className="font-semibold tracking-tight">LemonCake</span>
            <span className="hidden sm:inline text-[11px] font-mono text-white/30 ml-1">agent-payment-mcp</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3">
            <a href={GLAMA_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:inline text-[13px] text-white/50 hover:text-white/90 transition">Try in browser ↗</a>
            <a href={NPM_URL}   target="_blank" rel="noopener noreferrer" className="hidden sm:inline text-[13px] text-white/50 hover:text-white/90 transition">npm</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:inline text-[13px] text-white/50 hover:text-white/90 transition">GitHub</a>
            <Link href="/register" className="text-[12px] sm:text-[13px] font-semibold px-3 sm:px-4 py-1.5 bg-[#fffd43] text-[#06060a] rounded-lg hover:bg-[#fffd43]/90 transition">
              Sign up
            </Link>
            <LangSwitcher current="ja" basePath="/start" />
          </nav>
        </div>
      </header>

      {/* ───── HERO ───── */}
      <section className="relative overflow-hidden border-b border-white/5">
        {/* subtle vignette */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[820px] h-[420px] rounded-full bg-[#fffd43]/5 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-12 items-center">
            {/* left: copy */}
            <div className="flex flex-col items-start gap-6">
              <span className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#fffd43]/80 bg-[#fffd43]/5 border border-[#fffd43]/20 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fffd43] animate-pulse" />
                MCP server · USDC · x402-compatible · agent payments
              </span>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
                Pay-per-call USDC <br className="hidden md:inline" />
                for <span className="text-[#fffd43]">any HTTP API</span>.
              </h1>

              <p className="text-base md:text-lg text-white/60 leading-relaxed">
                Give your AI agent a wallet. Your Claude / Cursor / Cline calls
                Tavily, ElevenLabs, gBizINFO — without you handing over API keys.
                Per-call billing in USDC, refunds on failure, capped spending.
              </p>

              <div className="w-full space-y-3">
                <CopyCommand value={NPM_COMMAND} label="Copy install command" />
                <p className="text-[12px] text-white/40 leading-relaxed">
                  Paste into any terminal. With <strong className="text-white/60">no environment variables</strong>, it boots in <span className="text-[#fffd43]">Demo Mode</span> — real Wikipedia / FX / httpbin, no signup, no card.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 mt-1">
                <a
                  href={GLAMA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#fffd43] text-[#06060a] font-semibold text-sm hover:bg-[#fffd43]/90 transition"
                >
                  Try in browser sandbox →
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/80 font-semibold text-sm hover:bg-white/10 transition"
                >
                  How it works
                </a>
              </div>

              {/* badges row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-[11px] text-white/40">
                <Pill label="MIT licensed" />
                <Pill label="MCP 1.10+" />
                <Pill label="Node 20+" />
                <Pill label="Listed on Glama" accent />
                <Pill label="Demo Mode (no auth)" accent />
                <Pill label="x402-compatible" accent />
              </div>
            </div>

            {/* right: live terminal demo */}
            <div className="lg:sticky lg:top-20">
              <TerminalDemo />
              <p className="text-[11px] text-white/30 mt-3 text-center font-mono">
                ↑ live capture · this is what `npx -y agent-payment-mcp` actually outputs
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ───── INTERACTIVE PLAYGROUND ───── */}
      <Section title="Try it on this page — no install, no signup" eyebrow="Live demo">
        <p className="text-white/50 text-sm mb-6 max-w-2xl">
          The widget below hits the same Wikipedia / FX / httpbin upstreams that <code className="font-mono text-[#fffd43]/80">npx -y agent-payment-mcp</code> uses in Demo Mode. Same response shape, same x402-compatible receipt, $0 charged. If this convinces you the call shape is right, install the MCP server and your agent gets the same JSON back.
        </p>
        <DemoPlayground />
      </Section>

      {/* ───── PROBLEMS ───── */}
      <Section title="Why this exists" eyebrow="The friction we kill">
        <div className="grid md:grid-cols-3 gap-5">
          <Card
            title="Stop juggling API keys."
            body="Your agent shouldn't need 12 different SaaS dashboards. One ERC-2612 permit covers Tavily, Serper, ElevenLabs, gBizINFO, Hunter.io — the upstream secret stays with us, USDC stays in your wallet."
          />
          <Card
            title="Stop manual signups."
            body="Every new API needs an email, a card, a quota tier. With pay-per-call, your agent calls a service for $0.001 and gets the result on-chain. No relationship to set up."
          />
          <Card
            title="Stop overspending."
            body="KYA (Know-Your-Agent) limits cap your agent's spend per session, per day, per service. Issue a token with a $5 ceiling and walk away."
          />
        </div>
      </Section>

      {/* ───── HOW IT WORKS ───── */}
      <Section title="30-second walkthrough" eyebrow="How it works" id="how-it-works">
        <ol className="space-y-5">
          <Step
            n={1}
            title="Run the MCP server (no signup)"
            body={
              <>
                Add this to <code className="font-mono text-[#fffd43]/90">claude_desktop_config.json</code> (or your Cursor / Cline equivalent):
                <pre className="mt-3 rounded-xl bg-black/60 border border-white/10 p-4 overflow-x-auto text-[12px] md:text-[13px] font-mono text-white/80">{`{
  "mcpServers": {
    "pay-per-call": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"]
    }
  }
}`}</pre>
                <p className="text-[12px] text-white/40 mt-2">No env vars = Demo Mode. Boot the Inspector and call <code className="font-mono">demo_search</code> to hit real Wikipedia results.</p>
              </>
            }
          />
          <Step
            n={2}
            title="Ask Claude to use it"
            body={
              <>
                <p className="text-white/60">Open Claude Desktop and type:</p>
                <pre className="mt-3 rounded-xl bg-black/60 border border-white/10 p-4 overflow-x-auto text-[13px] md:text-[14px] text-[#fffd43]/90">&quot;Search Wikipedia for &lsquo;Model Context Protocol&rsquo; via agent-payment-mcp and summarise.&quot;</pre>
                <p className="text-[12px] text-white/40 mt-2">Claude picks <code className="font-mono">call_service</code>, fires <code className="font-mono">demo_search</code>, returns the summary. No API key required.</p>
              </>
            }
          />
          <Step
            n={3}
            title="Sign one permit to unlock paid services"
            body={
              <>
                Visit <Link href="/start/v2" className="text-[#fffd43] hover:underline font-mono">/start/v2</Link> → sign in with Google → sign <strong className="text-white/90">one ERC-2612 permit</strong> (90 days, $25/day hard cap, no gas) → copy <code className="font-mono text-[#fffd43]/90">LEMON_CAKE_PERMIT</code> into the env block above. Your agent can then call Tavily, Serper, Hunter.io, the NTA invoice API, gBizINFO, and more at <strong className="text-white/90">$0.001/call</strong>.
                <p className="mt-3 flex flex-wrap gap-3">
                  <Link href="/start/v2" className="text-[#fffd43] hover:underline font-semibold text-sm">
                    Get a permit →
                  </Link>
                  <Link href="/sellers" className="text-[#fffd43]/60 hover:text-[#fffd43] hover:underline text-sm">
                    or publish your own API →
                  </Link>
                </p>
              </>
            }
          />
        </ol>
      </Section>

      {/* ───── PROMPTS ───── */}
      <Section title="Pre-written prompts" eyebrow="Try without typing">
        <p className="text-white/50 text-sm mb-6 max-w-2xl">
          The MCP server ships with 6 ready-to-fire prompts. They show up in the
          Glama Inspector / Claude Desktop / Cursor prompt picker. Click one and
          the agent runs the full demo flow.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <PromptCard emoji="🎮" name="explore-demo" desc="setup → list_services → demo_search → demo_fx, no auth needed" />
          <PromptCard emoji="🛍" name="discover-marketplace" desc="List approved services and recommend top 3 for an agent's use case" />
          <PromptCard emoji="🇯🇵" name="japan-tax-check" desc="Validate 適格請求書発行事業者番号 against the NTA registry" />
          <PromptCard emoji="💰" name="spend-with-budget" desc="check_balance → call_service → check_balance, see KYA caps in action" />
          <PromptCard emoji="🔄" name="real-vs-demo" desc="Hit demo_search and a real Serper service with the same query" />
          <PromptCard emoji="🏯" name="japan-finance-bundle" desc="gBizINFO + 国税庁 + e-Gov bundled Japan-corp research workflow" />
        </div>
      </Section>

      {/* ───── PRICING ───── */}
      <Section title="Transparent pricing" eyebrow="Cost">
        <div className="grid md:grid-cols-3 gap-5">
          <PriceCard
            label="Per call"
            value="$0.001"
            sub="x402 baseline — same price as Coinbase CDP facilitator"
          />
          <PriceCard
            label="Free tier"
            value="1,000/月"
            sub="First 1,000 calls/month free — perfect for prototyping"
          />
          <PriceCard
            label="Provider Pro"
            value="¥9,800"
            sub="freee/MF 自動仕訳 + 適格請求書自動発行 (publish your API)"
            accent
          />
        </div>
      </Section>

      {/* ───── x402 ───── */}
      <Section title="x402-compatible interface" eyebrow="Standards">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-6 md:p-8">
          <p className="text-white/70 leading-relaxed">
            LemonCake is a native <a href="https://www.x402.org/" target="_blank" rel="noopener noreferrer" className="text-[#fffd43] hover:underline">x402</a> facilitator on Base USDC.
            ERC-3009 signatures settle on-chain via <code className="font-mono text-[#fffd43]/80">/api/x402/verify</code>.
            With <code className="font-mono text-[#fffd43]/80">@lemon-cake/x402-server</code> in <em>hybrid mode</em>, your endpoint is also auto-indexed in the
            <a href="https://docs.cdp.coinbase.com/x402/bazaar" target="_blank" rel="noopener noreferrer" className="text-[#fffd43] hover:underline"> Coinbase x402 Bazaar</a> and discoverable from <a href="https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments.html" target="_blank" rel="noopener noreferrer" className="text-[#fffd43] hover:underline">AWS Bedrock AgentCore</a> — without giving up freee/MF auto-journal or JPY off-ramp.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <X402Card
              kind="✓"
              title="Receipt on success"
              body="`x402Receipt` field with scheme / chain / asset / amount / recipient / paymentIntentId / settledAt — same parser works for on-chain x402."
            />
            <X402Card
              kind="✓"
              title="402 challenge parser"
              body="Detects WWW-Authenticate: x402, X-402-* headers, and body.x402. Surfaced as `x402Challenge` with source attribution."
            />
            <X402Card
              kind="✓"
              title="PAYMENT_PENDING retry"
              body="Async settlement returns retryAfterMs + retryContract; same idempotencyKey resumes without double-charge."
            />
          </div>

          <pre className="mt-6 rounded-xl bg-black/60 border border-white/10 p-4 overflow-x-auto text-[12px] md:text-[13px] font-mono text-white/80">{`{
  "status": 200,
  "chargeId": "ch_abc123",
  "amountUsdc": "0.001",
  "x402Receipt": {
    "scheme":         "exact",
    "network":        "base-mainnet",
    "asset":          "USDC",
    "amount":         "0.001",
    "recipient":      "serper",
    "txHash":         "0xabc…f01",
    "settledAt":      "2026-05-22T14:50:11.019Z"
  }
}`}</pre>
          <p className="text-[12px] text-white/40 mt-3">
            Demo Mode emits the same shape — write your handler against{" "}
            <code className="font-mono text-white/60">demo_search</code> and ship unchanged.
          </p>
        </div>
      </Section>

      {/* ───── JAPAN ───── */}
      <Section title="Japanese tax & corporate APIs (built-in)" eyebrow="Differentiator">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent p-6 md:p-8">
          <p className="text-white/70 leading-relaxed">
            Most agent payment infrastructure ignores Japan. We don&apos;t.
            Native MCP tools for inbound JP business compliance:
          </p>
          <ul className="mt-5 grid sm:grid-cols-2 gap-3 text-sm">
            <JpRow ja="国税庁 適格請求書発行事業者番号 検証" en="NTA invoice issuer verification" />
            <JpRow ja="gBizINFO 法人情報" en="gBizINFO corporate registry" />
            <JpRow ja="e-Gov 法令検索" en="e-Gov statutes search" />
            <JpRow ja="TRUSTDOCK eKYC" en="TRUSTDOCK eKYC" />
            <JpRow ja="源泉徴収判定 + 計算" en="Source-withholding ruling + calculation" />
            <JpRow ja="freee / Money Forward 仕訳出力" en="freee / MF journal export" />
          </ul>
          <p className="text-[12px] text-white/40 mt-5">
            The <code className="font-mono">japan-tax-check</code> and{" "}
            <code className="font-mono">japan-finance-bundle</code> prompts wrap these into one-click flows.
          </p>
        </div>
      </Section>

      {/* ───── FINAL CTA ───── */}
      <section className="relative border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-20 md:py-28 text-center">
          <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            Ship an agent that <span className="text-[#fffd43]">pays for itself</span>.
          </h2>
          <p className="text-white/55 text-base md:text-lg mt-4 max-w-2xl mx-auto">
            Demo Mode runs in 30 seconds. Real services unlock with a $5 top-up.
            No subscription, MIT-licensed source.
          </p>
          <div className="mt-8 max-w-xl mx-auto">
            <CopyCommand value={NPM_COMMAND} label="Copy install command" />
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-6">
            <a
              href={GLAMA_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#fffd43] text-[#06060a] font-semibold text-sm hover:bg-[#fffd43]/90 transition"
            >
              Try in browser sandbox →
            </a>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/80 font-semibold text-sm hover:bg-white/10 transition"
            >
              Create free account
            </Link>
          </div>
        </div>
      </section>

      {/* ───── FOOTER ───── */}
      <footer className="border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-wrap items-center justify-between gap-4 text-[12px] text-white/40">
          <div className="flex items-center gap-2">
            <span>🍋</span>
            <span>LemonCake · MIT</span>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-1">
            <a href={NPM_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white/80">npm</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white/80">GitHub</a>
            <a href={GLAMA_URL} target="_blank" rel="noopener noreferrer" className="hover:text-white/80">Glama</a>
            <Link href="/about" className="hover:text-white/80">About</Link>
            <Link href="/legal/terms" className="hover:text-white/80">Terms</Link>
            <Link href="/support" className="hover:text-white/80">Support</Link>
          </nav>
        </div>
      </footer>
    </main>
  );
}

/* ────────── helpers ────────── */

function Section({
  children,
  title,
  eyebrow,
  id,
}: {
  children: React.ReactNode;
  title: string;
  eyebrow?: string;
  id?: string;
}) {
  return (
    <section id={id} className="border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        {eyebrow && (
          <p className="text-[11px] font-mono uppercase tracking-wider text-[#fffd43]/70 mb-3">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl md:text-4xl font-black tracking-tight leading-tight mb-8 md:mb-10">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 hover:border-white/20 transition">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-white/55 text-sm leading-relaxed">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 md:p-8">
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-[#fffd43] font-mono font-bold tabular-nums">{n.toString().padStart(2, "0")}</span>
        <h3 className="text-xl md:text-2xl font-bold tracking-tight">{title}</h3>
      </div>
      <div className="text-white/65 text-sm md:text-base leading-relaxed">{body}</div>
    </li>
  );
}

function PromptCard({ emoji, name, desc }: { emoji: string; name: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-[#fffd43]/30 transition">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-base">{emoji}</span>
        <code className="font-mono text-sm text-[#fffd43]/90">{name}</code>
      </div>
      <p className="text-white/50 text-[12.5px] leading-relaxed">{desc}</p>
    </div>
  );
}

function X402Card({ kind, title, body }: { kind: string; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[#fffd43] font-bold">{kind}</span>
        <span className="text-white/85 font-semibold text-sm">{title}</span>
      </div>
      <p className="text-white/50 text-[12.5px] leading-relaxed">{body}</p>
    </div>
  );
}

function PriceCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-6 ${accent ? "border-[#fffd43]/30 bg-[#fffd43]/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
      <p className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">{label}</p>
      <p className="text-3xl md:text-4xl font-black tracking-tight mt-2">{value}</p>
      <p className="text-white/50 text-xs mt-2 leading-relaxed">{sub}</p>
    </div>
  );
}

function JpRow({ ja, en }: { ja: string; en: string }) {
  return (
    <li className="flex items-baseline gap-3">
      <span className="text-[#fffd43] mt-0.5 shrink-0">✓</span>
      <span className="text-white/75">
        <span>{ja}</span>
        <span className="text-white/35 ml-1.5 text-[12px]">/ {en}</span>
      </span>
    </li>
  );
}

function Pill({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 ${accent ? "text-[#fffd43]/80" : ""}`}>
      <span className={`w-1 h-1 rounded-full ${accent ? "bg-[#fffd43]" : "bg-white/30"}`} />
      <span>{label}</span>
    </span>
  );
}
