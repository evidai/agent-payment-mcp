import Link from "next/link";
import ContactButton from "./ContactButton";
import AuthedRedirect from "./AuthedRedirect";
import { LangSwitcher } from "@/components/LangSwitcher";

export const metadata = {
  title: "LemonCake — AI エージェントに財布を持たせる M2M 決済・会計インフラ",
  description: "LemonCake は AI エージェント専用の M2M 決済・会計インフラ。permit 1 行で外部 API に自律決済、freee / MoneyForward 自動仕訳、源泉徴収 10.21% / インボイス国税庁 API / 電子帳簿保存法 7 年保持まで全自動。JPYC・USDC 対応。Dify・LangChain・MCP で即利用可能。",
  alternates: {
    canonical: "https://lemoncake.xyz/about",
    languages: {
      "ja-JP": "https://lemoncake.xyz/about",
      "en-US": "https://lemoncake.xyz/en/about",
    },
  },
  openGraph: {
    title: "LemonCake — AI エージェントに財布を持たせる M2M 決済・会計インフラ",
    description: "permit 1 行で AI エージェントに安全な支払い能力を付与。freee / MoneyForward 自動仕訳、源泉徴収・インボイス・電帳法対応。",
    url: "https://lemoncake.xyz/about",
    type: "article",
  },
};

// ── FAQPage JSON-LD（AEO/AIO: AI 検索エンジンが引用しやすい形で Q&A を提供） ──
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "LemonCake とは何ですか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LemonCake は AI エージェント専用の M2M（Machine-to-Machine）決済・会計インフラです。permit に 1 度署名するだけで、AI エージェントが外部 API に自律的に支払い、freee / MoneyForward に自動仕訳まで完結します。日本の源泉徴収（10.21%）、インボイス制度（国税庁 API 連携）、電子帳簿保存法（7 年保持）にフルコンプライアンス。",
      },
    },
    {
      "@type": "Question",
      name: "AI エージェントに安全にお金を持たせるにはどうすればいい？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LemonCake の permit に署名してください。予算上限・有効期限・呼び出し先ホストの allowlist を絞ったトークンをエージェントに渡すだけで、漏洩しても被害が限定されます。リクエストごとに Reputation スコアで異常検知も行います。",
      },
    },
    {
      "@type": "Question",
      name: "AI エージェントが外部 API に支払った場合、源泉徴収はどう処理される？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LemonCake が自動判定します。受領者の法人/個人判定、報酬区分（原稿料・デザイン料・講演料など）、10.21% または 20.42% の税率計算、国税庁インボイス API による登録番号照合まで全自動で行い、freee に 3 勘定仕訳（外注費／預り金／普通預金）で記帳します。",
      },
    },
    {
      "@type": "Question",
      name: "JPYC で AI エージェント決済はできますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "できます。LemonCake は JPYC（Polygon 上の円建てステーブルコイン）を標準サポート。為替リスクなし、実質手数料 1 円/件、税務は利益課税のみで暗号資産課税の複雑さを回避できます。USDC も並行サポート。",
      },
    },
    {
      "@type": "Question",
      name: "Dify / LangChain / MCP で使えますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "はい。Dify 公式プラグイン、LangChain Tool（Python/JS）、MCP サーバー（@lemoncake/mcp-server）を提供しています。中級エンジニアなら 15 分で組み込み完了します。",
      },
    },
    {
      "@type": "Question",
      name: "Skyfire や Coinbase x402 との違いは？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Skyfire は米国市場中心で USDC 主体、x402 は HTTP 402 ベースのオープン標準です。LemonCake は JPYC + USDC 両対応で、日本の税務（源泉徴収・インボイス・電子帳簿保存法）と会計ソフト（freee / MoneyForward）に唯一フル統合しています。日本市場で業務利用するなら LemonCake が最適解です。",
      },
    },
    {
      "@type": "Question",
      name: "無料で試せますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "はい。lemoncake.xyz で 30 秒でアカウントを作成でき、無料枠があります。クレジットカード登録なしで permit の発行・テスト決済まで試せます。",
      },
    },
    {
      "@type": "Question",
      name: "どの会計ソフトに対応していますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "freee 会計、MoneyForward クラウド会計の両方に対応しています。OAuth 連携後は AI エージェントの決済が発生するたびにイベントベースで自動仕訳が作成されます。",
      },
    },
  ],
};

// ── SVG Icons ────────────────────────────────────────────────────────────────
const IconZap = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);
const IconStore = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);
const IconArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 flex-shrink-0">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconTerminal = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
);
const IconPackage = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const IconPower = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>
  </svg>
);
const IconBadge = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
  </svg>
);
const IconBeaker = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
    <path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/>
  </svg>
);

// ── Data ──────────────────────────────────────────────────────────────────────
const whyItems = [
  {
    eyebrow: "非カストディ",
    title: "USDC は\nあなたのウォレットに残る",
    body: "LemonCake は USDC を一切預かりません。AI エージェントが API を呼ぶ瞬間、あなたのウォレットから提供者ウォレットへ直接オンチェーン送金。FSA Fintech サポートデスクへの照会 (Q1-Q11) で「資金移動業・暗号資産交換業・電子決済手段等取引業のいずれにも該当しない」確認済。",
    stats: [
      { num: "0%", label: "LemonCake の取分 (per-call)" },
      { num: "JP/US/EU", label: "規制グリーン圏" },
    ],
    flipped: false,
  },
  {
    eyebrow: "ERC-2612 permit",
    title: "1 度の署名で\n90 日間 ノーサイン運用",
    body: "EIP-712 形式の permit に 1 度署名すれば、90 日間 / $25/日 の hard cap 内で AI が自由に API を呼べる。署名はオンチェーン署名なのでガス代不要。漏洩しても cap 以上は引かれない。Coinbase Onramp / Transak (JPY) でカード入金可。",
    stats: [
      { num: "90 日", label: "permit 有効期限" },
      { num: "$25/日", label: "default hard cap" },
    ],
    flipped: true,
  },
  {
    eyebrow: "x402 native",
    title: "Coinbase Bazaar /\nAWS AgentCore に自動掲載",
    body: "LemonCake は HTTP 402 Payment Required の公式 facilitator として動作。`@lemon-cake/x402-server` の hybrid モードを Provider が有効化すると、Coinbase CDP 経由で settle → x402 Bazaar / AWS Bedrock AgentCore Payments / 22 社 Foundation の流量に自動で接続される。",
    stats: [
      { num: "Base", label: "settlement chain" },
      { num: "ERC-3009", label: "署名スキーム" },
    ],
    flipped: false,
  },
  {
    eyebrow: "日本ビジネス特化",
    title: "freee / 適格請求書 /\nJPY オフランプを内蔵",
    body: "受け取った USDC を freee / MoneyForward に自動仕訳。適格請求書（インボイス制度）も月末に自動発行。Coincheck 経由で USDC → JPY → 銀行口座まで 1 クリック (Business プラン)。これが Coinbase / Circle / Stripe Agentic にできない、LemonCake の堀。",
    stats: [
      { num: "freee/MF", label: "自動仕訳連携" },
      { num: "Coincheck", label: "JPY オフランプ" },
    ],
    flipped: true,
  },
];

