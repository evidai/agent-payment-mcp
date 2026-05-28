import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "適格請求書（インボイス制度）自動発行 — LemonCake Docs",
  description: "Pro プラン機能。T+13 桁登録番号を入れておけば、月末に前月分のインボイスを国税庁仕様で自動生成。",
  alternates: { canonical: "https://lemoncake.xyz/docs/invoices" },
};

export default function InvoicesDocPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">適格請求書 自動発行</h1>
        <p className="text-sm text-gray-500 !mt-0">
          インボイス制度（2023 年 10 月施行）対応。月次集計を自動でインボイス化。Pro プラン以上。
        </p>

        <hr className="my-8 border-gray-200" />

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">なぜ必要か</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          B2B で売上を立てる場合、買い手が<strong>仕入税額控除</strong>を取るには適格請求書が必須。
          現状、USDC で API を売っている個人 / 法人にこれを正しく発行している事業者はほぼ無い。
          LemonCake がここを自動化することで、Buyer 側の経理部門が安心して支払える状態を作る。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">生成されるインボイスの記載事項</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          国税庁の <a href="https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/invoice.htm" target="_blank" rel="noopener" className="text-amber-700">適格請求書の記載事項</a> を全て満たす：
        </p>
        <ol className="text-sm text-gray-700 leading-relaxed pl-5 list-decimal space-y-1.5">
          <li>適格請求書発行事業者の氏名 / 名称 + <strong>登録番号 T+13 桁</strong></li>
          <li>取引年月日</li>
          <li>取引内容（軽減税率対象の場合はその旨）</li>
          <li>税率ごとに区分した対価の合計額 + 適用税率</li>
          <li>税率ごとに区分した<strong>消費税額</strong></li>
          <li>書類の交付を受ける事業者の氏名 / 名称</li>
        </ol>
        <p className="text-xs text-gray-500 leading-relaxed mt-2">
          PDF + JSON（電子インボイス Peppol 互換）で出力。電子帳簿保存法 7 年保管の要件も自動で満たす。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">セットアップ</h2>
        <ol className="text-sm text-gray-700 leading-relaxed pl-5 list-decimal space-y-1.5">
          <li>Pro プラン以上に加入</li>
          <li><Link href="/app" className="text-amber-700">/sellers</Link> 設定で <strong>T+13 桁登録番号</strong>を入力</li>
          <li>ダッシュボード → /publish/invoices で「自動発行を有効化」トグル ON</li>
          <li>毎月 1 日 09:00 JST に前月分が自動生成され、Buyer のメールアドレス宛に PDF が送信される</li>
        </ol>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">複数 Buyer / 月次集計</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          tx を Buyer ウォレットアドレス（または認証済み AI エージェント識別子）でグルーピング。
          同じ Buyer から複数 tx あれば 1 通のインボイスに合算。
          1 ヶ月で 1 tx も無い Buyer 宛にはインボイスは生成されない。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">税率区分</h2>
        <ul className="text-sm text-gray-700 leading-relaxed pl-5 list-disc space-y-1.5">
          <li>デフォルト：<strong>標準税率 10%</strong>（API サービスは原則これ）</li>
          <li>非課税 / 輸出免税：海外 Buyer 宛は 0% 区分で発行可能（要設定）</li>
          <li>軽減税率 8%：API サービスでは通常該当しない</li>
        </ul>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Buyer 側での扱い</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          受け取った PDF を <strong>freee / MoneyForward / 弥生</strong> 等にアップロードすれば、買掛 / 仕入として処理できる。
          国税庁の「<a href="https://www.invoice-kohyo.nta.go.jp/" target="_blank" rel="noopener" className="text-amber-700">適格請求書発行事業者公表サイト</a>」で T 番号の有効性を即時確認可能。
        </p>

        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">登録番号未取得の場合</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          T 番号無しでも「区分記載請求書」形式で発行可能（消費税額の記載のみ）。
          Buyer 側は仕入税額控除を取れないが、経費精算には使える。
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">
          登録は <a href="https://www.nta.go.jp/taxes/tetsuzuki/shinsei/annai/invoice_kanyu.htm" target="_blank" rel="noopener" className="text-amber-700">国税庁の電子申請</a> から無料・15 分で完了する。
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-500">関連：<Link href="/docs/accounting" className="text-amber-700">freee / MF 自動仕訳 →</Link></p>
      </article>
    </main>
  );
}
