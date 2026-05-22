"use client";

/**
 * ProviderRegistrationWizard — 共有可能な provider 登録 wizard。
 *
 * /sellers 直アクセス時の full-page 版と、ダッシュボード内（PublishPage）
 * の embedded 版で同じコンポーネントを使う。
 *
 * Props:
 *   - variant: "page" (full hero + 3-col valueプロップ) | "embed" (簡素)
 *   - onSuccess?: 登録完了時のコールバック（dashboard 側で providerV2Id 反映）
 *   - heroless?: true で hero を完全に隠す
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

type Step = "identity" | "wallet" | "pricing" | "tax" | "review";

const STEP_ORDER: Step[] = ["identity", "wallet", "pricing", "tax", "review"];

const PRICE_PRESETS = [
  { value: "0.001", label: "$0.001", hint: "x402 標準" },
  { value: "0.003", label: "$0.003", hint: "" },
  { value: "0.005", label: "$0.005", hint: "推奨" },
  { value: "0.01",  label: "$0.01",  hint: "" },
  { value: "0.05",  label: "$0.05",  hint: "高付加価値" },
  { value: "0.10",  label: "$0.10",  hint: "プレミアム" },
];

export interface ProviderRegistrationWizardProps {
  variant?:  "page" | "embed";
  onSuccess?: (result: RegisterResult) => void;
}

export function ProviderRegistrationWizard({
  variant = "page",
  onSuccess,
}: ProviderRegistrationWizardProps) {
  const [step, setStep]                   = useState<Step>("identity");
  // companyName (任意) と personalName (必須) を分離。submit 時に "Company / Person"
  // 形で 1 フィールドに結合してバックエンドの providers/v2.name に送る。
  const [companyName, setCompanyName]     = useState("");
  const [personalName, setPersonalName]   = useState("");
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

  // バックエンドへ送る統合された name フィールド
  const combinedName = useMemo(() => {
    const c = companyName.trim();
    const p = personalName.trim();
    if (c && p) return `${c} / ${p}`;
    return c || p;
  }, [companyName, personalName]);

  const canAdvance = useMemo<Record<Step, boolean>>(() => ({
    identity: personalName.trim().length >= 1 && /\S+@\S+\.\S+/.test(email),
    wallet:   /^0x[a-fA-F0-9]{40}$/.test(baseWallet),
    pricing:  parseFloat(pricePerCall) >= 0.001,
    tax:      true,
    review:   true,
  }), [personalName, email, baseWallet, pricePerCall]);

  const revenueSim = useMemo(() => {
    const price = parseFloat(pricePerCall);
    const tiers = [1_000, 10_000, 100_000];
    return tiers.map(calls => {
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
          name: combinedName,
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
      // 即座に dashboard 側にも反映
      try { localStorage.setItem("lemon_provider_v2_id", data.id); } catch { /* */ }
      onSuccess?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function nextStep() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[idx + 1]!);
    } else {
      handleSubmit();
    }
  }
  function prevStep() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]!);
  }

  async function copy(text: string, field: string) {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  }

  const mcpConfig = result ? JSON.stringify({
    mcpServers: {
      [combinedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 24) || "my-api"]: {
        command: "npx",
        args: ["-y", "agent-payment-mcp"],
        env: {
          LEMON_CAKE_PERMIT:      "<paste permit from /start/v2>",
          LEMON_CAKE_SERVICE_ID:  result.id,
        },
      },
    },
  }, null, 2) : "";

  const containerCls = variant === "embed"
    ? "flex flex-col gap-5"
    : "flex flex-col gap-5";

  // ─────────────────────────────────────────────────────────────
  // SUCCESS VIEW
  // ─────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className={containerCls}>
        <div className="text-center mb-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100">
            <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">登録完了 🎉</h2>
          <p className="mt-1 text-sm text-gray-500">{result.name} の API がマーケットに掲載されました</p>
        </div>

        {/* SERVICE ID */}
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Service ID</p>
            <button onClick={() => copy(result.id, "serviceId")} className="text-xs font-bold text-amber-700 hover:text-amber-900 transition">
              {copiedField === "serviceId" ? "✓ コピー済み" : "コピー"}
            </button>
          </div>
          <code className="block break-all font-mono text-sm text-gray-800 select-all">{result.id}</code>
          <p className="mt-2 text-[11px] text-amber-700">MCP 設定 / ダッシュボードで使用。<strong>公開して OK</strong>。</p>
        </div>

        {/* API KEY */}
        <div className="rounded-2xl border-2 border-red-300 bg-red-50/40 p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-red-700">API Key（秘密）</p>
            <div className="flex gap-3">
              <button onClick={() => setSecretShown(!secretShown)} className="text-xs font-bold text-red-700 hover:text-red-900">
                {secretShown ? "隠す" : "表示"}
              </button>
              <button onClick={() => copy(result.apiKey, "apiKey")} className="text-xs font-bold text-red-700 hover:text-red-900">
                {copiedField === "apiKey" ? "✓ コピー済み" : "コピー"}
              </button>
            </div>
          </div>
          <code className="block break-all font-mono text-sm text-gray-800 select-all">
            {secretShown ? result.apiKey : "•".repeat(Math.min(40, result.apiKey.length))}
          </code>
          <p className="mt-2 text-[11px] text-red-700"><strong>誰にも共有しないでください</strong>。再表示できません。</p>
        </div>

        {/* MCP config */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Claude / Cursor / Cline 設定</p>
            <button onClick={() => copy(mcpConfig, "mcpConfig")} className="text-xs font-bold text-gray-700 hover:text-gray-900">
              {copiedField === "mcpConfig" ? "✓ コピー済み" : "コピー"}
            </button>
          </div>
          <pre className="rounded-xl bg-gray-950 p-4 text-xs font-mono text-gray-300 overflow-x-auto leading-relaxed">{mcpConfig}</pre>
        </div>

        {variant === "embed" ? (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="self-start rounded-full bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-gray-800 transition"
          >
            ダッシュボードを更新 →
          </button>
        ) : (
          <a href="/" className="self-start rounded-full bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-gray-800 transition">
            ダッシュボードへ →
          </a>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // WIZARD
  // ─────────────────────────────────────────────────────────────
  return (
    <div className={containerCls}>
      {/* progress */}
      <div className="mb-2">
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
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900">あなたについて</h3>
          <p className="mt-1 text-sm text-gray-500">あとで変更できます。</p>

          <div className="mt-6 space-y-5">
            {/* 会社名 と 氏名 を 2 カラムで横並びに（モバイルは縦に積む） */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1.5">
                  会社名
                  <span className="text-gray-400 font-normal text-xs ml-1.5">（任意）</span>
                </label>
                <input
                  type="text" autoFocus value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="例: Acme Inc."
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
                />
                <p className="mt-1.5 text-[11px] text-gray-400">個人開発者は空欄で OK</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-800 mb-1.5">
                  氏名
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="text" value={personalName}
                  onChange={(e) => setPersonalName(e.target.value)}
                  placeholder="例: Taro Tanaka"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
                />
                <p className="mt-1.5 text-[11px] text-gray-400">必須</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">
                メールアドレス
                <span className="text-red-500 ml-1">*</span>
              </label>
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@example.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
              />
              <p className="mt-1.5 text-[11px] text-gray-400">決済完了通知・インボイス発行のみに使用</p>
            </div>
          </div>
        </div>
      )}

      {/* wallet */}
      {step === "wallet" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900">USDC の受取先</h3>
          <p className="mt-1 text-sm text-gray-500">
            Base チェーン上のあなたのウォレット。<strong className="text-gray-700">LemonCake は USDC を一切預かりません</strong>。
          </p>
          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">Base ウォレットアドレス</label>
              <input
                type="text" autoFocus value={baseWallet}
                onChange={(e) => setBaseWallet(e.target.value)}
                placeholder="0xAbCd1234..."
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-mono focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
              />
              <p className="mt-1.5 text-[11px] text-gray-400 leading-relaxed">
                MetaMask / Coinbase Wallet / Rabby などで取得。
                Base がない場合は <a href="https://chainlist.org/chain/8453" target="_blank" rel="noopener" className="underline text-amber-700">chainlist</a> から追加。
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">
                API エンドポイント URL <span className="text-gray-400 font-normal text-xs ml-1">（任意）</span>
              </label>
              <input
                type="url" value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://api.example.com"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
              />
            </div>
          </div>
        </div>
      )}

      {/* pricing */}
      {step === "pricing" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900">1 リクエストあたりの価格</h3>
          <p className="mt-1 text-sm text-gray-500">
            あとで変更可能。<strong className="text-gray-700">月 1,000 call は無料</strong>。
          </p>

          <div className="mt-6">
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
                  <p className={`text-sm font-bold ${pricePerCall === p.value ? "text-amber-700" : "text-gray-900"}`}>{p.label}</p>
                  {p.hint && <p className="mt-0.5 text-[9px] text-gray-500 font-medium uppercase tracking-wider">{p.hint}</p>}
                </button>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
              <span>カスタム:</span>
              <input
                type="number" step="0.001" min="0.001" max="1"
                value={pricePerCall}
                onChange={(e) => setPricePerCall(e.target.value)}
                className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm font-mono focus:border-amber-500 focus:outline-none"
              />
              <span>USDC / call</span>
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 p-5">
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">月間想定収益</p>
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

      {/* tax */}
      {step === "tax" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900">
            日本のインボイス制度 <span className="text-sm text-gray-400 font-normal ml-2">（任意）</span>
          </h3>
          <p className="mt-1 text-sm text-gray-500">日本の事業者の場合は登録番号を入れておくと、自動で適格請求書が発行できます。海外の方はスキップで OK。</p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-800 mb-1.5">適格請求書発行事業者登録番号</label>
              <input
                type="text" value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value.toUpperCase())}
                placeholder="T1234567890123" pattern="T\d{13}"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base font-mono focus:border-amber-500 focus:outline-none focus:ring-4 focus:ring-amber-100 transition"
              />
              <p className="mt-1.5 text-[11px] text-gray-400">
                T + 13桁。<a href="https://www.invoice-kohyo.nta.go.jp/" target="_blank" rel="noopener" className="underline text-amber-700">国税庁公表サイト</a>で確認可能
              </p>
            </div>
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition">
              <input
                type="checkbox" checked={autoIssue}
                onChange={(e) => setAutoIssue(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
              />
              <div>
                <p className="text-sm font-bold text-gray-900">毎月末に自動でインボイスを発行する</p>
                <p className="mt-0.5 text-[11px] text-gray-500">Pro プラン以上の機能</p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* review */}
      {step === "review" && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="text-xl font-bold text-gray-900">確認</h3>
          <p className="mt-1 text-sm text-gray-500">登録ボタンを押すと、serviceId と API key が即時発行されます。</p>
          <div className="mt-6 space-y-2 text-sm">
            {[
              { label: "会社名",          value: companyName || "(個人)" },
              { label: "氏名",            value: personalName },
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
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
      )}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={prevStep}
          disabled={step === STEP_ORDER[0]}
          className="text-sm font-bold text-gray-500 hover:text-gray-900 transition px-2 py-2 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ← 戻る
        </button>
        <button
          type="button"
          onClick={nextStep}
          disabled={!canAdvance[step] || loading}
          className="rounded-full bg-gray-900 px-8 py-3 text-sm font-bold text-white hover:bg-gray-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading
            ? "登録中…"
            : step === "review"
              ? "登録する → serviceId 発行"
              : "次へ →"}
        </button>
      </div>
    </div>
  );
}
