"use client";

/**
 * /start/v2 — Non-custodial onboarding (production PLG UI).
 *
 * Post-FSA-Q11 architecture. LemonCake never holds USDC. The user signs
 * ONE ERC-2612 permit (~90 days valid) and the resulting signature
 * replaces the legacy Pay Token JWT entirely.
 *
 * Flow (target: 2 minutes, 1 wallet signature, then noop forever):
 *   1. Google sign-in via Privy → embedded wallet auto-created.
 *   2. Confirm the user has USDC on Base (or surface exchange options).
 *   3. One ERC-2612 permit signature: "spend up to $25/day from my wallet,
 *      valid 90 days, only to this LemonCake marketplace spender address".
 *   4. Show the encoded permit blob — paste into MCP config as
 *      `LEMON_CAKE_PERMIT` and we're done.
 *
 * Production assumes NEXT_PUBLIC_PRIVY_APP_ID is set; the mock fallback
 * was removed when v2 went live (2026-05-22) to keep the UI honest.
 */

import { useEffect, useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, type WalletClient } from "viem";
import { base, polygon } from "viem/chains";
// We construct the Coinbase Onramp URL manually so we can hand it the
// Privy embedded-wallet address. The OnchainKit `<FundButton />` would
// otherwise gate the flow behind a wagmi connector and force the user
// through a redundant "Connect Wallet" step.
import {
  DEFAULT_CHAIN,
  encodePermit,
  getTokenAddress,
  permitDeadlineFromNow,
  resolveToken,
  signStablePermit,
  type Currency,
  type SignedPermit,
} from "@/lib/permit";
import {
  detectDefaultCurrency,
  saveCurrencyPreference,
} from "@/lib/locale-detector";
import { trackEvent } from "@/lib/analytics";
import { PRIVY_ENABLED, COINBASE_ENABLED } from "@/Providers";

// Marketplace spender — temporary placeholder until per-service
// receivers are surfaced from the marketplace API. This address never
// holds USDC; it only acts as the allowed `transferFrom` caller, so
// FSA Q11's "non-custodial" condition still applies.
// Real marketplace spender wallet (generated 2026-05-22).
// This address is set as `spender` in every ERC-2612 permit so the
// LemonCake charge API can call transferFrom on behalf of the user.
// Private key → BASE_SPENDER_PRIVATE_KEY in Railway env (never committed).
const MARKETPLACE_SPENDER = "0x23e0D435b62d8eABE2b239c461Ec6fb2E8B7E965" as const;

// NB: this env holds the CDP **Project ID (UUID)** — not the client API
// key. Onramp's `appId` is the project identifier; the client API key
// is only used for direct REST calls / OnchainKit's React hooks.
const COINBASE_PROJECT_ID = process.env.NEXT_PUBLIC_COINBASE_PROJECT_ID ?? "";

// Transak — JP-compatible onramp (Banxa / Alchemy Pay / bank transfer).
// Unlike Coinbase Onramp, Transak charges the user a spread (no cost to
// us) and works with JPY bank transfer + convenience stores. We expose
// it as a parallel path for users in Japan where Coinbase Onramp is
// geo-blocked.
const TRANSAK_API_KEY = process.env.NEXT_PUBLIC_TRANSAK_API_KEY ?? "";

// Build the Coinbase Pay onramp URL. We match the parameter shape used
// by OnchainKit's official `getOnrampBuyUrl` helper:
//   • `addresses` is a Record<address, network[]>, NOT the legacy
//     `destinationWallets` array (the legacy form 500s on pay.coinbase.com).
//   • `assets` is a JSON array of symbols.
//   • `presetFiatAmount` + `fiatCurrency` is what actually pre-fills
//     the amount; `presetCryptoAmount` would expect a crypto-denominated
//     value and the URL otherwise drops the user on an empty form.
// Mint a Coinbase Onramp session token via our own API route, then
// build the pay.coinbase.com URL around it. Newer CDP projects refuse
// the bare-appId flow ("Project is configured to require secure
// initialization") so the addresses must be bound to a server-issued
// token instead of passed as URL params.
async function buildOnrampUrl(walletAddress: string, presetUsd: number): Promise<string> {
  const tokenRes = await fetch("/api/coinbase/session-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: walletAddress }),
  });
  if (!tokenRes.ok) {
    const detail = await tokenRes.text().catch(() => "");
    throw new Error(`session-token mint failed (${tokenRes.status}): ${detail}`);
  }
  const { sessionToken } = (await tokenRes.json()) as { sessionToken?: string };
  if (!sessionToken) {
    throw new Error("session-token mint returned no token");
  }

  const url = new URL("https://pay.coinbase.com/buy");
  url.searchParams.set("sessionToken", sessionToken);
  url.searchParams.set("defaultAsset", "USDC");
  url.searchParams.set("defaultNetwork", "base");
  url.searchParams.set("presetFiatAmount", String(presetUsd));
  url.searchParams.set("fiatCurrency", "USD");
  url.searchParams.set("defaultExperience", "buy");
  // Onramp's Japanese localisation is incomplete (the popup throws
  // "ja not supported yet" + 403 on graphql). Force English so the
  // flow at least renders; once Coinbase ships JP support we can drop
  // this override.
  url.searchParams.set("language", "en");
  return url.toString();
}

