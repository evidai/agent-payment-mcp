/**
 * /en/start — English landing page for global discovery.
 *
 * Mirrors /start but English-first and USD-primary pricing. Heavily
 * focused on x402 / non-custodial / global narrative since the JP-
 * specific accounting features (freee/MF/qualified invoice/JPY off-
 * ramp) are not the hook for non-JP audiences.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { LangSwitcher } from "@/components/LangSwitcher";

export const metadata: Metadata = {
  title: "LemonCake — Pay-per-call USDC for any HTTP API (non-custodial, x402)",
  description:
    "Give your AI agent a USDC wallet. Pay-per-call any HTTP API. Non-custodial: one ERC-2612 permit signature gives 90 days of bounded spend. x402 Bazaar discoverable via Coinbase CDP hybrid mode.",
  alternates: { canonical: "https://lemoncake.xyz/en/start" },
};

const NPM_COMMAND = "npx -y agent-payment-mcp";

export default function StartPageEn() {
  return (
    <main className="min-h-screen bg-[#06060a] text-white antialiased">

      {/* ───── Non-custodial banner ───── */}
      <div className="bg-[#fffd43] text-[#06060a] border-b border-yellow-500">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between gap-4 text-sm">
          <span>
            🍋 <strong>Non-custodial</strong>: USDC stays in your wallet. One ERC-2612 permit, 90 days, $25/day hard cap. FSA-confirmed (no license required).
          </span>
          <Link
            href="/start/v2"
            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#06060a] text-[#fffd43] px-3 py-1 text-xs font-bold hover:bg-gray-800 transition"
          >
            Get started →
          </Link>
        </div>
      </div>

      {/* ───── Top strip ───── */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#06060a]/85 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/en/start" className="flex items-center gap-2">
            <span className="text-[#fffd43] text-xl">🍋</span>
            <span className="font-semibold tracking-tight">LemonCake</span>
            <span className="hidden sm:inline text-[11px] font-mono text-white/30 ml-1">agent-payment-mcp</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-3 text-[13px]">
            <a href="https://www.npmjs.com/package/agent-payment-mcp" target="_blank" rel="noopener noreferrer" className="hidden sm:inline text-white/50 hover:text-white/90 transition">npm</a>
            <a href="https://github.com/evidai/agent-payment-mcp" target="_blank" rel="noopener noreferrer" className="hidden sm:inline text-white/50 hover:text-white/90 transition">GitHub</a>
            <Link href="/en/sellers" className="text-white/50 hover:text-white/90">For Providers</Link>
            <LangSwitcher current="en" basePath="/start" />
          </nav>
        </div>
      </header>

      {/* ───── HERO ───── */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[820px] h-[420px] rounded-full bg-[#fffd43]/5 blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-12 items-center">
            <div className="flex flex-col items-start gap-6">
              <span className="inline-flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#fffd43]/80 bg-[#fffd43]/5 border border-[#fffd43]/20 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#fffd43] animate-pulse" />
                MCP server · USDC · x402-native · non-custodial
              </span>

              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
                Pay-per-call USDC <br className="hidden md:inline" />
                for <span className="text-[#fffd43]">any HTTP API</span>.
              </h1>

              <p className="text-base md:text-lg text-white/60 leading-relaxed">
                Give your AI agent a wallet — and never write a JWT or hand over a card.
                One ERC-2612 permit signature, 90 days, $25/day cap. Your USDC never
                leaves your wallet.
              </p>

              <div className="w-full">
                <pre className="rounded-xl bg-black/60 border border-white/10 p-4 overflow-x-auto text-[13px] md:text-[14px] font-mono text-white/80">{NPM_COMMAND}</pre>
                <p className="mt-2 text-[12px] text-white/40 leading-relaxed">
                  With <strong className="text-white/60">no environment variables</strong>, it boots in <span className="text-[#fffd43]">Demo Mode</span> — real Wikipedia / FX / httpbin, no signup, no card.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 mt-1">
                <Link href="/start/v2" className="inline-flex items-center gap-2 rounded-full bg-[#fffd43] px-5 py-2.5 text-sm font-bold text-[#06060a] hover:bg-[#fffd43]/90 transition">
                  Sign a permit →
                </Link>
                <Link href="/en/sellers" className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-bold text-white/80 hover:border-white/40 transition">
                  Publish your API →
                </Link>
              </div>
            </div>

            {/* right: code mock */}
            <div className="lg:pl-6">
              <div className="rounded-2xl bg-black/60 border border-white/10 p-5">
                <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2 font-mono">claude_desktop_config.json</p>
                <pre className="text-[12px] font-mono text-white/80 leading-relaxed overflow-x-auto">{`{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"],
      "env": {
        "LEMON_CAKE_PERMIT": "<paste blob>"
      }
    }
  }
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── x402 / Discoverability ───── */}
      <Section title="Native x402 facilitator" eyebrow="Standards">
        <p className="text-white/70 leading-relaxed max-w-3xl">
          LemonCake operates an x402 facilitator on Base USDC.
          ERC-3009 signatures settle on-chain via <code className="font-mono text-[#fffd43]/80">/api/x402/verify</code>.
          With <code className="font-mono text-[#fffd43]/80">@lemon-cake/x402-server</code> in <em>hybrid mode</em>, your
          endpoint is auto-indexed in the
          <a href="https://docs.cdp.coinbase.com/x402/bazaar" target="_blank" rel="noopener noreferrer" className="text-[#fffd43] hover:underline"> Coinbase x402 Bazaar</a> and
          discoverable from <a href="https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments.html" target="_blank" rel="noopener noreferrer" className="text-[#fffd43] hover:underline">AWS Bedrock AgentCore</a>.
        </p>

        <pre className="mt-6 rounded-xl bg-black/60 border border-white/10 p-4 overflow-x-auto text-[12px] md:text-[13px] font-mono text-white/80">{`{
  "status": 200,
  "chargeId": "ch_abc123",
  "amountUsdc": "0.001",
  "x402Receipt": {
    "scheme":         "exact",
    "network":        "base",
    "asset":          "USDC",
    "amount":         "0.001",
    "txHash":         "0xabc…f01",
    "settledAt":      "2026-05-22T14:50:11.019Z"
  }
}`}</pre>
      </Section>

      {/* ───── Pricing (USD) ───── */}
      <Section title="Plans" eyebrow="Pricing">
        <p className="text-white/50 text-sm mb-6 max-w-2xl">
          Pay-per-call is commodity: $0.001 baseline (matching Coinbase CDP).
          The first 1,000 calls/month are on us. Subscriptions unlock the
          accounting and off-ramp tooling around it.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: "Free",     price: "$0",    sub: "1,000 calls/mo, basic dashboard" },
            { name: "Pro",      price: "$69",   sub: "10K calls + accounting integrations + invoice automation" },
            { name: "Business", price: "$199",  sub: "100K calls + off-ramp + multi-wallet + SLA 99.9%" },
            { name: "Scale",    price: "$699",  sub: "500K calls + audit log + team + dedicated Slack" },
          ].map((p) => (
            <div key={p.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[11px] uppercase tracking-wider text-white/40 font-mono">{p.name}</p>
              <p className="mt-2 text-2xl font-black font-mono">{p.price}<span className="text-xs font-normal text-white/40">/mo</span></p>
              <p className="mt-2 text-xs text-white/50 leading-relaxed">{p.sub}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[11px] text-white/40">
          Above the free tier: 100% of your provider price goes to you. LemonCake takes nothing per-call.
        </p>
      </Section>

      {/* ───── Footer ───── */}
      <footer className="border-t border-white/5 py-10 mt-20">
        <div className="max-w-6xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-[12px] text-white/40">
          <div className="flex items-center gap-3">
            <span className="text-[#fffd43]">🍋</span>
            <span>LemonCake (Evid AI)</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/en/security" className="hover:text-white/70">Security</Link>
            <Link href="/en/privacy" className="hover:text-white/70">Privacy</Link>
            <Link href="/en/legal/terms" className="hover:text-white/70">Terms</Link>
            <a href="mailto:contact@aievid.com" className="hover:text-white/70">contact@aievid.com</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────
// Section helper
// ─────────────────────────────────────────────────────────────
function Section({ title, eyebrow, children }: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-14 md:py-20">
        {eyebrow && <p className="text-[11px] uppercase tracking-wider text-[#fffd43]/70 font-mono mb-2">{eyebrow}</p>}
        <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-6">{title}</h2>
        {children}
      </div>
    </section>
  );
}

