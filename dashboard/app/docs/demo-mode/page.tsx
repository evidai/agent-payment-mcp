import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Demo Mode — LemonCake Docs",
  description: "サインアップ・課金・env vars 不要。npx -y agent-payment-mcp だけで 8 つの実 API（search / weather / FX 等）を即試せる。",
  alternates: { canonical: "https://lemoncake.xyz/docs/demo-mode" },
};

export default function DemoModeDocPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">Demo Mode</h1>
        <p className="text-sm text-gray-500 !mt-0">
          <strong>0 円 / 0 セットアップ / 0 wallet</strong>で agent-payment-mcp を体験する方法。
        </p>

        <hr className="my-8 border-gray-200" />

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">起動方法</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto">{`{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"]
    }
  }
}`}</pre>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          <code className="text-[10px] bg-gray-100 px-1 rounded">LEMON_CAKE_PERMIT</code> が無いと自動で Demo Mode に入る。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">含まれる 8 つの実 API</h2>
        <div className="rounded-2xl border border-gray-200 overflow-x-auto text-xs">
          <table className="w-full min-w-[440px]">
            <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left font-bold">サービス名</th>
                <th className="px-3 py-2 text-left font-bold">中身</th>
                <th className="px-3 py-2 text-left font-bold">バックエンド</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono">demo_search</td>
                <td className="px-3 py-2">Wikipedia 検索 + 要約</td>
                <td className="px-3 py-2 text-gray-500">Wikipedia REST API</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono">demo_translate</td>
                <td className="px-3 py-2">テキスト翻訳</td>
                <td className="px-3 py-2 text-gray-500">MyMemory</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono">demo_weather</td>
                <td className="px-3 py-2">現在の天気</td>
                <td className="px-3 py-2 text-gray-500">Open-Meteo</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono">demo_geocode</td>
                <td className="px-3 py-2">住所 → 緯度経度</td>
                <td className="px-3 py-2 text-gray-500">OpenStreetMap Nominatim</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono">demo_time</td>
                <td className="px-3 py-2">指定タイムゾーン現在時刻</td>
                <td className="px-3 py-2 text-gray-500">WorldTimeAPI</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono">demo_dictionary</td>
                <td className="px-3 py-2">英単語の定義</td>
                <td className="px-3 py-2 text-gray-500">Free Dictionary API</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono">demo_fx</td>
                <td className="px-3 py-2">為替レート換算</td>
                <td className="px-3 py-2 text-gray-500">exchangerate.host</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono">demo_echo</td>
                <td className="px-3 py-2">入力をそのまま返す（疎通確認）</td>
                <td className="px-3 py-2 text-gray-500">内蔵</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">使い方</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          MCP client 起動後、agent に話しかける：
        </p>
        <pre className="bg-gray-950 text-amber-300 rounded-xl p-4 text-sm overflow-x-auto">{`「lemon で東京の天気を教えて」
「lemon で 'AGI' を Wikipedia で検索して要約して」
「lemon で USD/JPY の今のレートは？」`}</pre>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          Claude が <code className="text-[10px] bg-gray-100 px-1 rounded">list_services</code> → <code className="text-[10px] bg-gray-100 px-1 rounded">call_service(demo_weather)</code> を自動的に選択して実行する。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Demo Mode の制約</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li>レート制限：1 ツール当たり <strong>60 calls / hour</strong>（公平利用のため）</li>
          <li>1 リクエスト最大 5 秒。長文翻訳・大規模検索は paid サービスへ</li>
          <li>有料パッケージへの自動 fallback は無し（明示的に permit 設定が必要）</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">なぜ無料？</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          全て <strong>無料で公開されている公共 API</strong> のラッパー。LemonCake 側で課金処理を挟まないので原価は通信費だけ。
          「最初の 10 分で楽しい体験」を提供するための仕掛け。気に入ったら permit 発行（<Link href="/start/v2" className="text-amber-700">/start/v2</Link>）で paid サービスを開放。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">paid サービスへの移行</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          permit を env に設定するだけ。<Link href="/docs/quickstart" className="text-amber-700">Quickstart</Link> Step 3 参照。
          Serper / Hunter.io / gBizINFO / NTA インボイス API などが追加で利用可能になる。
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-500">関連：<Link href="/docs/quickstart" className="text-amber-700">Quickstart →</Link></p>
      </article>
    </main>
  );
}
