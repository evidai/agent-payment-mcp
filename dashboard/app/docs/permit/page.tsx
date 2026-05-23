import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ERC-2612 permit — LemonCake Docs",
  description: "1 度の署名で 90 日間 / $25/日 cap を AI エージェントに委譲する仕組み。USDC が漏洩しても他は安全な non-custodial の証明。",
  alternates: { canonical: "https://lemoncake.xyz/docs/permit" },
};

export default function PermitDocPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">ERC-2612 permit の仕組み</h1>
        <p className="text-sm text-gray-500 !mt-0">
          1 度の <strong>EIP-712 署名</strong>で AI に USDC 決済能力を渡す。LemonCake は秘密鍵もカストディ権限も持たない。
        </p>

        <hr className="my-8 border-gray-200" />

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">課題：AI に毎回承認させたくない</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          AI エージェントが API を叩くたびにユーザーが <code className="text-xs bg-gray-100 px-1 rounded">approve()</code> を承認するのは現実的でない。
          かといって秘密鍵を AI に渡したら、無制限に資金が抜ける危険性。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          <strong>解：ERC-2612 permit（EIP-2612）</strong> — オフチェーン署名で「90 日間 / 1 日 $25 まで spender に転送許可」という<strong>条件付き approval</strong> をオンチェーンに焼ける。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">EIP-712 署名内容</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`{
  "domain": {
    "name":              "USD Coin",
    "version":           "2",
    "chainId":           8453,                           // Base
    "verifyingContract": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"  // USDC on Base
  },
  "types": {
    "Permit": [
      { "name": "owner",    "type": "address" },
      { "name": "spender",  "type": "address" },
      { "name": "value",    "type": "uint256" },
      { "name": "nonce",    "type": "uint256" },
      { "name": "deadline", "type": "uint256" }
    ]
  },
  "message": {
    "owner":    "<Buyer wallet>",
    "spender":  "0x23e0D...E965",                       // LemonCake batch spender
    "value":    "2250000000",                            // 2,250 USDC = $25 × 90 day
    "nonce":    "<USDC.nonces(owner)>",
    "deadline": "<now + 90 day>"
  }
}`}</pre>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          USDC v2 contract が ERC-2612 互換なので、追加デプロイ無しでそのまま動く。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">3 つの安全装置</h2>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">1. Value cap（$2,250 上限）</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          USDC contract が <code className="text-xs bg-gray-100 px-1 rounded">value</code> を超える <code className="text-xs bg-gray-100 px-1 rounded">transferFrom</code> を<strong>必ず reject</strong>。
          これ以上は USDC スマコン自体が許可しないので、LemonCake バグでもハッキングでも超過不可能。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">2. Deadline（90 日で自動失効）</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          <code className="text-xs bg-gray-100 px-1 rounded">deadline</code> 経過後は<strong>署名が無効化</strong>。再利用しようとしても USDC contract が reject。
          再開するには <Link href="/start/v2" className="text-amber-700">/start/v2</Link> で再署名するだけ。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">3. Off-chain daily cap（$25/日）</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          LemonCake バックエンドが Redis で<strong>UTC 日次の累計</strong>を管理。
          24h 内で $25 を超える <code className="text-xs bg-gray-100 px-1 rounded">PermitCharge</code> リクエストは 402 で reject。
          オンチェーンの value cap（$2,250）が「最終防衛線」、daily cap は「日常使いの天井」という二重防御。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">即時 revoke する方法</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          permit を即座に無効化したい場合、USDC contract に直接以下を送る：
        </p>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`// Basescan で USDC contract を開く
// https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913#writeProxyContract
// "approve" 関数に以下を入力して Write:
spender: 0x23e0D...E965  // LemonCake batch spender
value:   0`}</pre>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          1 tx でゼロ化。ガス代 ~$0.01。LemonCake の介入不要。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">spender アドレス（公開）</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          LemonCake のバッチ spender ウォレットは:{" "}
          <a
            href="https://basescan.org/address/0x23e0D71B0b9eE9b7fd0F46DD49998b1681c2E965"
            target="_blank"
            rel="noopener"
            className="text-amber-700 font-mono text-xs"
          >
            0x23e0D...E965 ↗
          </a>
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          このアドレスから出るのは「Buyer → Provider への USDC 転送 tx」と「ガス代用 ETH 消費」のみ。
          Basescan で全履歴を監査可能。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">関連 EIP / ERC</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li><a href="https://eips.ethereum.org/EIPS/eip-2612" target="_blank" rel="noopener" className="text-amber-700">EIP-2612</a>: permit by signature</li>
          <li><a href="https://eips.ethereum.org/EIPS/eip-712" target="_blank" rel="noopener" className="text-amber-700">EIP-712</a>: typed structured data signing</li>
          <li><a href="https://eips.ethereum.org/EIPS/eip-3009" target="_blank" rel="noopener" className="text-amber-700">EIP-3009</a>: transferWithAuthorization（x402 が利用）</li>
        </ul>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-500">関連：<Link href="/security" className="text-amber-700">セキュリティ全文 →</Link></p>
      </article>
    </main>
  );
}
