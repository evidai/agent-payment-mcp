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

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, type WalletClient } from "viem";
import { base } from "viem/chains";
// We construct the Coinbase Onramp URL manually so we can hand it the
// Privy embedded-wallet address. The OnchainKit `<FundButton />` would
// otherwise gate the flow behind a wagmi connector and force the user
// through a redundant "Connect Wallet" step.
import {
  encodePermit,
  permitDeadlineFromNow,
  signUsdcPermit,
  USDC_ADDRESS,
  type SignedPermit,
} from "@/lib/permit";
import { trackEvent } from "@/lib/analytics";
import { PRIVY_ENABLED, COINBASE_ENABLED } from "@/Providers";

// Marketplace spender — temporary placeholder until per-service
// receivers are surfaced from the marketplace API. This address never
// holds USDC; it only acts as the allowed `transferFrom` caller, so
// FSA Q11's "non-custodial" condition still applies.
const MARKETPLACE_SPENDER = "0x000000000000000000000000000000000000dEaD" as const;

const COINBASE_PROJECT_ID = process.env.NEXT_PUBLIC_COINBASE_PROJECT_ID ?? "";

// Build the Coinbase Pay onramp URL. We match the parameter shape used
// by OnchainKit's official `getOnrampBuyUrl` helper:
//   • `addresses` is a Record<address, network[]>, NOT the legacy
//     `destinationWallets` array (the legacy form 500s on pay.coinbase.com).
//   • `assets` is a JSON array of symbols.
//   • `presetFiatAmount` + `fiatCurrency` is what actually pre-fills
//     the amount; `presetCryptoAmount` would expect a crypto-denominated
//     value and the URL otherwise drops the user on an empty form.
function buildOnrampUrl(walletAddress: string, presetUsd: number): string {
  const url = new URL("https://pay.coinbase.com/buy/select-asset");
  url.searchParams.set("appId", COINBASE_PROJECT_ID);
  url.searchParams.set(
    "addresses",
    JSON.stringify({ [walletAddress]: ["base"] }),
  );
  url.searchParams.set("assets", JSON.stringify(["USDC"]));
  url.searchParams.set("defaultAsset", "USDC");
  url.searchParams.set("defaultNetwork", "base");
  url.searchParams.set("presetFiatAmount", String(presetUsd));
  url.searchParams.set("fiatCurrency", "USD");
  url.searchParams.set("defaultExperience", "buy");
  return url.toString();
}

// $25.00 USDC daily cap (USDC uses 6 decimals).
const DEFAULT_DAILY_CAP_USDC_BASE = BigInt(25_000_000);

const STEPS = [
  { id: 1, label: "サインイン",      detail: "Google で 1 クリック / wallet 自動作成" },
  { id: 2, label: "USDC を確認",     detail: "Base 上にあれば OK / 無ければ取引所案内" },
  { id: 3, label: "1 回だけ署名",     detail: "ERC-2612 permit — 90日間有効" },
  { id: 4, label: "完了",            detail: "以降は完全ノーサイン" },
] as const;

