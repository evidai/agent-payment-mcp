"use client";

/**
 * /sellers — Provider 登録 (v4)
 *
 * 実装は components/ProviderRegistrationWizard.tsx に集約。
 * このページは公開 URL 用の薄いラッパー（hero + valueプロップ + wizard）。
 * ダッシュボード内（PublishPage）も同じ wizard を embed variant で使う。
 */

import { ProviderRegistrationWizard } from "@/components/ProviderRegistrationWizard";

export default function SellersPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">

        {/* Hero */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider">
            <span>🍋</span><span>For API Providers</span>
          </span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold text-gray-900 leading-tight tracking-tight">
            あなたの API を<br />
            <span className="text-amber-600">AI エージェントの収入源</span>に
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl mx-auto">
            USDC で直接受け取り。Stripe の <strong className="text-gray-900">60 倍安い手数料</strong>。
            月 1,000 call まで無料。<strong className="text-gray-900">1 分で登録完了</strong>。
          </p>
        </div>

        {/* 3 column value props */}
        <div className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "💰", title: "USDC 直接着金", desc: "クレジットカード会社を経由せず、あなたのウォレットに即時。chargeback 不可。" },
            { icon: "⚡", title: "$0.001 から",   desc: "1 リクエスト数円から。Stripe の最低 ¥45/件と比較して 60 倍安い。" },
            { icon: "🌏", title: "海外摩擦ゼロ", desc: "クレカ使えない国でも USDC で OK。JP/US/EU 規制グリーン。" },
          ].map((v) => (
            <div key={v.title} className="rounded-2xl border border-gray-200 bg-white p-5">
              <div className="text-3xl">{v.icon}</div>
              <div className="mt-3 font-bold text-gray-900">{v.title}</div>
              <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{v.desc}</p>
            </div>
          ))}
        </div>

        {/* Wizard 本体 */}
        <ProviderRegistrationWizard variant="page" />

        <p className="mt-12 text-center text-xs text-gray-400">
          USDC はあなたのウォレットに直接届きます。LemonCake は決済経路に介在しません。
          <br />
          詳細: <a href="/security" className="underline hover:text-amber-700">/security</a>
        </p>
      </div>
    </main>
  );
}
