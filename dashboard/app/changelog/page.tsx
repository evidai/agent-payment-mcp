import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog — LemonCake",
  description: "LemonCake の更新履歴。v2 launch、x402 hybrid、4-tier pricing、JPY off-ramp などの実装ログ。",
  alternates: { canonical: "https://lemoncake.xyz/changelog" },
};

interface ChangelogEntry {
  date:    string;          // "2026-05-23"
  version?: string;          // "v2.1.0"
  tag:     "feature" | "fix" | "release" | "partnership" | "note";
  title:   string;
  body:    string;           // markdown-ish text
  links?:  { label: string; href: string }[];
}

const ENTRIES: ChangelogEntry[] = [
  {
    date: "2026-05-23",
    tag: "feature",
    title: "4-tier 価格 + USD pricing + IP ベース locale 振り分け",
    body: "Pro ¥9,800 / Business ¥29,800 / Scale ¥98,000（USD は $69 / $199 / $699）に再設計。Vercel Edge middleware で非 JP IP を /en/* に自動 redirect。/en/start・/en/sellers の英語版 LP を追加。",
    links: [
      { label: "Pro upgrade", href: "/" },
      { label: "English LP", href: "/en/start" },
    ],
  },
  {
    date: "2026-05-23",
    tag: "feature",
    title: "/about Trust strip + 競合比較表",
    body: "freee アプリストア・FSA・Coinbase Bazaar・AWS AgentCore のバッジを Hero 下に配置。Stripe / Coinbase CDP / Skyfire / Circle と LemonCake を 9 項目で比較する表を追加。",
    links: [{ label: "Comparison table", href: "/about#comparison" }],
  },
  {
    date: "2026-05-22",
    version: "agent-payment-mcp@0.9.1",
    tag: "release",
    title: "Demo Mode 拡張（8 つの無料実 API デモ）",
    body: "サインアップ・env vars 不要で動く実 API デモを 8 つ内蔵：search / translate / weather / geocode / time / dictionary / fx / echo。`npx -y agent-payment-mcp` だけで即体験可能。",
    links: [{ label: "npm", href: "https://www.npmjs.com/package/agent-payment-mcp" }],
  },
  {
    date: "2026-05-22",
    tag: "feature",
    title: "x402 hybrid facilitator + @lemon-cake/x402-server v0.2",
    body: "Coinbase x402 Bazaar / AWS Bedrock AgentCore 互換の hybrid モード実装。Provider が `facilitator: \"both\"` を指定すれば、CDP 経由で settle → Bazaar 自動掲載 + LemonCake にも metering 記録（freee 仕訳 / インボイス対応）。",
    links: [
      { label: "@lemon-cake/x402-server", href: "https://www.npmjs.com/package/@lemon-cake/x402-server" },
      { label: "x402 Bazaar", href: "https://docs.cdp.coinbase.com/x402/bazaar" },
    ],
  },
  {
    date: "2026-05-22",
    tag: "feature",
    title: "JPY オフランプ（Business プラン）",
    body: "Coincheck の API キーを暗号化保存し、USDC → JPY 売却 → 銀行口座出金まで 1 クリックで実行できる機能を Business プラン専用で公開。LemonCake は API トリガー実行のみで、USDC・JPY 双方とも一切預からない。",
  },
  {
    date: "2026-05-22",
    tag: "feature",
    title: "適格請求書（インボイス制度）自動発行 (Pro プラン)",
    body: "Provider の月間課金を集計し、国税庁仕様の適格請求書を自動生成。T+13 桁の登録番号、税率区分、消費税額、書類交付先を全て含む。月末 cron で前月分を自動発行（autoIssueInvoices flag 付き Provider に対して）。",
  },
  {
    date: "2026-05-22",
    tag: "feature",
    title: "Provider セルフサービス登録 (/sellers wizard)",
    body: "5 step ウィザード（Identity → Wallet → Pricing → Tax → Review）で 1 分で登録完了。serviceId + API key 即時発行。MCP 設定 JSON も自動生成してコピペで使える。",
    links: [{ label: "/sellers", href: "/sellers" }],
  },
  {
    date: "2026-05-22",
    tag: "feature",
    title: "v2 launch — 非カストディ ERC-2612 permit",
    body: "Privy embedded wallet + Coinbase Onramp (USD) + Transak (JPY) を統合した /start/v2 を本番公開。1 度の permit 署名で 90 日 / $25/日 hard cap を agent に委譲。LemonCake は USDC を一切預からない設計。",
    links: [
      { label: "/start/v2", href: "/start/v2" },
      { label: "技術詳細", href: "/security" },
    ],
  },
  {
    date: "2026-05-21",
    tag: "partnership",
    title: "FSA Fintech サポートデスク Q1-Q11 確認完了",
    body: "金融庁 Fintech サポートデスクへの照会で「非カストディ設計が資金移動業・暗号資産交換業・電子決済手段等取引業のいずれにも該当せず、登録不要」との回答を取得。これにより LemonCake は日本で金融ライセンスなしに運営可能。",
    links: [{ label: "詳細", href: "/security" }],
  },
  {
    date: "2026-05-09",
    tag: "release",
    title: "兄弟 MCP パッケージ群を一斉公開",
    body: "alpaca-guard-mcp（Alpaca paper trading）、xstocks-mcp（Solana xStocks）、tokenized-stock-mcp（Dinari dShares）、polymarket-guard-mcp（Polymarket）を順次 npm 公開。全パッケージ permit-based 非カストディに準拠。",
  },
  {
    date: "2026-05-07",
    version: "agent-payment-mcp@0.5.0",
    tag: "release",
    title: "lemon-cake-mcp → agent-payment-mcp に rename",
    body: "npm パッケージ名を agent-payment-mcp に変更（旧 lemon-cake-mcp も thin wrapper で互換維持）。よりプロダクト機能を直接表す名称に。",
  },
  {
    date: "2026-05-08",
    tag: "partnership",
    title: "Anthropic Directory 提出",
    body: "Claude のオフィシャル MCP ディレクトリへ agent-payment-mcp を提出。承認結果待ち（〜2 週間想定）。",
  },
];