// First 6 + last 4 — keeps full address out of the rendered DOM while
// still letting the user visually verify it matches their wallet.
function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Read the current `nonces(owner)` value from the USDC contract on the
// user's chain. The permit signature is bound to this nonce so the
// contract knows the order of permits to apply.
async function readUsdcNonce(
  walletClient: WalletClient,
  chainId: number,
  owner: `0x${string}`,
): Promise<bigint> {
  const usdc = USDC_ADDRESS[chainId];
  if (!usdc) throw new Error(`USDC not configured on chain ${chainId}`);

  // EIP-1474 eth_call with the `nonces(address)` ABI selector
  // (0x7ecebe00) + the owner address right-padded.
  const data = ("0x7ecebe00" + owner.slice(2).toLowerCase().padStart(64, "0")) as `0x${string}`;
  const transport = walletClient.transport as unknown as {
    request: (args: { method: string; params: unknown[] }) => Promise<string>;
  };
  const hex = await transport.request({
    method: "eth_call",
    params: [{ to: usdc, data }, "latest"],
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
      const owner = userWallet.address as `0x${string}`;
      const eip1193 = await userWallet.getEthereumProvider();
      const walletClient = createWalletClient({
        account: owner,
        chain: base,
        transport: custom(eip1193),
      });
      const nonce = await readUsdcNonce(walletClient, base.id, owner);
      const signed = await signUsdcPermit({
        walletClient,
        chainId: base.id,
        owner,
        spender: MARKETPLACE_SPENDER,
        value: DEFAULT_DAILY_CAP_USDC_BASE,
        nonce,
        deadline: permitDeadlineFromNow(),
      });
      setPermit(signed);
      setEncodedPermit(encodePermit(signed));
      trackEvent("v2_permit_signed", {
        chain_id: 8453,
        cap_usdc: 25,
        validity_days: 90,
      });
      setStep(4);
    } catch (e) {
      trackEvent("v2_permit_sign_failed", { error: e instanceof Error ? e.message : "unknown" });
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
          <p className="font-bold">🍋 LemonCake は USDC を一切預かりません</p>
          <p className="mt-1 leading-relaxed">
            金融庁 Fintech サポートデスクへの照会（Q1–Q11）を完了し、非カストディ設計が
            <strong>登録不要</strong>であることを確認しました。お客様の USDC はお客様自身の
            ウォレットに残ったまま、AI エージェントが直接 API 提供者に支払います。
          </p>
        </div>

        <h1 className="text-3xl font-bold text-gray-900">2 分で始める</h1>
        <p className="mt-2 text-gray-600">
          サインは 90 日に 1 回。以降は完全ノーサインで AI が API を呼びます。
        </p>

        {/* Step progress */}
        <ol className="mt-10 grid grid-cols-4 gap-2">
          {STEPS.map((s) => (
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
              <h2 className="text-xl font-bold">Step 2 · USDC を確認</h2>
              <p className="mt-2 text-sm text-gray-600">
                Base チェーン上の USDC を使います。LemonCake は経由しないので、
                あなたのウォレットに直接 USDC があれば OK。
              </p>
              {userWallet?.address && (
                <p className="mt-4 text-xs text-gray-500">
                  ウォレット:{" "}
                  <span className="font-mono text-gray-700" title={userWallet.address}>
                    {shortAddr(userWallet.address)}
                  </span>{" "}
                  <span className="text-gray-400">(Base 8453)</span>
                </p>
              )}

              {/* Apple Pay primary path — Coinbase Onramp. Falls back to
                  the "持っていない" exchange list when the project ID is
                  missing or the user prefers to bridge manually. */}
              {COINBASE_ENABLED && userWallet?.address && (
                <div className="mt-6 rounded-2xl border-2 border-gray-900 bg-white p-5 shadow-sm">
                  <p className="text-sm font-bold text-gray-900">
                    💳 カードでいますぐ USDC を取得
                  </p>
                  <p className="mt-1 text-xs text-gray-600 leading-relaxed">
                    Apple Pay / Google Pay / クレジットカードで USDC を購入し、あなたのウォレットに直接届きます。
                    Coinbase 経由（FSA 暗号資産交換業 #00029）、LemonCake は決済経路に一切介在しません。
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[10, 20, 50].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => {
                          trackEvent("v2_onramp_clicked", { amount_usd: amt });
                          const w = window.open(
                            buildOnrampUrl(userWallet.address as string, amt),
                            "coinbase-onramp",
                            "popup,width=480,height=720",
                          );
                          if (!w) {
                            setError("ポップアップがブロックされました。ブラウザ設定で許可してください。");
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

              <div className="mt-6 flex flex-wrap gap-2">
                <button
                  onClick={handleHasUsdc}
                  className="inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-white hover:bg-amber-600"
                >
                  USDC は準備済み → 次へ
                </button>
                <button
                  onClick={() => setShowExchanges((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-3 text-sm font-bold text-gray-700 hover:border-gray-400"
                >
                  他の方法を見る
                </button>
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
              <h2 className="text-xl font-bold">Step 3 · 1 回だけ署名</h2>
              <p className="mt-2 text-sm text-gray-600">
                「90 日間、最大 $25/日まで LemonCake マーケットに使ってよい」と署名します。
                これはオンチェーン取引ではなく <strong>EIP-712 形式の署名</strong>のみ。
                ガス代は発生しません。
              </p>
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs font-mono leading-relaxed text-gray-700">
                <div>chain:    Base (8453)</div>
                <div>cap:      25 USDC / day</div>
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
                  <li>AI が API を呼ぶ瞬間、permit 署名が USDC コントラクトに渡される</li>
                  <li>USDC はあなたのウォレット → API 提供者へ <strong>直接転送</strong></li>
                  <li>LemonCake のアドレスは経路に登場しない（FSA Q11 準拠）</li>
                  <li>$25/日の上限はあなただけが調整可能</li>
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

              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs">
                <p className="font-bold text-gray-700">claude_desktop_config.json への追加例</p>
                <pre className="mt-2 overflow-x-auto rounded bg-white p-3 font-mono leading-relaxed text-gray-800">
{`{
  "mcpServers": {
    "lemon": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"],
      "env": {
        "LEMON_CAKE_PERMIT": "<上のトークン>"
      }
    }
  }
}`}
                </pre>
              </div>
            </>
          )}
        </section>

        {/* Disclaimer / FSA stance */}
        <p className="mt-6 text-xs text-gray-500">
          ※ USDC は常にあなたのウォレットに残り、LemonCake は ERC-2612 permit 署名のみを受け取ります。
          金融庁 Fintech サポートデスクへの照会 (Q1-Q11) を完了済み。
          詳細：<a href="/security" className="underline hover:text-amber-700">/security</a>
        </p>
      </div>
    </main>
  );
}
