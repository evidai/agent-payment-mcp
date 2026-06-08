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

// ── SVG Icons ────────────────────────────────────────────────────────────────
const IconArrowRight = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
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
          <div className="pointer-events-none absolute -right-16 top-10 hidden md:block w-[52%] max-w-[600px]">
            <Image
              src="/hero-visual.png"
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
              <span className="text-black">
                5分で有料化する。
              </span>
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
                src="/hero-visual.png"
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

      {/* ── API Monetization Flow visualization ── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">How it works</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-12 leading-tight">
          あなたと従量課金収益の間に、<br />
          <span className="text-[#fffd43]">たった 4 つの箱。</span>
        </h2>

        <div className="relative">
          {/* Desktop: horizontal flow with arrows */}
          <div className="hidden md:flex items-center justify-between gap-3">
            {[
              { num: "1", title: "あなたの API", sub: "HTTP なら何でも",          tone: "bg-white/4 border-white/10" },
              { num: "2", title: "Gateway",      sub: "URL に prefix を足すだけ",   tone: "bg-[#fffd43]/10 border-[#fffd43]/30" },
              { num: "3", title: "有料アクセス", sub: "Buyer が Pay Token で支払う", tone: "bg-[#fffd43]/10 border-[#fffd43]/30" },
              { num: "4", title: "収益",         sub: "97% があなた、3% が手数料",  tone: "bg-emerald-500/10 border-emerald-500/30" },
            ].map((step, i, arr) => (
              <div key={step.num} className="flex items-center flex-1">
                <div className={`flex-1 rounded-2xl border p-5 text-center ${step.tone}`}>
                  <div className="text-[10px] font-mono text-white/40 mb-1">STEP {step.num}</div>
                  <div className="text-[16px] font-bold text-white">{step.title}</div>
                  <div className="text-[12px] text-white/55 mt-1.5">{step.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="px-2 text-white/30 text-xl font-thin" aria-hidden="true">→</div>
                )}
              </div>
            ))}
          </div>

          {/* Mobile: stacked vertical */}
          <div className="md:hidden flex flex-col gap-3">
            {[
              { num: "1", title: "あなたの API", sub: "HTTP なら何でも" },
              { num: "2", title: "Gateway",      sub: "URL に prefix を足すだけ" },
              { num: "3", title: "有料アクセス", sub: "Buyer が Pay Token で支払う" },
              { num: "4", title: "収益",         sub: "97% があなた、3% が手数料" },
            ].map((step, i, arr) => (
              <div key={step.num}>
                <div className="rounded-2xl border border-white/10 bg-white/4 p-4">
                  <div className="text-[10px] font-mono text-white/40">STEP {step.num}</div>
                  <div className="text-[15px] font-bold text-white mt-1">{step.title}</div>
                  <div className="text-[12px] text-white/55 mt-1">{step.sub}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="text-center py-1 text-white/30 text-lg" aria-hidden="true">↓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <p className="mt-10 text-center text-[12px] text-white/40 max-w-xl mx-auto leading-relaxed">
          変えるのは URL 1 つだけ。Gateway ルーティング・Pay Token 検証・レート制限・使用量計測、そして Stripe 経由の Seller 入金まで、すべて LemonCake が処理します。
        </p>
      </section>

      {/* ── Why developers ── */}
      <section id="why-developers" className="max-w-6xl mx-auto px-6 py-24">
        <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">Why developers use LemonCake</p>
        <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
          決済インフラが面倒にする部分を、<br />
          <span className="text-[#fffd43]">まとめて引き受ける。</span>
        </h2>
        <p className="text-center text-[14px] text-white/40 mb-16 max-w-xl mx-auto">
          LemonCake を繋いだら、気にしなくてよくなる 6 つのこと。
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { t: "従量課金", d: "tool call 単位・token 単位・成果単位で課金。サブセントのマイクロペイメントがネイティブに動作 — 最低取引額なし、Stripe のような $0.30 の下限なし。" },
            { t: "AI エージェント決済", d: "エージェントが使い切り上限付きで、あなたのエンドポイントに直接支払う。人間の承認も、API キー共有も、「認証情報をリセットして」というサポート対応も不要。" },
            { t: "API キー管理ゼロ", d: "キーの発行・ローテーション・失効はもう不要。Buyer はインストール時に 1 度だけ認証。あなたが秘密情報に触れることはありません。" },
            { t: "Stripe 入金", d: "Buyer はカードで Pay Token を購入。Seller には Stripe Connect Direct Charge で入金。LemonCake が資金をプールすることはありません。" },
            { t: "暗号資産オンボーディング不要", d: "Buyer にブロックチェーンウォレット、シードフレーズ、取引所アカウントは不要。カード決済と上限つき Pay Token だけで使えます。" },
            { t: "MCP ネイティブ", d: "どの MCP サーバーにもそのまま挿せるミドルウェア。Bazaar + Glama + Smithery + mcp.so + Claude Code Plugins Directory に自動掲載。" },
          ].map(({ t, d }) => (
            <div key={t} className="rounded-2xl bg-white/4 border border-white/8 p-6">
              <h3 className="text-[15px] font-bold text-white mb-2">{t}</h3>
              <p className="text-[13px] text-white/55 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Billing stack comparison ── */}
      <section className="bg-white/[0.02] border-y border-white/8">
        <div className="max-w-5xl mx-auto px-6 py-20">
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
                  <th scope="col" className="text-left py-3 px-3 text-[#fffd43] font-bold">LemonCake</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["計測 + 請求 + 決済を 1 つの SDK で", "決済のみ",            "計測 + 請求（決済は Stripe）", "対応"],
                  ["AI エージェントが Buyer",            "カードのみ",          "組織課金のみ",                "ネイティブ"],
                  ["1 コール サブセント",                "実質 $0.30 下限",     "可能だが Stripe 課金",        "$0.005"],
                  ["MCP / agent ミドルウェア",           "—",                   "—",                           "そのまま挿せる"],
                  ["API キー管理不要",                   "キー必須",            "キー必須",                    "組込み認証"],
                  ["無料枠",                             "Stripe レート適用",   "エンタープライズ階層",        "初回 3,000 件無料・以降3%"],
                  ["OSS の SDK",                         "クローズド",          "クローズド",                  "MIT"],
                  ["導入時間",                           "Connect オンボーディング", "実装エンジニアが必要",    "URLを貼って公開"],
                ].map(([f, s, o, lc]) => (
                  <tr key={f} className="border-b border-white/5">
                    <td className="py-3 px-3 text-white/70 font-medium">{f}</td>
                    <td className="py-3 px-3 text-white/40">{s}</td>
                    <td className="py-3 px-3 text-white/40">{o}</td>
                    <td className="py-3 px-3 text-white">{lc}</td>
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
      <section className="max-w-5xl mx-auto px-6 py-16">
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
              <p className="mt-3 text-[10px] text-white/35 text-center">サンプルデータ — ライブフィードは 2026 Q3 公開予定。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Margin dashboard teaser (Q3 2026) ── */}
      <section className="max-w-5xl mx-auto px-6 py-16">
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
      <section className="max-w-5xl mx-auto px-6 py-20">
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
      <section className="max-w-5xl mx-auto px-6 py-16">
        <div className="rounded-2xl bg-white/4 border border-white/8 p-6 md:p-8">
          <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4 text-center">安全装置</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-center md:text-left">
            <div>
              <h3 className="text-[14px] font-bold text-white mb-1.5">緊急停止（Kill switch）</h3>
              <p className="text-[12.5px] text-white/55 leading-relaxed">ダッシュボードから 1 クリックで失効。以降の課金はアトミックに 422 を返します。</p>
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-white mb-1.5">段階的な上限（KYA）</h3>
              <p className="text-[12.5px] text-white/55 leading-relaxed">デフォルト $10/日 → Know-Your-Agent で $1,000/日 → フル KYC で $50,000/日。</p>
            </div>
            <div>
              <h3 className="text-[14px] font-bold text-white mb-1.5">サンドボックス</h3>
              <p className="text-[12.5px] text-white/55 leading-relaxed">本番と同じ挙動のテストトークンを発行。実資金は動きません。</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <div className="bg-[#fffd43] w-full">
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
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
            <p className="text-[11px] text-white/20">Buyer Key · Pay Token · Stripe Connect · x402</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
