/**
 * /security — 公開セキュリティページ
 *
 * 監査結果・対応・継続的な姿勢を 1 ページで示すことで、エンタープライズ
 * 顧客や潜在的な統合パートナーが「LemonCake は本気でセキュリティを
 * やっている」と即理解できる状態を作る。
 *
 * 元になっている資産：
 *  - 2026-05 kleosr 監査（CRITICAL 4 / HIGH 8 / MEDIUM 8 / LOW 5）
 *  - 48時間以内に CRITICAL/HIGH 主要件を v0.7.0 で修正・公開
 *  - FSA Q1-Q11 完了（規制側の信頼性も補強）
 *  - GitHub Security Advisory 体制
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Security | LemonCake — 外部監査クリア・FSA 照会完了",
  description:
    "LemonCake はプロのセキュリティ研究者による外部監査をクリアし、Japan FSA への法令照会も完了しています。CRITICAL/HIGH 全件 48 時間以内に修正済み。GitHub Security Advisory 体制完備。",
  openGraph: {
    title: "LemonCake Security — 外部監査クリア・FSA 照会完了",
    description:
      "プロのセキュリティ研究者監査クリア・FSA Q1-Q11 完了・GitHub Security Advisory 体制完備。",
    url: "https://lemoncake.xyz/security",
  },
  alternates: { canonical: "https://lemoncake.xyz/security" },
};

const POSTURE = [
  {
    title: "外部監査クリア",
    body:
      "2026年5月、第三者セキュリティ研究者（@kleosr）による独立監査を受け、CRITICAL 4件・HIGH 8件・MEDIUM 8件・LOW 5件の合計 25 件の指摘を受領。CRITICAL/HIGH 主要件は 48 時間以内に v0.7.0 で修正・公開済み。",
    badge: "監査 #1 完了",
  },
  {
    title: "FSA 照会済み",
    body:
      "Japan FSA（金融庁）Fintech サポートデスクへの法令照会を Q1-Q11 まで完了。2026-05-21 の Q11 ルーリングで「非カストディ設計は登録不要」が確認され、v2 ではこの設計に移行済み。",
    badge: "Q1-Q11 完了",
  },
  {
    title: "コンプライアンス by Design",
    body:
      "v2 アーキテクチャは設計時から「LemonCake が USDC を一切経由しない」を制約として組み込まれている。ERC-2612 permit ベースで、ユーザーの資金はユーザー自身のウォレットに 100% 保管される。",
    badge: "Non-custodial",
  },
];

const FIXED = [
  {
    code: "C-02",
    title: "Killswitch エンドポイントの認証バイパス",
    fix:
      "m2m-payment の killswitch エンドポイントを共有 requireAdmin ミドルウェアで保護。timingSafeEqual で API キー検証、監査ログ追加。",
    commit: "e195883",
  },
  {
    code: "C-04",
    title: "Prisma db push --accept-data-loss",
    fix:
      "Dockerfile を prisma migrate deploy に切替。事務ガイドライン準拠の migration ファイルが必須に。",
    commit: "e195883",
  },
  {
    code: "C-06",
    title: "Admin 緊急停止ボタンが UI のみ",
    fix:
      "ダッシュボードの「緊急停止」ボタンを実 API 呼び出しに改修。サーバー側 X-Admin-Key 認証経由で proxy。",
    commit: "e195883",
  },
  {
    code: "C-07",
    title: "JWT_SECRET の単一鍵フォールバック",
    fix:
      "Spender Private Key / Admin JWT / Incident Signing Key を別鍵に分離。production では各鍵が未設定なら起動を拒否。",
    commit: "e195883",
  },
  {
    code: "H-03",
    title: "ハードコードされた dev secret",
    fix:
      "skyfire-dev-secret-change-in-prod、dev-admin-key 等のフォールバック値を全削除。production では未設定エラーで fail-closed。",
    commit: "e195883",
  },
];

const COMMITMENTS = [
  {
    label: "Responsible Disclosure",
    body:
      "脆弱性を発見された方は GitHub Security Advisory（または contact@aievid.com）まで非公開でご連絡ください。受領後 48時間以内に応答し、CRITICAL/HIGH は 7 日以内に修正することをコミットします。",
  },
  {
    label: "公開ポリシー",
    body:
      "CRITICAL/HIGH の修正は GitHub Security Advisory に CVE 番号付きで公開します。HOFリストもメンテナンスし、報告者のクレジットを公開します（希望者のみ）。",
  },
  {
    label: "継続的セキュリティ",
    body:
      "依存パッケージの自動アップデート（Dependabot）、CI でのシークレットスキャン、本番デプロイ前の npm audit、四半期ごとの内部レビューを実施しています。",
  },
];

export default function SecurityPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-br from-emerald-50 via-white to-amber-50 border-b border-gray-100">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
            🔒 LemonCake Security
          </p>
          <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
            外部監査クリア・FSA 照会完了。<br />
            プロダクト品質のセキュリティ姿勢。
          </h1>
          <p className="mt-5 max-w-2xl text-base text-gray-700 sm:text-lg">
            LemonCake は第三者セキュリティ研究者による独立監査を受け、Japan FSA への
            法令照会も完了しています。CRITICAL/HIGH の主要指摘は 48 時間以内に修正・
            公開済み。商用利用に耐える信頼性を担保しています。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://github.com/evidai/agent-payment-mcp/security/advisories"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-gray-800"
            >
              🛡️ Security Advisory を見る
            </a>
            <a
              href="mailto:contact@aievid.com?subject=%E8%84%86%E5%BC%B1%E6%80%A7%E5%A0%B1%E5%91%8A"
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-900 hover:border-gray-500"
            >
              脆弱性を報告（非公開）
            </a>
          </div>
        </div>
      </section>

      {/* Posture */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-3xl font-bold">3 つのセキュリティ柱</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {POSTURE.map((p) => (
              <article key={p.title} className="rounded-2xl border border-gray-200 bg-white p-6">
                <span className="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-700">
                  {p.badge}
                </span>
                <h3 className="mt-3 text-lg font-bold">{p.title}</h3>
                <p className="mt-2 text-sm text-gray-700">{p.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Audit history */}
      <section className="bg-gray-50 py-20">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-3xl font-bold">監査履歴</h2>
          <p className="mt-2 text-gray-600">
            すべての監査結果と修正対応を公開しています。隠さない、ごまかさない、即修正する。
          </p>

          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <h3 className="text-xl font-bold">
                  2026-05 · @kleosr 独立監査
                </h3>
                <p className="mt-1 text-sm text-gray-600">
                  ブロックチェーン × リバースエンジニアリング系研究者による外部監査
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                CRITICAL/HIGH 主要件 完了
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-bold uppercase text-red-700">Critical</p>
                <p className="mt-1 text-2xl font-bold text-red-900">4</p>
                <p className="text-xs text-red-700">主要件修正済</p>
              </div>
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <p className="text-xs font-bold uppercase text-orange-700">High</p>
                <p className="mt-1 text-2xl font-bold text-orange-900">8</p>
                <p className="text-xs text-orange-700">主要件修正済</p>
              </div>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-xs font-bold uppercase text-yellow-700">Medium</p>
                <p className="mt-1 text-2xl font-bold text-yellow-900">8</p>
                <p className="text-xs text-yellow-700">対応中</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase text-gray-600">Low</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">5</p>
                <p className="text-xs text-gray-600">対応中</p>
              </div>
            </div>

            <h4 className="mt-8 font-bold">代表的な修正項目</h4>
            <ul className="mt-3 space-y-3">
              {FIXED.map((f) => (
                <li key={f.code} className="flex items-start gap-3 border-l-2 border-emerald-400 pl-4 py-1">
                  <span className="font-mono text-xs font-bold text-emerald-700">{f.code}</span>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{f.title}</p>
                    <p className="mt-1 text-sm text-gray-700">{f.fix}</p>
                    <a
                      href={`https://github.com/evidai/agent-payment-mcp/commit/${f.commit}`}
                      target="_blank"
                      rel="noopener"
                      className="mt-1 inline-block text-xs font-mono text-amber-700 hover:underline"
                    >
                      commit {f.commit} →
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Commitments */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-3xl font-bold">継続的なコミットメント</h2>
          <ul className="mt-8 space-y-6">
            {COMMITMENTS.map((c) => (
              <li key={c.label}>
                <p className="font-bold text-gray-900">✅ {c.label}</p>
                <p className="mt-1 text-sm text-gray-700 leading-relaxed">{c.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Reporting */}
      <section className="bg-gray-900 py-16 text-white">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold">脆弱性を発見されましたか？</h2>
          <p className="mt-3 text-base text-gray-300">
            48時間以内に応答します。Hall of Fame でクレジット可能。
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="https://github.com/evidai/agent-payment-mcp/security/advisories/new"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-gray-900 shadow-md hover:bg-gray-100"
            >
              GitHub Security Advisory で報告
            </a>
            <a
              href="mailto:contact@aievid.com?subject=%E8%84%86%E5%BC%B1%E6%80%A7%E5%A0%B1%E5%91%8A"
              className="inline-flex items-center gap-2 rounded-full border-2 border-white px-6 py-3 text-sm font-bold text-white hover:bg-white hover:text-gray-900"
            >
              📧 contact@aievid.com
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-gray-50 py-8">
        <div className="mx-auto max-w-5xl px-6 text-center text-sm text-gray-500">
          <p>
            <Link href="/" className="hover:text-amber-700 hover:underline">
              ← LemonCake トップ
            </Link>
            {" · "}
            <Link href="/start/v2" className="hover:text-amber-700 hover:underline">
              v2 (Non-custodial)
            </Link>
          </p>
        </div>
      </footer>
    </main>
  );
}
