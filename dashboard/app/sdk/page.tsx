import Link from "next/link";

export const metadata = {
  title: "LemonCake SDK — @lemon-cake/mcp-sdk | Stripe for MCP Servers",
  description:
    "Add pay-per-call USDC billing to any MCP tool in 3 lines. @lemon-cake/mcp-sdk — demo mode, free tier, rate limiting, x402 compatible. Zero external dependencies.",
  alternates: { canonical: "https://lemoncake.xyz/sdk" },
  openGraph: {
    title: "LemonCake SDK — @lemon-cake/mcp-sdk",
    description: "Monetize your MCP server in 3 lines. permit billing, demo mode, rate limiting, x402.",
    url: "https://lemoncake.xyz/sdk",
  },
};

const CODE_BASIC = `import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";

const lc = createLemonCakeSDK({ sellerKey: process.env.LEMONCAKE_SELLER_KEY });

// Wrap any tool handler — that's it
server.tool("search_patents", lc.charge({ price: 0.05 })(async (args) => {
  // your existing handler
}));`;

const CODE_INSTALL = `npm install @lemon-cake/mcp-sdk @modelcontextprotocol/sdk`;

const CODE_DEMO = `// No LEMONCAKE_SELLER_KEY set? → Demo Mode auto-activates.
// All calls pass through, charges are logged but never executed.
const lc = createLemonCakeSDK({});  // demo mode on`;

const CODE_MIDDLEWARE = `// Apply billing to ALL tools in one line
const lc = createLemonCakeSDK({ sellerKey: process.env.LEMONCAKE_SELLER_KEY });
server.setRequestHandler(CallToolRequestSchema, lc.middleware({ defaultPrice: 0.01 }));`;

