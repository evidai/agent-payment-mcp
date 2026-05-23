import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "freee / MF 自動仕訳 — LemonCake Docs",
  description: "Pro プラン機能。USDC 受領のたびに freee / MoneyForward に journal entry を自動生成。月次集計も含む。",
  alternates: { canonical: "https://lemoncake.xyz/docs/accounting" },
};

export default function AccountingDocPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">freee / MoneyForward 自動仕訳</h1>
        <p className="text-sm text-gray-500 !mt-0">
          USDC 受領 → 仕訳作成まで <strong>0 操作</strong>。Pro プラン以上で有効。
        </p>

        <hr className="my-8 border-gray-200" />

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">何が自動化されるか</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li>USDC 受領 tx ごとに 1 仕訳生成</li>
          <li>勘定科目自動マッピング：<strong>売掛金 → 売上高 / 仮受消費税</strong>（標準税率 10%）</li>
          <li>取引先（Buyer ウォレット or 既知の AI エージェント名）を取引先マスタに自動登録</li>
          <li>月末に <strong>USDC → JPY の評価替え仕訳</strong>（為替差損益）も自動生成</li>
          <li>tx hash を備考欄に記録（後で証憑として参照可能）</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">対応会計ソフト</h2>
        <div className="rounded-2xl border border-gray-200 overflow-x-auto text-xs">
          <table className="w-full min-w-[440px]">
            <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left font-bold">サービス</th>
                <th className="px-3 py-2 text-left font-bold">連携方式</th>
                <th className="px-3 py-2 text-left font-bold">ステータス</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2"><strong>freee 会計</strong></td>
                <td className="px-3 py-2">freee アプリストア / OAuth 2.0</td>
                <td className="px-3 py-2 text-emerald-700">✓ 公開中</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2"><strong>MoneyForward クラウド会計</strong></td>
                <td className="px-3 py-2">公式 API / OAuth 2.0</td>
                <td className="px-3 py-2 text-emerald-700">✓ 公開中</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">弥生会計オンライン</td>
                <td className="px-3 py-2">CSV エクスポート</td>
                <td className="px-3 py-2 text-gray-500">手動 import 対応</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">セットアップ</h2>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">freee の場合</h3>
        <ol className="text-sm text-gray-700 leading-relaxed pl-5 list-decimal space-y-1.5">
          <li>Pro プランへアップグレード</li>
          <li>ダッシュボード → /publish/accounting → 「freee 連携」ボタン</li>
          <li>freee の OAuth 画面で事業所選択 → 承認</li>
          <li>勘定科目マッピング画面：デフォルト値を確認・上書き可能</li>
          <li>「自動仕訳を有効化」トグル ON</li>
        </ol>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">MoneyForward の場合</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          上と同じフロー。「MoneyForward 連携」ボタンから OAuth → マッピング → 有効化。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">勘定科目マッピング（デフォルト）</h2>
        <div className="rounded-2xl border border-gray-200 overflow-x-auto text-xs">
          <table className="w-full min-w-[440px]">
            <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-3 py-2 text-left font-bold">イベント</th>
                <th className="px-3 py-2 text-left font-bold">借方</th>
                <th className="px-3 py-2 text-left font-bold">貸方</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">USDC 受領</td>
                <td className="px-3 py-2">仮想通貨（USDC）</td>
                <td className="px-3 py-2">売上高 + 仮受消費税</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">USDC → JPY 売却</td>
                <td className="px-3 py-2">現預金（円口座）</td>
                <td className="px-3 py-2">仮想通貨 + 為替差損益</td>
              </tr>
              <tr className="border-t border-gray-100">
                <td className="px-3 py-2">月末評価替え</td>
                <td className="px-3 py-2">仮想通貨評価益</td>
                <td className="px-3 py-2">仮想通貨</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          科目はダッシュボード上で個別変更可能（御社の勘定体系に合わせる）。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">税理士との連携</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li>freee / MF の<strong>共有アカウント機能</strong>でそのまま税理士に見せられる</li>
          <li>備考欄の tx hash で Basescan へのリンクが入っているので、原資料との照合が即時可能</li>
          <li>四半期 / 期末で「仕訳一覧 CSV + tx hash 一覧」をダッシュボードから一括 export 可</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">FAQ</h2>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">免税事業者だけど仕訳は必要？</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          仮受消費税の行を 0 に上書きすればよい。マッピング画面で「消費税: 対象外」を選択。
        </p>

        <h3 className="text-base font-bold mt-5 mb-1 text-gray-900">過去分を一括同期できる？</h3>
        <p className="text-sm text-gray-700 leading-relaxed">
          可能。「過去 tx を同期」ボタンで全履歴を遡って仕訳作成。重複は tx hash で冪等チェック。
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-500">関連：<Link href="/docs/invoices" className="text-amber-700">適格請求書自動発行 →</Link></p>
      </article>
    </main>
  );
}
