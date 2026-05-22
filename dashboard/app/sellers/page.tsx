"use client";

/**
 * /sellers — Provider（API 提供者）登録ページ
 *
 * LemonCake に API を公開したい提供者向けのセルフサービス登録フォーム。
 * 登録すると:
 *   - serviceId（MCP 設定に貼る）が発行される
 *   - 月間 1,000 call まで無料、超過分 $0.005/call で課金
 *   - USDC は直接提供者の Base ウォレットに届く（LemonCake 経由なし）
 */

import { useState } from "react";

// NEXT_PUBLIC_API_URL が未設定でも本番 Railway にフォールバック。
// "" になると fetch("/api/providers/v2") が Next.js 自身に向いてしまうため必須。
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://skillful-blessing-production.up.railway.app";

interface RegisterResult {
  id:              string;
  apiKey:          string;
  name:            string;
  email:           string;
  baseWalletAddress: string;
  pricePerCallUsdc:  string;
  freeCallsPerMonth: number;
}

export default function SellersPage() {
  const [name,               setName]               = useState("");
  const [email,              setEmail]              = useState("");
  const [baseWallet,         setBaseWallet]         = useState("");
  const [apiEndpoint,        setApiEndpoint]        = useState("");
  const [pricePerCall,       setPricePerCall]       = useState("0.005");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [autoIssue,          setAutoIssue]          = useState(false);
  const [loading,            setLoading]            = useState(false);
  const [error,              setError]              = useState<string | null>(null);
  const [result,             setResult]             = useState<RegisterResult | null>(null);
  const [copiedField,        setCopiedField]        = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/providers/v2`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          baseWalletAddress:  baseWallet,
          apiEndpointUrl:     apiEndpoint || undefined,
          pricePerCallUsdc:   pricePerCall,
          registrationNumber: registrationNumber || undefined,
          autoIssueInvoices:  autoIssue,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data = await res.json() as RegisterResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function copy(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <div className="mx-auto max-w-2xl px-6 py-16">

        {/* Header */}
        <div className="mb-10">
          <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700 uppercase tracking-wide">
            For Providers
          </span>
          <h1 className="mt-3 text-3xl font-bold text-gray-900">
            API を LemonCake に登録する
          </h1>
          <p className="mt-3 text-gray-600 leading-relaxed">
            あなたの API を AI エージェントが直接 USDC で支払えるようにします。
            Stripe の 60 倍安い手数料。USDC は直接あなたのウォレットに届きます。
          </p>
        </div>

        {/* Value props */}
        <div className="mb-8 grid grid-cols-3 gap-3 text-center text-sm">
          {[
            { icon: "💰", label: "月 1,000 call 無料", sub: "超過分 $0.005/call" },
            { icon: "⚡", label: "即時着金", sub: "USDC、chargebackなし" },
            { icon: "🌐", label: "海外摩擦ゼロ", sub: "クレカ不要・JPY不要" },
          ].map((v) => (
            <div key={v.label} className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-2xl">{v.icon}</div>
              <div className="mt-1 font-bold text-gray-800">{v.label}</div>
              <div className="mt-0.5 text-xs text-gray-500">{v.sub}</div>
            </div>
          ))}
        </div>

        {!result ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm space-y-5"
          >
            <h2 className="text-lg font-bold text-gray-900">登録フォーム</h2>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                会社名 / 個人名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Evid AI"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                メールアドレス <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                USDC 受取ウォレット（Base チェーン）<span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={baseWallet}
                onChange={(e) => setBaseWallet(e.target.value)}
                placeholder="0xAbCd..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-amber-500 focus:outline-none"
              />
              <p className="mt-1 text-xs text-gray-500">
                Base Mainnet 上のウォレット。MetaMask / Coinbase Wallet などで取得できます。
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                API エンドポイント URL（任意）
              </label>
              <input
                type="url"
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                1 call あたりの価格（USDC）
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  max="1"
                  value={pricePerCall}
                  onChange={(e) => setPricePerCall(e.target.value)}
                  className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
                />
                <span className="text-sm text-gray-600">USDC / call</span>
                <span className="text-xs text-gray-400">（Stripe 比 60× 安）</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                最低 $0.001。月 1,000 call の無料枠を超えた分のみ課金。
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                🇯🇵 インボイス制度（任意）
              </p>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  適格請求書発行事業者登録番号
                </label>
                <input
                  type="text"
                  value={registrationNumber}
                  onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                  placeholder="T1234567890123"
                  pattern="T\d{13}"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:border-amber-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  T + 13桁。
                  <a href="https://www.invoice-kohyo.nta.go.jp/" target="_blank" rel="noopener" className="underline text-amber-700">国税庁公表サイト</a>
                  で確認できます。
                </p>
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoIssue}
                  onChange={(e) => setAutoIssue(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-xs text-gray-700 leading-relaxed">
                  毎月末に前月分のインボイスを自動発行する
                  <span className="text-gray-400 ml-1">（Pro プラン機能のプレビュー）</span>
                </span>
              </label>
            </div>

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "登録中…" : "登録する → serviceId を発行"}
            </button>
          </form>
        ) : (
          /* 登録完了 */
          <div className="rounded-2xl border border-emerald-300 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">🎉</span>
              <div>
                <h2 className="text-xl font-bold text-emerald-800">登録完了</h2>
                <p className="text-sm text-gray-600">{result.name} — {result.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* serviceId */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">
                  SERVICE ID（MCP 設定に貼る）
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all font-mono text-sm text-gray-800">
                    {result.id}
                  </code>
                  <button
                    onClick={() => copy(result.id, "serviceId")}
                    className="shrink-0 rounded-full bg-gray-900 px-3 py-1 text-xs font-bold text-white hover:bg-gray-800"
                  >
                    {copiedField === "serviceId" ? "✓" : "コピー"}
                  </button>
                </div>
              </div>

              {/* apiKey */}
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700 mb-1">
                  API KEY（秘密にしてください）
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all font-mono text-sm text-gray-800">
                    {result.apiKey}
                  </code>
                  <button
                    onClick={() => copy(result.apiKey, "apiKey")}
                    className="shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-bold text-white hover:bg-amber-600"
                  >
                    {copiedField === "apiKey" ? "✓" : "コピー"}
                  </button>
                </div>
              </div>

              {/* 料金設定サマリー */}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <p className="font-bold mb-2">料金設定</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>月間無料枠</span>
                    <span className="font-mono">{result.freeCallsPerMonth.toLocaleString()} call</span>
                  </div>
                  <div className="flex justify-between">
                    <span>超過単価</span>
                    <span className="font-mono">${result.pricePerCallUsdc} / call</span>
                  </div>
                  <div className="flex justify-between">
                    <span>USDC 受取ウォレット</span>
                    <span className="font-mono">{result.baseWalletAddress.slice(0,6)}…{result.baseWalletAddress.slice(-4)}</span>
                  </div>
                </div>
              </div>

              {/* 次のステップ */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                <p className="font-bold text-gray-800 mb-2">次のステップ</p>
                <ol className="list-decimal list-inside space-y-1 text-xs text-gray-600">
                  <li>
                    MCP サーバーの <code className="bg-gray-100 px-1 rounded">LEMON_CAKE_SERVICE_ID</code> に SERVICE ID をセット
                  </li>
                  <li>
                    課金呼び出し: <code className="bg-gray-100 px-1 rounded">POST /api/charges/permit</code> にユーザーの permit を渡す
                  </li>
                  <li>
                    月次メータリング確認: <code className="bg-gray-100 px-1 rounded">GET /api/charges/permit/quota</code>
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        <p className="mt-6 text-xs text-gray-500">
          ※ USDC はユーザーのウォレット → あなたのウォレットへ直接転送されます。
          LemonCake は決済経路に介在しません。
          詳細: <a href="/security" className="underline hover:text-amber-700">/security</a>
        </p>
      </div>
    </main>
  );
}
