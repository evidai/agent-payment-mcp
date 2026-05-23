import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCP SDK — LemonCake Docs",
  description: "@lemon-cake/mcp-sdk の withPayment() で MCP server の任意 tool を pay-per-call 化する方法。",
  alternates: { canonical: "https://lemoncake.xyz/docs/mcp-sdk" },
};

export default function McpSdkDocPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">MCP SDK で MCP server を収益化</h1>
        <p className="text-sm text-gray-500 !mt-0">
          <code className="text-xs bg-gray-100 px-1 rounded">@lemon-cake/mcp-sdk</code> の <code className="text-xs bg-gray-100 px-1 rounded">withPayment()</code> で 1 行ラップ。
        </p>

        <hr className="my-8 border-gray-200" />

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">インストール</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto">{`npm install @lemon-cake/mcp-sdk @modelcontextprotocol/sdk`}</pre>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">最小例</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { withPayment } from "@lemon-cake/mcp-sdk";

const server = new Server(
  { name: "my-paid-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler("tools/call", withPayment({
  serviceId:       "your-providerV2-id",   // /sellers で発行
  pricePerCallUsd: 0.01,                    // 1 call $0.01
  toolName:        "search_premium",        // この tool だけ課金
  handler: async (args) => {
    // 実際の処理
    const results = await doSearch(args.q);
    return { content: [{ type: "text", text: JSON.stringify(results) }] };
  },
}));

await server.connect(new StdioServerTransport());`}</pre>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">複数 tool を課金する場合</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`server.setRequestHandler("tools/call", withPayment({
  serviceId: "your-providerV2-id",
  pricing: {
    search_premium:   { pricePerCallUsd: 0.01 },
    summarize:        { pricePerCallUsd: 0.02 },
    embed:            { pricePerCallUsd: 0.005 },
    health_check:     { free: true },            // 無料 tool
  },
  handlers: {
    search_premium:   async (args) => { /* ... */ },
    summarize:        async (args) => { /* ... */ },
    embed:            async (args) => { /* ... */ },
    health_check:     async ()     => ({ content: [{ type: "text", text: "ok" }] }),
  },
}));`}</pre>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">課金フロー</h2>
        <ol className="text-sm text-gray-700 leading-relaxed pl-5 list-decimal space-y-1.5">
          <li>Buyer の MCP client（Claude / Cursor 等）が tool を呼び出す</li>
          <li><code className="text-xs bg-gray-100 px-1 rounded">withPayment</code> は <code className="text-xs bg-gray-100 px-1 rounded">LEMON_CAKE_PERMIT</code> を request context から探す（agent-payment-mcp 経由なら自動付与）</li>
          <li>permit が無い場合は <code className="text-xs bg-gray-100 px-1 rounded">PaymentRequiredError</code> を返す（402 相当）</li>
          <li>permit が有る場合は LemonCake API に <code className="text-xs bg-gray-100 px-1 rounded">PermitCharge</code> を発行 → 成功時のみ handler 実行</li>
          <li>charge tx は Basescan で公開、Provider のダッシュボードに即時反映</li>
        </ol>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">無料 tool との混在</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          <code className="text-xs bg-gray-100 px-1 rounded">free: true</code> を指定した tool は LemonCake を呼ばない。
          無料 + 有料 hybrid な MCP server を作れる（Demo Mode と同じ思想）。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">エラーハンドリング</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`try {
  // ...
} catch (err) {
  if (err.code === "PERMIT_EXPIRED")    { /* 90 day expired */ }
  if (err.code === "DAILY_CAP_EXCEEDED"){ /* $25/day reached */ }
  if (err.code === "INSUFFICIENT_USDC") { /* Buyer wallet 残高不足 */ }
  if (err.code === "PERMIT_MISSING")    { /* env に LEMON_CAKE_PERMIT 無し */ }
}`}</pre>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Express / Hono 版との違い</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li><Link href="/docs/x402-hybrid" className="text-amber-700">x402-server</Link>：HTTP API を 402 で課金。AWS AgentCore / Bazaar 経由でも流入</li>
          <li><strong>mcp-sdk</strong>：MCP transport（stdio / SSE）上で課金。Claude Desktop / Cursor / Cline と直接統合</li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed">
          MCP 専用エコシステム（Anthropic Directory / mcp.so 等）に出すなら mcp-sdk。HTTP API として広く公開するなら x402-server。
          両方公開しても serviceId を揃えれば売上は合算される。
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-500">関連：<Link href="/docs/x402-hybrid" className="text-amber-700">x402 hybrid mode →</Link></p>
      </article>
    </main>
  );
}
