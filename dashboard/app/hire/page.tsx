/**
 * /hire — Founder の受託営業ランディング。
 *
 * Glama / Cursor Directory / X / LinkedIn からの流入をここに着地させて
 * 「受託・業務委託の問い合わせ」を取りに行く専用ページ。
 *
 * LemonCake 本体の認知（1,786 PV/月）を founder の労働収益に変換する
 * ファネルの末端。SaaS 単体は成熟まで時間かかるので、その間の橋渡し。
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "受託・業務委託 | LemonCake — MCP / AI エージェント実装",
  description:
    "日本初の MCP 5本公開・@lemon-cake/mcp-sdk 開発者が、貴社の AI エージェント実装・MCP 対応・freee/MoneyForward × AI 統合を受託します。¥50万〜。",
  openGraph: {
    title: "MCP / AI エージェント受託エンジニア — LemonCake Founder",
    description:
      "5本の MCP 公開実績・セキュリティ監査クリア・USDC 決済実装。受託 ¥50万〜、業務委託 月¥150万〜。",
    url: "https://lemoncake.xyz/hire",
  },
  alternates: { canonical: "https://lemoncake.xyz/hire" },
};

// ─── Data ─────────────────────────────────────────────────────────────────────

const PROOF_POINTS = [
  { label: "公開 MCP", value: "5本", note: "agent-payment / alpaca-guard / xstocks / tokenized-stock / SDK" },
  { label: "Glama スコア", value: "AAB", note: "92% プロファイル充足" },
  { label: "セキュリティ監査", value: "クリア", note: "@kleosr 2026年5月、CRITICAL/HIGH 全件修正" },
  { label: "対応 MCP クライアント", value: "5+", note: "Claude Desktop / Cursor / Cline / Codex / Continue" },
];

const PACKAGES = [
  {
    name: "MCP 化受託",
    audience: "既存 SaaS / API を AI エージェントから呼べるようにしたい企業",
    deliverables: [
      "貴社 API → MCP サーバー実装（TypeScript / Python）",
      "Claude Desktop / Cursor / Cline 向け設定 JSON",
      "Glama / cursor.directory / mcp.directory 等への登録代行",
      "ドキュメント・サンプルコード一式",
    ],
    duration: "2〜3週間",
    price: "¥50〜150万",
    feature: true,
  },
  {
    name: "AI エージェント基盤構築",
    audience: "自社プロダクトに「AI が自律的にタスクこなす」機能を組み込みたい企業",
    deliverables: [
      "MCP マーケットプレイス型基盤（Pay Token 設計）",
      "Claude / GPT-4o / Gemini 接続",
      "Slack / freee / Notion など主要 SaaS との連携実装",
      "Kill Switch・監査ログ・スパム制御",
    ],
    duration: "1〜2ヶ月",
    price: "¥150〜400万",
  },
  {
    name: "業務委託（フリーランス）",
    audience: "AI / Web3 / SaaS スタートアップの開発体制を週3〜4で強化したい企業",
    deliverables: [
      "TypeScript / Next.js / Prisma フルスタック",
      "MCP / Pay Token / USDC 決済の実装経験",
      "AI コーディング（Claude Code / Cursor）熟練",
      "技術選定・アーキテクチャ・コードレビュー",
    ],
    duration: "週3〜4日、3ヶ月〜",
    price: "¥150〜250万 / 月",
  },
  {
    name: "技術相談・1Day レビュー",
    audience: "「自社の AI 戦略、本当にこれで合ってる？」を客観確認したい意思決定者",
    deliverables: [
      "コードレビュー + アーキテクチャ診断書",
      "MCP / AI エージェント時代の戦略提案",
      "日本の AI 規制（金融庁照会経験あり）に関する情報提供",
      "実装ロードマップ（90日プラン）",
    ],
    duration: "1日 + 報告書",
    price: "¥30万 / 回",
  },
];

const PORTFOLIO = [
  {
    name: "agent-payment-mcp",
    desc: "AI エージェントに USDC ウォレットを持たせる MCP サーバー。Pay Token で日次上限・Kill Switch・スコープ制御。",
    link: "https://www.npmjs.com/package/agent-payment-mcp",
  },
  {
    name: "@lemon-cake/mcp-sdk",
    desc: "MCP サーバー開発者向け課金 SDK。3行で USDC 従量課金組込み。",
    link: "https://www.npmjs.com/package/@lemon-cake/mcp-sdk",
  },
  {
    name: "alpaca-guard-mcp",
    desc: "Alpaca Markets ペーパートレード × ハード USD 日次上限ガード MCP。",
    link: "https://www.npmjs.com/package/alpaca-guard-mcp",
  },
  {
    name: "xstocks-mcp",
    desc: "Solana / Jupiter DEX で USDC → トークン化米国株（AAPLx 等）を直接 swap する MCP。",
    link: "https://www.npmjs.com/package/xstocks-mcp",
  },
  {
    name: "tokenized-stock-mcp",
    desc: "Dinari dShares 経由で USDC → トークン化米国株を購入する MCP。",
    link: "https://www.npmjs.com/package/tokenized-stock-mcp",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HirePage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-yellow-50 via-white to-amber-50">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
            🍋 LemonCake Founder · 受託・業務委託
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
            日本初の MCP 5本公開エンジニアが、<br />
            貴社の AI エージェント実装を請負います。
          </h1>
          <p className="mt-5 max-w-2xl text-base text-gray-700 sm:text-lg">
            Claude Desktop / Cursor / Cline から呼べる MCP サーバーを 2〜3週間で実装。
            セキュリティ監査クリア済み・@lemon-cake/mcp-sdk 開発者。
            金融庁への AI 決済法令照会も完了しています。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="mailto:contact@aievid.com?subject=%E5%8F%97%E8%A8%97%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87"
              className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-amber-600"
            >
              📧 contact@aievid.com にメール
            </a>
            <a
              href="https://twitter.com/messages/compose?recipient_id=aievid"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-900 hover:border-amber-500"
            >
              X で DM（@aievid）
            </a>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            営業日 24 時間以内に返信します。NDA 提示後の詳細打合せ可。
          </p>

          {/* Proof points */}
          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {PROOF_POINTS.map((p) => (
              <div key={p.label} className="rounded-xl border border-amber-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{p.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{p.value}</p>
                <p className="mt-1 text-xs text-gray-600">{p.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Packages */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold">受託パッケージ</h2>
          <p className="mt-2 text-gray-600">
            完成保証付き。要件定義から納品まで一気通貫。御見積は要件確認後 48時間以内。
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {PACKAGES.map((pkg) => (
              <article
                key={pkg.name}
                className={`rounded-2xl border p-6 ${
                  pkg.feature ? "border-amber-400 bg-amber-50" : "border-gray-200 bg-white"
                }`}
              >
                {pkg.feature && (
                  <span className="inline-block rounded-full bg-amber-500 px-3 py-0.5 text-xs font-bold text-white">
                    一番依頼が多い
                  </span>
                )}
                <h3 className="mt-2 text-xl font-bold text-gray-900">{pkg.name}</h3>
                <p className="mt-1 text-sm text-gray-600">{pkg.audience}</p>

                <ul className="mt-4 space-y-2 text-sm text-gray-800">
                  {pkg.deliverables.map((d) => (
                    <li key={d} className="flex items-start gap-2">
                      <span className="mt-1 text-amber-500">✓</span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 flex items-end justify-between border-t border-gray-200 pt-4">
                  <div>
                    <p className="text-xs text-gray-500">納期</p>
                    <p className="text-sm font-bold text-gray-900">{pkg.duration}</p>
                  </div>
                  <p className="text-xl font-bold text-amber-700">{pkg.price}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Portfolio */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-3xl font-bold">公開実績（npm）</h2>
          <p className="mt-2 text-gray-600">
            全てプロのセキュリティ監査済み。商用利用可能。MIT ライセンス。
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PORTFOLIO.map((item) => (
              <li key={item.name} className="rounded-xl border border-gray-200 bg-white p-5 hover:border-amber-500">
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener"
                  className="block"
                >
                  <p className="font-mono text-sm font-bold text-amber-700">{item.name}</p>
                  <p className="mt-2 text-sm text-gray-700">{item.desc}</p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Why me */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-3xl font-bold">他社との違い</h2>
          <ul className="mt-8 space-y-5 text-base text-gray-800">
            <li>
              <p className="font-bold">
                ✅ 実装済みのコードが既にあります。ゼロから書き起こさない分、納期と単価で勝てます。
              </p>
              <p className="mt-1 text-sm text-gray-600">
                MCP サーバー雛形・Pay Token・freee/MFC 連携・Solana/Polygon USDC 決済 — 全部動くコードがあります。
              </p>
            </li>
            <li>
              <p className="font-bold">
                ✅ 日本の規制を分かっています（金融庁 Q1–Q10 照会完了）。
              </p>
              <p className="mt-1 text-sm text-gray-600">
                資金決済法・金商法上の AI エージェント決済の取扱いについて、実際に金融庁から見解を取得済み。コンプライアンス込みで設計できます。
              </p>
            </li>
            <li>
              <p className="font-bold">
                ✅ プロのセキュリティ監査を通してます。
              </p>
              <p className="mt-1 text-sm text-gray-600">
                外部研究者による監査の CRITICAL / HIGH 全件を 2 日以内に修正・公開。納品物にも同水準のセキュリティを担保します。
              </p>
            </li>
            <li>
              <p className="font-bold">
                ✅ Claude Code / Cursor のフル活用を前提に設計します。
              </p>
              <p className="mt-1 text-sm text-gray-600">
                MCP は AI エージェントから呼ばれるためのものです。「AI が呼びやすい設計」を分かっている人が実装しないと意味がありません。
              </p>
            </li>
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-amber-500 py-16 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold">まずは要件を聞かせてください</h2>
          <p className="mt-3 text-base">
            初回のヒアリングは無料・60 分以内。要件次第では即お見積もり可能です。
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="mailto:contact@aievid.com?subject=%E5%8F%97%E8%A8%97%E3%81%AE%E3%81%94%E7%9B%B8%E8%AB%87&body=%E2%97%8F%20%E8%B2%B4%E7%A4%BE%E5%90%8D%2F%E5%80%8B%E4%BA%BA%E5%90%8D%3A%0A%E2%97%8F%20%E5%AF%BE%E8%B1%A1%E3%81%AE%E3%83%97%E3%83%AD%E3%83%80%E3%82%AF%E3%83%88%2FAPI%3A%0A%E2%97%8F%20%E5%B8%8C%E6%9C%9B%E7%B4%8D%E6%9C%9F%3A%0A%E2%97%8F%20%E3%81%94%E4%BA%88%E7%AE%97%E3%82%A4%E3%83%A1%E3%83%BC%E3%82%B8%3A%0A%E2%97%8F%20%E3%81%9D%E3%81%AE%E4%BB%96%E8%A6%81%E6%9C%9B%3A"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-amber-700 shadow-md hover:bg-gray-100"
            >
              📧 メールで相談
            </a>
            <a
              href="https://twitter.com/aievid"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full border-2 border-white px-6 py-3 text-sm font-bold text-white hover:bg-white hover:text-amber-700"
            >
              X (@aievid)
            </a>
          </div>

          <p className="mt-6 text-xs opacity-80">
            連絡先: contact@aievid.com · 株式会社 Evidai
          </p>
        </div>
      </section>

      {/* Footer link */}
      <footer className="bg-gray-50 py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-sm text-gray-500">
          <p>
            <Link href="/" className="hover:text-amber-700 hover:underline">
              ← LemonCake トップに戻る
            </Link>
            {" · "}
            <Link href="/about" className="hover:text-amber-700 hover:underline">
              プロダクトについて
            </Link>
            {" · "}
            <Link href="/services" className="hover:text-amber-700 hover:underline">
              MCP カタログ
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
