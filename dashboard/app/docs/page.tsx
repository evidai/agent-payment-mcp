import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs — LemonCake",
  description: "LemonCake 公式ドキュメント。permit セットアップ、x402 hybrid モード、JPY オフランプ、API リファレンス。",
  alternates: { canonical: "https://lemoncake.xyz/docs" },
};

interface DocSection {
  title:   string;
  desc:    string;
  href:    string;
  icon:    string;
  external?: boolean;
  badge?:  string;
}

const SECTIONS: { heading: string; items: DocSection[] }[] = [
  {
    heading: "Buyer (AI エージェント運用者)",
    items: [
      {
        title: "5 分でセットアップ",
        desc:  "npx -y agent-payment-mcp で Demo Mode（8 つの無料実 API）→ 必要に応じて permit 発行 → Claude / Cursor / Cline に接続",
        href:  "/docs/quickstart",
        icon:  "🚀",
      },
      {
        title: "ERC-2612 permit の仕組み",
        desc:  "1 度の署名で 90 日間 / $25/日 cap を agent に委譲する技術詳細。non-custodial の証明",
        href:  "/docs/permit",
        icon:  "🎫",
      },
    ],
  },
  {
    heading: "Seller (API 提供者)",
    items: [
      {
        title: "x402 hybrid モード",
        desc:  "@lemon-cake/x402-server 3 行で組み込み。CDP 経由 settle → Bazaar / AgentCore 自動掲載 + LemonCake metering 連動。/sellers 登録は wizard 上で完結",
        href:  "/docs/x402-hybrid",
        icon:  "⚡",
        badge: "RECOMMENDED",
      },
      {
        title: "Coinbase x402 からの移行ガイド",
        desc:  "facilitator URL 1 行差し替えで Coinbase x402 → LemonCake へ。MPP 互換、free 1k tx/mo、JP onramp。cutover plan + rollback script 同梱",
        href:  "/docs/migrate-from-coinbase",
        icon:  "🔄",
        badge: "NEW",
      },
      {
        title: "Crossmint からの移行ガイド",
        desc:  "per-MAW vs per-tx の honest cost calculator + 非カストディ wallet 移行の playbook。card 系は Crossmint 残置・USDC は LemonCake、coexist 設計",
        href:  "/docs/migrate-from-crossmint",
        icon:  "🔁",
        badge: "NEW",
      },
      {
        title: "Stripe MPP との coexistence",
        desc:  "Stripe MPP は捨てない、LemonCake を MPP-signed payment の Base/USDC 設定 layer として並走させる。JP buyer / 高頻度 micro-payment / 非カストディ 3 シナリオで効く",
        href:  "/docs/migrate-from-stripe-mpp",
        icon:  "🧬",
        badge: "NEW",
      },
      {
        title: "freee / MF 自動仕訳",
        desc:  "Pro プランで提供。USDC 受領のたびに freee / MoneyForward に journal entry 自動生成",
        href:  "/docs/accounting",
        icon:  "📒",
      },
      {
        title: "適格請求書（インボイス制度）自動発行",
        desc:  "Pro プラン。T+13 桁登録番号を入れておけば月末に前月分インボイス自動生成",
        href:  "/docs/invoices",
        icon:  "🧾",
      },
      {
        title: "JPY オフランプ（USDC → 銀行口座）",
        desc:  "Business プラン。Coincheck API キー暗号化保存 → 1 クリックで USDC → JPY → 銀行口座出金",
        href:  "/docs/jpy-offramp",
        icon:  "🏦",
      },
    ],
  },
  {
    heading: "API リファレンス",
    items: [
      {
        title: "Swagger UI",
        desc:  "全 API エンドポイントの仕様。Try it out で直接実行可能",
        href:  "https://skillful-blessing-production.up.railway.app/docs",
        icon:  "📖",
        external: true,
      },
      {
        title: "OpenAPI JSON",
        desc:  "OpenAPI 3.0 仕様 (機械可読)",
        href:  "https://skillful-blessing-production.up.railway.app/openapi.json",
        icon:  "🔌",
        external: true,
      },
    ],
  },
  {
    heading: "リソース",
    items: [
      {
        title: "Security",
        desc:  "監査結果・FSA 確認内容・脅威モデル",
        href:  "/security",
        icon:  "🛡️",
      },
      {
        title: "GitHub (OSS)",
        desc:  "agent-payment-mcp / @lemon-cake/x402-server / @lemon-cake/mcp-sdk のソースコード",
        href:  "https://github.com/evidai/agent-payment-mcp",
        icon:  "📦",
        external: true,
      },
      {
        title: "npm packages",
        desc:  "公開済 6 パッケージ一覧",
        href:  "https://www.npmjs.com/~evidai_lemoncake",
        icon:  "📚",
        external: true,
      },
    ],
  },
];

export default function DocsHubPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <div className="mx-auto max-w-4xl px-5 py-12 sm:py-16">

        <div className="mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider">
            📚 Docs
          </span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold text-gray-900 leading-tight tracking-tight">
            LemonCake<br />
            <span className="text-amber-600">Documentation</span>
          </h1>
          <p className="mt-5 text-base text-gray-600 leading-relaxed max-w-2xl">
            非カストディ USDC pay-per-call の使い方・統合・API リファレンス。
            分からないことは <a href="mailto:contact@aievid.com" className="text-amber-700 underline">contact@aievid.com</a> までどうぞ。
          </p>
        </div>

        {SECTIONS.map((sec) => (
          <section key={sec.heading} className="mb-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{sec.heading}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sec.items.map((item) => (
                <a
                  key={item.title}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener" : undefined}
                  className="group relative rounded-2xl border border-gray-200 bg-white p-5 hover:border-amber-300 hover:bg-amber-50/30 transition"
                >
                  {item.badge && (
                    <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider bg-amber-500 text-white px-2 py-0.5 rounded-full">
                      {item.badge}
                    </span>
                  )}
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <p className="font-bold text-gray-900 group-hover:text-amber-700 transition">
                    {item.title}
                    {item.external && <span className="ml-1 text-xs text-gray-400">↗</span>}
                  </p>
                  <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </a>
              ))}
            </div>
          </section>
        ))}

        <div className="mt-12 rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-300">Need help?</p>
          <p className="mt-2 text-sm leading-relaxed">
            ドキュメントに無い質問は遠慮なく <a href="mailto:contact@aievid.com" className="text-amber-300 underline">contact@aievid.com</a> へ。<br />
            v2 のバグ報告・機能要望は <a href="https://github.com/evidai/agent-payment-mcp/issues" target="_blank" rel="noopener" className="text-amber-300 underline">GitHub Issues</a> も歓迎。
          </p>
        </div>
      </div>
    </main>
  );
}