const TAG_STYLES: Record<ChangelogEntry["tag"], string> = {
  feature:     "bg-amber-100 text-amber-700 border-amber-200",
  fix:         "bg-red-100 text-red-700 border-red-200",
  release:     "bg-blue-100 text-blue-700 border-blue-200",
  partnership: "bg-emerald-100 text-emerald-700 border-emerald-200",
  note:        "bg-gray-100 text-gray-600 border-gray-200",
};

const TAG_LABEL: Record<ChangelogEntry["tag"], string> = {
  feature:     "Feature",
  fix:         "Fix",
  release:     "Release",
  partnership: "Partnership",
  note:        "Note",
};

export default function ChangelogPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">

        {/* Hero */}
        <div className="mb-12">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider">
            🍋 Changelog
          </span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold text-gray-900 leading-tight tracking-tight">
            What's new in<br />
            <span className="text-amber-600">LemonCake</span>
          </h1>
          <p className="mt-5 text-base text-gray-600 leading-relaxed">
            v2（非カストディ）への移行ログ、x402 / Bazaar 統合、JPY オフランプなど、最近の主要アップデート。
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <Link href="/docs" className="rounded-full border border-gray-300 px-3 py-1.5 hover:border-amber-500 hover:text-amber-700 transition">📚 Docs</Link>
            <Link href="/about" className="rounded-full border border-gray-300 px-3 py-1.5 hover:border-amber-500 hover:text-amber-700 transition">仕組み</Link>
            <Link href="/security" className="rounded-full border border-gray-300 px-3 py-1.5 hover:border-amber-500 hover:text-amber-700 transition">セキュリティ</Link>
            <a href="https://github.com/evidai/agent-payment-mcp/commits/main" target="_blank" rel="noopener" className="rounded-full border border-gray-300 px-3 py-1.5 hover:border-amber-500 hover:text-amber-700 transition">📜 GitHub commits ↗</a>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-8 relative">
          {/* vertical line */}
          <div className="absolute left-[22px] top-2 bottom-2 w-px bg-amber-200 hidden sm:block" />

          {ENTRIES.map((e, i) => (
            <div key={i} className="relative flex flex-col sm:flex-row gap-4">
              {/* Date column */}
              <div className="sm:w-44 flex-shrink-0 flex sm:flex-col items-start gap-2">
                <div className="hidden sm:flex w-11 h-11 rounded-full bg-white border-2 border-amber-300 items-center justify-center text-xs font-bold text-amber-700 z-10 shadow-sm">
                  {e.date.slice(5).replace("-", "/")}
                </div>
                <div className="flex sm:flex-col items-baseline sm:items-start gap-2 sm:gap-0">
                  <p className="text-xs font-mono text-gray-500">{e.date}</p>
                  {e.version && (
                    <p className="text-[10px] font-mono text-amber-700 sm:mt-0.5">{e.version}</p>
                  )}
                </div>
              </div>

              {/* Card */}
              <div className="flex-1 rounded-2xl border border-gray-200 bg-white p-5 hover:border-amber-300 transition">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${TAG_STYLES[e.tag]}`}>
                    {TAG_LABEL[e.tag]}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">{e.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{e.body}</p>
                {e.links && e.links.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    {e.links.map((l) => (
                      <a
                        key={l.label}
                        href={l.href}
                        target={l.href.startsWith("http") ? "_blank" : undefined}
                        rel={l.href.startsWith("http") ? "noopener" : undefined}
                        className="text-amber-700 hover:text-amber-900 font-bold"
                      >
                        {l.label} →
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-12 text-center text-xs text-gray-400">
          更新通知: 現状無し。気になる方は <a href="https://github.com/evidai/agent-payment-mcp" target="_blank" rel="noopener" className="underline hover:text-amber-700">GitHub</a> を watch してください。
        </p>
      </div>
    </main>
  );
}
