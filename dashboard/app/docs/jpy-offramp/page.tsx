import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "JPY オフランプ — LemonCake Docs",
  description: "Business プラン専用機能。USDC → JPY → 銀行口座出金を 1 クリック。Coincheck API キー暗号化保存、LemonCake は USDC を一切保管しない。",
  alternates: { canonical: "https://lemoncake.xyz/docs/jpy-offramp" },
};

export default function JpyOfframpDocPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">JPY オフランプ</h1>
        <p className="text-sm text-gray-500 !mt-0">
          USDC 受領 → JPY 売却 → 銀行口座出金まで <strong>1 クリック</strong>。Business プラン専用。
        </p>

        <hr className="my-8 border-gray-200" />

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">なぜ必要か</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          API を売って USDC を受け取っても、生活費や法人税は円で払う。
          毎月 Coincheck / bitFlyer にログインして手動で売却 → 出金するのは時間の無駄。
          LemonCake はこのフローを <strong>API 呼び出し 1 回</strong>に圧縮する。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">非カストディの設計</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          重要：<strong>LemonCake は USDC も JPY も一切保管しない</strong>。
        </p>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li>Provider の <strong>Coincheck アカウント宛て</strong>に USDC を直接送金（ウォレットアドレスは Provider 自身が登録）</li>
          <li>LemonCake は Coincheck API キーを <strong>AES-256-GCM で暗号化</strong>して預かるだけ</li>
          <li>「USDC 売って円にして指定口座へ振り込め」という<strong>API リクエストを代行送信</strong>するのみ</li>
          <li>JPY は Provider 名義の銀行口座に直接着金</li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed">
          つまり LemonCake は<strong>「APIキーで Coincheck を操作するロボット」</strong>であって、資金の保管者ではない。
          FSA Q12 で非カストディ性を確認中。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">セットアップ（3 step）</h2>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">Step 1: Business プランへアップグレード</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          ダッシュボード <Link href="/" className="text-amber-700">トップ</Link> から Business（¥29,800/月 または $199/月）を選択。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">Step 2: Coincheck API キーを登録</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          Coincheck の <a href="https://coincheck.com/ja/api_settings" target="_blank" rel="noopener" className="text-amber-700">API 設定</a> で以下権限のキーを作成：
        </p>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1">
          <li><code className="text-xs bg-gray-100 px-1 rounded">取引</code>（売却に必要）</li>
          <li><code className="text-xs bg-gray-100 px-1 rounded">送金</code>（銀行口座出金に必要）</li>
          <li><code className="text-xs bg-gray-100 px-1 rounded">アカウント情報</code>（残高確認）</li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed">
          ダッシュボードの「JPY オフランプ」パネルに API key / secret を貼り付け → <strong>サーバー側で AES-256-GCM 暗号化</strong>して DB 保存。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">Step 3: 銀行口座を登録</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          Coincheck 側で出金先銀行口座を事前登録（Provider 名義のみ可）。これも Coincheck の規約上必須。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">実行</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          ダッシュボードの「USDC を JPY 化」ボタンを押すと：
        </p>
        <ol className="text-sm text-gray-700 leading-relaxed pl-5 list-decimal space-y-1.5">
          <li>USDC 残高を Provider の Coincheck 入金アドレスへ送金（Base → Coincheck）</li>
          <li>着金確認後、Coincheck 現物板で USDC/JPY 成行売却</li>
          <li>JPY を登録済み銀行口座へ自動振込（Coincheck 出金 API）</li>
        </ol>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          所要時間：ブロックチェーン承認 1-3 分 + Coincheck 売却即時 + 銀行振込 1-2 営業日（Coincheck の出金スケジュール依存）。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">手数料</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li><strong>LemonCake 手数料：0 円</strong>（Business プラン月額に含む）</li>
          <li>Base ガス代：~$0.01 / tx</li>
          <li>Coincheck の売買スプレッド + 出金手数料 407 円（GMO以外）／全額 Provider 負担</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">セキュリティ</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li>API キー保存時に <code className="text-xs bg-gray-100 px-1 rounded">crypto.subtle.encrypt</code>（AES-256-GCM）。マスターキーは Railway env で別管理</li>
          <li>復号は<strong>出金 API 呼び出し時のメモリ内のみ</strong>。DB に平文は残らない</li>
          <li>ダッシュボードでいつでも「API キー削除」可能。即座にゼロ化</li>
          <li>Coincheck 側で <strong>IP allowlist</strong> を設定すれば LemonCake サーバー IP（Railway）からのみ叩ける</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">対応取引所（v1）</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li><strong>Coincheck</strong>（v1 サポート、USDC 上場済）</li>
          <li>bitFlyer / GMOコイン / bitbank：USDC 上場待ち。ロードマップに記載</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">FAQ</h2>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">税務上どう扱われる？</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          USDC 受領時点で売上（時価で円換算）、JPY 売却時に為替差損益が発生。
          Pro プランの <Link href="/docs/accounting" className="text-amber-700">freee 自動仕訳</Link>がここまで対応する。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">Coincheck じゃなく自分の MetaMask に送りたい</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          Provider 設定で受取アドレスを変更可能。JPY オフランプを使わない構成も OK（USDC のまま運用）。
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-500">
          関連：<Link href="/docs/accounting" className="text-amber-700">freee 自動仕訳 →</Link>
          {" / "}
          <Link href="/security" className="text-amber-700">セキュリティ詳細 →</Link>
        </p>
      </article>
    </main>
  );
}
