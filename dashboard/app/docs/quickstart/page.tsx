import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quickstart — LemonCake Docs",
  description: "5 分で agent-payment-mcp を Claude / Cursor / Cline に接続。Demo Mode から permit 発行まで。",
  alternates: { canonical: "https://lemoncake.xyz/docs/quickstart" },
};

export default function QuickstartPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">Quickstart</h1>
        <p className="text-sm text-gray-500 !mt-0">5 分で AI エージェントに USDC ウォレットを持たせる。</p>

        <hr className="my-8 border-gray-200" />

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Step 1: MCP server を追加</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Claude Desktop / Cursor / Cline の MCP 設定ファイル（典型的には{" "}
          <code className="text-xs bg-gray-100 px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code>
          ）に追記：
        </p>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"]
    }
  }
}`}</pre>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          env vars 無しで起動すると <strong className="text-gray-700">Demo Mode</strong>。サインアップ不要・課金なしで Wikipedia / FX / weather / translate など 8 つの実 API を試せる。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Step 2: Claude にアクセス</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          MCP client を再起動後、agent に話しかける：
        </p>
        <pre className="bg-gray-950 text-amber-300 rounded-xl p-4 text-sm overflow-x-auto">{`「lemon を使って Wikipedia で 'Model Context Protocol' を検索して要約して」`}</pre>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          agent が <code className="text-[10px] bg-gray-100 px-1 rounded">list_services</code> → <code className="text-[10px] bg-gray-100 px-1 rounded">call_service(demo_search)</code> を自動実行する。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Step 3: paid services を解放（任意）</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Demo Mode で気に入ったら、<Link href="/start/v2" className="text-amber-700 font-bold">/start/v2</Link> で permit を発行：
        </p>
        <ol className="text-sm text-gray-700 leading-relaxed pl-5 list-decimal space-y-1.5">
          <li>Google でサインイン（Privy が embedded wallet を自動生成）</li>
          <li>Apple Pay / Google Pay / 銀行振込で USDC を購入（Coinbase / Transak が内蔵）</li>
          <li>ERC-2612 permit に 1 度署名（90 日 / $25/日 hard cap、ガス代不要）</li>
          <li>表示された <code className="text-xs bg-gray-100 px-1 rounded">LEMON_CAKE_PERMIT</code> をコピペで env に貼る</li>
        </ol>

        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed mt-3">{`{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"],
      "env": {
        "LEMON_CAKE_PERMIT": "<paste blob>"
      }
    }
  }
}`}</pre>

        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          これで Serper（Google Search）、Hunter.io、gBizINFO、NTA 適格請求書 API などの paid services を呼べる。
          単価は Provider 設定（多くは <code className="text-xs bg-gray-100 px-1 rounded">$0.001</code> 〜 <code className="text-xs bg-gray-100 px-1 rounded">$0.05</code>/call）。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">FAQ</h2>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">USDC が漏洩したらどうなるの？</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          permit に焼かれた cap（デフォルト $25/日）を超えて引かれない。<code className="text-xs bg-gray-100 px-1 rounded">approve(spender, 0)</code> を USDC contract に直接送れば即時 revoke も可能。
          詳細は <Link href="/docs/permit" className="text-amber-700">permit ドキュメント</Link>。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">90 日後どうなる？</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          permit の deadline が切れて自動失効。<Link href="/start/v2" className="text-amber-700">/start/v2</Link> で再署名するだけ。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">LemonCake は USDC を持ってない？</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          一切持たない。AI が API を呼ぶ瞬間、あなたのウォレットから Provider のウォレットへ直接オンチェーン送金される。LemonCake はこの送金を実行するための permit を渡すだけ。
          <Link href="/security" className="text-amber-700">セキュリティ詳細</Link>。
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-500">次：<Link href="/docs/permit" className="text-amber-700 font-bold">ERC-2612 permit の仕組み →</Link></p>
      </article>
    </main>
  );
}
