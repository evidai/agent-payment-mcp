import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LemonCake Trade — AI agent trading stack on Solana + Base",
  description: "4 MCPs that let Claude / Cursor / Cline trade on Solana DEX, GMX perps, Alpaca paper, and Dinari tokenized stocks. ERC-2612 on-chain spending caps, non-custodial.",
  alternates: { canonical: "https://lemoncake.xyz/trade" },
  openGraph: {
    title: "LemonCake Trade — AI agent trading stack",
    description: "Solana DEX, GMX perps, US stocks (paper + tokenized) — all through Claude. On-chain $/day cap.",
    url: "https://lemoncake.xyz/trade",
    type: "website",
  },
};

interface TradeProduct {
  name:         string;
  npm:          string;
  category:     "DEX" | "Perps" | "Paper" | "Tokenized";
  network:      string;
  pricePerCall: string;
  tagline:      string;
  bullets:      string[];
  who:          string;
  github:       string;
  install:      string;
  status:       "live" | "beta" | "alpha";
}

const PRODUCTS: TradeProduct[] = [
  {
    name:         "xstocks-mcp",
    npm:          "xstocks-mcp",
    category:     "DEX",
    network:      "Solana",
    pricePerCall: "$0.10 / swap",
    tagline:      "Claude trades Solana xStocks via Jupiter DEX",
    bullets: [
      "AAPLx · TSLAx · SPYx · NVDAx 等 (Backed Finance / Jupiter aggregator)",
      "Daily USD cap in ~/.xstocks/cap.json — agent can't override from inside a tool call",
      "Real mint resolution + scam token filter built-in",
      "Dry-run default; opt-in for live swaps with SOLANA_WALLET_PRIVATE_KEY + XSTOCKS_ALLOW_LIVE",
    ],
    who:    "DeFi-aware retail trader who wants tokenized US stock exposure via AI",
    github: "https://github.com/evidai/xstocks-mcp",
    install:"npx -y xstocks-mcp",
    status: "live",
  },
  {
    name:         "gmx-mcp",
    npm:          "gmx-mcp",
    category:     "Perps",
    network:      "Arbitrum / Avalanche",
    pricePerCall: "$0.10 / trade",
    tagline:      "Claude trades GMX perpetuals with on-chain spending caps",
    bullets: [
      "GMX v2 markets (BTC / ETH / SOL / ARB perp 等)",
      "Long / short positions, leverage configurable",
      "Daily USD notional cap, position size cap",
      "Position info / PnL tracking tools",
    ],
    who:    "Perps trader who wants AI-assisted entries/exits with guardrails",
    github: "https://github.com/evidai/gmx-mcp",
    install:"npx -y gmx-mcp",
    status: "beta",
  },
  {
    name:         "alpaca-guard-mcp",
    npm:          "alpaca-guard-mcp",
    category:     "Paper",
    network:      "Alpaca (US equities)",
    pricePerCall: "$0.10 / trade",
    tagline:      "Claude paper-trades US stocks via Alpaca with kill-switch",
    bullets: [
      "Alpaca paper trading account (free, US residents only for live)",
      "8 tools: list_positions / get_quote / buy_stock / sell_stock 等",
      "Daily $ cap @ ~/.alpaca-guard/cap.json — strict ledger guard",
      "Paper default; live trading requires explicit env vars",
    ],
    who:    "US equity trader prototyping AI strategies before risking real capital",
    github: "https://github.com/evidai/alpaca-guard-mcp",
    install:"npx -y alpaca-guard-mcp",
    status: "live",
  },
  {
    name:         "tokenized-stock-mcp",
    npm:          "tokenized-stock-mcp",
    category:     "Tokenized",
    network:      "Base (USDC)",
    pricePerCall: "$0.10 / trade",
    tagline:      "Claude buys US stocks (Dinari dShares) directly in USDC",
    bullets: [
      "Dinari dShares: AAPL / TSLA / NVDA 等を USDC で直接買付",
      "Sandbox mode default (DINARI_SANDBOX=true)",
      "Live: DINARI_SANDBOX=false + TOKENIZED_STOCK_ALLOW_LIVE=yes-i-understand",
      "Pay Token pass-through — user wallet funds the trade direct, LemonCake never holds USDC",
    ],
    who:    "Non-US trader who wants direct US stock exposure via stablecoin",
    github: "https://github.com/evidai/tokenized-stock-mcp",
    install:"npx -y tokenized-stock-mcp",
    status: "live",
  },
];

