import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "x402 Hybrid Mode — LemonCake Docs",
  description: "@lemon-cake/x402-server の hybrid モード解説。Coinbase Bazaar / AWS AgentCore 自動掲載 + LemonCake metering 連動。",
  alternates: { canonical: "https://lemoncake.xyz/docs/x402-hybrid" },
};

export default function X402HybridPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">x402 Hybrid Mode</h1>
        <p className="text-sm text-gray-500 !mt-0">
          1 つのミドルウェアで <strong>Coinbase Bazaar 自動掲載</strong> + <strong>LemonCake 機能（freee 仕訳 / インボイス / JPY オフランプ）</strong>を同時に得る方法。
        </p>

        <hr className="my-8 border-gray-200" />

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">背景：なぜ hybrid が必要か</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          x402 Bazaar / AWS Bedrock AgentCore の流量を取り込むには、settle が Coinbase CDP facilitator を経由する必要がある。
          一方、freee / 適格請求書 / JPY オフランプといった<strong>日本ローカル機能</strong>は LemonCake 経由の metering が前提。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          hybrid モードは <strong>「CDP で settle、LemonCake にも記録」</strong> の二段構え。1 つのミドルウェアで両方の恩恵を受けられる。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">インストール</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto">{`npm install @lemon-cake/x402-server`}</pre>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Express での使い方</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`import express from "express";
import { x402Middleware } from "@lemon-cake/x402-server";

const app = express();

app.use("/api/search", x402Middleware({
  serviceId:       "your-providerV2-id",   // /sellers で発行
  pricePerCallUsd: 0.001,
  facilitator:     "both",                  // ← hybrid モード
  bazaar: {
    name:        "Web Search API",
    description: "Real-time Google search",
    category:    "search",
    tags:        ["search", "web"],
  },
}));

app.get("/api/search", (req, res) => {
  res.json({ results: [/* … */] });
});

app.listen(3000);`}</pre>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Hono / Cloudflare Workers での使い方</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`import { Hono } from "hono";
import { x402Hono } from "@lemon-cake/x402-server";

const app = new Hono();

app.use("/api/search", x402Hono({
  serviceId:       "your-providerV2-id",
  pricePerCallUsd: 0.001,
  facilitator:     "both",
}));

app.get("/api/search", (c) => c.json({ results: [/* … */] }));`}</pre>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">3 つの facilitator モード</h2>
        <div className="rounded-2xl border border-gray-200 overflow-x-auto text-xs">
          <table className="w-full min-w-[440px]">
            <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left font-bold">facilitator</th>
                <th className="px-3 py-2 text-left font-bold">挙動</th>
                <th className="px-3 py-2 text-left font-bold">向き</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-t border-gray-100">
                <td className="px-3 py-3 font-mono"><code>"lemoncake"</code></td>
                <td className="px-3 py-3">全部 LemonCake 経由で verify + settle</td>
                <td className="px-3 py-3">JP-centric, freee 仕訳が主目的</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-3 font-mono"><code>"coinbase"</code></td>
                <td className="px-3 py-3">全部 CDP 経由で verify + settle</td>
                <td className="px-3 py-3">Bazaar 流量だけ欲しい場合</td>
              </tr>
              <tr className="border-t border-gray-100 bg-amber-50/30">
                <td className="px-3 py-3 font-mono font-bold text-amber-800"><code>"both"</code></td>
                <td className="px-3 py-3">CDP で settle → LemonCake に async POST</td>
                <td className="px-3 py-3"><strong>推奨</strong>：Bazaar + freee 両取り</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">設定オプション</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li><code className="text-xs bg-gray-100 px-1 rounded">serviceId</code>（必須）：<Link href="/app" className="text-amber-700">/sellers</Link> で発行した providerV2Id</li>
          <li>
            <code className="text-xs bg-gray-100 px-1 rounded">pricePerCallUsd</code>（任意、fallback only）：
            v0.2.2+ では単価のシングルソースは <Link href="/app" className="text-amber-700">/sellers</Link> wizard で設定した DB 値。
            この値は LemonCake API 到達不能時の安全弁としてのみ使う。
            ダッシュボードから単価変更すれば <strong>コード再デプロイ不要</strong>で 60 秒以内に反映
          </li>
          <li><code className="text-xs bg-gray-100 px-1 rounded">facilitator</code>（任意、デフォルト "lemoncake"）：上記 3 モード</li>
          <li><code className="text-xs bg-gray-100 px-1 rounded">bazaar.&#123;name, description, category, tags&#125;</code>：Bazaar 掲載時の表示メタ</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Bazaar 自動掲載のしくみ</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          <code className="text-xs bg-gray-100 px-1 rounded">facilitator: "coinbase" | "both"</code> + <code className="text-xs bg-gray-100 px-1 rounded">bazaar</code> オプションを渡すと、402 レスポンスに{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">extensions.discoverable: true</code> が自動で付与される。
          初回の settle が CDP で完了した時点で、Coinbase 側がリソース URL を Bazaar の discovery index にカタログする。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          Bazaar に掲載されると、AWS Bedrock AgentCore Payments の MCP server / 22 社 Foundation メンバーの client 経由でも検索可能になる。
          つまり <strong>1 settle で global discovery</strong>。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">確認方法</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto">{`curl 'https://api.cdp.coinbase.com/platform/v2/x402/discovery/search?q=<yourServiceName>'`}</pre>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">"both" モードでの metering</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          CDP で settle が成功した直後、ミドルウェアは <code className="text-xs bg-gray-100 px-1 rounded">POST /api/x402/record</code> を fire-and-forget で叩く。
          これにより <code className="text-xs bg-gray-100 px-1 rounded">PermitCharge</code> として記録され、月次のインボイス自動発行 / freee 仕訳の対象になる。
          冪等性は txHash で担保されるので、リクエストが重複しても二重記録されない。
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-500">関連：<Link href="/app" className="text-amber-700">/sellers 登録 wizard →</Link></p>
      </article>
    </main>
  );
}