// Build a Transak widget URL pre-filled with the user's wallet address,
// JPY as the fiat currency, and USDC on Base as the target asset.
// Transak's revenue model is a user-side spread (~1–2 %), so there is
// no partner cost. The API secret is only required for "Secure Widget"
// mode (server-signed sessions); for the current integration the
// public API key in the URL is sufficient.
function buildTransakUrl(walletAddress: string, fiatAmountJpy: number): string {
  const url = new URL("https://global.transak.com/");
  url.searchParams.set("apiKey",                  TRANSAK_API_KEY);
  url.searchParams.set("defaultCryptoCurrency",   "USDC");
  url.searchParams.set("networks",                "base");
  url.searchParams.set("walletAddress",           walletAddress);
  url.searchParams.set("disableWalletAddressForm","true");
  url.searchParams.set("fiatCurrency",            "JPY");
  url.searchParams.set("defaultFiatAmount",       String(fiatAmountJpy));
  url.searchParams.set("themeColor",              "F5C518");
  url.searchParams.set("productsAvailed",         "buy");
  return url.toString();
}

// $25.00 USDC daily cap (USDC uses 6 decimals).
const DEFAULT_DAILY_CAP_USDC_BASE = BigInt(25_000_000);
// ¥3,000 JPYC daily cap (JPYC uses 18 decimals).
// Roughly matches the USDC default ($25 ≈ ¥3,750 at recent rates) so
// Japanese demo users hit comparable budget headroom.
// (`10n ** 18n` literal needs ES2020; tsconfig targets ES2017 so we
// spell it out with BigInt() to keep the build green.)
const DEFAULT_DAILY_CAP_JPYC_POLYGON = BigInt(3_000) * (BigInt(10) ** BigInt(18));

/**
 * Daily-cap default per currency. The actual signed value can later be
 * raised by the user from the dashboard — this is just the "first
 * signature" amount, sized for safe demoing.
 */
const DEFAULT_DAILY_CAP: Record<Currency, bigint> = {
  USDC: DEFAULT_DAILY_CAP_USDC_BASE,
  JPYC: DEFAULT_DAILY_CAP_JPYC_POLYGON,
};

/**
 * Human-readable display of the cap (the signature pane shows this).
 * Kept separate from `describePermit()` because we render it before any
 * permit exists.
 */
function formatCap(currency: Currency): string {
  return currency === "JPYC" ? "¥3,000 / day" : "$25 / day";
}

/** Brief label for the UI ("USDC on Base", "JPYC on Polygon"). */
function chainLabel(currency: Currency): string {
  const chainId = DEFAULT_CHAIN[currency];
  return currency === "JPYC" ? `JPYC (Polygon ${chainId})` : `USDC (Base ${chainId})`;
}

/**
 * Step labels are derived from the active currency so the progress bar
 * stays in sync with the toggle. Until 2026-05-23 the labels were
 * hardcoded to "USDC（任意）" / "Apple Pay / 銀行振込" and they kept
 * leaking USDC into the JPYC flow — bad demo signal for JPYC社.
 */
function stepsFor(currency: Currency): ReadonlyArray<{
  id: 1 | 2 | 3 | 4;
  label: string;
  detail: string;
}> {
  const fundingDetail =
    currency === "JPYC"
      ? "後で入金 OK / 今入れたければ JPYC EX で銀行振込 / カード"
      : "後で入金 OK / 今入れたければ Apple Pay / 銀行振込";
  return [
    { id: 1, label: "サインイン",       detail: "Google で 1 クリック / 専用ウォレットが自動生成" },
    { id: 2, label: `${currency}（任意）`, detail: fundingDetail },
    { id: 3, label: "1 回だけ署名",      detail: "支払い権限の委譲（90 日有効・$25/日 上限）" },
    { id: 4, label: "完了",             detail: "トークンをコピー → 以降は AI が自動課金" },
  ];
}

// First 6 + last 4 — keeps full address out of the rendered DOM while
// still letting the user visually verify it matches their wallet.
function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Read the current `nonces(owner)` value from the stablecoin contract
// on the user's chain. The permit signature is bound to this nonce so
// the contract knows the order of permits to apply. Both USDC and JPYC
// expose the same `nonces(address)` selector — only the contract
// address differs.
async function readPermitNonce(
  walletClient: WalletClient,
  currency: Currency,
  chainId: number,
  owner: `0x${string}`,
): Promise<bigint> {
  const tokenAddr = getTokenAddress(currency, chainId);

  // EIP-1474 eth_call with the `nonces(address)` ABI selector
  // (0x7ecebe00) + the owner address right-padded.
  const data = ("0x7ecebe00" + owner.slice(2).toLowerCase().padStart(64, "0")) as `0x${string}`;
  const transport = walletClient.transport as unknown as {
    request: (args: { method: string; params: unknown[] }) => Promise<string>;
  };
  const hex = await transport.request({
    method: "eth_call",
    params: [{ to: tokenAddr, data }, "latest"],
  });
  return BigInt(hex);
}