const STATUS_STYLE: Record<TradeProduct["status"], string> = {
  live:  "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  beta:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  alpha: "bg-violet-500/15 text-violet-300 border-violet-500/30",
};

const CATEGORY_ICON: Record<TradeProduct["category"], string> = {
  DEX:       "🌊",
  Perps:     "📈",
  Paper:     "📝",
  Tokenized: "🎟️",
};

export default function TradePage() {
  return (
    <main className="min-h-screen bg-[#06060a] text-white font-sans antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-[#06060a]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Link href="/about/en" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover" />
              <span className="font-bold text-[15px] text-white">LemonCake</span>
              <span className="text-[10px] text-white/40 ml-2 font-mono">/trade</span>
            </Link>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <Link href="/start/v2" className="text-white/50 hover:text-white/90">Sign permit</Link>
            <Link href="/me"       className="text-white/50 hover:text-white/90">My account</Link>
            <Link href="/docs"     className="text-white/50 hover:text-white/90">Docs</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#fffd43] w-full">
        <div className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
          <div className="inline-block px-3 py-1 mb-6 bg-[#1a0f00]/8 border border-[#1a0f00]/15 rounded-full text-[11px] font-mono text-[#1a0f00]/70">
            Built with LemonCake · Open source MCPs · MIT
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-[#1a0f00] mb-5 leading-[1.08]">
            Built with<br/>
            <span className="text-black">LemonCake.</span>
          </h1>
          <p className="text-base md:text-lg text-[#1a0f00]/60 max-w-2xl mx-auto mb-8 leading-relaxed">
            Four production MCP servers that use the LemonCake SDK in real life.
            Reference integrations for the AI API Gatekeeper — fork them, install them, learn from the source.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/start/free?utm_source=trade&utm_medium=hero&utm_campaign=trade_launch"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a0f00] text-white font-semibold rounded-xl hover:bg-[#1a0f00]/80 transition-colors text-sm"
            >
              Build your own → /start/free
            </Link>
            <a
              href="#products"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#1a0f00] border border-[#1a0f00]/15 font-semibold rounded-xl hover:bg-white/90 transition-colors text-sm"
            >
              Pick a tool ↓
            </a>
          </div>
        </div>
      </section>

      {/* Products */}
      <section id="products" className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">
          Available Now
        </p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-12">
          Pick the market<br/>your agent should trade
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PRODUCTS.map((p) => (
            <article key={p.name} className="rounded-2xl bg-white/4 border border-white/8 p-6 flex flex-col gap-4 hover:border-[#fffd43]/30 transition">
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl leading-none">{CATEGORY_ICON[p.category]}</span>
                  <div>
                    <h3 className="text-xl font-black text-white">{p.name}</h3>
                    <p className="text-[11px] font-mono text-white/40 mt-0.5">
                      {p.category} · {p.network} · {p.pricePerCall}
                    </p>
                  </div>
                </div>
                <span className={`flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_STYLE[p.status]}`}>
                  {p.status}
                </span>
              </div>

              <p className="text-sm text-white/80 leading-relaxed">{p.tagline}</p>

              <ul className="text-[12px] text-white/60 space-y-1.5 pl-4 list-disc">
                {p.bullets.map((b, i) => (<li key={i}>{b}</li>))}
              </ul>

              <div className="text-[11px] text-white/40 leading-relaxed border-l border-white/10 pl-3 italic">
                Built for: {p.who}
              </div>

              {/* Install */}
              <div className="rounded-lg bg-black/40 border border-white/8 p-3 font-mono text-[11px] text-white/80 break-all">
                <span className="text-white/40">$</span> {p.install}
              </div>

              <div className="flex items-center gap-3 text-[12px] mt-auto">
                <a
                  href={p.github}
                  target="_blank" rel="noopener noreferrer"
                  className="text-white/60 hover:text-[#fffd43] transition"
                >
                  GitHub →
                </a>
                <a
                  href={`https://www.npmjs.com/package/${p.npm}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-white/60 hover:text-[#fffd43] transition"
                >
                  npm →
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* How it works (3 step) */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-white/8">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">
          How it works
        </p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-12">
          Three steps, ninety days
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { n: "01", title: "Sign one permit", body: "Google sign-in → embedded wallet → ERC-2612 permit on Base. Caps your USDC spend at $25/day for 90 days. No gas, no further sign-offs." },
            { n: "02", title: "Add the MCP",     body: "npx -y xstocks-mcp / gmx-mcp / etc. in Claude Desktop config. Restart Claude. The agent now sees the trading tools." },
            { n: "03", title: "Just ask",        body: "「Buy 100 AAPLx if it dips below $230」「Open a 2x ETH long on GMX」 — the agent calls the tool, pays $0.10/trade, and stops at the cap." },
          ].map(({ n, title, body }) => (
            <div key={n} className="rounded-2xl border border-white/8 bg-white/4 p-6">
              <p className="text-[#fffd43]/80 font-mono text-[11px] mb-3">{n}</p>
              <h3 className="text-lg font-black text-white mb-3">{title}</h3>
              <p className="text-[13px] text-white/60 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Safety */}
      <section className="max-w-4xl mx-auto px-6 py-20 border-t border-white/8">
        <p className="text-center text-[11px] font-semibold text-emerald-400/70 uppercase tracking-widest mb-4">
          Safety model
        </p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-12">
          Even a hallucinating agent<br/>can't break the bank
        </h2>

        <div className="space-y-3">
          {[
            { icon: "🔒", title: "On-chain hard cap", body: "USDC contract itself enforces the per-day spend cap. The agent literally can't transfer more — the EVM rejects the tx." },
            { icon: "🚫", title: "No custody",         body: "LemonCake never holds your funds. USDC moves Buyer wallet → Provider wallet directly. Verified by Japan FSA Q1-Q11." },
            { icon: "⏰", title: "90-day expiry",       body: "Permit auto-expires after 90 days. Forget about it, and nothing can be spent. Re-sign explicitly to extend." },
            { icon: "🔪", title: "Instant revoke",      body: "Call USDC.approve(spender, 0) anytime from /me dashboard. ~$0.01 gas. Spending stops immediately." },
            { icon: "📊", title: "Public audit trail",  body: "Every charge is an on-chain transaction. Open Basescan with your wallet address, see every dollar moved." },
          ].map((s) => (
            <div key={s.title} className="flex items-start gap-4 rounded-xl border border-white/8 bg-white/3 p-5">
              <span className="text-2xl leading-none flex-shrink-0">{s.icon}</span>
              <div>
                <h4 className="font-bold text-white text-base mb-1">{s.title}</h4>
                <p className="text-[13px] text-white/60 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center border-t border-white/8">
        <h2 className="text-3xl md:text-4xl font-black text-white mb-6">
          One signature.<br/>Four markets.
        </h2>
        <p className="text-[15px] text-white/60 mb-8 leading-relaxed">
          Sign a single ERC-2612 permit and your agent can swap on Jupiter,
          trade GMX perps, paper-test on Alpaca, and buy Dinari dShares — for 90 days.
        </p>
        <Link
          href="/start/v2?utm_source=trade&utm_medium=cta&utm_campaign=trade_launch"
          className="inline-flex items-center gap-2 px-8 py-4 bg-[#fffd43] text-[#1a0f00] font-bold rounded-xl hover:bg-[#fffd43]/90 transition-colors text-base"
        >
          Sign permit (60 seconds) →
        </Link>
        <p className="mt-6 text-[11px] text-white/40">
          $25/day on-chain cap · 90 days · revoke anytime · zero subscription
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/8 py-10 text-center text-[11px] text-white/40">
        <p>
          <Link href="/about/en" className="hover:text-white/70">Home</Link>
          <span className="mx-2">·</span>
          <Link href="/docs" className="hover:text-white/70">Docs</Link>
          <span className="mx-2">·</span>
          <Link href="/security" className="hover:text-white/70">Security</Link>
          <span className="mx-2">·</span>
          <a href="https://github.com/evidai/agent-payment-mcp" target="_blank" rel="noopener noreferrer" className="hover:text-white/70">GitHub</a>
        </p>
      </footer>
    </main>
  );
}
