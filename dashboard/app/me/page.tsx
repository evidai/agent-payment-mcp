"use client";

/**
 * /me — Buyer ダッシュボード（非カストディ wallet 状態 + 課金履歴）
 *
 * 目的: permit 発行後の「使ってる感」を出す。USDC 残高 / 有効 permit /
 * 使った量 / 残り cap / 履歴を 1 ページで見せる。今までは Basescan に飛ぶか
 * MCP のログを見ないと自分の状態が分からなかった。
 *
 * データソース:
 *   - Wallet アドレス → Privy embedded wallet
 *   - USDC 残高       → Base RPC (viem)
 *   - 有効 permit     → USDC.allowance(owner, marketplaceSpender) を読む
 *                       オンチェーンに残高表示。deadline は localStorage に
 *                       /start/v2 で署名時に保存しておいた値を参照（後方互換
 *                       無い場合は "unknown" 表示）
 *   - 課金履歴        → GET /api/charges/permit/by-owner
 *
 * 非カストディ堅持:
 *   - 表示・revoke ボタンは Privy embedded wallet 経由でユーザ自身が署名
 *   - LemonCake サーバは仲介しない（履歴 API も on-chain 公開情報相当）
 */

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { usePrivy, useWallets, useFundWallet } from "@privy-io/react-auth";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  encodeFunctionData,
  type Address,
} from "viem";
import { base } from "viem/chains";
import { PRIVY_ENABLED } from "@/Providers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://skillful-blessing-production.up.railway.app";
const TRANSAK_API_KEY = process.env.NEXT_PUBLIC_TRANSAK_API_KEY ?? "";

/**
 * Transak buy widget URL → USDC on Base。
 *
 * Privy Funds の MoonPay Rails が JP 未対応 ("Coming soon to your region")
 * のため、JP 訪問者はこちらにフォールバックする。
 *
 * 重要な学び (2026-05-25): JPY → USDC on Base の組み合わせは Transak で
 * "fiat currency not supported" になる。`fiatCurrency` を強制せず、
 * Transak の geo 自動判定に任せる（JP IP なら JPY、それ以外なら USD/EUR）。
 */
function buildTransakBuyUrl(address: string): string {
  const url = new URL("https://global.transak.com/");
  url.searchParams.set("apiKey",                   TRANSAK_API_KEY);
  url.searchParams.set("defaultCryptoCurrency",    "USDC");
  url.searchParams.set("network",                  "base");        // 'network' (単数) が現行 API
  url.searchParams.set("walletAddress",            address);
  url.searchParams.set("disableWalletAddressForm", "true");
  url.searchParams.set("themeColor",               "F5C518");
  url.searchParams.set("productsAvailed",          "buy");
  url.searchParams.set("hideMenu",                 "true");
  // fiatCurrency / defaultFiatAmount は意図的に外す:
  //   - JP IP → Transak が自動で JPY を選択
  //   - 他    → USD / EUR 等が自動選択
  return url.toString();
}

/**
 * JP user 判定。優先順:
 *   1. lemon_locale cookie (LangSwitcher で明示設定)
 *   2. navigator.language が "ja-*" で始まる
 *   3. それ以外 = JP ではない扱い
 *
 * IP geo は Vercel edge でしか取れないので、最も信頼性高いのは cookie。
 * navigator.language は OS 言語設定なので、JP 在住 US 設定 user は漏れるが、
 * その場合 Privy Funds が（理論上）動くはずなので大きな問題ではない。
 */
function isJapanUser(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof document !== "undefined" && /lemon_locale=ja/.test(document.cookie)) return true;
  if (typeof navigator !== "undefined" && /^ja\b/.test(navigator.language ?? "")) return true;
  return false;
}

// Base USDC contract (FiatTokenV2_2)
const USDC_BASE: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// LemonCake marketplace spender (matches /start/v2)
const MARKETPLACE_SPENDER: Address = "0x23e0D435b62d8eABE2b239c461Ec6fb2E8B7E965";

