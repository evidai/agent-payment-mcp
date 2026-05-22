"use client";

/**
 * /sellers — Provider 登録 (v3 UX rewrite)
 *
 * 改善点:
 *   - 3 ステップウィザード（Identity → Wallet → Pricing → Done）
 *   - 価格はスライダー UI（USDC 小数点入力を排除）
 *   - 各ステップで「あなたが得るもの」を可視化（収益シミュレーター）
 *   - 成功画面はカード式 + 1 クリックコピー + MCP 設定即時生成
 *   - レスポンシブ、キー操作可
 */

import { useMemo, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ??
  "https://skillful-blessing-production.up.railway.app";

interface RegisterResult {
  id:                string;
  apiKey:            string;
  name:              string;
  email:             string;
  baseWalletAddress: string;
  pricePerCallUsdc:  string;
  freeCallsPerMonth: number;
}

type Step = "intro" | "identity" | "wallet" | "pricing" | "tax" | "review" | "done";

const STEP_ORDER: Step[] = ["identity", "wallet", "pricing", "tax", "review"];

// price slider の刻み（USDC）
const PRICE_PRESETS = [
  { value: "0.001",  label: "$0.001",  hint: "x402 標準" },
  { value: "0.003",  label: "$0.003",  hint: "" },
  { value: "0.005",  label: "$0.005",  hint: "推奨" },
  { value: "0.01",   label: "$0.01",   hint: "" },
  { value: "0.05",   label: "$0.05",   hint: "高付加価値" },
  { value: "0.10",   label: "$0.10",   hint: "プレミアム" },
];

export default function SellersPage() {
  // ── form state ───────────────────────────────────────────────
  const [step, setStep]                   = useState<Step>("intro");
  const [name, setName]                   = useState("");
  const [email, setEmail]                 = useState("");
  const [baseWallet, setBaseWallet]       = useState("");
  const [apiEndpoint, setApiEndpoint]     = useState("");
  const [pricePerCall, setPricePerCall]   = useState("0.005");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [autoIssue, setAutoIssue]         = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [result, setResult]               = useState<RegisterResult | null>(null);
  const [copiedField, setCopiedField]     = useState<string | null>(null);
  const [secretShown, setSecretShown]     = useState(false);

  // ── validation per step ──────────────────────────────────────
  const canAdvance = useMemo<Record<Step, boolean>>(() => ({
    intro:    true,
    identity: name.trim().length >= 1 && /\S+@\S+\.\S+/.test(email),
    wallet:   /^0x[a-fA-F0-9]{40}$/.test(baseWallet),
    pricing:  parseFloat(pricePerCall) >= 0.001,
    tax:      true,
    review:   true,
    done:     true,
  }), [name, email, baseWallet, pricePerCall]);

  // 月間想定収益シミュレーター
  const revenueSim = useMemo(() => {
    const price = parseFloat(pricePerCall);
    const tiers = [1_000, 10_000, 100_000];
    return tiers.map(calls => {
      // Provider が受け取る額（free quota 1000 は LemonCake が吸収）
      const billable = Math.max(0, calls - 1000);
      const usd = billable * price;
      return { calls, usd: usd.toFixed(2), jpy: Math.round(usd * 150).toLocaleString() };
    });
  }, [pricePerCall]);

  async function handleSubmit() {
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
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function nextStep() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx === -1) {  // from intro
      setStep("identity");
      return;
    }
    if (idx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[idx + 1]!);
    } else {
      handleSubmit();
    }
  }
  function prevStep() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]!);
    else setStep("intro");
  }

  async function copy(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  const mcpConfig = result ? JSON.stringify({
    mcpServers: {
      [name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "my-api"]: {
        command: "npx",
        args: ["-y", "agent-payment-mcp"],
        env: {
          LEMON_CAKE_PERMIT:      "<paste permit from /start/v2>",
          LEMON_CAKE_SERVICE_ID:  result.id,
        },
      },
    },
  }, null, 2) : "";

  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">

        {/* ── INTRO ──────────────────────────────────────────── */}
        {step === "intro" && (
          <>
            {/* Hero */}
            <div className="text-center">
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
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: "💰",
                  title: "USDC 直接着金",
                  desc: "クレジットカード会社を経由せず、あなたのウォレットに即時。chargeback 不可。",
                },
                {
                  icon: "⚡",
                  title: "$0.001 から",
                  desc: "1 リクエスト数円から課金可能。Stripe の最低 ¥45 / 件と比較して 60 倍安い。",
                },
                {
                  icon: "🌏",
                  title: "海外摩擦ゼロ",
                  desc: "クレカ使えない国でも USDC で OK。JP/US/EU/UK/SG/CA/CH 規制グリーン。",
                },
              ].map((v) => (
                <div key={v.title} className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="text-3xl">{v.icon}</div>
                  <div className="mt-3 font-bold text-gray-900">{v.title}</div>
                  <p className="mt-1.5 text-xs text-gray-500 leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>

            {/* Comparison strip */}
            <div className="mt-10 rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Stripe との比較</p>
              </div>
              <div className="grid grid-cols-3 divide-x divide-gray-100">
                <div className="p-5 text-center">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">最低手数料</p>
                  <p className="mt-2 text-sm text-gray-400 line-through font-mono">¥45/件</p>
                  <p className="text-xl font-bold text-amber-600 font-mono">$0.001 (¥0.15)</p>
                </div>
                <div className="p-5 text-center">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">着金まで</p>
                  <p className="mt-2 text-sm text-gray-400 line-through">2–7 日</p>
                  <p className="text-xl font-bold text-amber-600">2 秒</p>
                </div>
                <div className="p-5 text-center">
                  <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">chargeback</p>
                  <p className="mt-2 text-sm text-gray-400 line-through">数ヶ月</p>
                  <p className="text-xl font-bold text-amber-600">不可</p>
                </div>
              </div>
            </div>

            {/* Plan teaser */}
            <div className="mt-10">
              <p className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">プラン</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { name: "Free", price: "¥0", calls: "1,000 call/月", color: "border-gray-200" },
                  { name: "Pro",      price: "¥4,980", calls: "10,000 call/月 + freee 仕訳 + 適格請求書", color: "border-amber-300 bg-amber-50/40" },
                  { name: "Business", price: "¥14,800", calls: "100,000 + JPY オフランプ + SLA", color: "border-gray-200" },
                ].map(p => (
                  <div key={p.name} className={`rounded-xl border-2 ${p.color} p-4`}>
                    <p className="font-bold text-gray-900">{p.name}</p>
                    <p className="mt-1 text-xl font-bold text-gray-900 font-mono">{p.price}<span className="text-[10px] font-normal text-gray-500">/月</span></p>
                    <p className="mt-1.5 text-[11px] text-gray-500 leading-relaxed">{p.calls}</p>
                  </div>
                ))}
              </div>
              <p className="text-center text-[11px] text-gray-400 mt-3">
                今は無料の Free プランで登録 → 後でアップグレード可能
              </p>
            </div>

            <button
              onClick={() => setStep("identity")}
              className="mt-10 w-full sm:w-auto sm:mx-auto sm:block rounded-full bg-gray-900 px-8 py-4 text-base font-bold text-white hover:bg-gray-800 transition-colors"
            >
              1 分で登録する →
            </button>
            <p className="mt-3 text-center text-[11px] text-gray-400">
              KYC / 法人登記 / 法人口座は不要。Base ウォレットだけあれば OK。
            </p>
          </>
        )}

        {/* ── WIZARD ─────────────────────────────────────────── */}
        {STEP_ORDER.includes(step) && (
          <>
            {/* progress */}
            <div className="mb-8">
              <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                <span>Step {STEP_ORDER.indexOf(step) + 1} / {STEP_ORDER.length}</span>
                <span className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <span
                    className="block h-full bg-amber-500 transition-all duration-300"
                    style={{ width: `${((STEP_ORDER.indexOf(step) + 1) / STEP_ORDER.length) * 100}%` }}
                  />
                </span>
              </div>
            </div>

            {/* identity */}
            {step === "identity" && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-gray-900">あなたについて教えてください</h2>
                <p className="mt-2 text-sm text-gray-500">2 つだけ。あとで変更できます。</p>
                <div className="mt-7 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">会社名 / 個人名</label>
                    <input
                      type="text"
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Evid AI / 山田太郎"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">メールアドレス</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="contact@example.com"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
                    />
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      決済完了通知・インボイス発行のみに使用。マーケティング配信なし。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* wallet */}
            {step === "wallet" && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-gray-900">USDC の受取先</h2>
                <p className="mt-2 text-sm text-gray-500">
                  Base チェーン上のあなたのウォレットアドレス。<strong className="text-gray-700">LemonCake は USDC を一切預かりません</strong>。
                </p>
                <div className="mt-7 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">Base ウォレットアドレス</label>
                    <input
                      type="text"
                      autoFocus
                      value={baseWallet}
                      onChange={(e) => setBaseWallet(e.target.value)}
                      placeholder="0xAbCd1234..."
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-mono focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
                    />
                    <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed">
                      MetaMask / Coinbase Wallet / Rabby などで取得。
                      Base ネットワークが追加されていない場合は{" "}
                      <a href="https://chainlist.org/chain/8453" target="_blank" rel="noopener" className="underline text-amber-700">こちら</a>
                      から。
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">
                      API エンドポイント URL <span className="text-gray-400 font-normal text-xs ml-1">（任意）</span>
                    </label>
                    <input
                      type="url"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      placeholder="https://api.example.com"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
                    />
                    <p className="mt-1.5 text-[11px] text-gray-400">後で `/settings` から追加してもOK</p>
                  </div>
                </div>
              </div>
            )}

            {/* pricing */}
            {step === "pricing" && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-gray-900">1 リクエストあたりの価格</h2>
                <p className="mt-2 text-sm text-gray-500">
                  あとで変更可能。<strong className="text-gray-700">月 1,000 call は無料</strong>（あなたではなく LemonCake が負担）。
                </p>

                {/* preset chips */}
                <div className="mt-7">
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {PRICE_PRESETS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPricePerCall(p.value)}
                        className={`rounded-xl border-2 p-2.5 text-center transition-all ${
                          pricePerCall === p.value
                            ? "border-amber-500 bg-amber-50 shadow-sm"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <p className={`text-sm font-bold ${pricePerCall === p.value ? "text-amber-700" : "text-gray-900"}`}>
                          {p.label}
                        </p>
                        {p.hint && (
                          <p className="mt-0.5 text-[9px] text-gray-500 font-medium uppercase tracking-wider">
                            {p.hint}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* custom */}
                  <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                    <span>カスタム:</span>
                    <input
                      type="number"
                      step="0.001"
                      min="0.001"
                      max="1"
                      value={pricePerCall}
                      onChange={(e) => setPricePerCall(e.target.value)}
                      className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <span>USDC / call</span>
                  </div>
                </div>

                {/* revenue simulator */}
                <div className="mt-8 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-5">
                  <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">あなたの月間想定収益</p>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {revenueSim.map(r => (
                      <div key={r.calls}>
                        <p className="text-[10px] text-gray-500">{r.calls.toLocaleString()} call/月</p>
                        <p className="mt-0.5 text-xl font-bold text-gray-900 font-mono">${r.usd}</p>
                        <p className="text-[10px] text-gray-400">≈ ¥{r.jpy}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-gray-500 leading-relaxed">
                    ※ 最初の 1,000 call は LemonCake 負担。USDC は受取ウォレットに直接着金。
                  </p>
                </div>
              </div>
            )}

            {/* tax / invoice */}
            {step === "tax" && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-gray-900">
                  日本のインボイス制度 <span className="text-base text-gray-400 font-normal ml-2">（任意）</span>
                </h2>
                <p className="mt-2 text-sm text-gray-500">
                  日本の事業者の場合は登録番号を入れておくと、自動で適格請求書が発行できます。海外の方はスキップで OK。
                </p>

                <div className="mt-7 space-y-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-1.5">
                      適格請求書発行事業者登録番号
                    </label>
                    <input
                      type="text"
                      value={registrationNumber}
                      onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                      placeholder="T1234567890123"
                      pattern="T\d{13}"
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-mono focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
                    />
                    <p className="mt-1.5 text-[11px] text-gray-400">
                      T + 13桁。
                      <a href="https://www.invoice-kohyo.nta.go.jp/" target="_blank" rel="noopener" className="underline text-amber-700">国税庁公表サイト</a>
                      で確認可能
                    </p>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
                    <input
                      type="checkbox"
                      checked={autoIssue}
                      onChange={(e) => setAutoIssue(e.target.checked)}
                      className="mt-0.5 w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900">毎月末に自動でインボイスを発行する</p>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        Pro プラン以上の機能。前月分の課金合計を集計し、PDF で生成 + メール送信。
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* review */}
            {step === "review" && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
                <h2 className="text-2xl font-bold text-gray-900">確認</h2>
                <p className="mt-2 text-sm text-gray-500">登録ボタンを押すと、serviceId と API key が即時発行されます。</p>

                <div className="mt-7 space-y-3 text-sm">
                  {[
                    { label: "名前 / 会社名",    value: name },
                    { label: "メールアドレス",  value: email },
                    { label: "受取ウォレット",  value: baseWallet, mono: true },
                    { label: "API エンドポイント", value: apiEndpoint || "(未設定)" },
                    { label: "単価",            value: `$${pricePerCall} / call`, mono: true },
                    { label: "登録番号",        value: registrationNumber || "(未設定)", mono: true },
                    { label: "自動インボイス",  value: autoIssue ? "ON" : "OFF" },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-gray-500 text-xs">{row.label}</span>
                      <span className={`text-gray-900 ${row.mono ? "font-mono text-xs" : ""}`}>{row.value || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                {error}
              </div>
            )}

            {/* nav buttons */}
            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={prevStep}
                className="text-sm font-bold text-gray-500 hover:text-gray-900 transition px-2 py-2"
              >
                ← 戻る
              </button>
              <button
                type="button"
                onClick={nextStep}
                disabled={!canAdvance[step] || loading}
                className="rounded-full bg-gray-900 px-8 py-3.5 text-sm font-bold text-white hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {loading
                  ? "登録中…"
                  : step === "review"
                    ? "登録する → serviceId 発行"
                    : "次へ →"}
              </button>
            </div>
          </>
        )}

        {/* ── DONE ───────────────────────────────────────────── */}
        {step === "done" && result && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h1 className="mt-5 text-3xl font-bold text-gray-900">登録完了 🎉</h1>
              <p className="mt-2 text-gray-500">{result.name} さんの API がマーケットに掲載されました</p>
            </div>

            {/* SERVICE ID */}
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Service ID</p>
                <button
                  onClick={() => copy(result.id, "serviceId")}
                  className="text-xs font-bold text-amber-700 hover:text-amber-900 transition"
                >
                  {copiedField === "serviceId" ? "✓ コピー済み" : "コピー"}
                </button>
              </div>
              <code className="block break-all font-mono text-sm text-gray-800 select-all">
                {result.id}
              </code>
              <p className="mt-2 text-[11px] text-amber-700">
                MCP 設定 / ダッシュボードで使用。<strong>公開して OK</strong>（apiKey とは別物）。
              </p>
            </div>

            {/* API KEY */}
            <div className="mt-3 rounded-2xl border-2 border-red-300 bg-red-50/40 p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-red-700">API Key（秘密）</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setSecretShown(!secretShown)}
                    className="text-xs font-bold text-red-700 hover:text-red-900 transition"
                  >
                    {secretShown ? "隠す" : "表示"}
                  </button>
                  <button
                    onClick={() => copy(result.apiKey, "apiKey")}
                    className="text-xs font-bold text-red-700 hover:text-red-900 transition"
                  >
                    {copiedField === "apiKey" ? "✓ コピー済み" : "コピー"}
                  </button>
                </div>
              </div>
              <code className="block break-all font-mono text-sm text-gray-800 select-all">
                {secretShown ? result.apiKey : "•".repeat(result.apiKey.length)}
              </code>
              <p className="mt-2 text-[11px] text-red-700">
                <strong>誰にも共有しないでください</strong>。再表示できません。安全な場所に保管。
              </p>
            </div>

            {/* MCP config */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Claude / Cursor / Cline 設定（コピペ用）
                </p>
                <button
                  onClick={() => copy(mcpConfig, "mcpConfig")}
                  className="text-xs font-bold text-gray-700 hover:text-gray-900 transition"
                >
                  {copiedField === "mcpConfig" ? "✓ コピー済み" : "コピー"}
                </button>
              </div>
              <pre className="rounded-xl bg-gray-950 p-4 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">{mcpConfig}</pre>
            </div>

            {/* Summary */}
            <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">プラン設定</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="text-[10px] text-gray-400">月間無料枠</p>
                  <p className="font-bold text-gray-900 font-mono">{result.freeCallsPerMonth.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">超過単価</p>
                  <p className="font-bold text-gray-900 font-mono">${result.pricePerCallUsdc}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400">受取ウォレット</p>
                  <p className="font-bold text-gray-900 font-mono text-xs">{result.baseWalletAddress.slice(0,6)}…{result.baseWalletAddress.slice(-4)}</p>
                </div>
              </div>
            </div>

            {/* Next steps */}
            <div className="mt-8 rounded-2xl bg-gradient-to-br from-gray-900 to-gray-800 p-6 text-white">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-300">次にやること</p>
              <ol className="mt-3 space-y-2 text-sm">
                <li className="flex items-start gap-2"><span className="text-amber-300 font-bold">1.</span><span>上の MCP 設定を <code className="px-1 bg-white/10 rounded text-xs">claude_desktop_config.json</code> に貼る</span></li>
                <li className="flex items-start gap-2"><span className="text-amber-300 font-bold">2.</span><span><strong>Pro プラン</strong>にアップグレードすると freee 自動仕訳 + 適格請求書が解禁（¥4,980/月）</span></li>
                <li className="flex items-start gap-2"><span className="text-amber-300 font-bold">3.</span><span>SDK で課金を埋め込むなら <code className="px-1 bg-white/10 rounded text-xs">@lemon-cake/mcp-sdk</code></span></li>
              </ol>
              <div className="mt-5 flex flex-wrap gap-2">
                <a href="/" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-gray-900 hover:bg-gray-100 transition">
                  ダッシュボードへ →
                </a>
                <a href="/" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-xs font-bold text-white hover:bg-white/10 transition">
                  Pro にアップグレード
                </a>
              </div>
            </div>
          </>
        )}

        {/* footer */}
        <p className="mt-12 text-center text-xs text-gray-400">
          USDC はあなたのウォレットに直接届きます。LemonCake は決済経路に介在しません。
          <br />
          詳細: <a href="/security" className="underline hover:text-amber-700">/security</a>
        </p>
      </div>
    </main>
  );
}
