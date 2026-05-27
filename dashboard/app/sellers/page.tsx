"use client";

/**
 * /sellers — Provider 登録 (v4)
 *
 * 実装は components/ProviderRegistrationWizard.tsx に集約。
 * このページは公開 URL 用の薄いラッパー（hero + valueプロップ + wizard）。
 * ダッシュボード内（PublishPage）も同じ wizard を embed variant で使う。
 */

import { ProviderRegistrationWizard } from "@/components/ProviderRegistrationWizard";
import { LangSwitcher } from "@/components/LangSwitcher";

export default function SellersPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">

        {/* Lang switcher */}
        <div className="flex justify-end mb-4">
          <LangSwitcher current="ja" basePath="/sellers" variant="light" />
        </div>

        {/* Hero */}
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider">
            <span>🍋</span><span>For MCP / API Builders</span>
          </span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-bold text-gray-900 leading-tight tracking-tight">
            あなたの MCP / API に<br />
            <span className="text-amber-600">3 行で課金</span>を追加
          </h1>
          <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl mx-auto">
            <code className="bg-gray-900 text-amber-300 px-1.5 py-0.5 rounded text-sm">lc.charge({"{ price: 0.02 }"})</code> でツール呼び出しごとに課金。
            <strong className="text-gray-900">月額無料、API が売れた時だけ 3%。</strong>
            最初の 3,000 calls 無料、固定手数料なし、Stripe Connect 不要、グローバル対応。
          </p>
        </div>

        {/* 3 column value props */}
        <div className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: "💰", title: "usage-based 課金", desc: "ツール呼び出し / トークン / 完了タスク単位で micro-payment。Stripe の $0.30 最低額の壁なし。" },
            { icon: "⚡", title: "subscription 不要", desc: "従量制で受け取り。chargeback なし、invoice 自動、API key 配布不要。" },
            { icon: "🌏", title: "海外摩擦ゼロ", desc: "Stripe Connect 非対応国でも動く。日本、インドネシア、アルゼンチン — 全部 day-one 対応。" },
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
