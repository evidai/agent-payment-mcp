import Link from "next/link";
import Image from "next/image";
import ContactButton from "./ContactButton";
import { LangSwitcher } from "@/components/LangSwitcher";

export const metadata = {
  title: "LemonCake — MCP / APIを5分で有料化",
  description: "MCPサーバーやHTTP APIを5分で有料化。買い手はカードで前払いし、エージェントは上限つき Pay Token で自律利用。暗号資産ウォレット不要、コールごとのAPIキー不要。初回3,000コール無料、以降3%。",
  alternates: {
    canonical: "https://lemoncake.xyz/about",
    languages: {
      "ja-JP": "https://lemoncake.xyz/about",
      "en-US": "https://lemoncake.xyz/about/en",
    },
  },
  openGraph: {
    title: "LemonCake — MCP / APIを5分で有料化",
    description: "MCPサーバーやHTTP APIを5分で有料化。カード前払い、上限つきPay Token、暗号資産ウォレット不要。初回3,000コール無料、以降3%。",
    url: "https://lemoncake.xyz/about",
    type: "article",
  },
};

// ── FAQPage JSON-LD（AEO/AIO: AI 検索エンジンが引用しやすい形で Q&A を提供。本文の可視内容と一致させる） ──
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "LemonCake とは何ですか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LemonCake は AI API・MCP サーバーのための従量課金・収益化レイヤーです。URL に prefix を 1 つ足す（または SDK を 1 行呼ぶ）だけで、あなたのエンドポイントが有料 API になります。使用量計測・Pay Token 検証・レート制限・不正防止・精算まで全部こちらで処理。SDK は MIT のオープンコアで、課金エンジンはホスト型です。",
      },
    },
    {
      "@type": "Question",
      name: "料金はいくらですか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "月額費用はありません。セラーごとに最初の 3,000 API コールは無料（アカウント通算・月リセットなし）。それ以降は売れた時だけ 3%（97% があなたの取り分）。Gateway・Pay Token 発行・支出上限・使用量計測まで全部込みです。",
      },
    },
    {
      "@type": "Question",
      name: "Stripe / Orb / Metronome と何が違いますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Stripe は「人間がカードを切る」前提で、実質 $0.30 の下限がサブセント課金を壊します。Orb と Metronome は計測・請求はしても決済は Stripe 任せ。LemonCake は計測＋請求＋決済を 1 つの SDK に統合し、AI エージェントを一級の Buyer として扱うので、人間でない呼び出し元に 1 コール $0.005 で課金できます。",
      },
    },
    {
      "@type": "Question",
      name: "Pay Token とは何ですか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Pay Token は Buyer があなたの API に渡す支出上限付きのクレデンシャルです。ハードな支出上限・有効期限・スコープを持ち、Gateway がコールごとに検証します。暴走・乱用するエージェントは上限に当たって、あなたの API も（クラウドの請求も）リクエストを見る前にブロックされます。",
      },
    },
    {
      "@type": "Question",
      name: "AI エージェントが私の API に直接支払えますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "はい。エージェントが使い切り上限付きで、あなたのエンドポイントに直接支払います。人間の承認も、API キー共有も、「認証情報をリセットして」というサポート対応も不要。これが LemonCake が想定する AI ネイティブな使い方です。",
      },
    },
    {
      "@type": "Question",
      name: "Buyer に暗号資産ウォレットは必要ですか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "不要です。Buyer は Stripe のカード決済で支払い、上限つきの Pay Token を受け取ります。ブロックチェーンウォレット、シードフレーズ、暗号資産オンボーディングは不要です。",
      },
    },
    {
      "@type": "Question",
      name: "LemonCake はオープンソースですか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Supabase / Clerk / Resend と同じオープンコアです。SDK（@lemon-cake/mcp-sdk・@lemon-cake/x402-server・agent-payment-mcp）と全 MCP アダプタは npm・GitHub で MIT 公開。ホスト型の課金エンジン・ダッシュボード・コンプライアンス・不正検知はサービスとして運用します。私たちが消えても、あなたの組込みは動き続けます。",
      },
    },
    {
      "@type": "Question",
      name: "MCP サーバーで使えますか？日本でも動きますか？",
      acceptedAnswer: {
        "@type": "Answer",
        text: "はい。どの MCP サーバーにもそのまま挿せるミドルウェアで、どの MCP SDK でも動作します。Buyer 側 MCP には無料デモツールも同梱されているため、Seller が本番 API を接続する前にエージェント側の支払いフローを試せます。",
      },
    },
  ],
};

// ── SVG Icons（絵文字の代わりに統一線画アイコン。stroke=currentColor で文脈色に追従） ──
const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};
const IconArrowRight = () => (
  <svg {...svgProps} strokeWidth={2} className="w-4 h-4">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);
const IconCard = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/>
  </svg>
);
const IconBot = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="4" y="9" width="16" height="11" rx="2.5"/><line x1="12" y1="5.5" x2="12" y2="9"/><circle cx="12" cy="4" r="1.3"/>
    <line x1="9" y1="13.5" x2="9" y2="15"/><line x1="15" y1="13.5" x2="15" y2="15"/>
  </svg>
);
const IconGear = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <circle cx="12" cy="12" r="3.2"/>
    <path d="M12 2.5v2.8M12 18.7v2.8M2.5 12h2.8M18.7 12h2.8M5.3 5.3l2 2M16.7 16.7l2 2M18.7 5.3l-2 2M7.3 16.7l-2 2"/>
  </svg>
);
const IconTicket = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/>
    <path d="M13 5.5v2M13 11v2M13 16.5v2"/>
  </svg>
);
const IconLock = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>
  </svg>
);
const IconLink2 = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7.1-7.1l-1.7 1.7"/>
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7.1 7.1l1.7-1.7"/>
  </svg>
);
const IconTag = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M3 3h8.2L21 12.8a2 2 0 0 1 0 2.8l-5.4 5.4a2 2 0 0 1-2.8 0L3 11.2z"/><circle cx="8" cy="8" r="1.6"/>
  </svg>
);
const IconRocket = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M12 2.5c2.9 2.1 4.6 5.6 4.6 9.6 0 1.4-.3 2.9-.8 4.4H8.2c-.5-1.5-.8-3-.8-4.4 0-4 1.7-7.5 4.6-9.6z"/>
    <circle cx="12" cy="9.5" r="1.8"/>
    <path d="M7.6 14.5 5 19.5l3.6-1.2M16.4 14.5l2.6 5-3.6-1.2M12 18.5V22"/>
  </svg>
);
const IconMeter = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M4 16a8 8 0 1 1 16 0"/><line x1="12" y1="16" x2="16.5" y2="11.5"/><circle cx="12" cy="16" r="1.2"/>
    <line x1="4" y1="19.5" x2="20" y2="19.5"/>
  </svg>
);
const IconKey = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <circle cx="7.5" cy="15.5" r="3.8"/><path d="M10.5 12.5 20 3M17.5 5.5l2.5 2.5M14.5 8.5l2.5 2.5"/>
  </svg>
);
const IconPayout = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="2" y="7" width="20" height="11" rx="2"/><circle cx="12" cy="12.5" r="2.6"/>
    <path d="M5.5 10v.01M18.5 15v.01"/>
  </svg>
);
const IconBadge = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="3" y="5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="11" r="2"/>
    <path d="M5.5 16.5c.7-1.5 1.7-2.2 3-2.2s2.3.7 3 2.2M14.5 9.5H19M14.5 13H19"/>
  </svg>
);
const IconPlug = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M9 2.5V8M15 2.5V8M7 8h10v3.5a5 5 0 0 1-10 0z"/><line x1="12" y1="16.5" x2="12" y2="21.5"/>
  </svg>
);
const IconStop = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M7.9 2.5h8.2l5.4 5.4v8.2l-5.4 5.4H7.9l-5.4-5.4V7.9z"/><line x1="12" y1="8" x2="12" y2="12.5"/><path d="M12 16h.01"/>
  </svg>
);
const IconSteps = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <rect x="3" y="14" width="4.5" height="6.5" rx="1"/><rect x="9.75" y="9.5" width="4.5" height="11" rx="1"/><rect x="16.5" y="4.5" width="4.5" height="16" rx="1"/>
  </svg>
);
const IconFlask = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <path d="M10 2.5v6L4.6 18.4A2 2 0 0 0 6.4 21.5h11.2a2 2 0 0 0 1.8-3.1L14 8.5v-6"/><path d="M8.5 2.5h7M7.2 15h9.6"/>
  </svg>
);
const IconClock = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg {...svgProps} className={className}>
    <circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>
  </svg>
);