// Minimal ERC-20 ABI（balanceOf + allowance + approve）
const ERC20_ABI = [
  {
    type: "function", name: "balanceOf", stateMutability: "view",
    inputs:  [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "allowance", stateMutability: "view",
    inputs:  [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function", name: "approve", stateMutability: "nonpayable",
    inputs:  [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

interface ChargeRow {
  id:          string;
  serviceId:   string;
  serviceName: string | null;
  amountUsdc:  string;
  status:      "PENDING" | "COMPLETED" | "FAILED";
  txHash:      string | null;
  createdAt:   string;
  completedAt: string | null;
}

interface ChargesResponse {
  ownerAddress: string;
  totalCount:   number;
  totalUsdc:    string;
  charges:      ChargeRow[];
}

// localStorage に保存している permit のメタ（/start/v2 署名時に書き込み想定）
interface PermitMeta {
  signedAt:  number;  // unix ms
  deadline:  number;  // unix s
  valueUsdc: string;  // 累計上限
  currency:  string;  // "USDC" 想定
}

const PUBLIC_CLIENT = createPublicClient({
  chain: base,
  transport: http(),
});

export default function MePage() {
  const privy = usePrivy();
  const { wallets } = useWallets();
  const isPrivyReady = PRIVY_ENABLED && privy.ready;
  const isLogged = isPrivyReady && privy.authenticated;
  const wallet = wallets[0];
  const address = wallet?.address as Address | undefined;

  // 再 fetch tick (useFundWallet の onUserExited から触りたいので state で)
  const [refetchTick, setRefetchTick] = useState(0);
  // Privy 2.x funding hook: Coinbase Pay / MoonPay を国判定で自動選択
  // ※ Privy ダッシュボードで funding providers ON にしないとモーダル出ない
  const { fundWallet } = useFundWallet({
    onUserExited: () => {
      // モーダル閉じた直後（着金完了してたら）残高 refresh
      setTimeout(() => setRefetchTick(t => t + 1), 2000);
    },
  });

  const [usdcBalance, setUsdcBalance] = useState<bigint | null>(null);
  const [allowance, setAllowance]     = useState<bigint | null>(null);
  const [charges, setCharges]         = useState<ChargesResponse | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [permitMeta, setPermitMeta]   = useState<PermitMeta | null>(null);
  const [revoking, setRevoking]       = useState(false);
  const [toast, setToast]             = useState<{msg: string; type: "info"|"error"} | null>(null);
  const [showJpGuide, setShowJpGuide] = useState(false);
  // helper: 旧 setToast(string) interface との後方互換のため、エラー判定の
  // ヒューリスティクスを内蔵。`not enabled` / `failed` / `エラー` 等を含めば error 扱い
  function pushToast(msg: string, type?: "info"|"error") {
    const t = type ?? (/not enabled|failed|error|エラー|失敗/i.test(msg) ? "error" : "info");
    setToast({ msg, type: t });
    setTimeout(() => setToast(null), 5000);
  }

  // on-chain + history 読み込み
  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true); setError(null);
    try {
      const [bal, allow, chargesRes] = await Promise.all([
        PUBLIC_CLIENT.readContract({
          address: USDC_BASE, abi: ERC20_ABI, functionName: "balanceOf", args: [address],
        }) as Promise<bigint>,
        PUBLIC_CLIENT.readContract({
          address: USDC_BASE, abi: ERC20_ABI, functionName: "allowance", args: [address, MARKETPLACE_SPENDER],
        }) as Promise<bigint>,
        fetch(`${API_URL}/api/charges/permit/by-owner?ownerAddress=${address.toLowerCase()}&limit=50`)
          .then(r => r.ok ? r.json() as Promise<ChargesResponse> : null),
      ]);
      setUsdcBalance(bal);
      setAllowance(allow);
      setCharges(chargesRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "読み込み失敗");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => { if (address) refresh(); }, [address, refresh, refetchTick]);

  // localStorage の permit メタを拾う
  useEffect(() => {
    if (typeof window === "undefined" || !address) return;
    try {
      const raw = localStorage.getItem(`lemon_permit_meta_${address.toLowerCase()}`);
      if (raw) setPermitMeta(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [address]);

  async function handleRevoke() {
    if (!wallet || !address || revoking) return;
    if (!confirm("permit を即時取消します。\n以降の AI 課金は全件拒否されます（USDC.approve(spender, 0) を送信）。\nよろしいですか？")) return;
    setRevoking(true);
    try {
      const provider = await wallet.getEthereumProvider();
      const walletClient = createWalletClient({
        chain: base,
        transport: custom(provider),
        account: address,
      });
      const data = encodeFunctionData({
        abi: ERC20_ABI, functionName: "approve",
        args: [MARKETPLACE_SPENDER, BigInt(0)],
      });
      const txHash = await walletClient.sendTransaction({
        to: USDC_BASE, data, account: address, chain: base,
      });
      pushToast(`取消 tx 送信: ${txHash.slice(0, 10)}…`, "info");
      // localStorage からも消す
      try { localStorage.removeItem(`lemon_permit_meta_${address.toLowerCase()}`); } catch {}
      setPermitMeta(null);
      // 1 秒後に再 fetch
      setTimeout(refresh, 3000);
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "取消失敗", "error");
    } finally {
      setRevoking(false);
      // toast の auto-dismiss は pushToast 内で行う
    }
  }

  // 状態派生
  const allowanceUsdc = useMemo(() => {
    if (allowance == null) return null;
    return Number(formatUnits(allowance, 6));
  }, [allowance]);

  const balanceUsdc = useMemo(() => {
    if (usdcBalance == null) return null;
    return Number(formatUnits(usdcBalance, 6));
  }, [usdcBalance]);

  const permitActive = allowance != null && allowance > BigInt(0);
  const expiresInDays = permitMeta ? Math.max(0, Math.ceil((permitMeta.deadline * 1000 - Date.now()) / 86400000)) : null;
  const totalChargedUsdc = charges ? Number(charges.totalUsdc) : 0;

  // 既存 buyer 救済: on-chain では allowance 有効だが localStorage にメタ無し
  // = 過去に v0.2.1 以前で署名した人。「詳細不明だが有効」状態を表示。
  const permitMetaMissing = permitActive && !permitMeta;

  // ─── レンダリング ─────────────────────────────────────────

  if (!isPrivyReady) {
    return <Loading msg="ウォレット接続中…" />;
  }
  if (!isLogged) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-2xl mb-3">🍋</p>
          <h1 className="text-xl font-bold text-gray-900">Buyer ダッシュボード</h1>
          <p className="mt-2 text-sm text-gray-500">
            permit 残高 / 課金履歴 / 取消 を見るには、permit を発行した Wallet で Google サインインしてください。
          </p>
          <button
            onClick={() => privy.login()}
            className="mt-6 w-full py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl transition"
          >
            Google でサインイン
          </button>
          <p className="mt-4 text-[11px] text-gray-400">
            まだ permit を発行していない方は <Link href="/start/v2" className="text-amber-700 underline">/start/v2</Link> から
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <div className="mx-auto max-w-4xl px-5 py-10 sm:py-14">
        {/* Header */}
        <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 uppercase tracking-wider">
              🍋 Buyer Dashboard
            </span>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900">あなたの財布</h1>
            <p className="mt-1 text-sm text-gray-500 font-mono break-all">{address}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={refresh}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? "更新中…" : "更新"}
            </button>
            <button
              onClick={() => privy.logout()}
              className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg border border-gray-200"
            >
              ログアウト
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {toast && (
          <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            toast.type === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}>{toast.msg}</div>
        )}

        {/* Top KPI: balance + allowance + 累計 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {/* USDC 残高 + チャージボタン同居 */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 text-emerald-900 p-4 flex flex-col">
            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-600">USDC 残高</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {balanceUsdc != null ? `$${balanceUsdc.toFixed(2)}` : "—"}
            </p>
            <p className="mt-1 text-[10px] text-gray-500">Base チェーン上</p>
            <button
              onClick={async () => {
                if (!address) return;
                // JP user: Alchemy Pay 経由 (JP × USDC × Base × Apple/Google Pay 対応の唯一の現実解)
                //   - server-side で HMAC-SHA256 signature 生成 → URL 受領
                //   - Alchemy Pay 未設定なら 404 → 手動ガイド (JpFundingGuide) に fallback
                if (isJapanUser()) {
                  try {
                    const res = await fetch(`${API_URL}/api/onramp/alchemy-pay/url`, {
                      method:  "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        walletAddress: address,
                        fiat:          "JPY",
                        fiatAmount:    "3000",
                        crypto:        "USDC",
                        network:       "BASE",
                      }),
                    });
                    if (res.status === 404) {
                      // Alchemy Pay credentials 未設定 → 手動ガイドに fallback
                      setShowJpGuide(true);
                      return;
                    }
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const data = await res.json() as { url: string };
                    window.open(data.url, "_blank", "noopener,noreferrer");
                    // user が戻った頃に残高 refresh
                    setTimeout(() => setRefetchTick(t => t + 1), 30000);
                  } catch (e) {
                    // network エラー等は手動ガイドに fallback (安全側)
                    console.warn("[onramp] alchemy-pay fetch failed, falling back to manual guide", e);
                    setShowJpGuide(true);
                  }
                  return;
                }
                // 海外 user は Privy Funds (Coinbase Pay / MoonPay Rails) 経由
                try {
                  await fundWallet(address, {
                    chain: { id: 8453 },   // Base
                    amount: "20",
                    asset: "USDC",
                    defaultFundingMethod: "card",
                    card: { preferredProvider: "moonpay" },
                  });
                } catch (e) {
                  const msg = e instanceof Error ? e.message : "入金フロー起動に失敗";
                  if (/not enabled|funding is not/i.test(msg)) {
                    pushToast("USDC 入金は準備中です。直接送金（Coinbase 取引所 → Base ネットワーク）で入金できます。", "info");
                  } else {
                    pushToast(msg, "error");
                  }
                }
              }}
              className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition disabled:opacity-50"
              disabled={!address}
            >
              + USDC を入金
            </button>
            {balanceUsdc != null && balanceUsdc < 5 && (
              <p className="mt-2 text-[10px] text-amber-700 leading-tight">
                ⚠️ 残高少なめ。$5+ あると数日分の API call まかなえる
              </p>
            )}
          </div>
          <KpiCard
            label="支払い権限 残量"
            value={allowanceUsdc != null ? `$${allowanceUsdc.toFixed(2)}` : "—"}
            sub={
              permitActive
                ? (expiresInDays != null
                    ? `あと ${expiresInDays} 日有効`
                    : permitMetaMissing
                      ? "有効（期限詳細は再署名で記録）"
                      : "有効")
                : "未発行 / 失効"
            }
            color={permitActive ? "amber" : "gray"}
          />
          <KpiCard
            label="累計課金額"
            value={`$${totalChargedUsdc.toFixed(2)}`}
            sub={`${charges?.totalCount ?? 0} 件の API 呼び出し`}
            color="violet"
          />
        </div>

        {/* Permit 状態 + 操作 */}
        <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-gray-900">支払い権限（permit）</h2>
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                AI エージェントがあなたの代わりに USDC で API 料金を払うための「権限」。
                ハードキャップを超えた支払いは USDC スマートコントラクト自体が拒否します。
                いつでも下のボタンで即時取消可能（ガス代 ~$0.01）。
              </p>

              {/* 期限詳細不明な既存 buyer 向け案内 */}
              {permitMetaMissing && (
                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 leading-relaxed">
                  ⚠️ オンチェーン上では権限が有効ですが、署名日時 / 有効期限の記録がこの端末に残っていません。
                  <Link href="/start/v2" className="ml-1 font-bold underline">再署名</Link>すると詳細が記録され、
                  期限切れ前の通知も届くようになります。
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                <div className="text-gray-500">状態</div>
                <div className="font-bold">
                  {permitActive
                    ? <span className="text-emerald-700">✓ 有効</span>
                    : <span className="text-gray-500">未発行 / 失効</span>}
                </div>
                <div className="text-gray-500">残り上限</div>
                <div className="font-mono">{allowanceUsdc != null ? `$${allowanceUsdc.toFixed(2)} USDC` : "—"}</div>
                {permitMeta && (
                  <>
                    <div className="text-gray-500">署名日時</div>
                    <div>{new Date(permitMeta.signedAt).toLocaleString("ja-JP")}</div>
                    <div className="text-gray-500">有効期限</div>
                    <div>{new Date(permitMeta.deadline * 1000).toLocaleString("ja-JP")}{expiresInDays != null && `（あと ${expiresInDays} 日）`}</div>
                  </>
                )}
                {permitMetaMissing && (
                  <>
                    <div className="text-gray-500">署名日時</div>
                    <div className="text-gray-400">— 記録なし</div>
                    <div className="text-gray-500">有効期限</div>
                    <div className="text-gray-400">— 記録なし（最大 90 日想定）</div>
                  </>
                )}
                <div className="text-gray-500">受取 spender</div>
                <div className="font-mono text-[10px] break-all">{MARKETPLACE_SPENDER}</div>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-shrink-0">
              {permitActive ? (
                <button
                  onClick={handleRevoke}
                  disabled={revoking}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg disabled:opacity-50"
                >
                  {revoking ? "送信中…" : "permit を即時取消"}
                </button>
              ) : (
                <Link
                  href="/start/v2"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-xs font-bold rounded-lg text-center"
                >
                  permit を発行 →
                </Link>
              )}
              <a
                href={`https://basescan.org/address/${address}`}
                target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg text-center"
              >
                Basescan で監査 ↗
              </a>
            </div>
          </div>
        </div>

        {/* Charges history */}
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">課金履歴</h2>
            <p className="text-[11px] text-gray-400">最大 50 件</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-2 text-left font-bold">日時</th>
                  <th className="px-4 py-2 text-left font-bold">サービス</th>
                  <th className="px-4 py-2 text-right font-bold">金額</th>
                  <th className="px-4 py-2 text-left font-bold">状態</th>
                  <th className="px-4 py-2 text-left font-bold">tx</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                {!charges || charges.charges.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    <div className="space-y-2">
                      <p className="text-gray-500">まだ課金履歴がありません。</p>
                      <p className="text-[11px] leading-relaxed">
                        次にやること：
                      </p>
                      <ol className="text-[11px] text-left max-w-xs mx-auto list-decimal pl-5 space-y-0.5 text-gray-500">
                        <li>USDC を入金（上の「+ USDC を入金」ボタン）</li>
                        <li>permit を発行（<Link href="/start/v2" className="text-amber-700 underline">/start/v2</Link>）</li>
                        <li>MCP 設定を Claude / Cursor に貼付（<Link href="/docs/quickstart" className="text-amber-700 underline">手順</Link>）</li>
                        <li>AI に「lemon を使って〜」と話しかける</li>
                      </ol>
                    </div>
                  </td></tr>
                ) : (
                  charges.charges.map(c => (
                    <tr key={c.id} className="border-t border-gray-100">
                      <td className="px-4 py-2.5 font-mono text-[10px] text-gray-500">{new Date(c.createdAt).toLocaleString("ja-JP")}</td>
                      <td className="px-4 py-2.5">
                        {c.serviceName ?? <span className="text-gray-400 font-mono">{c.serviceId.slice(0, 12)}…</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        ${Number(c.amountUsdc).toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.status === "COMPLETED" ? <Pill v="green" label="✓ 成功"/>
                          : c.status === "PENDING" ? <Pill v="amber" label="処理中"/>
                          : <Pill v="red" label="失敗"/>}
                      </td>
                      <td className="px-4 py-2.5">
                        {c.txHash ? (
                          <a
                            href={`https://basescan.org/tx/${c.txHash}`}
                            target="_blank" rel="noopener noreferrer"
                            className="text-amber-700 hover:underline font-mono text-[10px]"
                          >
                            {c.txHash.slice(0, 10)}…
                          </a>
                        ) : (
                          <span className="text-gray-300 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick links */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickLink href="/start/v2" label="permit を再発行 / 上限変更"   desc="期限切れや cap 変更したい時" icon="🎫" />
          <QuickLink href="/docs/quickstart" label="MCP 設定の貼り方"        desc="Claude / Cursor / Cline" icon="📚" />
          <QuickLink href="/sellers" label="Provider として API を売る"      desc="自分の API で USDC を稼ぐ" icon="🏪" />
        </div>

        <p className="mt-10 text-center text-[11px] text-gray-400">
          LemonCake はあなたの USDC を一切保管しません。
          全ての送金は <Link href="/security" className="underline">USDC スマートコントラクト</Link>が直接実行します。
        </p>
      </div>

      {/* JP user 向け入金ガイドモーダル */}
      {showJpGuide && address && (
        <JpFundingGuide address={address} onClose={() => setShowJpGuide(false)} />
      )}
    </main>
  );
}

// ─── 小物 ────────────────────────────────────────────────

function Loading({ msg }: { msg: string }) {
  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-sm text-gray-400">{msg}</p>
    </main>
  );
}

interface KpiCardProps {
  label: string; value: string; sub: string;
  color: "emerald" | "amber" | "violet" | "gray";
}
const KPI_CLS: Record<KpiCardProps["color"], string> = {
  emerald: "border-emerald-200 bg-emerald-50/40 text-emerald-900",
  amber:   "border-amber-200 bg-amber-50/40 text-amber-900",
  violet:  "border-violet-200 bg-violet-50/40 text-violet-900",
  gray:    "border-gray-200 bg-white text-gray-900",
};

function KpiCard({ label, value, sub, color }: KpiCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${KPI_CLS[color]}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-600">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[10px] text-gray-500">{sub}</p>
    </div>
  );
}

function Pill({ v, label }: { v: "green"|"amber"|"red"; label: string }) {
  const c = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red:   "bg-red-50 text-red-700 border-red-200",
  }[v];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${c}`}>{label}</span>;
}

function QuickLink({ href, label, desc, icon }: { href: string; label: string; desc: string; icon: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-amber-300 hover:bg-amber-50/30 transition"
    >
      <div className="text-2xl mb-1">{icon}</div>
      <p className="font-bold text-gray-900 text-sm group-hover:text-amber-700">{label}</p>
      <p className="mt-0.5 text-[10px] text-gray-500">{desc}</p>
    </Link>
  );
}

/**
 * JpFundingGuide — JP user 向け USDC 入金ガイドモーダル
 *
 * 2026-05 時点で JP × USDC on Base × Apple Pay/クレカ の即時 onramp は構造的に
 * 存在しない（Privy Funds / MoonPay Rails / Transak いずれも未対応）。
 * Coinbase Japan 取引所経由が現実解なので、それを明確に案内する。
 */
function JpFundingGuide({ address, onClose }: { address: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto p-6"
           onClick={e => e.stopPropagation()}>
        <button onClick={onClose} aria-label="閉じる"
                className="absolute top-4 right-4 w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/>
          </svg>
        </button>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wider">
          🇯🇵 JP user 向け
        </span>
        <h2 className="mt-3 text-lg font-bold text-gray-900">日本からの USDC 入金</h2>
        <p className="mt-1 text-xs text-gray-500 leading-relaxed">
          残念ながら 2026 年 5 月時点で <strong>JP × USDC on Base × クレカ即時購入</strong>は
          どの onramp も提供していません（規制とプロバイダの組合せ制約）。
          現実解は<strong> Coinbase 取引所経由 </strong>（合計 30-60 分）：
        </p>

        {/* Wallet address copy */}
        <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              あなたの受取アドレス（Base）
            </p>
            <button onClick={copy}
                    className="text-[10px] font-bold text-amber-700 hover:text-amber-900">
              {copied ? "✓ コピー済" : "コピー"}
            </button>
          </div>
          <code className="block break-all font-mono text-[11px] text-gray-800 select-all">{address}</code>
        </div>

        {/* 3 step */}
        <ol className="mt-5 space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">1</span>
            <div>
              <p className="font-bold text-gray-900">Coinbase Japan で口座開設（初回のみ、KYC 含み 15-30 分）</p>
              <a href="https://www.coinbase.com/ja-jp" target="_blank" rel="noopener noreferrer"
                 className="text-xs text-amber-700 hover:underline">
                coinbase.com/ja-jp →
              </a>
              <p className="text-[11px] text-gray-500 mt-0.5">既に口座あれば skip</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">2</span>
            <div>
              <p className="font-bold text-gray-900">JPY 入金 → USDC を購入</p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                銀行振込 / コンビニ等。¥3,000 程度（≈$20）で API call 数日分。
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">3</span>
            <div>
              <p className="font-bold text-gray-900">「送付」→ Base ネットワーク選択 → 上のアドレスを貼付</p>
              <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">
                ⚠️ <strong>必ず Base を選択</strong>。Ethereum を選ぶと送金手数料 $20 取られて到着しない。
                Coinbase は USDC のネットワーク選択肢で「Base」を 2024 年から提供しています。
              </p>
            </div>
          </li>
        </ol>

        {/* Alternative for crypto-experienced users */}
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-600 leading-relaxed">
          <p className="font-bold text-gray-700">既に USDC を持っている方</p>
          <p className="mt-1">
            MetaMask / Rabby / 他取引所から、<strong>Base ネットワーク</strong>で上のアドレス宛に送金してください。即着金（数分）。
          </p>
        </div>

        <button onClick={onClose}
                className="mt-5 w-full py-2 bg-gray-900 hover:bg-black text-white text-sm font-bold rounded-lg">
          閉じる
        </button>
      </div>
    </div>
  );
}