const features = [
  {
    title: "3行で完結",
    titleEn: "3-line integration",
    body: "既存の MCP サーバーに import 1行・SDK 初期化 1行・ラップ 1行。それだけ。",
    bodyEn: "Import, init, wrap. That's all. Drop into any existing MCP server.",
    icon: "⚡",
  },
  {
    title: "デモモード",
    titleEn: "Demo Mode",
    body: "LEMONCAKE_SELLER_KEY を設定しなければデモモードで起動。実 USDC を動かさずにフロー全体を検証できる。",
    bodyEn: "No SELLER_KEY = Demo Mode. Test the full billing flow without moving real USDC.",
    icon: "🧪",
  },
  {
    title: "無料枠 + レートリミット",
    titleEn: "Free tier + rate limiting",
    body: "ツールごと・トークンごとに無料呼び出し数を設定可。スライディングウィンドウで 1 分あたりの上限も内蔵。",
    bodyEn: "Per-tool free call quota and per-token sliding-window rate limiting — both built in.",
    icon: "🛡️",
  },
  {
    title: "x402 互換",
    titleEn: "x402 compatible",
    body: "HTTP 402 / X-Payment-Required ヘッダーを自動付与。Coinbase/Linux Foundation 標準プロトコル対応。",
    bodyEn: "Auto-sets X-Payment-Required headers. Compatible with the x402 open payment standard.",
    icon: "🔗",
  },
  {
    title: "ゼロ外部依存",
    titleEn: "Zero external deps",
    body: "peer: @modelcontextprotocol/sdk のみ。バンドルサイズを増やさず、どんな MCP サーバーにも追加できる。",
    bodyEn: "Only peer dep is @modelcontextprotocol/sdk. No bloat.",
    icon: "📦",
  },
  {
    title: "収益レポート",
    titleEn: "Earnings API",
    body: "lc.getEarnings() で累計収益・ツール別内訳・pending/confirmed の残高をリアルタイム取得。",
    bodyEn: "lc.getEarnings() returns realtime earnings, per-tool breakdown, and pending/confirmed balances.",
    icon: "📊",
  },
];

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0d0d12]">
      {label && (
        <div className="px-4 py-2 border-b border-white/8 text-[10px] font-semibold text-white/30 uppercase tracking-widest">
          {label}
        </div>
      )}
      <pre className="p-4 text-[13px] font-mono text-[#a6e22e] overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function SdkPage() {
  return (
    <main className="min-h-screen bg-[#06060a] text-white font-sans antialiased">
      {/* Nav */}
      <nav className="sticky top-0 z-20 bg-[#06060a]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/about" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-[15px]">LemonCake</span>
          </Link>
          <div className="flex items-center gap-4 text-[13px] text-white/50">
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/login" className="hover:text-white transition-colors">Dashboard</Link>
            <a
              href="https://www.npmjs.com/package/@lemon-cake/mcp-sdk"
              target="_blank" rel="noopener"
              className="px-4 py-2 bg-[#fffd43] text-[#1a0f00] text-xs font-bold rounded-lg hover:bg-[#f5f341] transition-colors"
            >
              npm install →
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-[11px] font-semibold text-white/50 uppercase tracking-widest mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#fffd43]" />
          @lemon-cake/mcp-sdk v0.1.0
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-tight mb-6">
          Stripe for<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#fffd43] to-[#f0c000]">
            MCP Servers
          </span>
        </h1>
        <p className="text-lg text-white/45 max-w-2xl mx-auto mb-10 leading-relaxed">
          自分の MCP ツールに USDC 課金を 3 行で追加。<br />
          デモモード・無料枠・レートリミット・x402 対応をすべて内蔵。
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <a
            href="https://www.npmjs.com/package/@lemon-cake/mcp-sdk"
            target="_blank" rel="noopener"
            className="px-8 py-3.5 bg-[#fffd43] text-[#1a0f00] font-bold rounded-xl hover:bg-[#f5f341] transition-colors"
          >
            npm install @lemon-cake/mcp-sdk
          </a>
          <Link href="/login" className="px-8 py-3.5 border border-white/20 text-white/70 font-semibold rounded-xl hover:border-white/40 hover:text-white transition-colors">
            SELLER_KEY を取得 →
          </Link>
        </div>
      </section>

      {/* Quick start */}
      <section className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <p className="text-[11px] font-semibold text-[#fffd43]/70 uppercase tracking-widest">インストール</p>
            <CodeBlock code={CODE_INSTALL} />
            <p className="text-[11px] font-semibold text-[#fffd43]/70 uppercase tracking-widest mt-2">デモモード（ゼロ設定）</p>
            <CodeBlock code={CODE_DEMO} />
          </div>
          <div className="flex flex-col gap-4">
            <p className="text-[11px] font-semibold text-[#fffd43]/70 uppercase tracking-widest">本番（1 ツール）</p>
            <CodeBlock code={CODE_BASIC} />
          </div>
        </div>
      </section>

      {/* Middleware mode */}
      <div className="border-t border-white/8">
        <section className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-3">全ツール一括対応</p>
          <h2 className="text-2xl md:text-3xl font-black mb-6 leading-tight">
            1 行でサーバー全体に適用
          </h2>
          <CodeBlock code={CODE_MIDDLEWARE} label="middleware mode" />
        </section>
      </div>

      {/* Features */}
      <div className="border-t border-white/8 bg-white/[0.02]">
        <section className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-12">Features</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(f => (
              <div key={f.title} className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-white mb-1">{f.title}</h3>
                <p className="text-[13px] text-white/40 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* How billing works */}
      <div className="border-t border-white/8">
        <section className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-3">仕組み</p>
          <h2 className="text-2xl md:text-3xl font-black mb-10 leading-tight">課金フロー</h2>
          <div className="flex flex-col md:flex-row gap-4 items-start">
            {[
              { step: "1", label: "permit", body: "エージェントオペレーターが LemonCake で permit（ERC-2612）を発行。予算上限・有効期限付き。" },
              { step: "2", label: "ツール呼び出し", body: "エージェントが MCP ツールを呼び出す際に _meta.payToken で permit を添付。" },
              { step: "3", label: "preflight", body: "SDK が LemonCake API で残高確認・チャージ枠を予約（PENDING）。残高不足なら 402 で即時拒否。" },
              { step: "4", label: "実行 → 確定", body: "ツールハンドラー実行後、SDK が charge を confirm。失敗なら cancel。USDC が実際に移動。" },
            ].map(({ step, label, body }) => (
              <div key={step} className="flex-1 flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#fffd43]/10 border border-[#fffd43]/20 flex items-center justify-center text-[#fffd43] text-sm font-bold flex-shrink-0">{step}</div>
                  <span className="text-sm font-bold text-white">{label}</span>
                </div>
                <p className="text-[13px] text-white/40 leading-relaxed pl-11">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* CTA */}
      <div className="border-t border-white/8 bg-[#fffd43]">
        <section className="max-w-5xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-[#1a0f00] mb-4">
            今すぐ MCP サーバーを収益化する
          </h2>
          <p className="text-[#1a0f00]/60 mb-8 text-base">
            SELLER_KEY を取得してダッシュボードの Seller アカウントページからコピー。3 分で完了。
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="https://www.npmjs.com/package/@lemon-cake/mcp-sdk"
              target="_blank" rel="noopener"
              className="px-8 py-3.5 bg-[#1a0f00] text-[#fffd43] font-bold rounded-xl hover:bg-[#2a1f10] transition-colors"
            >
              npm install @lemon-cake/mcp-sdk
            </a>
            <Link href="/login" className="px-8 py-3.5 border-2 border-[#1a0f00]/30 text-[#1a0f00] font-semibold rounded-xl hover:border-[#1a0f00] transition-colors">
              ダッシュボードへ →
            </Link>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/8">
        <div className="max-w-5xl mx-auto px-6 py-10 flex items-center justify-between text-[12px] text-white/30">
          <span>© 2026 Evid AI / LemonCake</span>
          <div className="flex gap-6">
            <Link href="/about" className="hover:text-white/60 transition-colors">About</Link>
            <Link href="/legal/terms" className="hover:text-white/60 transition-colors">Terms</Link>
            <Link href="/legal/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