// ── Page ──────────────────────────────────────────────────────────────────────
// 構造は /about/en (v2) に統一（2026-05-29）。本文は EN の
// Monetization Flow / Why developers / Billing 比較 / Abuse Log /
// Open core / Safety rails を日本語化したもの。旧オンチェーン決済・
// Quickstart・Buyer-Seller・Mission・Philosophy セクションは撤去。
// メタデータと FAQ JSON-LD も新ポジショニング（従量課金・3%・Pay Token・
// オープンコア）に合わせて書き換え、可視内容と一致させた（2026-05-29）。
export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#06060a] text-white font-sans antialiased">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* CSS-only animations for the money-flow diagram + ledger ticker (no client JS) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes lcCoin { 0% { transform: translateX(0); opacity: 0; } 10% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateX(calc(100% - 10px)); opacity: 0; } }
@keyframes lcTicker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
@keyframes lcPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(255,253,67,0.35); } 50% { box-shadow: 0 0 0 10px rgba(255,253,67,0); } }
@keyframes lcFloat { 0%, 100% { transform: translateY(0) rotate(-8deg); } 50% { transform: translateY(-14px) rotate(8deg); } }
@keyframes lcStepPop { 0% { transform: scale(1); } 50% { transform: scale(1.12); } 100% { transform: scale(1); } }
@keyframes lcGrow { from { width: 0%; } }
@keyframes lcStamp { 0%, 86%, 100% { transform: rotate(-2deg) scale(1); } 92% { transform: rotate(-7deg) scale(1.12); } }
@keyframes lcShine { 0% { transform: translateX(-140%) skewX(-18deg); } 55%, 100% { transform: translateX(260%) skewX(-18deg); } }
.lc-coin { animation: lcCoin 3.2s linear infinite; will-change: transform, opacity; }
.lc-coin-dot { box-shadow: 0 0 8px rgba(255,253,67,0.8); }
.lc-ticker { animation: lcTicker 28s linear infinite; will-change: transform; }
.lc-cv { content-visibility: auto; contain-intrinsic-block-size: auto 1000px; }
.lc-pulse { animation: lcPulse 2.4s ease-in-out infinite; }
.lc-float { animation: lcFloat 5.5s ease-in-out infinite; }
.lc-grow { animation: lcGrow 1.8s cubic-bezier(.2,.8,.2,1) both; }
.lc-stamp { animation: lcStamp 4s ease-in-out infinite; }
.lc-shine { animation: lcShine 5.5s ease-in-out infinite; }
.lc-tilt { transition: transform .45s ease; transform-style: preserve-3d; transform: rotateY(-8deg) rotateX(4deg); }
.lc-tilt:hover { transform: rotateY(0deg) rotateX(0deg) translateY(-6px); }
@keyframes lcReveal { from { opacity: 0; transform: translateY(32px); } to { opacity: 1; transform: none; } }
@keyframes lcDrift { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(60px, -40px) scale(1.15); } }
@keyframes lcDrift2 { 0%, 100% { transform: translate(0, 0) scale(1.1); } 50% { transform: translate(-70px, 50px) scale(0.95); } }
.lc-aurora { animation: lcDrift 26s ease-in-out infinite; will-change: transform; }
.lc-aurora2 { animation: lcDrift2 34s ease-in-out infinite; will-change: transform; }
.lc-outline { color: transparent; -webkit-text-stroke: 1.5px rgba(255,255,255,0.07); user-select: none; }
.lc-outline-strong { color: transparent; -webkit-text-stroke: 1px rgba(255,253,67,0.4); }
@media (prefers-reduced-motion: no-preference) {
  @supports (animation-timeline: view()) {
    .lc-stagger > * { animation: lcReveal 1s linear both; animation-timeline: view(); animation-range: entry 0% entry 42%; }
  }
}
.lc-card { transition: transform .25s ease, border-color .25s ease, box-shadow .25s ease; }
.lc-card:hover { transform: translateY(-4px); border-color: rgba(255,253,67,0.35); box-shadow: 0 12px 32px rgba(0,0,0,0.45); }
.lc-step:hover .lc-step-emoji { animation: lcStepPop .45s ease; }
details.lc-faq > summary { list-style: none; cursor: pointer; }
details.lc-faq > summary::-webkit-details-marker { display: none; }
details.lc-faq > summary .lc-faq-chev { transition: transform .2s ease; }
details.lc-faq[open] > summary .lc-faq-chev { transform: rotate(90deg); }
@media (prefers-reduced-motion: reduce) { .lc-coin, .lc-ticker, .lc-pulse, .lc-float, .lc-grow, .lc-stamp, .lc-shine, .lc-aurora, .lc-aurora2 { animation: none; } .lc-card:hover { transform: none; } .lc-tilt, .lc-tilt:hover { transform: none; } }
`,
        }}
      />

      {/* aurora backdrop — slow drifting glow blobs behind the dark sections */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="lc-aurora absolute -left-40 top-1/4 h-[55vh] w-[55vw] rounded-full bg-[#fffd43]/[0.05] blur-[110px]" />
        <div className="lc-aurora2 absolute -right-40 top-2/3 h-[45vh] w-[45vw] rounded-full bg-emerald-400/[0.04] blur-[110px]" />
      </div>
      {/* film grain — static texture overlay */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[60] opacity-[0.05]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 bg-[#06060a]/90 backdrop-blur-md border-b border-white/8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="LemonCake" width={28} height={28} className="w-7 h-7 rounded-lg object-cover" />
              <span className="font-bold text-[15px] text-white">LemonCake</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              {[
                { label: "ドキュメント", href: "/docs" },
                { label: "料金",         href: "/pricing" },
                { label: "仕組み",       href: "#how-it-works" },
                { label: "コンサルティング", href: "/consulting" },
              ].map(({ label, href }) => (
                <a key={label} href={href} className="text-[13px] text-white/50 hover:text-white/90 transition-colors">{label}</a>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LangSwitcher current="ja" basePath="/about" variant="dark" />
            <Link href="/app" className="hidden sm:inline text-[13px] text-white/50 hover:text-white/80 transition-colors">
              ダッシュボード
            </Link>
            <ContactButton className="text-[13px] font-semibold px-3 sm:px-4 py-1.5 bg-white text-[#06060a] rounded-lg hover:bg-white/90 transition-colors whitespace-nowrap">
              <span className="sm:hidden">相談</span>
              <span className="hidden sm:inline">お問い合わせ</span>
            </ContactButton>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <div className="bg-[#fffd43] w-full overflow-hidden">
        <section className="relative max-w-6xl mx-auto px-6 pt-12 pb-10 md:pt-20 md:pb-16 min-h-[calc(100vh-64px)] flex items-center">
          {/* floating LemonCake logos — playful, decorative only */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
            {[
              { left: "3%",  top: "10%", size: 56, delay: "0s",   opacity: 0.85 },
              { left: "11%", top: "72%", size: 40, delay: "1.6s", opacity: 0.7 },
              { left: "45%", top: "6%",  size: 34, delay: "0.8s", opacity: 0.6 },
              { left: "30%", top: "88%", size: 30, delay: "2.4s", opacity: 0.55 },
              { left: "63%", top: "12%", size: 26, delay: "3.2s", opacity: 0.5 },
            ].map((l, i) => (
              <span key={i} className="lc-float absolute" style={{ left: l.left, top: l.top, opacity: l.opacity, animationDelay: l.delay }}>
                <Image src="/logo.png" alt="" width={l.size} height={l.size} className="drop-shadow-[0_6px_12px_rgba(26,15,0,0.25)]" style={{ width: l.size, height: "auto" }} />
              </span>
            ))}
          </div>
          <div className="pointer-events-none absolute -right-16 top-10 hidden md:block w-[52%] max-w-[600px]">
            <Image
              src="/hero-visual.webp"
              alt="LemonCake — AI agent payment infrastructure"
              width={2508}
              height={2508}
              priority
              sizes="(min-width: 768px) 600px, 360px"
              className="w-full h-auto drop-shadow-2xl"
            />
          </div>
          <div className="relative z-10 w-full md:max-w-[620px] text-left">
            <div className="inline-flex items-center gap-2 mb-5 flex-wrap">
              <span className="px-3 py-1 bg-[#1a0f00]/8 border border-[#1a0f00]/15 rounded-full text-[10.5px] md:text-[11px] font-mono text-[rgba(26,15,0,0.72)]">
                MCP / API のための安全な収益化レイヤー · オープンコア
              </span>
              <span className="px-2 py-1 bg-[#1a0f00] text-[#fffd43] rounded-full text-[10px] font-mono font-bold uppercase tracking-widest">
                Private Beta
              </span>
            </div>
            <h1 className="text-[34px] sm:text-5xl lg:text-6xl font-black tracking-tight text-[#1a0f00] mb-4 leading-[1.02]">
              MCP / APIを、<br />
              <span className="inline-block bg-[#1a0f00] text-[#fffd43] px-3 py-0.5 rounded-xl -rotate-1 mr-1">5分</span>
              <span className="text-black">で有料化する。</span>
            </h1>
            <p className="text-[15px] md:text-lg text-[rgba(26,15,0,0.76)] max-w-[560px] mb-3 leading-relaxed">
              <strong className="text-[#1a0f00]">URLを貼って、1コール単価を決めて、購入リンクを共有。</strong>
              買い手はカードで前払いし、エージェントは上限つき Pay Token で自律利用します。
            </p>
            <p className="text-[12px] text-[rgba(26,15,0,0.62)] max-w-[560px] mb-7 leading-relaxed">
              <strong>本番稼働中:</strong> x402 gateway / Stripe-backed Pay Token / spend caps / usage ledger。暗号資産ウォレット不要。初回3,000コール無料、以降3%。売上の97%はSellerへ。
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/app"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#1a0f00] text-[#fffd43] font-bold rounded-lg hover:bg-[#1a0f00]/85 transition-colors text-sm"
              >
                無料で始める <IconArrowRight />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#1a0f00] border border-[#1a0f00]/15 font-semibold rounded-lg hover:bg-white/90 transition-colors text-sm"
              >
                ライブデモを見る →
              </Link>
            </div>
            <dl className="mt-8 grid grid-cols-3 max-w-[520px] border-y border-[rgba(26,15,0,0.14)] divide-x divide-[rgba(26,15,0,0.14)]">
              {[
                ["97%", "Seller取り分"],
                ["3,000", "無料コール"],
                ["0", "暗号資産ウォレット"],
              ].map(([v, k]) => (
                <div key={k} className="py-3 px-3 first:pl-0">
                  <dt className="text-[22px] font-black leading-none text-[#1a0f00]">{v}</dt>
                  <dd className="mt-1 text-[10px] font-bold text-[rgba(26,15,0,0.56)]">{k}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-7 md:hidden">
              <Image
                src="/hero-visual.webp"
                alt="LemonCake — AI agent payment infrastructure"
                width={2508}
                height={2508}
                priority
                sizes="360px"
                className="mx-auto w-[78%] max-w-[300px] h-auto drop-shadow-2xl"
              />
            </div>
          </div>
        </section>

        {/* Code snippet — sits inside the yellow hero band as a "this is real" anchor */}
        <section className="max-w-5xl mx-auto px-6 pb-12 md:pb-16">
          <div className="rounded-lg bg-[#1a0f00] text-white p-4 md:p-5 shadow-xl border border-[#1a0f00]/20">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <div className="w-2 h-2 rounded-full bg-[#28c840]" />
              <span className="ml-3 text-[11px] font-mono text-white/40">tool-server.ts</span>
            </div>
            <pre className="font-mono text-[12px] md:text-[13px] leading-relaxed overflow-x-auto">
              <code>
                <span className="text-[#c8b800]">{"import"}</span>{" { createLemonCakeSDK } "}<span className="text-[#c8b800]">{"from"}</span> <span className="text-[#7bc97a]">{`"@lemon-cake/mcp-sdk"`}</span>;{"\n\n"}
                <span className="text-[#c8b800]">const</span>{" lc = "}<span className="text-white">createLemonCakeSDK</span>{"();"}{" "}<span className="text-white/40">{"// env var なしのデモモード"}</span>{"\n\n"}
                <span className="text-white/50">{"// HTTP ルート — 1 行。"}</span>{"\n"}
                {"app.use("}<span className="text-white">lc.protect</span>{"("}<span className="text-[#7bc97a]">{`"/api/search"`}</span>{", { cost: "}<span className="text-[#febc2e]">{"0.02"}</span>{" }));"}{"\n\n"}
                <span className="text-white/50">{"// または MCP ツール — 同じ書き方。"}</span>{"\n"}
                {"server.tool("}<span className="text-[#7bc97a]">{`"search"`}</span>{", "}<span className="text-white">lc.charge</span>{"({ price: "}<span className="text-[#febc2e]">{"0.02"}</span>{" }), handler);"}
              </code>
            </pre>
          </div>
          <p className="mt-4 text-center text-[12px] text-[#1a0f00]/50">
            MCP にそのまま挿せるミドルウェア。どの MCP SDK でも動作。初回 3,000 calls 無料。
          </p>
        </section>
      </div>

      {/* wavy divider: yellow → dark */}
      <div className="bg-[#fffd43]" aria-hidden="true">
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="block w-full h-[40px] md:h-[64px]">
          <path d="M0,32 C240,64 480,0 720,24 C960,48 1200,8 1440,32 L1440,64 L0,64 Z" fill="#06060a" />
        </svg>
      </div>

      {/* marquee — capability strip */}
      <div className="overflow-hidden border-b border-white/5 py-3" aria-hidden="true">
        <div className="lc-ticker flex w-max items-center gap-10 px-4 font-black text-[12px] uppercase tracking-[0.3em] whitespace-nowrap">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex items-center gap-10">
              {["Pay-per-call", "HTTP 402", "Pay Token", "MCP Native", "97% to Sellers", "No Crypto Wallet", "x402 Gateway", "Sub-cent Pricing"].map((w, i) => (
                <span key={w} className={`flex items-center gap-10 ${i % 2 ? "text-white/20" : "lc-outline-strong"}`}>{w}<span className="text-[#fffd43]/35">●</span></span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── 3 steps in 5 minutes ── */}
      <section className="lc-cv lc-stagger relative max-w-6xl mx-auto px-6 pt-20 pb-4">
        <span aria-hidden="true" className="lc-outline pointer-events-none absolute inset-x-0 top-2 text-center text-[88px] md:text-[150px] font-black leading-none whitespace-nowrap">START</span>
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Getting started</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          やることは <span className="text-[#fffd43]">3つ</span> だけ。
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-12 max-w-xl mx-auto">
          コードを書かなくても始められます。タイマーは 5 分あれば十分。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 md:gap-2 md:items-stretch">
          {[
            { n: "1", icon: IconLink2, time: "1分", t: "つなぐ", d: (
              <>
                <span className="block mb-2">既存の API / MCP は <b className="text-white">URL を貼るだけ</b>。コード変更ゼロ。</span>
                <span className="my-2 flex items-center gap-2 text-[10px] font-mono text-white/30"><span className="h-px flex-1 bg-white/10" />または ゼロから作る<span className="h-px flex-1 bg-white/10" /></span>
                <span className="flex items-center justify-center gap-2 rounded-lg border border-[#fffd43]/20 bg-black/40 px-2.5 py-1.5 font-mono text-[11.5px] text-[#fffd43]/90 whitespace-nowrap overflow-x-auto">
                  <span className="text-white/35 select-none">$</span> npx create-lemon-mcp
                </span>
              </>
            ) },
            { n: "2", icon: IconTag, time: "1分", t: "単価を決める", d: "1 コールいくらかをスライダーで設定。$0.005 のサブセントから OK。いつでも変更できます。" },
            { n: "3", icon: IconRocket, time: "3分", t: "購入リンクを共有", d: "発行された購入リンクを README や X に貼るだけ。買い手がカードで前払いしたら、もう売上が立ちます。" },
          ].map(({ n, icon: StepIcon, time, t, d }, i) => (
            <div key={n} className="contents">
              <div className="lc-step lc-card relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 md:p-7 text-center">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#fffd43] px-3 py-0.5 text-[11px] font-black text-[#1a0f00]">STEP {n}</span>
                <div className="lc-step-emoji mx-auto mt-2 mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#fffd43]/25 bg-[#fffd43]/8 text-[#fffd43]" aria-hidden="true"><StepIcon className="w-8 h-8" /></div>
                <p className="mb-2 inline-flex items-center gap-1 font-mono text-[10px] text-[#fffd43]/70"><IconClock className="w-3 h-3" /> {time}</p>
                <h3 className="text-[17px] font-bold text-white mb-2">{t}</h3>
                <div className="text-[13px] text-white/55 leading-relaxed">{d}</div>
              </div>
              {i < 2 && (
                <div className="hidden md:flex items-center justify-center px-1 text-[#fffd43]/50 text-2xl font-black" aria-hidden="true">→</div>
              )}
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-[12px] text-white/40">
          合計 <span className="font-black text-[#fffd43]">5分</span>。あとはエージェントが勝手に払いに来ます。
        </p>
      </section>

      {/* ── How it works — animated money flow ── */}
      <section id="how-it-works" className="lc-cv lc-stagger relative max-w-6xl mx-auto px-6 py-20">
        <span aria-hidden="true" className="lc-outline pointer-events-none absolute inset-x-0 top-2 text-center text-[88px] md:text-[150px] font-black leading-none whitespace-nowrap">FLOW</span>
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">How it works</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          お金の流れが、<span className="text-[#fffd43]">ぜんぶ見える。</span>
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-12 max-w-xl mx-auto">
          買い手が前払い → エージェントが上限内で自律利用 → あなたに 97%。これだけです。
        </p>

        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 md:p-10 space-y-8">
          {/* Lane 1 — 前払い */}
          <div>
            <p className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-3">① 買い手がカードで前払い</p>
            <div className="flex items-center gap-3 md:gap-5">
              <div className="flex h-14 w-14 md:h-16 md:w-16 flex-none items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-white/70" aria-hidden="true"><IconCard className="w-7 h-7 md:w-8 md:h-8" /></div>
              <div className="relative h-8 flex-1 overflow-hidden" aria-hidden="true">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
                <span className="lc-coin absolute inset-0"><span className="lc-coin-dot absolute left-0 top-1/2 -mt-[5px] h-[10px] w-[10px] rounded-full bg-[#fffd43]" /></span>
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-[#06060a] px-2.5 py-0.5 font-mono text-[10px] text-white/55 whitespace-nowrap">前払い $5.00</span>
              </div>
              <div className="flex-none rounded-2xl border border-[#fffd43]/35 bg-[#fffd43]/10 px-3.5 py-2.5 md:px-5 md:py-3">
                <p className="flex items-center gap-1.5 text-[15px] md:text-[17px] font-black text-[#fffd43]"><IconTicket className="w-5 h-5" /> Pay Token</p>
                <p className="mt-0.5 font-mono text-[10px] text-white/55">上限 $5.00 · 500 calls · 期限つき</p>
              </div>
            </div>
          </div>

          {/* Lane 2 — 自律利用（コインが流れる） */}
          <div>
            <p className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-3">② エージェントが 1 コールずつ払って使う</p>
            <div className="flex items-center gap-3 md:gap-5">
              <div className="flex h-14 w-14 md:h-16 md:w-16 flex-none items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-white/70" aria-hidden="true"><IconBot className="w-7 h-7 md:w-8 md:h-8" /></div>
              <div className="relative h-8 flex-1 overflow-hidden" aria-hidden="true">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
                {[0, 1, 2].map((i) => (
                  <span key={i} className="lc-coin absolute inset-0" style={{ animationDelay: `${i * 1.05}s` }}><span className="lc-coin-dot absolute left-0 top-1/2 -mt-[5px] h-[10px] w-[10px] rounded-full bg-[#fffd43]" /></span>
                ))}
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-[#06060a] px-2.5 py-0.5 font-mono text-[10px] text-white/55 whitespace-nowrap">$0.01 / call</span>
              </div>
              <div className="lc-pulse flex h-14 w-14 md:h-16 md:w-16 flex-none items-center justify-center rounded-2xl border border-[#fffd43]/40 bg-[#fffd43]/12" aria-hidden="true">
                <Image src="/logo.png" alt="" width={40} height={40} className="w-9 h-9 md:w-11 md:h-11 object-contain drop-shadow" />
              </div>
              <div className="relative hidden h-8 flex-1 overflow-hidden sm:block" aria-hidden="true">
                <div className="absolute left-0 right-0 top-1/2 h-px bg-white/15" />
                <span className="lc-coin absolute inset-0" style={{ animationDelay: "0.6s" }}><span className="lc-coin-dot absolute left-0 top-1/2 -mt-[5px] h-[10px] w-[10px] rounded-full bg-emerald-400" style={{ boxShadow: "0 0 8px rgba(52,211,153,0.8)" }} /></span>
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-[#06060a] px-2.5 py-0.5 font-mono text-[10px] text-white/55 whitespace-nowrap">検証 ✓ 計量 ✓ 転送</span>
              </div>
              <div className="flex h-14 w-14 md:h-16 md:w-16 flex-none items-center justify-center rounded-2xl border border-white/12 bg-white/5 text-white/70" aria-hidden="true"><IconGear className="w-7 h-7 md:w-8 md:h-8" /></div>
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] text-white/35">
              <span>エージェント</span><span className="text-[#fffd43]/70">LemonCake Gateway</span><span>あなたの API</span>
            </div>
          </div>

          {/* Lane 3 — 分配と上限 */}
          <div>
            <p className="text-[10px] font-mono text-white/35 uppercase tracking-widest mb-3">③ 売上は自動で分配。予算が尽きたら止まる</p>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="flex h-10 overflow-hidden rounded-xl border border-white/10 text-[12px] font-black">
                <div className="lc-grow flex items-center justify-center bg-[#fffd43] text-[#1a0f00] whitespace-nowrap overflow-hidden" style={{ width: "85%" }}>97% あなたへ（Stripe 直接入金）</div>
                <div className="flex flex-1 items-center justify-center bg-white/10 text-white/60">3%</div>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-center font-mono text-[11.5px] text-white/70 whitespace-nowrap">
                予算ゼロ → <b className="lc-stamp inline-flex items-center gap-1 text-[#fffd43]"><IconLock className="w-3.5 h-3.5" /> 402 で自動停止</b>
              </div>
            </div>
          </div>

          {/* Ledger ticker — the demo's story, scrolling forever */}
          <div className="overflow-hidden rounded-xl border border-white/8 bg-black/40 py-2" aria-hidden="true">
            <div className="lc-ticker flex w-max gap-8 px-4 font-mono text-[11px] whitespace-nowrap">
              {[0, 1].map((dup) => (
                <div key={dup} className="flex gap-8">
                  {[
                    ["#17", "200 paid_call", "$0.01", "you +$0.0097"],
                    ["#18", "200 paid_call", "$0.01", "you +$0.0097"],
                    ["#19", "200 paid_call", "$0.01", "you +$0.0097"],
                    ["#20", "200 paid_call", "$0.01", "you +$0.0097"],
                  ].map(([n, s, c, y2]) => (
                    <span key={`${dup}-${n}`} className="text-white/45">
                      <span className="text-white/25">{n}</span> {s} <span className="text-[#fffd43]/80">{c}</span> → <span className="text-emerald-300/80">{y2}</span>
                    </span>
                  ))}
                  <span className="font-bold text-[#fffd43]">#21 402 cap_enforced — token spent, agent stopped</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-[12px] text-white/40 max-w-xl mx-auto leading-relaxed">
          変えるのは URL 1 つ（または SDK 1 行）だけ。Pay Token 検証・レート制限・使用量計測・Stripe 入金まで、流れの真ん中は全部 LemonCake が処理します。
        </p>
      </section>

      {/* ── Pay Token = capped prepaid card ── */}
      <section className="lc-cv lc-stagger max-w-6xl mx-auto px-6 py-24 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-10 items-center">
          {/* Copy */}
          <div>
            <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">What is a Pay Token?</p>
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
              エージェントに渡すのは、<br />
              <span className="text-[#fffd43]">上限つきプリペイドカード。</span>
            </h2>
            <p className="text-[14px] text-white/50 leading-relaxed mb-8">
              クレカ番号でも API キーでもなく、使い切りの Pay Token。
              上限・期限・スコープがカード自体に焼き込まれていて、
              超えた瞬間に <span className="font-mono text-[#fffd43]">402</span> で止まる — 例外なし。
            </p>
            <ul className="space-y-4">
              {[
                { t: "ハード上限", d: "$5 と書いたカードで $5.01 は絶対に使えない。あなたの承認も監視も不要。" },
                { t: "有効期限", d: "期限が切れたら自動失効。放置されたカードが事故になることはない。" },
                { t: "スコープ", d: "指定したエンドポイント専用。他の API では 1 円も使えない。" },
                { t: "即時失効", d: "ダッシュボードから 1 クリックで revoke。次のコールから即拒否。" },
              ].map(({ t, d }) => (
                <li key={t} className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#fffd43]/15 border border-[#fffd43]/40 text-[#fffd43] text-[11px] font-black" aria-hidden="true">✓</span>
                  <p className="text-[13.5px] text-white/60 leading-relaxed"><b className="text-white">{t}</b> — {d}</p>
                </li>
              ))}
            </ul>
          </div>

          {/* The card */}
          <div className="relative mx-auto w-full max-w-[440px] [perspective:1200px]">
            {/* glow behind */}
            <div className="pointer-events-none absolute inset-0 -m-10 rounded-full bg-[#fffd43]/[0.07] blur-3xl" aria-hidden="true" />
            <div className="lc-tilt relative aspect-[1.586/1] rounded-[22px] border border-[#fffd43]/25 bg-gradient-to-br from-[#1c1c26] via-[#101016] to-[#06060a] p-5 md:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.6),0_0_40px_rgba(255,253,67,0.12)] overflow-hidden">
              {/* holo blob + grid texture */}
              <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(255,253,67,0.16),rgba(255,160,220,0.08),transparent_70%)]" aria-hidden="true" />
              <div className="pointer-events-none absolute inset-0 opacity-[0.05]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "26px 26px" }} aria-hidden="true" />
              {/* shine sweep */}
              <div className="pointer-events-none absolute inset-y-0 w-1/3 lc-shine bg-gradient-to-r from-transparent via-white/10 to-transparent" aria-hidden="true" />

              {/* top row: chip + contactless + logo */}
              <div className="relative flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-11 rounded-md bg-gradient-to-br from-[#f5e36b] to-[#c8a93e] border border-[#fff7c2]/50 grid grid-cols-2 gap-[2px] p-[3px]" aria-hidden="true">
                    {[0,1,2,3].map(i => <span key={i} className="rounded-[2px] bg-[#a8862c]/60" />)}
                  </div>
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white/40 rotate-90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M8.5 8.5a5 5 0 0 1 0 7" /><path d="M5.7 5.7a9 9 0 0 1 0 12.6" /><path d="M11.3 11.3a1.2 1.2 0 0 1 0 1.4" />
                  </svg>
                </div>
                <div className="flex items-center gap-2">
                  <Image src="/logo.png" alt="" width={30} height={30} className="w-7 h-7 md:w-8 md:h-8 object-contain drop-shadow" aria-hidden="true" />
                  <span className="font-mono text-[9px] md:text-[10px] font-bold tracking-[0.22em] text-[#fffd43]/80 uppercase">Pay Token</span>
                </div>
              </div>

              {/* number */}
              <p className="relative mt-5 md:mt-7 font-mono text-[17px] md:text-[21px] tracking-[0.14em] text-white/90">
                lc_pay <span className="text-white/35">••••</span> <span className="text-white/35">••••</span> 8f3a
              </p>

              {/* budget bar */}
              <div className="relative mt-4 md:mt-5">
                <div className="flex items-baseline justify-between font-mono text-[10px] text-white/45 mb-1.5">
                  <span>残高 <b className="text-[#fffd43] text-[12px]">$3.18</b> / $5.00</span>
                  <span className="text-white/35">318 calls left</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="lc-grow h-full rounded-full bg-gradient-to-r from-[#fffd43] to-[#ffe066]" style={{ width: "64%" }} />
                </div>
              </div>

              {/* bottom row */}
              <div className="relative mt-4 md:mt-6 flex items-end justify-between font-mono text-[9.5px] md:text-[10.5px]">
                <div>
                  <p className="text-white/30 uppercase tracking-widest mb-0.5">Holder</p>
                  <p className="flex items-center gap-1 text-white/80"><IconBot className="w-3.5 h-3.5 text-white/60" /> research-agent-01</p>
                </div>
                <div>
                  <p className="text-white/30 uppercase tracking-widest mb-0.5">Scope</p>
                  <p className="text-[#fffd43]/85">/api/search のみ</p>
                </div>
                <div className="text-right">
                  <p className="text-white/30 uppercase tracking-widest mb-0.5">Exp</p>
                  <p className="text-white/80">07 / 26</p>
                </div>
              </div>
            </div>

            {/* floating status chips */}
            <div className="pointer-events-none absolute -right-2 -top-4 rounded-full border border-emerald-400/40 bg-[#06060a] px-3 py-1.5 font-mono text-[10px] text-emerald-300 shadow-lg" aria-hidden="true">
              ✓ verified · $0.01 charged
            </div>
            <div className="pointer-events-none absolute -left-2 -bottom-4 inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-[#06060a] px-3 py-1.5 font-mono text-[10px] text-red-300 shadow-lg" aria-hidden="true">
              <IconLock className="w-3 h-3" /> 上限到達 → 402
            </div>
          </div>
        </div>
      </section>

      {/* ── Why developers ── */}
      <section id="why-developers" className="lc-cv lc-stagger relative max-w-6xl mx-auto px-6 py-24">
        <span aria-hidden="true" className="lc-outline pointer-events-none absolute inset-x-0 top-2 text-center text-[88px] md:text-[150px] font-black leading-none whitespace-nowrap">WHY</span>
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Why developers use LemonCake</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          決済インフラが面倒にする部分を、<br />
          <span className="text-[#fffd43]">まとめて引き受ける。</span>
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-16 max-w-xl mx-auto">
          LemonCake を繋いだら、気にしなくてよくなる 6 つのこと。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-5">
          {[
            { icon: IconMeter, t: "従量課金", d: "tool call 単位・token 単位・成果単位で課金。サブセントのマイクロペイメントがネイティブに動作 — 最低取引額なし、Stripe のような $0.30 の下限なし。", span: "md:col-span-3", wide: false },
            { icon: IconBot, t: "AI エージェント決済", d: "エージェントが使い切り上限付きで、あなたのエンドポイントに直接支払う。人間の承認も、API キー共有も、「認証情報をリセットして」というサポート対応も不要。", span: "md:col-span-3", wide: false },
            { icon: IconKey, t: "API キー管理ゼロ", d: "キーの発行・ローテーション・失効はもう不要。Buyer はインストール時に 1 度だけ認証。あなたが秘密情報に触れることはありません。", span: "md:col-span-2", wide: false },
            { icon: IconPayout, t: "Stripe 入金", d: "Buyer はカードで Pay Token を購入。Seller には Stripe Connect Direct Charge で入金。LemonCake が資金をプールすることはありません。", span: "md:col-span-2", wide: false },
            { icon: IconBadge, t: "Agent Identity", d: "エージェントごとに ID・予算・利用履歴を紐づけ。暴走したら pause / revoke で即停止 — 残高が残っていても、そのエージェントだけ止められます。", span: "md:col-span-2", wide: false },
            { icon: IconPlug, t: "MCP ネイティブ", d: "どの MCP サーバーにもそのまま挿せるミドルウェア。npx create-lemon-mcp で雛形ごと生成。Glama + Smithery + mcp.so などに自動掲載。", span: "md:col-span-6", wide: true },
          ].map(({ icon: CardIcon, t, d, span, wide }) => (
            <div key={t} className={`lc-card rounded-2xl bg-white/4 border border-white/8 p-6 ${span} ${wide ? "md:flex md:items-center md:gap-6 md:bg-gradient-to-r md:from-[#fffd43]/[0.06] md:to-transparent" : ""}`}>
              <div className={`mb-3 flex items-center justify-center rounded-xl border border-[#fffd43]/20 bg-[#fffd43]/8 text-[#fffd43] ${wide ? "h-14 w-14 flex-none md:mb-0" : "h-10 w-10"}`} aria-hidden="true"><CardIcon className={wide ? "w-7 h-7" : "w-5 h-5"} /></div>
              <div>
                <h3 className="text-[15px] font-bold text-white mb-2">{t}</h3>
                <p className="text-[13px] text-white/55 leading-relaxed">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Billing stack comparison ── */}
      <section className="lc-cv bg-white/[0.02] border-y border-white/8">
        <div className="lc-stagger relative max-w-5xl mx-auto px-6 py-20">
          <span aria-hidden="true" className="lc-outline pointer-events-none absolute inset-x-0 top-4 text-center text-[88px] md:text-[150px] font-black leading-none whitespace-nowrap">VS</span>
          <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">The billing stack today</p>
          <h2 className="text-center text-3xl font-black text-white mb-4 leading-tight">
            Stripe は人間向け。Orb &amp; Metronome は SaaS 向け。<br />
            <span className="text-[#fffd43]">LemonCake は AI 向け。</span>
          </h2>
          <p className="text-center text-[13px] text-white/45 mb-10 max-w-2xl mx-auto">
            既存の課金インフラは「人間がカードを切り、組織が席を更新する」前提。AI API は人間でない呼び出し元に、1 コール サブセント単位で課金する。形が違えば、スタックも違う。
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-white/10">
                  <th scope="col" className="text-left py-3 px-3 text-white/50 font-semibold"></th>
                  <th scope="col" className="text-left py-3 px-3 text-white/60 font-semibold">Stripe</th>
                  <th scope="col" className="text-left py-3 px-3 text-white/60 font-semibold">Orb / Metronome</th>
                  <th scope="col" className="text-left py-3 px-3 text-[#fffd43] font-bold bg-[#fffd43]/[0.07] rounded-t-lg">
                    <span className="inline-flex items-center gap-1.5">
                      <Image src="/logo.png" alt="" width={20} height={20} className="w-5 h-5 object-contain" aria-hidden="true" />
                      LemonCake
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["計測 + 請求 + 決済を 1 つの SDK で", ["✗", "決済のみ"],              ["△", "計測 + 請求（決済は Stripe）"], "対応"],
                  ["AI エージェントが Buyer",            ["✗", "カードのみ"],            ["✗", "組織課金のみ"],                "ネイティブ"],
                  ["1 コール サブセント",                ["✗", "実質 $0.30 下限"],       ["△", "可能だが Stripe 課金"],        "$0.005"],
                  ["MCP / agent ミドルウェア",           ["✗", "—"],                     ["✗", "—"],                           "そのまま挿せる"],
                  ["API キー管理不要",                   ["✗", "キー必須"],              ["✗", "キー必須"],                    "組込み認証"],
                  ["無料枠",                             ["△", "Stripe レート適用"],     ["△", "エンタープライズ階層"],        "初回 3,000 件無料・以降3%"],
                  ["OSS の SDK",                         ["✗", "クローズド"],            ["✗", "クローズド"],                  "MIT"],
                  ["導入時間",                           ["△", "Connect オンボーディング"], ["✗", "実装エンジニアが必要"],     "URLを貼って公開"],
                ] as [string, [string, string], [string, string], string][]).map(([f, s, o, lc]) => (
                  <tr key={f} className="border-b border-white/5">
                    <td className="py-3 px-3 text-white/70 font-medium">{f}</td>
                    {[s, o].map(([mark, text], i) => (
                      <td key={i} className="py-3 px-3 text-white/40">
                        <span className={`mr-1.5 font-bold ${mark === "✗" ? "text-red-400/70" : "text-amber-300/70"}`} aria-hidden="true">{mark}</span>
                        {text}
                      </td>
                    ))}
                    <td className="py-3 px-3 text-white bg-[#fffd43]/[0.07]">
                      <span className="mr-1.5 font-bold text-[#fffd43]" aria-hidden="true">✓</span>
                      {lc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-[11px] text-white/30 text-center font-mono">
            人間のチェックアウトで Stripe を置き換えるつもりはありません。Buyer が AI エージェントのときに欲しくなるスタック、それが LemonCake です。
          </p>
        </div>
      </section>

      {/* ── Abuse Prevention Log ── */}
      <section className="lc-cv max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-red-500/10 to-red-500/[0.02] border border-red-500/25 p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-[11px] font-semibold text-red-300 uppercase tracking-widest mb-3">課金だけじゃない — 不正・暴走の防止</p>
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
                暴走エージェントを止める。<br />
                <span className="text-red-300">あなたに 1 円も請求が来る前に。</span>
              </h2>
              <p className="text-[14px] text-white/55 leading-relaxed">
                Pay Token の支出上限とレート制限は Gateway でチェックされます。無限ループに陥った異常なエージェントは即座に壁に当たり — あなたの API はそのリクエストを見ることすらなく、AWS の請求も動きません。ダッシュボードの blocked-request フィードで、止めた内容を確認できます。
              </p>
            </div>
            {/* mock log */}
            <div className="rounded-2xl bg-black/40 border border-white/10 p-4 font-mono text-[11.5px] text-white/70">
              <div className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-3">ブロックしたリクエスト（サンプル）</div>
              {[
                { t: "14:21:08", reason: "spend_cap_exceeded",  saved: "$12.40" },
                { t: "14:19:55", reason: "rate_limit_exceeded", saved: "$0.78"  },
                { t: "14:15:02", reason: "token_revoked",        saved: "$0.04"  },
                { t: "14:11:30", reason: "spend_cap_exceeded",  saved: "$8.20"  },
              ].map((r, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-b-0">
                  <span className="text-white/40">{r.t}</span>
                  <span className="text-red-300/85">{r.reason}</span>
                  <span className="text-emerald-300/85 font-bold">−{r.saved}</span>
                </div>
              ))}
              <p className="mt-3 text-[10px] text-white/35 text-center">サンプル表示 — 実データはダッシュボードの「ブロック済みリクエスト」で確認できます。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Margin dashboard teaser (Q3 2026) ── */}
      <section className="lc-cv max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-3xl bg-gradient-to-br from-amber-500/10 to-amber-500/[0.02] border border-amber-500/25 p-8 md:p-10">
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-center">
            <div>
              <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest mb-3">Q3 2026 公開予定 · Early access</p>
              <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
                マージン ダッシュボード。
              </h2>
              <p className="text-[14px] text-white/55 leading-relaxed max-w-xl">
                agent / endpoint / token 単位で AI 原価 vs 売上を可視化。マージン漏れが複利で効く前に潰す。Stripe / Orb / Metronome が native で見せないのは、彼らの顧客が $0.05 の売上の裏に $0.50 の OpenAI コストを背負ってないから。あなたのは違う。
              </p>
            </div>
            <a
              href="mailto:contact@aievid.com?subject=%E3%83%9E%E3%83%BC%E3%82%B8%E3%83%B3%20%E3%83%80%E3%83%83%E3%82%B7%E3%83%A5%E3%83%9C%E3%83%BC%E3%83%89%20early%20access&body=Hiroto%20%E6%A7%98%0A%0A%E3%83%9E%E3%83%BC%E3%82%B8%E3%83%B3%E3%83%80%E3%83%83%E3%82%B7%E3%83%A5%E3%83%9C%E3%83%BC%E3%83%89%E5%85%AC%E9%96%8B%E3%81%AE%E9%9A%9B%E3%81%AB%E9%80%9A%E7%9F%A5%E3%82%92%E5%B8%8C%E6%9C%9B%E3%81%97%E3%81%BE%E3%81%99%E3%80%82%0A%0Astack%20%2F%20%E7%94%A8%E9%80%94%3A%20%5B1-2%20%E8%A1%8C%5D%0A%0A%E3%82%88%E3%82%8D%E3%81%97%E3%81%8F%E3%81%8A%E9%A1%98%E3%81%84%E3%81%97%E3%81%BE%E3%81%99%E3%80%82%0A%5B%E5%90%8D%E5%89%8D%5D"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-amber-400 text-amber-950 font-bold rounded-xl hover:bg-amber-300 transition-colors text-[13px] whitespace-nowrap"
            >
              Early access に参加 →
            </a>
          </div>
        </div>
      </section>

      {/* ── Open core ── */}
      <section className="lc-cv max-w-5xl mx-auto px-6 py-20">
        <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.02] border border-emerald-500/20 p-10 md:p-12">
          <div className="text-center mb-10">
            <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest mb-4">Open core, like Supabase &amp; Clerk</p>
            <h2 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">
              SDK は fork して OK。<br />
              <span className="text-emerald-400">面倒なところは、こちらでホスト。</span>
            </h2>
            <p className="text-[14px] text-white/55 leading-relaxed max-w-2xl mx-auto">
              完全 OSS の課金インフラは資金が尽きた瞬間に死ぬ。完全 SaaS の課金インフラは設計からしてロックイン。オープンコアだけが誠実な中間 — MIT ライセンスの SDK + ホスト型の実行基盤。私たちが消えても、あなたの組込みは動き続けます。
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* OPEN side */}
            <div className="rounded-2xl bg-emerald-500/5 border border-emerald-500/20 p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2 py-0.5 uppercase tracking-widest">Open · MIT</span>
              </div>
              <h3 className="text-[15px] font-bold text-white mb-3">fork できるもの</h3>
              <ul className="space-y-2 text-[12.5px] text-white/60 font-mono">
                {[
                  "@lemon-cake/mcp-sdk",
                  "@lemon-cake/x402-server",
                  "agent-payment-mcp",
                  "examples/*（スターターテンプレート）",
                  "MCP アダプタ（Claude / Cursor / LangChain）",
                  "全ドキュメント・移行ガイド",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">●</span> {line}
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center gap-2">
                <a href="https://github.com/evidai/agent-payment-mcp" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300 hover:text-emerald-200 transition-colors">
                  GitHub →
                </a>
                <span className="text-white/20">·</span>
                <a href="https://www.npmjs.com/package/@lemon-cake/mcp-sdk" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-emerald-300 hover:text-emerald-200 transition-colors">
                  npm →
                </a>
              </div>
            </div>
            {/* CLOSED side */}
            <div className="rounded-2xl bg-white/4 border border-white/10 p-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-bold text-white/60 bg-white/8 border border-white/15 rounded-full px-2 py-0.5 uppercase tracking-widest">Hosted</span>
              </div>
              <h3 className="text-[15px] font-bold text-white mb-3">サービスとして運用するもの</h3>
              <ul className="space-y-2 text-[12.5px] text-white/55 font-mono">
                {[
                  "課金エンジン（決済・台帳）",
                  "収益ルーティング・支払いロジック",
                  "ダッシュボード（分析・支払い・不正対策）",
                  "コンプライアンス（税務・請求書・レポート）",
                  "不正・乱用検知",
                  "ホスト型 Gateway・稼働率 SLA",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <span className="text-white/40 mt-0.5">●</span> {line}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <Link href="/pricing" className="inline-flex items-center gap-1.5 text-[12px] text-white/60 hover:text-white transition-colors">
                  料金を見る →
                </Link>
              </div>
            </div>
          </div>
          <p className="mt-6 text-[11px] text-white/30 text-center font-mono">
            MIT · Supabase / Clerk / Resend と同じパターン · 本番 MCP 5 本公開済
          </p>
        </div>
      </section>

      {/* ── Safety rails (condensed) ── */}
      <section className="lc-cv max-w-5xl mx-auto px-6 py-16">
        <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-5 text-center">安全装置</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="lc-card rounded-2xl border border-red-400/25 bg-gradient-to-br from-red-500/10 to-transparent p-6 text-center md:text-left">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-red-400/30 bg-red-500/10 text-red-300" aria-hidden="true"><IconStop className="w-6 h-6" /></div>
            <h3 className="text-[14px] font-bold text-white mb-1.5">緊急停止（Kill switch）</h3>
            <p className="text-[12.5px] text-white/55 leading-relaxed">ダッシュボードから 1 クリックで失効。エージェント単位の pause / revoke も。以降の課金は即座に拒否されます。</p>
          </div>
          <div className="lc-card rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/10 to-transparent p-6 text-center md:text-left">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/10 text-sky-300" aria-hidden="true"><IconSteps className="w-6 h-6" /></div>
            <h3 className="text-[14px] font-bold text-white mb-1.5">段階的な上限（KYA）</h3>
            <p className="text-[12.5px] text-white/55 leading-relaxed">デフォルト $10/日 → Know-Your-Agent で $1,000/日 → フル KYC で $50,000/日。</p>
          </div>
          <div className="lc-card rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/10 to-transparent p-6 text-center md:text-left">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-300" aria-hidden="true"><IconFlask className="w-6 h-6" /></div>
            <h3 className="text-[14px] font-bold text-white mb-1.5">サンドボックス</h3>
            <p className="text-[12.5px] text-white/55 leading-relaxed">本番と同じ挙動のテストトークンを発行。実資金は動きません。<a href="/demo" className="text-[#fffd43]/80 hover:text-[#fffd43] underline underline-offset-2">ライブデモ →</a></p>
          </div>
        </div>
      </section>

      {/* ── FAQ（faqJsonLd と同一ソースを描画 — JSON-LD と可視内容が常に一致） ── */}
      <section className="lc-cv lc-stagger relative max-w-3xl mx-auto px-6 py-20">
        <span aria-hidden="true" className="lc-outline pointer-events-none absolute inset-x-0 top-2 text-center text-[88px] md:text-[150px] font-black leading-none whitespace-nowrap">FAQ</span>
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">FAQ</p>
        <h2 className="flex items-center justify-center gap-2.5 text-center text-3xl md:text-4xl font-black text-white mb-10 leading-tight">
          よくある質問
          <Image src="/logo.png" alt="" width={40} height={40} className="inline-block w-8 h-8 md:w-10 md:h-10 object-contain drop-shadow" aria-hidden="true" />
        </h2>
        <div className="space-y-3">
          {faqJsonLd.mainEntity.map((q) => (
            <details key={q.name} className="lc-faq group rounded-2xl border border-white/10 bg-white/[0.03] open:border-[#fffd43]/30 open:bg-white/[0.05]">
              <summary className="flex items-center gap-3 px-5 py-4">
                <span className="lc-faq-chev flex-none text-[#fffd43] font-black" aria-hidden="true">›</span>
                <span className="text-[14.5px] font-bold text-white">{q.name}</span>
              </summary>
              <p className="px-5 pb-5 pl-[42px] text-[13.5px] text-white/60 leading-relaxed">{q.acceptedAnswer.text}</p>
            </details>
          ))}
        </div>
      </section>

      {/* wavy divider: dark → yellow */}
      <div className="bg-[#06060a]" aria-hidden="true">
        <svg viewBox="0 0 1440 64" preserveAspectRatio="none" className="block w-full h-[40px] md:h-[64px]">
          <path d="M0,40 C240,8 480,56 720,32 C960,8 1200,56 1440,24 L1440,64 L0,64 Z" fill="#fffd43" />
        </svg>
      </div>

      {/* ── Closing CTA ── */}
      <div className="bg-[#fffd43] w-full">
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          <span className="lc-float mx-auto mb-6 inline-block">
            <Image src="/logo.png" alt="LemonCake" width={88} height={88} className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] object-contain drop-shadow-[0_10px_24px_rgba(26,15,0,0.3)]" />
          </span>
          <p className="text-[11px] font-bold text-[#1a0f00]/55 uppercase tracking-widest mb-4">
            ローンチプラン · Private Beta
          </p>
          <h2 className="text-4xl md:text-5xl font-black text-[#1a0f00] mb-5 leading-tight">
            AIエージェントに、<br />
            <span className="text-black">有料APIを自分で払わせる。</span>
          </h2>
          <p className="text-[14px] md:text-[15px] text-[#1a0f00]/65 mb-8 max-w-xl mx-auto leading-relaxed">
            上限つきの Pay Token をエージェントに渡すだけ — 暗号資産ウォレット不要・コールごとの鍵不要。
            初回 3,000 コール無料、以降 3%。資金は預からず、取り分は97%。
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/app"
              className="inline-flex items-center gap-2 px-7 py-3 bg-[#1a0f00] text-[#fffd43] font-bold rounded-xl hover:bg-[#1a0f00]/85 transition-colors text-sm"
            >
              無料で始める <IconArrowRight />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-7 py-3 bg-white text-[#1a0f00] border border-[#1a0f00]/15 font-semibold rounded-xl hover:bg-white/90 transition-colors text-sm"
            >
              料金の詳細 →
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-2 px-7 py-3 bg-transparent text-[#1a0f00]/65 font-semibold hover:text-[#1a0f00] transition-colors text-sm"
            >
              ドキュメント →
            </Link>
          </div>
          <p className="mt-6 text-[11px] text-[#1a0f00]/40 font-mono">
            クレジットカード不要。Private Beta 中は手動オンボーディング（約 24 時間）。
          </p>
        </section>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-white/8 py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Image src="/logo.png" alt="LemonCake" width={24} height={24} className="w-6 h-6 rounded-md object-cover" />
                <span className="font-bold text-[13px] text-white">LemonCake</span>
              </div>
              <p className="text-[12px] text-white/30 leading-relaxed">M2M Payment Infrastructure<br />for AI Agents</p>
            </div>
            {/* プロダクト */}
            <div>
              <p className="text-[11px] font-semibold text-white/25 uppercase tracking-widest mb-3">プロダクト</p>
              <ul className="flex flex-col gap-2">
                {[
                  { label: "ダッシュボード", href: "/app" },
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
            <p className="text-[11px] text-white/20">Buyer Key · Pay Token · Stripe Connect · x402</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