const buyerFeatures = [
  "ERC-2612 permit に 1 度署名で 90 日間ノーサイン運用",
  "$25/日 の hard cap がチェーンに焼かれて改変不可",
  "USDC はあなたのウォレットに残る（非カストディ）",
  "Apple Pay / Google Pay / 銀行振込（JPY）から USDC 入手まで内蔵",
  "x402 Bazaar / AWS Bedrock AgentCore 互換、global discovery 経路に接続",
  "permit 漏洩しても cap 上限まで、有効期限後は自動失効",
];

const sellerFeatures = [
  "/sellers で 1 分登録、即日 USDC で課金開始（KYC・法人不要）",
  "USDC は Provider ウォレットに 100% 直接着金、chargeback 不可",
  "Pro プランで freee / MoneyForward 自動仕訳 + 適格請求書自動発行",
  "Business プランで USDC → JPY 自動オフランプ (Coincheck → 銀行口座)",
  "@lemon-cake/x402-server で 3 行で hybrid モード対応 + Bazaar 自動掲載",
  "月 1,000 call まで無料（LemonCake 負担）",
  "営業ゼロで 24 時間収益発生",
];

const integrations = [
  {
    icon: <IconTerminal />,
    badge: "npm · agent-payment-mcp",
    title: "MCP サーバー（buyer 側）",
    subtitle: "Claude / Cursor / Cline に即接続",
    body: "npx -y agent-payment-mcp で起動。claude_desktop_config.json に LEMON_CAKE_PERMIT を貼るだけ。Demo Mode は signup 不要、permit 不要で即動作（Wikipedia / FX / httpbin）。",
    code: `npx -y agent-payment-mcp`,
    tools: ["list_services", "call_service", "check_balance", "setup"],
    href: "https://www.npmjs.com/package/agent-payment-mcp",
    published: true,
  },
  {
    icon: <IconStore />,
    badge: "npm · @lemon-cake/x402-server",
    title: "x402 middleware（seller 側）",
    subtitle: "Express / Hono に 3 行で組み込み",
    body: "Provider の API に HTTP 402 を組み込む。hybrid モードで Coinbase CDP 経由 settle → x402 Bazaar / AWS Bedrock AgentCore に自動掲載 + LemonCake にも metering 記録される（freee 仕訳 / インボイス対応）。",
    code: `npm install @lemon-cake/x402-server`,
    tools: ["x402Middleware()", "x402Hono()", "hybrid mode", "Bazaar discovery"],
    href: "https://www.npmjs.com/package/@lemon-cake/x402-server",
    published: true,
  },
  {
    icon: <IconPackage />,
    badge: "npm · @lemon-cake/mcp-sdk",
    title: "MCP SDK（seller 側 / 旧来式）",
    subtitle: "MCP server を 3 行で収益化",
    body: "MCP ツールに withPayment() を 1 行追加。x402 facilitator と統合済。Provider が自前 API ではなく MCP server を公開するケース向け。",
    code: `npm install @lemon-cake/mcp-sdk`,
    tools: ["withPayment()", "demoMode", "getEarnings()"],
    href: "https://www.npmjs.com/package/@lemon-cake/mcp-sdk",
    published: true,
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#06060a] text-white font-sans antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <AuthedRedirect />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 bg-[#06060a]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover" />
              <span className="font-bold text-[15px] text-white">LemonCake</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              {[
                { label: "インテグレーション", href: "#integrations" },
                { label: "機能",             href: "#features" },
                { label: "5分で試す",        href: "#quickstart" },
                { label: "仕組み",           href: "#infrastructure" },
                { label: "ユースケース",     href: "#use-cases" },
              ].map(({ label, href }) => (
                <a key={label} href={href} className="text-[13px] text-white/50 hover:text-white/90 transition-colors">{label}</a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LangSwitcher current="ja" basePath="/about" variant="dark" />
            <Link href="/me" className="text-[13px] text-white/50 hover:text-white/80 transition-colors">
              マイページ
            </Link>
            <Link href="/login" className="text-[13px] text-white/50 hover:text-white/80 transition-colors">
              ログイン
            </Link>
            <ContactButton className="text-[13px] font-semibold px-4 py-1.5 bg-white text-[#06060a] rounded-lg hover:bg-white/90 transition-colors">
              お問い合わせ
            </ContactButton>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="bg-[#fffd43] w-full">
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-16 md:pt-24 md:pb-20 flex flex-col md:flex-row items-center gap-8 md:gap-12">
          {/* Image — top on mobile, right on desktop */}
          <div className="w-full max-w-[380px] md:max-w-none md:w-[460px] flex-shrink-0 order-1 md:order-2">
            <img
              src="/hero-visual.png"
              alt="LemonCake — AI agent payment infrastructure"
              className="w-full h-auto drop-shadow-2xl"
            />
          </div>
          {/* Text — bottom on mobile, left on desktop */}
          {/*
           * Hero repivoted 2026-05-27: dev-billing / open-core narrative
           * (matches /about/en). 旧 hero ("Code pays code · We never touch
           * the funds") は crypto / non-custodial を前面に出してて、ICP
           * (MCP / API 開発者) が「自分向けじゃない」と離脱してた。
           * 新 hero は SDK と「3 行で課金追加」を主役に。
           */}
          <div className="flex-1 text-center md:text-left order-2 md:order-1">
            <div className="inline-block px-3 py-1 mb-5 bg-[#1a0f00]/8 border border-[#1a0f00]/15 rounded-full text-[11px] font-mono text-[#1a0f00]/70">
              AI billing OS · オープンコア · 月 1,000 tx 無料
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-[#1a0f00] mb-6 leading-[1.08]">
              AI ツールに課金を、<br />
              <span className="text-black">
                3 行のコードで。
              </span>
            </h1>
            <p className="text-lg md:text-xl text-[#1a0f00]/60 max-w-xl mb-8 leading-relaxed mx-auto md:mx-0">
              AI ネイティブな usage-based billing。call / token / agent 単位で課金、
              <strong>API キー管理不要</strong>、<strong>subscription 設定不要</strong>、Stripe Connect 非対応国でも動く。
            </p>
            <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
              <Link
                href="/start/free"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a0f00] text-white font-semibold rounded-xl hover:bg-[#1a0f00]/80 transition-colors text-sm"
              >
                無料で始める <IconArrowRight />
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#1a0f00] border border-[#1a0f00]/15 font-semibold rounded-xl hover:bg-white/90 transition-colors text-sm"
              >
                ドキュメント →
              </Link>
              <Link
                href="/sellers"
                className="inline-flex items-center gap-2 px-6 py-3 bg-transparent text-[#1a0f00]/70 font-semibold hover:text-[#1a0f00] transition-colors text-sm"
              >
                API 提供者向け →
              </Link>
            </div>
            <p className="text-[12px] text-[#1a0f00]/50 mt-4">
              <code className="font-mono">npm i @lemon-cake/mcp-sdk</code> · MIT · オープンコア（Supabase / Clerk と同じパターン）
            </p>
          </div>
        </section>
      </div>

      {/* ── Trust strip ── */}
      <section className="bg-black/40 border-y border-white/8 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-[10px] uppercase tracking-[0.18em] text-white/30 mb-6">
            Trusted by the ecosystem
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 text-center">
            <a
              href="https://www.freee.co.jp/app"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center"
            >
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">📒</span>
              <p className="text-[13px] font-bold text-white/90">freee アプリストア</p>
              <p className="text-[10px] text-white/40 mt-0.5">公式パートナー 2026-05 公開</p>
            </a>
            <a
              href="/security"
              className="group flex flex-col items-center"
            >
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">⚖️</span>
              <p className="text-[13px] font-bold text-white/90">FSA Q1-Q11 確認済</p>
              <p className="text-[10px] text-white/40 mt-0.5">非カストディ・登録不要</p>
            </a>
            <a
              href="https://docs.cdp.coinbase.com/x402/bazaar"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center"
            >
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🪙</span>
              <p className="text-[13px] font-bold text-white/90">Coinbase x402 Bazaar</p>
              <p className="text-[10px] text-white/40 mt-0.5">Hybrid 互換 / 自動掲載</p>
            </a>
            <a
              href="https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/payments.html"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center"
            >
              <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">☁️</span>
              <p className="text-[13px] font-bold text-white/90">AWS Bedrock AgentCore</p>
              <p className="text-[10px] text-white/40 mt-0.5">Payments 互換</p>
            </a>
          </div>

          {/* Distribution channels */}
          <div className="mt-8 pt-6 border-t border-white/8">
            <p className="text-center text-[10px] uppercase tracking-[0.18em] text-white/30 mb-4">
              Distribution channels
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[12px] text-white/40">
              <a href="https://www.npmjs.com/~evidai_lemoncake" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition">
                <span className="text-white/30">npm</span> <span className="font-bold text-white/70">6 packages</span>
              </a>
              <a href="https://glama.ai/mcp/servers/evidai/lemon-cake" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition">
                <span className="text-white/30">Glama</span> <span className="font-bold text-white/70">Listed (AAB)</span>
              </a>
              <a href="https://registry.modelcontextprotocol.io" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition">
                <span className="text-white/30">MCP Registry</span> <span className="font-bold text-white/70">Official</span>
              </a>
              <span className="text-white/30">Smithery</span>
              <span className="text-white/30">mcp.so</span>
              <span className="text-white/30">Cline</span>
              <span className="text-white/30">LobeHub</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Integrations ── */}
      <section id="integrations" className="relative overflow-hidden py-28">
        {/* Video background */}
        <video
          className="absolute inset-0 w-full h-full object-cover opacity-40"
          src="/dvd_screensaver.mp4"
          autoPlay
          loop
          muted
          playsInline
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#06060a]/40" />
        {/* Content */}
        <div className="relative z-10 max-w-6xl mx-auto px-6">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Integrations</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          あなたのエージェントに<br />3 分で接続する
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-16 max-w-xl mx-auto">
          Claude・Cursor・Eliza など主要なフレームワークに対応した公式パッケージを提供しています。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {integrations.map(({ icon, badge, title, subtitle, body, code, tools, href, published }) => (
            <div key={title} className="rounded-3xl bg-white/4 border border-white/8 p-8 flex flex-col gap-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#fffd43]/10 border border-[#fffd43]/20 flex items-center justify-center text-[#fffd43]">
                    {icon}
                  </div>
                  <span className="text-[11px] font-mono text-white/30 bg-white/5 px-2 py-0.5 rounded">{badge}</span>
                  {published && (
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-full">✓ published</span>
                  )}
                </div>
                <h3 className="text-xl font-black text-white mb-0.5">{title}</h3>
                <p className="text-[12px] text-white/40">{subtitle}</p>
              </div>
              {/* Body */}
              <p className="text-[13px] text-white/50 leading-relaxed">{body}</p>
              {/* Code block */}
              <div className="rounded-xl bg-black/40 border border-white/8 px-4 py-3 font-mono text-[13px] text-[#fffd43]">
                $ {code}
              </div>
              {/* Tools */}
              <div className="flex flex-wrap gap-2">
                {tools.map(t => (
                  <span key={t} className="text-[11px] font-mono text-white/40 bg-white/5 border border-white/8 px-2 py-0.5 rounded-md">{t}</span>
                ))}
              </div>
              {/* Link */}
              <a href={href} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] text-[#fffd43]/70 hover:text-[#fffd43] transition-colors mt-auto">
                npm で見る <IconArrowRight />
              </a>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-28">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Features</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          エージェントに渡す<br />&quot;3 つの安全装置&quot;
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-16 max-w-xl mx-auto">
          暴走を防ぐ緊急停止、身元証明で限度額解放、本番前にノーリスクで動作確認。<br />
          すべてダッシュボード 1 画面から。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Kill Switch */}
          <div className="rounded-3xl bg-gradient-to-br from-red-500/10 to-red-500/[0.02] border border-red-500/20 p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                <IconPower />
              </div>
              <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Kill Switch</span>
            </div>
            <h3 className="text-xl font-black text-white mb-2">緊急停止ボタン</h3>
            <p className="text-[13px] text-white/45 leading-relaxed mb-5">
              署名済みの permit を 1 クリックで即座に無効化。エージェントが想定外の挙動を始めた瞬間、すべての支払いが止まります。revoke 後の課金リクエストは 422 で拒否されます。
            </p>
            <div className="mt-auto flex flex-col gap-2 text-[12px] text-white/50">
              <div className="flex items-center gap-2"><span className="text-red-400"><IconCheck /></span>アトミック revoke（レース条件なし）</div>
              <div className="flex items-center gap-2"><span className="text-red-400"><IconCheck /></span>所有者のみ操作可能</div>
              <div className="flex items-center gap-2"><span className="text-red-400"><IconCheck /></span>ダッシュボード → マイ Permit</div>
            </div>
          </div>

          {/* KYA */}
          <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.02] border border-emerald-500/20 p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <IconBadge />
              </div>
              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Know Your Agent</span>
            </div>
            <h3 className="text-xl font-black text-white mb-2">KYA 認証で上限解放</h3>
            <p className="text-[13px] text-white/45 leading-relaxed mb-5">
              エージェント名と用途を申告するだけで即日 KYA 認証。1 日あたりの限度額が 10 → 1,000 USDC に引き上げられます。KYC 認証まで進めば 50,000 USDC まで拡張可能。
            </p>
            <div className="mt-auto flex flex-col gap-2 text-[12px] text-white/50">
              <div className="flex items-center gap-2"><span className="text-emerald-400"><IconCheck /></span>NONE: 10 USDC/日</div>
              <div className="flex items-center gap-2"><span className="text-emerald-400"><IconCheck /></span>KYA: 1,000 USDC/日（即時）</div>
              <div className="flex items-center gap-2"><span className="text-emerald-400"><IconCheck /></span>KYC: 50,000 USDC/日</div>
            </div>
          </div>

          {/* Sandbox */}
          <div className="rounded-3xl bg-gradient-to-br from-purple-500/10 to-purple-500/[0.02] border border-purple-500/20 p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-11 h-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <IconBeaker />
              </div>
              <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Sandbox</span>
            </div>
            <h3 className="text-xl font-black text-white mb-2">本番前の安全テスト</h3>
            <p className="text-[13px] text-white/45 leading-relaxed mb-5">
              Sandbox フラグ ON で発行したトークンは、実 USDC を 1 ドルも動かしません。上限管理・課金記録・プロキシ転送は本番と完全同一で動作するので、安心してエージェントの挙動検証ができます。
            </p>
            <div className="mt-auto flex flex-col gap-2 text-[12px] text-white/50">
              <div className="flex items-center gap-2"><span className="text-purple-400"><IconCheck /></span>実残高は減算されない</div>
              <div className="flex items-center gap-2"><span className="text-purple-400"><IconCheck /></span>上限・冪等性は本番と同挙動</div>
              <div className="flex items-center gap-2"><span className="text-purple-400"><IconCheck /></span>行に TEST バッジ表示</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quickstart ── */}
      <section id="quickstart" className="max-w-5xl mx-auto px-6 py-28">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Quickstart</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          <span className="text-[#fffd43]">5 分</span>で動かす
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-16 max-w-xl mx-auto">
          登録して、permit に署名して、エージェントに渡す。以上。
        </p>

        <ol className="flex flex-col gap-5">
          {/* Step 1 */}
          <li className="rounded-3xl bg-white/4 border border-white/8 p-7 flex gap-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#fffd43] text-[#1a0f00] font-black text-lg flex items-center justify-center">1</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-white mb-1.5">アカウント作成・USDC 入金</h3>
              <p className="text-[13px] text-white/45 leading-relaxed mb-3">
                メールアドレスで即登録。テスト用に Sandbox トークンを使えば実 USDC なしでも最後まで試せます。
              </p>
              <Link href="/register" className="inline-flex items-center gap-1.5 text-[13px] text-[#fffd43]/80 hover:text-[#fffd43]">
                登録する <IconArrowRight />
              </Link>
            </div>
          </li>

          {/* Step 2 */}
          <li className="rounded-3xl bg-white/4 border border-white/8 p-7 flex gap-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#fffd43] text-[#1a0f00] font-black text-lg flex items-center justify-center">2</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-white mb-1.5">permit に署名</h3>
              <p className="text-[13px] text-white/45 leading-relaxed mb-3">
                ダッシュボードの 「マイ Permit」ページで、対象サービス・上限 USDC・有効期限を指定して発行。Sandbox モードなら実残高は動きません。
              </p>
              <div className="rounded-xl bg-black/40 border border-white/8 px-4 py-3 font-mono text-[12px] text-[#fffd43] leading-relaxed overflow-x-auto">
                <div className="text-white/40">$ # or via REST:</div>
                <div>curl -X POST https://lemoncake.xyz/api/tokens \</div>
                <div className="pl-4">-H &quot;Authorization: Bearer $BUYER_JWT&quot; \</div>
                <div className="pl-4">-d &apos;{'{'}&quot;serviceId&quot;:&quot;svc_xxx&quot;,&quot;limitUsdc&quot;:&quot;2.00&quot;,&quot;sandbox&quot;:true{'}'}&apos;</div>
              </div>
            </div>
          </li>

          {/* Step 3 */}
          <li className="rounded-3xl bg-white/4 border border-white/8 p-7 flex gap-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#fffd43] text-[#1a0f00] font-black text-lg flex items-center justify-center">3</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-white mb-1.5">エージェントに渡す</h3>
              <p className="text-[13px] text-white/45 leading-relaxed mb-4">
                お使いのフレームワークに合わせて 1 行。あとはエージェントが自律的に API を選び、支払い、完結します。
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl bg-black/40 border border-white/8 px-3.5 py-3">
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">Claude / Cursor</p>
                  <code className="text-[12px] font-mono text-[#fffd43] break-all">npx -y agent-payment-mcp</code>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/8 px-3.5 py-3">
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">Eliza v2</p>
                  <code className="text-[12px] font-mono text-[#fffd43] break-all">plugins: [lemonCakePlugin]</code>
                </div>
                <div className="rounded-xl bg-black/40 border border-white/8 px-3.5 py-3">
                  <p className="text-[10px] font-semibold text-white/40 uppercase tracking-widest mb-1.5">Any framework</p>
                  <code className="text-[12px] font-mono text-[#fffd43] break-all">POST /api/proxy/:id/*</code>
                </div>
              </div>
            </div>
          </li>

          {/* Step 4 */}
          <li className="rounded-3xl bg-gradient-to-br from-[#fffd43]/10 to-transparent border border-[#fffd43]/20 p-7 flex gap-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-[#fffd43] text-[#1a0f00] font-black text-lg flex items-center justify-center">✓</div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-black text-white mb-1.5">完成 — あとは見守るだけ</h3>
              <p className="text-[13px] text-white/55 leading-relaxed">
                課金履歴・残高・トークン使用量がダッシュボードにリアルタイム反映。<br />
                エージェントが暴走したら Kill Switch で 1 クリック停止。
              </p>
            </div>
          </li>
        </ol>

        <div className="mt-10 text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 px-7 py-3 bg-[#fffd43] text-[#1a0f00] font-semibold rounded-xl hover:bg-[#fffd43]/90 transition-colors text-sm"
          >
            無料で始める <IconArrowRight />
          </Link>
          <p className="mt-3 text-[12px] text-white/30">
            クレジットカード不要。Sandbox モードなら USDC も不要。
          </p>
        </div>
      </section>

      {/* ── Mission ── */}
      <section className="max-w-4xl mx-auto px-6 py-28 text-center">
        <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-6">ミッション</p>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-white leading-tight mb-6">
          エージェントに、<br />安全なお財布を渡す
        </h2>
        <p className="text-base md:text-lg text-white/45 max-w-2xl mx-auto leading-relaxed">
          AIエージェントが外部 API を呼び出すたびに、課金・認証・冪等性・残高管理が必要になります。
          LemonCake は ERC-2612 permit という仕組みで、エージェントに「予算上限付きのお財布」を渡します。
          上限を超えれば自動停止。エージェントは支払い能力を持ちながら、暴走しません。
        </p>
      </section>

      {/* ── Live demo GIF section ── */}
      <div id="demo" className="bg-gradient-to-b from-gray-50 to-white w-full mt-28">
        <section className="max-w-5xl mx-auto px-6 py-20">
          <p className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">90 SECOND DEMO</p>
          <h2 className="text-center text-3xl md:text-4xl font-black text-gray-900 mb-4 leading-tight">
            ChatGPT には絶対できない、<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#c8b800] to-[#a89400]">有料 API を AI が自律で叩く</span>
          </h2>
          <p className="text-center text-[14px] text-gray-500 max-w-2xl mx-auto mb-10">
            LemonCake のマーケットプレイス API を <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono">npx create-lemon-agent</code> で 90 秒で組み込む。
            ↓ 実際の動作 (Hunter.io から Anthropic 社員のメール発掘):
          </p>
          <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-900 shadow-2xl">
            <img src="https://raw.githubusercontent.com/evidai/create-lemon-agent/main/demo.gif" alt="LemonCake demo: agent autonomously calls Hunter.io paid API"
                 className="w-full" />
          </div>
          <p className="text-center text-[11px] text-gray-400 mt-3">
            このデモで agent が叩いた Hunter.io は要 API キー (月 $49)。LemonCake 経由なら $0.001 から従量課金。
          </p>
        </section>
      </div>

      {/* ── 「他 AI では無理」 3 use cases ── */}
      <div id="why-lemoncake" className="bg-white w-full">
        <section className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">WHY LEMONCAKE</p>
          <h2 className="text-center text-3xl md:text-4xl font-black text-gray-900 mb-12 leading-tight">
            汎用 AI に投げて返ってこない<br/>仕事だけ、ここで解ける
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: "🔍",
                title: "B2B 営業リサーチ",
                example: '"anthropic.com の主要連絡先メールを5件取得して"',
                why: "Hunter.io API は要 API キー + 月 $49。ChatGPT には叩けない。LemonCake なら $0.001/call で agent が直接呼ぶ。",
                api: "Hunter.io",
              },
              {
                icon: "📊",
                title: "金融・市場データ",
                example: '"USD/JPY の最新レートを取得し、過去 30 日の推移と比較して"',
                why: "Open Exchange Rates / Polygon.io は商用利用要 paid plan。ChatGPT は学習データ時点の値しか知らない。",
                api: "Open Exchange Rates",
              },
              {
                icon: "🇯🇵",
                title: "日本コンプライアンス",
                example: '"インボイス番号 T1234567890123 が有効か照合して"',
                why: "国税庁・gBizINFO・e-Gov は政府 API でキー登録要。日本の税務 / KYB ワークフロー必須。",
                api: "国税庁 invoice / gBizINFO",
              },
            ].map((u, i) => (
              <div key={i} className="rounded-2xl bg-gray-50 border border-gray-200 p-6 flex flex-col">
                <div className="text-3xl mb-3">{u.icon}</div>
                <h3 className="text-lg font-black text-gray-900 mb-2">{u.title}</h3>
                <code className="block text-xs bg-gray-900 text-emerald-300 p-3 rounded-lg font-mono mb-3 break-words">
                  {u.example}
                </code>
                <p className="text-[12px] text-gray-600 leading-relaxed mb-3 flex-1">{u.why}</p>
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">使う API: <span className="text-gray-700">{u.api}</span></div>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <a href="/services" className="inline-block px-6 py-3 bg-yellow-300 text-gray-900 text-sm font-bold rounded-xl hover:bg-yellow-400 transition-colors">
              16 個の稼働中 API を見る →
            </a>
          </div>
        </section>
      </div>

      {/* ── Buyer / Seller 2-column ── */}
      <div id="use-cases" className="bg-white w-full mt-28">
        <section className="max-w-6xl mx-auto px-6 py-28">
          <p className="text-center text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Use Cases</p>
          <h2 className="text-center text-3xl md:text-4xl font-black text-gray-900 mb-16 leading-tight">
            払う側も、売る側も<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#c8b800] to-[#a89400]">信頼されたネットワークで繋がる</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Buyer */}
            <div className="rounded-3xl bg-gray-50 border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-500">
                  <IconZap />
                </div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">BUYER / AGENT OPERATOR</p>
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">AIの知能を磨くことだけに集中する</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
                permit をエージェントに渡すだけ。決済・残高管理・冪等性はすべて LemonCake が処理します。あなたはエージェントのロジックだけに集中してください。
              </p>
              <ul className="flex flex-col gap-3">
                {buyerFeatures.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-600">
                    <span className="text-emerald-500 mt-0.5"><IconCheck /></span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            {/* Seller */}
            <div className="rounded-3xl bg-gray-50 border border-gray-200 p-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-xl bg-[#fffd43]/20 border border-[#c8b800]/30 flex items-center justify-center text-[#a89400]">
                  <IconStore />
                </div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">SELLER / API PROVIDER</p>
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">AIに売り、新しい収益源を開く</h3>
              <p className="text-[13px] text-gray-500 leading-relaxed mb-6">
                既存の API を LemonCake に登録するだけで、世界中の AI エージェントが新しい顧客になります。人間が見落とす深夜・休日も、エージェントは止まらずサービスを使い続けます。
              </p>
              <ul className="flex flex-col gap-3">
                {sellerFeatures.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-600">
                    <span className="text-emerald-500 mt-0.5"><IconCheck /></span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* ── Competitive comparison ── */}
      <section id="comparison" className="max-w-6xl mx-auto px-6 py-28">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Comparison</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          他の AI 決済基盤と<br className="md:hidden" />何が違うか
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-12 max-w-2xl mx-auto">
          グローバル流量は x402 commodity（$0.001/call）で受け、収益は日本ビジネス特化機能のサブスクで取る。これが LemonCake の構造。
        </p>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="w-full min-w-[720px] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-4 pr-4 font-bold text-white/60 text-[11px] uppercase tracking-widest">機能</th>
                <th className="text-center py-4 px-3 font-bold text-white/50 text-[11px]">Stripe<br />Agentic</th>
                <th className="text-center py-4 px-3 font-bold text-white/50 text-[11px]">Coinbase<br />CDP x402</th>
                <th className="text-center py-4 px-3 font-bold text-white/50 text-[11px]">Skyfire</th>
                <th className="text-center py-4 px-3 font-bold text-white/50 text-[11px]">Circle<br />Agent Stack</th>
                <th className="text-center py-4 pl-3 font-bold bg-[#fffd43]/10 text-[#fffd43] text-[11px] uppercase tracking-widest border-x-2 border-[#fffd43]/30">🍋 LemonCake</th>
              </tr>
            </thead>
            <tbody className="text-white/70">
              {[
                {
                  label: "カストディ性",
                  stripe: { mark: "❌", text: "保持あり" },
                  cdp:    { mark: "✓", text: "non-custodial" },
                  skyfire:{ mark: "❌", text: "保持あり" },
                  circle: { mark: "✓", text: "non-custodial" },
                  lemon:  { mark: "✓", text: "non-custodial (FSA Q1-Q11)" },
                },
                {
                  label: "per-call 単価",
                  stripe: { mark: "$$$", text: "2.9% + ¥45" },
                  cdp:    { mark: "$", text: "$0.001" },
                  skyfire:{ mark: "$$", text: "2-3%" },
                  circle: { mark: "$", text: "$0.000001~" },
                  lemon:  { mark: "$", text: "$0.001 (commodity)" },
                },
                {
                  label: "対応通貨",
                  stripe: { mark: "—", text: "Card / USD" },
                  cdp:    { mark: "—", text: "USDC" },
                  skyfire:{ mark: "—", text: "USDC" },
                  circle: { mark: "—", text: "USDC" },
                  lemon:  { mark: "—", text: "USDC + JPY ON/オフランプ" },
                },
                {
                  label: "x402 native",
                  stripe: { mark: "❌", text: "" },
                  cdp:    { mark: "✓", text: "ホスト元" },
                  skyfire:{ mark: "△", text: "互換" },
                  circle: { mark: "✓", text: "互換" },
                  lemon:  { mark: "✓", text: "Facilitator + Hybrid モード" },
                },
                {
                  label: "Bazaar 自動掲載",
                  stripe: { mark: "❌", text: "" },
                  cdp:    { mark: "✓", text: "ネイティブ" },
                  skyfire:{ mark: "❌", text: "" },
                  circle: { mark: "✓", text: "" },
                  lemon:  { mark: "✓", text: "Hybrid モード経由" },
                },
                {
                  label: "freee / MF 自動仕訳",
                  stripe: { mark: "❌", text: "" },
                  cdp:    { mark: "❌", text: "" },
                  skyfire:{ mark: "❌", text: "" },
                  circle: { mark: "❌", text: "" },
                  lemon:  { mark: "✓", text: "Pro プラン" },
                },
                {
                  label: "適格請求書（インボイス）",
                  stripe: { mark: "❌", text: "" },
                  cdp:    { mark: "❌", text: "" },
                  skyfire:{ mark: "❌", text: "" },
                  circle: { mark: "❌", text: "" },
                  lemon:  { mark: "✓", text: "Pro プラン・自動発行" },
                },
                {
                  label: "JPY オフランプ",
                  stripe: { mark: "❌", text: "" },
                  cdp:    { mark: "❌", text: "" },
                  skyfire:{ mark: "❌", text: "" },
                  circle: { mark: "❌", text: "" },
                  lemon:  { mark: "✓", text: "Business・Coincheck 経由" },
                },
                {
                  label: "規制 (日本)",
                  stripe: { mark: "—", text: "US only" },
                  cdp:    { mark: "△", text: "Provider 任せ" },
                  skyfire:{ mark: "—", text: "US 中心" },
                  circle: { mark: "△", text: "Provider 任せ" },
                  lemon:  { mark: "✓", text: "FSA 確認済・登録不要" },
                },
              ].map((row, i) => (
                <tr key={row.label} className={`border-b border-white/5 ${i % 2 === 1 ? "bg-white/[0.015]" : ""}`}>
                  <td className="py-3 pr-4 font-medium text-white/80">{row.label}</td>
                  <td className="py-3 px-3 text-center text-[12px]">
                    <div className="text-lg">{row.stripe.mark}</div>
                    {row.stripe.text && <div className="text-[10px] text-white/40 mt-0.5">{row.stripe.text}</div>}
                  </td>
                  <td className="py-3 px-3 text-center text-[12px]">
                    <div className="text-lg">{row.cdp.mark}</div>
                    {row.cdp.text && <div className="text-[10px] text-white/40 mt-0.5">{row.cdp.text}</div>}
                  </td>
                  <td className="py-3 px-3 text-center text-[12px]">
                    <div className="text-lg">{row.skyfire.mark}</div>
                    {row.skyfire.text && <div className="text-[10px] text-white/40 mt-0.5">{row.skyfire.text}</div>}
                  </td>
                  <td className="py-3 px-3 text-center text-[12px]">
                    <div className="text-lg">{row.circle.mark}</div>
                    {row.circle.text && <div className="text-[10px] text-white/40 mt-0.5">{row.circle.text}</div>}
                  </td>
                  <td className="py-3 pl-3 text-center text-[12px] bg-[#fffd43]/5 border-x-2 border-[#fffd43]/30">
                    <div className="text-lg">{row.lemon.mark}</div>
                    {row.lemon.text && <div className="text-[10px] text-[#fffd43]/80 mt-0.5 font-medium">{row.lemon.text}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/30">
          ※ 各サービスの仕様は 2026-05 時点。x402 / Coinbase / Circle は全て急速進化中、最新は公式ドキュメント参照。
        </p>
      </section>

      {/* ── The Infrastructure ── */}
      <section id="infrastructure" className="max-w-6xl mx-auto px-6 py-28">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-20">How It Works</p>
        <div className="flex flex-col gap-28">
          {whyItems.map(({ eyebrow, title, body, stats, flipped }) => (
            <div
              key={eyebrow}
              className={`flex flex-col md:flex-row items-center gap-12 ${flipped ? "md:flex-row-reverse" : ""}`}
            >
              {/* Text side */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-[#fffd43]/80 uppercase tracking-widest mb-3">{eyebrow}</p>
                <h3 className="text-2xl md:text-3xl font-black text-white mb-4 leading-tight whitespace-pre-line">{title}</h3>
                <p className="text-[14px] text-white/45 leading-relaxed max-w-md">{body}</p>
              </div>
              {/* Stats side */}
              <div className="flex-shrink-0 w-full md:w-72">
                <div className="rounded-3xl bg-white/4 border border-white/8 p-8 flex gap-8 justify-center md:justify-start">
                  {stats.map(({ num, label }) => (
                    <div key={label}>
                      <p className="text-3xl font-black text-white mb-1">{num}</p>
                      <p className="text-[11px] text-white/40 leading-tight">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── なぜ USDC / JPYC か ── */}
      <div className="bg-white w-full">
        <section className="max-w-5xl mx-auto px-6 py-28">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4 text-center">Why USDC / JPYC?</p>
          <h2 className="text-3xl font-black text-gray-900 text-center mb-4">なぜ円ではなく USDC なのか</h2>
          <p className="text-gray-500 text-center text-sm mb-14 max-w-xl mx-auto">AIエージェントによる決済には、銀行振込でも法定通貨APIでも解決できない根本的な問題があります。</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                title: "1リクエスト = $0.001 の決済が必要",
                body: "銀行振込の最小単位は1円。マイクロペイメントには対応していません。クレジットカードは手数料が課金額を上回ります。USDC/JPYCなら0.001ドルの課金が手数料ほぼゼロで実現できます。",
                icon: "⚡",
              },
              {
                title: "エージェントはAPIキーを持てない",
                body: "外部APIの認証情報をエージェントに渡すと漏洩リスクがあります。permitは予算上限・有効期限・呼び出し先を制限でき、漏洩しても被害が限定されます。",
                icon: "🔐",
              },
              {
                title: "円建てで使いたい → JPYCで可能",
                body: "LemonCakeはJPYC（Polygon上の円建てステーブルコイン）も標準サポート。為替リスクなし、暗号資産課税の複雑さを回避しながらマイクロペイメントが実現できます。",
                icon: "🇯🇵",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-gray-200 p-6">
                <div className="text-2xl mb-3">{item.icon}</div>
                <p className="font-semibold text-gray-900 mb-2 text-sm">{item.title}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── 競合比較 ── */}
      <section className="max-w-5xl mx-auto px-6 py-28">
        <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4 text-center">Comparison</p>
        <h2 className="text-3xl font-black text-white text-center mb-4">他のサービスとの違い</h2>
        <p className="text-white/50 text-center text-sm mb-14 max-w-xl mx-auto">「APIマーケットプレイス」「エージェント決済」と名乗るサービスは複数あります。何が違うのか。</p>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left px-5 py-4 text-white/60 font-medium">機能</th>
                <th className="px-5 py-4 text-[#fffd43] font-bold text-center">LemonCake</th>
                <th className="px-5 py-4 text-white/40 font-medium text-center">Composio</th>
                <th className="px-5 py-4 text-white/40 font-medium text-center">RapidAPI</th>
                <th className="px-5 py-4 text-white/40 font-medium text-center">Skyfire</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["マイクロペイメント（$0.001/call）", "✅", "❌", "❌", "✅"],
                ["日本の税務対応（源泉・インボイス）", "✅", "❌", "❌", "❌"],
                ["freee / MF 自動仕訳", "✅", "❌", "❌", "❌"],
                ["JPYC（円建て）対応", "✅", "❌", "❌", "❌"],
                ["MCP + 決済が一体化", "✅", "❌", "❌", "❌"],
                ["APIキー不要のエージェント決済", "✅", "❌", "❌", "✅"],
                ["npx 1行でエージェント作成", "✅", "❌", "❌", "❌"],
              ].map(([feature, ...vals]) => (
                <tr key={String(feature)} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                  <td className="px-5 py-4 text-white/70">{feature}</td>
                  {vals.map((v, i) => (
                    <td key={i} className="px-5 py-4 text-center text-base">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-white/30 text-xs text-center mt-4">※ 2026年5月時点の調査。各社公開情報に基づく。</p>
      </section>

      {/* ── Philosophy ── */}
      <section className="px-6 pt-28 pb-40 text-center">
        <div className="max-w-4xl mx-auto">
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-6">Our Philosophy</p>
          <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-8">
            鋼鉄の素材を、<br />
            <span className="text-[#fffd43]">ひと口のレモンケーキに。</span>
          </h2>
          <div className="text-left max-w-2xl mx-auto space-y-5 text-[15px] text-white/50 leading-relaxed">
            <p>
              M2M 決済インフラを構築するとは、本来「鋼鉄の素材」を扱うような体験でした。冪等性の担保、残高管理、KYA/KYC ティア認証、USDC スマートコントラクト——これらをゼロから実装することは、エージェント開発者にとって本質的でない負荷です。
            </p>
            <p>
              私たちは、その複雑で酸っぱい現実のすべてを、プラットフォームの裏側に隠しました。
            </p>
            <p className="text-white/80 font-medium">
              開発者やエージェントが触れるのは、極めてシンプルに洗練された 1 つのエンドポイントだけ。まるで、複雑な素材の組み合わせから生まれた、ひと口で食べられる美味しい「レモンケーキ」のように。
            </p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <div className="bg-white w-full">
        <section className="max-w-6xl mx-auto px-6 pt-20 pb-28 text-center">
          <div className="rounded-3xl bg-gray-50 border border-gray-200 px-8 py-16">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Ready to Power AI Transactions?</p>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-4 leading-tight">
              AIの知能を磨くことだけに<br />集中してください。
            </h2>
            <p className="text-[14px] text-gray-500 mb-8 max-w-md mx-auto leading-relaxed">
              決済・残高管理・冪等性はすべて LemonCake が処理します。<br />導入支援・技術相談・デモのリクエストはこちら。
            </p>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <ContactButton className="inline-flex items-center gap-2 px-7 py-3 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-700 transition-colors text-sm">
                お問い合わせフォームを開く
              </ContactButton>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-7 py-3 bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >
                ログイン
              </Link>
            </div>
          </div>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <img src="/logo.png" alt="LemonCake" className="w-6 h-6 rounded-md object-cover" />
                <span className="font-bold text-[13px] text-white">LemonCake</span>
              </div>
              <p className="text-[12px] text-white/30 leading-relaxed">M2M Payment Infrastructure<br />for AI Agents</p>
            </div>
            {/* プロダクト */}
            <div>
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-3">プロダクト</p>
              <ul className="flex flex-col gap-2">
                {[
                  { label: "ダッシュボード", href: "/login" },
                  { label: "MCP サーバー",  href: "https://www.npmjs.com/package/agent-payment-mcp" },
                  { label: "Eliza Plugin",  href: "https://www.npmjs.com/package/eliza-plugin-lemoncake" },
                  { label: "ドキュメント",  href: "https://lemoncake.xyz/docs" },
                ].map(({ label, href }) => (
                  <li key={label}>
                    <a href={href} className="text-[12px] text-white/40 hover:text-white/70 transition-colors">{label}</a>
                  </li>
                ))}
              </ul>
            </div>
            {/* ユースケース */}
            <div>
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-3">ユースケース</p>
              <ul className="flex flex-col gap-2">
                {["エージェント決済", "M2M 取引", "API マーケットプレイス", "マイクロペイメント"].map(item => (
                  <li key={item}><span className="text-[12px] text-white/40">{item}</span></li>
                ))}
              </ul>
            </div>
            {/* 法的情報 */}
            <div>
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-3">法的情報</p>
              <ul className="flex flex-col gap-2">
                {["利用規約", "プライバシーポリシー", "特定商取引法", "お問い合わせ"].map(item => (
                  <li key={item}><span className="text-[12px] text-white/40">{item}</span></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-white/8 pt-6 flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-[11px] text-white/20">© 2026 LemonCake. All rights reserved.</p>
            <p className="text-[11px] text-white/20">KYA/KYC ティア認証 · ERC-2612 permit · Polygon · USDC · JPYC</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
