import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "/sellers 登録ガイド — LemonCake Docs",
  description: "1 分で Provider 登録 → serviceId / apiKey 発行 → ダッシュボード機能解放。5 step ウィザード解説。",
  alternates: { canonical: "https://lemoncake.xyz/docs/sellers/quickstart" },
};

export default function SellersQuickstartPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">/sellers 登録ガイド</h1>
        <p className="text-sm text-gray-500 !mt-0">
          API・MCP を持っている人が <strong>1 分</strong>で USDC 課金を始める手順。
        </p>

        <hr className="my-8 border-gray-200" />

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">事前準備（あれば早い）</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li>USDC 受取用の Base ウォレットアドレス（MetaMask / Coinbase Wallet / Privy 何でも OK）</li>
          <li>適格請求書登録番号（T+13 桁）：日本で B2B 売上を立てる場合のみ。未取得でも登録は可</li>
          <li>無ければ <Link href="/start/v2" className="text-amber-700">/start/v2</Link> で Google ログインだけして embedded wallet を発行してもらえばよい</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">5 step ウィザード</h2>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">Step 1 — Identity</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          会社名 / 個人名（任意） / 連絡用メール / サービス分類（search / scraping / accounting など）を入力。
          支払業務に使う「Provider 表示名」だけ後から変更可能。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">Step 2 — Wallet</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          USDC 受取先アドレス（Base）を入力。Base 以外のチェーンは現在未対応。
          ここで入れたアドレスに、Buyer から<strong>直接</strong>送金される（LemonCake は経由しない）。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">Step 3 — Pricing</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          1 call の単価を USDC で入力。デフォルト <code className="text-xs bg-gray-100 px-1 rounded">0.001</code>（$0.001/call）。
          高単価サービス（gpt-4o 経由の要約など）は <code className="text-xs bg-gray-100 px-1 rounded">0.05</code> 〜 <code className="text-xs bg-gray-100 px-1 rounded">0.20</code> でも問題なし。
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          注意：x402 facilitator 経由の場合、最低 0.001 USDC（dust の防止）。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">Step 4 — Tax（任意）</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          適格請求書 T+13 桁を登録すると、Pro プラン以上で<strong>月末に前月分インボイスを自動生成</strong>。
          未登録でも記録は残る（後から付与可）。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">Step 5 — Review</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          内容確認 → 登録ボタン。<strong>serviceId</strong>（providerV2Id）と <strong>API key</strong> が即時発行される。
          MCP / Express / Hono 用の設定 JSON もコピペでそのまま使える形で生成される。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">登録後すぐ叩ける機能</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li><strong>Dashboard /publish 配下</strong>：売上ダッシュボード（日次 / 月次 / per-buyer）</li>
          <li><strong>x402 hybrid モード</strong>：<Link href="/docs/x402-hybrid" className="text-amber-700">/docs/x402-hybrid</Link> に 3 行で書ける統合方法</li>
          <li><strong>MCP SDK</strong>：<Link href="/docs/mcp-sdk" className="text-amber-700">/docs/mcp-sdk</Link>。MCP server を pay-per-call 化</li>
          <li>Demo charge：自分の API を Postman / curl で叩いて 402 → 設定 → 200 が返ることを確認できる sandbox tx</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Pro プランで解放される機能</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li><Link href="/docs/accounting" className="text-amber-700">freee / MoneyForward 自動仕訳</Link>（¥9,800/月）</li>
          <li><Link href="/docs/invoices" className="text-amber-700">適格請求書自動発行</Link>（月末 cron）</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Business / Scale で解放される機能</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li><Link href="/docs/jpy-offramp" className="text-amber-700">JPY オフランプ</Link>（Business / Scale）</li>
          <li>無料 call 枠拡張（Pro 1 万 / Business 5 万 / Scale 50 万 calls/月）</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">FAQ</h2>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">既存の API（FastAPI / Express）にどう挟む？</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          <code className="text-xs bg-gray-100 px-1 rounded">@lemon-cake/x402-server</code> をミドルウェアとして 1 行差し込むだけ。
          詳細は <Link href="/docs/x402-hybrid" className="text-amber-700">x402 hybrid モード</Link>。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">単価変更はどこから？</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          Dashboard → /publish → サービス編集。即時反映（次のリクエストから新単価）。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">退会したい</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          Provider 設定で「アカウント削除」可能。USDC 残高（あれば）は登録ウォレットに自動送金される。
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-500">関連：<Link href="/docs/x402-hybrid" className="text-amber-700">x402 hybrid mode →</Link></p>
      </article>
    </main>
  );
}