export default function StartV2Page() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [permit, setPermit] = useState<SignedPermit | null>(null);
  const [encodedPermit, setEncodedPermit] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [showExchanges, setShowExchanges] = useState(false);
  // Default to USDC on the server render so SSR markup is deterministic
  // (navigator/localStorage aren't available there). The effect below
  // upgrades to JPYC for Japanese users once we hydrate on the client.
  // This is the dual-currency entry point — flipping the toggle changes
  // which contract gets signed in Step 3.
  const [currency, setCurrency] = useState<Currency>("USDC");

  // Run locale + localStorage detection after hydration so SSR and the
  // first client render agree. Without the effect, navigator.language
  // would only be read once the component mounts, which is fine — we
  // just paint the toggle in its detected position on the first paint.
  useEffect(() => {
    const detected = detectDefaultCurrency();
    if (detected !== currency) {
      setCurrency(detected);
      trackEvent("v2_currency_auto_detected", { currency: detected });
    }
    // We only want this on mount — the user may flip the toggle later,
    // and re-running detection would clobber their choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Flip the toggle. Persists the choice so reloads/return visits keep it. */
  function handleSwitchCurrency(next: Currency) {
    if (next === currency) return;
    setCurrency(next);
    saveCurrencyPreference(next);
    trackEvent("v2_currency_switched", { currency: next });
  }

  const privy = usePrivy();
  const { wallets } = useWallets();

  const isPrivyReady = PRIVY_ENABLED && privy.ready;
  const isAuthenticated = PRIVY_ENABLED && privy.authenticated;
  const userWallet = wallets[0];

  // ── Step 1: Connect ───────────────────────────────────────────────────
  async function handleSignIn() {
    trackEvent("v2_signin_started");
    try {
      await privy.login();
      // login() resolves once the modal closes; user/wallet hydration
      // happens on the next render via the hooks above. We rely on the
      // render-derived `isAuthenticated` for the Step 2 gate.
    } catch (e) {
      trackEvent("v2_signin_failed", { error: e instanceof Error ? e.message : "unknown" });
      setError(e instanceof Error ? e.message : "サインインに失敗しました");
      return;
    }
    setStep(2);
  }

  // ── Step 2: USDC confirm (no LemonCake-hosted onramp) ─────────────────
  function handleHasUsdc() {
    trackEvent("v2_balance_confirmed", { source: "user_attests" });
    setStep(3);
  }

  function handleExchangeClick(exchange: string) {
    trackEvent("v2_exchange_link_clicked", { exchange });
  }

  // ── Step 3: Sign the permit ───────────────────────────────────────────
  async function handleSignPermit() {
    setError(null);
    if (!userWallet) {
      setError("ウォレットが見つかりません。サインインからやり直してください。");
      return;
    }
    setSigning(true);
    try {
      const owner   = userWallet.address as `0x${string}`;
      const chainId = DEFAULT_CHAIN[currency]; // 8453 USDC / 137 JPYC
      // Hand the wagmi chain object straight through — viem rejects
      // arbitrary chain objects in `signTypedData`, but accepts the
      // wagmi-exported ones because they share the same shape.
      const chain   = chainId === 8453 ? base : polygon;

      // Make sure the Privy wallet is on the right network before we
      // signal the typed-data request. For embedded wallets this is a
      // no-op; for injected/walletconnect EOAs it triggers the network
      // switch prompt.
      try {
        await userWallet.switchChain(chainId);
      } catch {
        // switchChain is fire-and-forget for embedded wallets — they're
        // chain-agnostic. The real chain enforcement happens in viem
        // below.
      }

      const eip1193 = await userWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account:   owner,
        chain,
        transport: custom(eip1193),
      });
      const nonce = await readPermitNonce(walletClient, currency, chainId, owner);
      const value = DEFAULT_DAILY_CAP[currency];
      const signed = await signStablePermit({
        walletClient,
        currency,
        chainId,
        owner,
        spender: MARKETPLACE_SPENDER,
        value,
        nonce,
        deadline: permitDeadlineFromNow(),
      });
      setPermit(signed);
      setEncodedPermit(encodePermit(signed));
      // /me ダッシュボードで permit メタを表示するために localStorage に保存
      // (on-chain には deadline/cap が見えないので、UI 側で補完するため)
      try {
        localStorage.setItem(
          `lemon_permit_meta_${owner.toLowerCase()}`,
          JSON.stringify({
            signedAt:  Date.now(),
            deadline:  Number(signed.deadline),
            valueUsdc: String(value),
            currency,
          }),
        );
      } catch { /* localStorage full / disabled — UI fallback で対応 */ }
      trackEvent("v2_permit_signed", {
        chain_id:      chainId,
        currency,
        cap_human:     formatCap(currency),
        validity_days: 90,
      });
      setStep(4);
    } catch (e) {
      trackEvent("v2_permit_sign_failed", {
        currency,
        error: e instanceof Error ? e.message : "unknown",
      });
      setError(e instanceof Error ? e.message : "署名に失敗しました");
    } finally {
      setSigning(false);
    }
  }

  async function copyToken() {
    await navigator.clipboard.writeText(encodedPermit);
    trackEvent("v2_permit_copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-yellow-50">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Banner */}
        <div className="mb-8 rounded-2xl border border-amber-300 bg-amber-100/60 p-4 text-sm text-amber-900">
          <p className="font-bold">
            🍋 LemonCake は {currency} を一切預かりません。AI エージェントが直接 API 提供者に支払います。
          </p>
        </div>

        <h1 className="text-3xl font-bold text-gray-900">2 分で始める</h1>
        <p className="mt-2 text-gray-600">
          サインは 90 日に 1 回。以降は完全ノーサインで AI が API を呼びます。
        </p>

        {/* Currency toggle — wins over the rest of the flow. Lives above
            the step bar so it's hard to miss; users coming in from a
            partner with ?currency=JPYC see the toggle already on JPYC. */}
        <div
          role="radiogroup"
          aria-label="Choose currency"
          className="mt-6 grid grid-cols-2 gap-3"
        >
          {(["JPYC", "USDC"] as const).map((c) => {
            const active   = c === currency;
            const isJpyc   = c === "JPYC";
            const sub      = isJpyc
              ? "日本円ステーブルコイン / Polygon"
              : "US Dollar / Base — グローバル";
            const detail   = isJpyc
              ? "為替リスクなし・JPYC EX で銀行振込/カード"
              : "Apple Pay・Google Pay・カード対応";
            // Official token logos shipped from /public. Using <img> over
            // next/image here because the logos are tiny (under 10kB
            // each) and we want zero LCP regression vs the previous
            // emoji — Next's optimizer adds a wrapper that's net loss
            // at this size.
            const logoSrc  = isJpyc ? "/jpyc.png" : "/usdc.png";
            return (
              <button
                key={c}
                role="radio"
                aria-checked={active}
                onClick={() => handleSwitchCurrency(c)}
                className={`text-left rounded-2xl border-2 px-4 py-3 transition-all ${
                  active
                    ? "border-amber-500 bg-amber-50 shadow-sm"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  <img
                    src={logoSrc}
                    alt={`${c} logo`}
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full"
                    loading="eager"
                    decoding="async"
                  />
                  <span className="text-base font-bold text-gray-900">{c}</span>
                  {active && (
                    <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Default
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs font-semibold text-gray-700">{sub}</div>
                <div className="mt-0.5 text-[11px] text-gray-500 leading-snug">{detail}</div>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-gray-500">
          選択した通貨で permit を発行します。あとからダッシュボードでもう一方を追加できます。
          {currency === "JPYC" && (
            <> 日本ユーザー向けデフォルト（要件: 東京都ステーブルコイン社会実装促進事業 / JPYC 株式会社規制版）。</>
          )}
        </p>
        {currency === "JPYC" && (
          <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-[11px] text-amber-900">
            <p className="font-bold">🚧 JPYC 統合は実験的機能</p>
            <p className="mt-1 leading-relaxed">
              現在 JPYC 株式会社へ EIP-712 ドメイン詳細 + JPYC EX 法人 API アクセスを申請中。
              UI / トグル / 通貨ルーティングは本番動作しますが、Polygon 上の実 permit 署名は
              JPYC社からの version 文字列確定待ちです。デモ用途は問題なくご利用いただけます。
            </p>
          </div>
        )}

        {/* Step progress — derived from currency so the labels track
            the toggle (e.g. "USDC（任意）" → "JPYC（任意）"). */}
        <ol className="mt-10 grid grid-cols-4 gap-2">
          {stepsFor(currency).map((s) => (
            <li
              key={s.id}
              className={`rounded-xl border p-3 text-center text-xs ${
                step >= s.id
                  ? "border-amber-500 bg-amber-500 text-white"
                  : "border-gray-200 bg-white text-gray-500"
              }`}
            >
              <div className="text-base font-bold">{s.id}</div>
              <div className="mt-1 font-semibold">{s.label}</div>
              <div className="mt-0.5 opacity-80">{s.detail}</div>
            </li>
          ))}
        </ol>

        {/* Active step body */}
        <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          {step === 1 && (
            <>
              <h2 className="text-xl font-bold">Step 1 · サインイン</h2>
              <p className="mt-2 text-sm text-gray-600">
                Google で 1 クリック。Privy が裏でウォレットを自動生成します。秘密鍵は
                あなたのデバイスにのみ存在し、LemonCake は触りません。
              </p>
              <button
                onClick={handleSignIn}
                disabled={!isPrivyReady}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {!isPrivyReady
                  ? "読み込み中…"
                  : isAuthenticated
                    ? "サインイン済み — 次へ"
                    : "Google でサインイン"}
              </button>
              {error && (
                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-bold">Step 2 · {currency}（任意）</h2>
              <p className="mt-2 text-sm text-gray-600">
                permit 署名は {currency} 残高がなくても発行できます。<strong>まず署名だけ取って試したい場合はスキップ可</strong>。
                {currency} は後で入金しても、無料デモサービスはすぐ使えます。
              </p>
              {userWallet?.address && (
                <p className="mt-4 text-xs text-gray-500">
                  ウォレット:{" "}
                  <span className="font-mono text-gray-700" title={userWallet.address}>
                    {shortAddr(userWallet.address)}
                  </span>{" "}
                  <span className="text-gray-400">({chainLabel(currency)})</span>
                </p>
              )}

              {/* 巨大 skip CTA — Glama 訪問者の摩擦削減の最重要 button.
                  入金は permit 取得に必須ではない（permit は上限を
                  署名するだけ。残高ゼロでも署名できる）ので、最上部に
                  目立つ skip ボタンを置く。 */}
              <div className="mt-6 rounded-2xl border-2 border-amber-500 bg-gradient-to-br from-amber-50 to-yellow-50 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🎁</span>
                  <div className="flex-1">
                    <p className="text-base font-bold text-gray-900">
                      とりあえず permit だけ欲しい人はこちら
                    </p>
                    <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                      {currency} 入金をスキップして直接署名へ。発行された permit で：
                      <br />
                      ✓ 無料デモサービス（Wikipedia / FX / httpbin）が使える
                      <br />
                      ✓ list_services / check_tax など無料機能も全部試せる
                      <br />
                      ✓ paid サービスを使いたくなった時に戻って {currency} 入金すれば即解禁
                    </p>
                    <button
                      onClick={() => {
                        trackEvent("v2_skipped_funding", { currency });
                        handleHasUsdc();
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-gray-800"
                    >
                      {currency} スキップ → 署名へ進む →
                    </button>
                  </div>
                </div>
              </div>

              {/* divider */}
              <div className="mt-8 mb-4 flex items-center gap-3">
                <span className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">
                  または 今すぐ {currency} を取得
                </span>
                <span className="flex-1 h-px bg-gray-200" />
              </div>

              {/* JPYC charge path — visible only when JPYC is selected.
                  Until the JPYC EX法人 API access lands (申請中, blocking
                  on JPYC社 review), we deep-link to jpyc.co.jp for the
                  bank-transfer / card flow. Once we have an API key we
                  swap this for the embedded modal designed in
                  docs/tokyo-stablecoin-grant/04-currency-routing-design.md. */}
              {currency === "JPYC" && (
                <div className="mt-6 rounded-2xl border-2 border-rose-400 bg-white p-5 shadow-sm">
                  <p className="text-sm font-bold text-gray-900">
                    🏦 JPYC EX で 円建て購入（銀行振込 / カード）
                  </p>
                  <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                    JPYC 株式会社（資金移動業ライセンス取得済）が運営する公式オンランプ。
                    銀行振込・クレジットカードで JPYC を即時購入し、あなたの Polygon ウォレットに直接届きます。
                    手数料無料、為替リスクなしの円建てステーブルコイン。LemonCake は決済経路に一切介在しません。
                  </p>
                  {userWallet?.address && (
                    <p className="mt-3 text-[11px] text-gray-500">
                      受取先ウォレット:{" "}
                      <span className="font-mono text-gray-700">{shortAddr(userWallet.address)}</span>{" "}
                      <span className="text-gray-400">(Polygon 137)</span>
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[1000, 3000, 5000].map((amt) => (
                      <a
                        key={amt}
                        href={`https://jpyc.co.jp/?amount=${amt}`}
                        target="_blank"
                        rel="noopener"
                        onClick={() => trackEvent("v2_jpyc_ex_clicked", { amount_jpy: amt })}
                        className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-600"
                      >
                        ¥{amt.toLocaleString()} 分購入
                      </a>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
                    所要時間: 銀行振込 数分・カード 即時。初回のみ JPYC EX 本人確認あり。
                    購入完了後、下の「JPYC 入金完了 → 署名へ進む」をクリック。
                  </p>
                  <p className="mt-2 text-[11px] text-amber-700">
                    🚧 JPYC EX 法人 API 統合は申請中（補助金事業 Phase 1）。
                    本実装後はこのモーダル内で完結します。
                  </p>
                </div>
              )}

              {/* Apple Pay primary path — Coinbase Onramp. Falls back to
                  the "持っていない" exchange list when the project ID is
                  missing or the user prefers to bridge manually.
                  Coinbase Onramp only ships USDC to Base, so this entire
                  block is gated on currency === "USDC". */}
              {currency === "USDC" && COINBASE_ENABLED && userWallet?.address && (
                <div className="mt-6 rounded-2xl border-2 border-gray-900 bg-white p-5 shadow-sm">
                  <p className="text-sm font-bold text-gray-900">
                    💳 カードでいますぐ USDC を取得
                  </p>
                  <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                    Apple Pay / Google Pay / クレジットカードで USDC を購入し、あなたのウォレットに直接届きます。
                    Coinbase 経由（FSA 暗号資産交換業 #00029）、LemonCake は決済経路に一切介在しません。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {/* Sandbox cap is $5/tx until we get full Onramp
                        access from Coinbase. The $1/$3/$5 preset keeps
                        every click within the test limit. */}
                    {[1, 3, 5].map((amt) => (
                      <button
                        key={amt}
                        onClick={async () => {
                          trackEvent("v2_onramp_clicked", { amount_usd: amt });
                          // Pop the window synchronously inside the
                          // user gesture so Safari / Chrome don't kill
                          // it, then navigate once the server mints
                          // the session token.
                          const w = window.open(
                            "about:blank",
                            "coinbase-onramp",
                            "popup,width=480,height=720",
                          );
                          if (!w) {
                            setError("ポップアップがブロックされました。ブラウザ設定で許可してください。");
                            return;
                          }
                          try {
                            const url = await buildOnrampUrl(
                              userWallet.address as string,
                              amt,
                            );
                            w.location.href = url;
                          } catch (e) {
                            w.close();
                            setError(
                              e instanceof Error
                                ? `Coinbase 接続に失敗しました: ${e.message}`
                                : "Coinbase 接続に失敗しました",
                            );
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-gray-800"
                      >
                        ${amt} を購入
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
                    所要時間 30 秒〜3 分（初回のみ本人確認あり）。
                    購入完了後、下の「USDC は準備済み → 次へ」をクリック。
                  </p>
                </div>
              )}

              {/* Transak — JP bank / convenience-store path.
                  Only relevant for USDC purchases (JPYC has its own
                  JPYC EX path above). Kept alongside Coinbase so
                  domestic users buying USDC have a native JPY option
                  even though Coinbase Onramp is geo-blocked in Japan. */}
              {currency === "USDC" && TRANSAK_API_KEY && userWallet?.address && (
                <div className="mt-4 rounded-2xl border-2 border-indigo-500 bg-white p-5 shadow-sm">
                  <p className="text-sm font-bold text-gray-900">
                    🏦 銀行振込 / コンビニ払いで USDC 購入（JPY 対応）
                  </p>
                  <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                    日本円で USDC を直接購入。銀行振込・コンビニ支払いに対応。
                    Transak 経由、LemonCake は決済経路に一切介在しません。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[1000, 3000, 5000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => {
                          trackEvent("v2_transak_clicked", { amount_jpy: amt });
                          const url = buildTransakUrl(userWallet.address as string, amt);
                          window.open(url, "transak-onramp", "popup,width=500,height=700");
                        }}
                        className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
                      >
                        ¥{amt.toLocaleString()} 分購入
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
                    初回のみ本人確認あり（3〜5 分）。購入完了後、下の「USDC は準備済み → 次へ」をクリック。
                  </p>
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={handleHasUsdc}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-white hover:bg-amber-600"
                >
                  {currency} 入金完了 → 署名へ進む
                </button>
                {currency === "USDC" && (
                  <button
                    onClick={() => setShowExchanges((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 hover:border-gray-400"
                  >
                    他の入手方法を見る
                  </button>
                )}
              </div>

              {showExchanges && (
                <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm">
                  <p className="font-bold text-gray-800">USDC を Base で手に入れる方法</p>
                  <p className="mt-1 text-xs text-gray-600">
                    LemonCake は決済の経路に入らないので、お好きな方法で OK。
                  </p>
                  <ul className="mt-4 space-y-2 text-xs">
                    <li className="flex items-start gap-2">
                      <span>🇯🇵</span>
                      <div>
                        <a
                          href="https://www.coincheck.com/exchange/usdc_jpy"
                          target="_blank"
                          rel="noopener"
                          onClick={() => handleExchangeClick("coincheck")}
                          className="font-bold text-amber-700 hover:underline"
                        >
                          Coincheck で JPY → USDC
                        </a>{" "}
                        購入後、Base に bridge（
                        <a
                          href="https://www.usdc.com/bridge"
                          target="_blank"
                          rel="noopener"
                          onClick={() => handleExchangeClick("circle_bridge")}
                          className="underline hover:text-amber-700"
                        >
                          USDC 公式 Bridge
                        </a>
                        ）
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>🇯🇵</span>
                      <div>
                        <a
                          href="https://bitflyer.com/ja-jp/"
                          target="_blank"
                          rel="noopener"
                          onClick={() => handleExchangeClick("bitflyer")}
                          className="font-bold text-amber-700 hover:underline"
                        >
                          bitFlyer
                        </a>{" "}
                        で取得後、Base へ送金
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <span>🌐</span>
                      <div>
                        <a
                          href="https://www.coinbase.com/price/usd-coin"
                          target="_blank"
                          rel="noopener"
                          onClick={() => handleExchangeClick("coinbase")}
                          className="font-bold text-amber-700 hover:underline"
                        >
                          Coinbase（海外）
                        </a>
                        — Base ネイティブ対応
                      </div>
                    </li>
                  </ul>
                  <p className="mt-4 text-xs text-gray-500">
                    Pro tip: $5〜$25 程度の少額でテストするのが安全。permit には残高は不要なので、
                    署名は今済ませて USDC 入金は後でも OK です。
                  </p>
                  <button
                    onClick={handleHasUsdc}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-xs font-bold text-white hover:bg-gray-800"
                  >
                    準備できた → 次へ
                  </button>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-bold">Step 3 · AI に支払い権限を渡す</h2>
              <p className="mt-2 text-sm text-gray-600">
                「90 日間、最大 {formatCap(currency)} まで LemonCake マーケットに使ってよい」と
                <strong>1 度だけ署名</strong>します（送金ではなく承認メッセージ）。
                ガス代ゼロ、{currency} は今ウォレットから動きません。
                <span className="block mt-2 text-[11px] text-gray-500">
                  ※ 技術名: ERC-2612 permit（{currency} スマートコントラクトに直接焼かれる承認、LemonCake の介在不要）。
                  実際に {currency} が動くのは AI が paid API を呼んだ瞬間だけ。
                </span>
              </p>
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs font-mono leading-relaxed text-gray-700">
                <div>currency: {currency}</div>
                <div>chain:    {currency === "JPYC" ? "Polygon (137)" : "Base (8453)"}</div>
                <div>token:    {shortAddr(resolveToken(currency, DEFAULT_CHAIN[currency]).address)}</div>
                <div>cap:      {formatCap(currency)}</div>
                <div>validity: 90 days</div>
                <div>spender:  {shortAddr(MARKETPLACE_SPENDER)}</div>
                {userWallet?.address && (
                  <div>owner:    {shortAddr(userWallet.address)}</div>
                )}
              </div>
              {error && (
                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              <button
                onClick={handleSignPermit}
                disabled={signing || !userWallet}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {signing ? "ウォレットで承認中…" : "署名する（1 回のみ）"}
              </button>
            </>
          )}

          {step === 4 && permit && (
            <>
              <h2 className="text-xl font-bold">Step 4 · 完了 🎉</h2>
              <p className="mt-2 text-sm text-gray-600">
                以下のトークンを MCP クライアントの設定にコピペして使ってください。
                <strong>90 日後の期限切れ 7 日前にメール + ブラウザ通知</strong>が届き、
                ワンクリックで延長できます。それまで完全ノーサインで AI が API を呼びます。
              </p>

              {/* What this permit does */}
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs text-gray-700">
                <p className="font-bold text-gray-800">この permit が動かしているもの</p>
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>AI が API を呼ぶ瞬間、permit 署名が {permit.currency} コントラクトに渡される</li>
                  <li>{permit.currency} はあなたのウォレット → API 提供者へ <strong>直接転送</strong></li>
                  <li>LemonCake のアドレスは経路に登場しない（FSA Q11 準拠）</li>
                  <li>{formatCap(permit.currency)} の上限はあなただけが調整可能</li>
                </ul>
              </div>

              {/* Auto-renewal status */}
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <span className="text-xl leading-none">🔔</span>
                <div className="text-sm">
                  <p className="font-bold text-emerald-900">自動更新通知 ON</p>
                  <p className="mt-0.5 text-emerald-800">
                    期限切れ 7 日前 / 3 日前 / 当日にメール通知。ブラウザ通知も許可するとさらに見逃しゼロに。
                  </p>
                  <button
                    className="mt-2 text-xs font-bold text-emerald-700 hover:underline"
                    onClick={async () => {
                      if (typeof window !== "undefined" && "Notification" in window) {
                        await Notification.requestPermission();
                      }
                    }}
                  >
                    ブラウザ通知を許可する →
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">
                  LEMON_CAKE_PERMIT
                </p>
                <p className="mt-2 break-all font-mono text-xs text-gray-800">{encodedPermit}</p>
                <button
                  onClick={copyToken}
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-1.5 text-xs font-bold text-white hover:bg-gray-800"
                >
                  {copied ? "コピーしました ✓" : "クリップボードにコピー"}
                </button>
              </div>

              <McpConfigBlock encodedPermit={encodedPermit} />
              <ConfigFilePaths />

              {/* 次にやること — Buyer dashboard / docs / Provider 登録 */}
              <div className="mt-8">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">次にやること</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <a href="/me" className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-amber-300 hover:bg-amber-50/30 transition">
                    <div className="text-2xl mb-1">📊</div>
                    <p className="font-bold text-gray-900 text-sm group-hover:text-amber-700">残高 / 課金履歴を見る</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">/me — Buyer ダッシュボード</p>
                  </a>
                  <a href="/docs/quickstart" className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-amber-300 hover:bg-amber-50/30 transition">
                    <div className="text-2xl mb-1">🛠</div>
                    <p className="font-bold text-gray-900 text-sm group-hover:text-amber-700">MCP 設定の貼り方</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">Claude / Cursor / Cline の手順</p>
                  </a>
                  <a href="/sellers" className="group rounded-xl border border-gray-200 bg-white p-4 hover:border-amber-300 hover:bg-amber-50/30 transition">
                    <div className="text-2xl mb-1">🏪</div>
                    <p className="font-bold text-gray-900 text-sm group-hover:text-amber-700">あなたの API も売る</p>
                    <p className="mt-0.5 text-[10px] text-gray-500">/sellers で 1 分登録</p>
                  </a>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Disclaimer / FSA stance — currency-aware so the JPYC mode
            doesn't say "USDC は常にあなたのウォレットに残り". */}
        <p className="mt-6 text-xs text-gray-500">
          ※ {currency} は常にあなたのウォレットに残り、LemonCake は ERC-2612 permit 署名のみを受け取ります。
          金融庁 Fintech サポートデスクへの照会 (Q1-Q11) を完了済み。
          詳細：<a href="/security" className="underline hover:text-amber-700">/security</a>
        </p>
      </div>
    </main>
  );
}

/**
 * OS を判定して MCP 設定ファイルの絶対パスを表示する。
 * macOS / Windows / Linux で違うため、初心者でも paste 先で迷わないように。
 */
/**
 * McpConfigBlock — permit を実値で埋めた MCP 設定 JSON を 1 クリックでコピー。
 * 旧 UI は `<上のトークン>` プレースホルダ JSON を表示して、user に手で
 * 差し替えさせていた（離脱ポイント）。これを「コピー → 設定ファイルに貼付」
 * の 2 step にする。
 */
function McpConfigBlock({ encodedPermit }: { encodedPermit: string }) {
  const [copied, setCopied] = useState(false);
  const config = `{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"],
      "env": {
        "LEMON_CAKE_PERMIT": "${encodedPermit}"
      }
    }
  }
}`;
  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs">
      <div className="flex items-center justify-between mb-2">
        <p className="font-bold text-gray-700">MCP 設定（permit 埋め込み済 / 丸ごと貼付 OK）</p>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(config);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="inline-flex items-center gap-1.5 rounded-full bg-gray-900 text-white px-3 py-1 text-[10px] font-bold hover:bg-gray-700"
        >
          {copied ? "✓ コピー済" : "全部コピー"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded bg-white p-3 font-mono leading-relaxed text-gray-800">
        {config}
      </pre>
      <p className="mt-2 text-[10px] text-gray-500 leading-relaxed">
        既存設定があれば <code className="bg-white px-1 rounded">mcpServers</code> ブロック内に
        <code className="bg-white px-1 rounded">"lemon"</code> エントリだけ追加してください。
      </p>
    </div>
  );
}

function ConfigFilePaths() {
  const [os, setOs] = useState<"mac" | "win" | "linux" | "unknown">("unknown");
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const p = navigator.platform.toLowerCase();
    if (p.includes("mac"))   setOs("mac");
    else if (p.includes("win")) setOs("win");
    else if (p.includes("linux")) setOs("linux");
  }, []);

  const paths: Record<typeof os, { claude: string; cursor: string }> = {
    mac: {
      claude: "~/Library/Application Support/Claude/claude_desktop_config.json",
      cursor: "~/.cursor/mcp.json",
    },
    win: {
      claude: "%APPDATA%\\Claude\\claude_desktop_config.json",
      cursor: "%USERPROFILE%\\.cursor\\mcp.json",
    },
    linux: {
      claude: "~/.config/Claude/claude_desktop_config.json",
      cursor: "~/.cursor/mcp.json",
    },
    unknown: {
      claude: "Claude Desktop の設定 → MCP → 設定ファイルを編集",
      cursor: "Cursor 設定 → MCP → 設定ファイルを編集",
    },
  };
  const p = paths[os];

  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
      <div className="rounded bg-white border border-gray-200 px-2 py-1.5">
        <p className="font-bold text-gray-500 uppercase tracking-wider mb-0.5">Claude Desktop</p>
        <code className="font-mono text-gray-700 break-all">{p.claude}</code>
      </div>
      <div className="rounded bg-white border border-gray-200 px-2 py-1.5">
        <p className="font-bold text-gray-500 uppercase tracking-wider mb-0.5">Cursor</p>
        <code className="font-mono text-gray-700 break-all">{p.cursor}</code>
      </div>
    </div>
  );
}
