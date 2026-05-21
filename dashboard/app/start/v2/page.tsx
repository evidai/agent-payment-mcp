"use client";

/**
 * /start/v2 — Non-custodial onboarding.
 *
 * Post-FSA-Q11 architecture. LemonCake never holds USDC. The user signs
 * ONE ERC-2612 permit (~90 days valid) and the resulting signature
 * replaces the legacy Pay Token JWT entirely.
 *
 * Flow (target: 2 minutes, 1 wallet signature, then noop forever):
 *   1. Privy "Sign in with Google" → embedded wallet auto-created.
 *   2. Stripe / Coinbase on-ramp → USDC lands in the user's wallet on Base.
 *   3. One ERC-2612 permit signature: "spend up to $25/day from my wallet,
 *      valid 90 days, only to this LemonCake marketplace spender address".
 *   4. Show the encoded permit blob — paste into MCP config as
 *      `LEMON_CAKE_PERMIT` and we're done.
 *
 * This file gracefully falls back to a mocked signing flow if Privy is
 * not configured (NEXT_PUBLIC_PRIVY_APP_ID unset). That keeps the page
 * demoable during development without breaking the user-visible Step 4.
 */

import { useState } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { createWalletClient, custom, type WalletClient } from "viem";
import { base } from "viem/chains";
import {
  encodePermit,
  permitDeadlineFromNow,
  signUsdcPermit,
  USDC_ADDRESS,
  type SignedPermit,
} from "@/lib/permit";
import { trackEvent } from "@/lib/analytics";
import { PRIVY_ENABLED } from "@/Providers";

// Marketplace spender — temporary placeholder until per-service
// receivers are surfaced from the marketplace API. This address never
// holds USDC; it only acts as the allowed `transferFrom` caller, so
// FSA Q11's "non-custodial" condition still applies.
const MARKETPLACE_SPENDER = "0x000000000000000000000000000000000000dEaD" as const;

// $25.00 USDC daily cap (USDC uses 6 decimals).
const DEFAULT_DAILY_CAP_USDC_BASE = BigInt(25_000_000);

// Stripe Crypto on-ramp URL pattern. Stripe is enabled per-customer
// at https://dashboard.stripe.com/test/crypto/onramp — set
// NEXT_PUBLIC_STRIPE_ONRAMP_PUBLISHABLE_KEY to switch from the demo
// onramp to a live integration.
const STRIPE_ONRAMP_PK = process.env.NEXT_PUBLIC_STRIPE_ONRAMP_PUBLISHABLE_KEY ?? "";

const STEPS = [
  { id: 1, label: "Google でサインイン", detail: "Privy 経由でウォレットを自動作成" },
  { id: 2, label: "USDC を入金",           detail: "クレカ → USDC（Stripe / Coinbase onramp）" },
  { id: 3, label: "1 回だけ署名",          detail: "ERC-2612 permit — 90日間有効" },
  { id: 4, label: "完了",                   detail: "以降は完全ノーサイン" },
] as const;

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

  // Privy hooks safely no-op when PRIVY_ENABLED is false (provider not
  // mounted, hooks return defaults).
  const privy = usePrivy();
  const { wallets } = useWallets();

  const isPrivyReady = PRIVY_ENABLED && privy.ready;
  const isAuthenticated = PRIVY_ENABLED && privy.authenticated;
  const userWallet = wallets[0];

  // ── Step 1: Connect ───────────────────────────────────────────────────
  async function handleSignIn() {
    trackEvent("v2_signin_started", { path: "wallet_create", privy: PRIVY_ENABLED });
    if (PRIVY_ENABLED) {
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
    }
    setStep(2);
  }

  // ── Step 2: USDC on-ramp ──────────────────────────────────────────────
  async function handleTopup() {
    trackEvent("v2_topup_clicked", { provider: STRIPE_ONRAMP_PK ? "stripe_crypto" : "demo" });
    if (STRIPE_ONRAMP_PK && userWallet?.address) {
      // Real flow: open Stripe Crypto onramp targeting the user's wallet
      // address. The Stripe widget handles the entire on-ramp UI; USDC
      // arrives directly in the user's wallet on Base.
      // (We open a new tab and let the user return when funded.)
      const target = encodeURIComponent(userWallet.address);
      window.open(
        `https://crypto.link.com/?pk=${STRIPE_ONRAMP_PK}&destinationCurrency=usdc&destinationNetwork=base&destinationAddress=${target}`,
        "_blank",
        "noopener",
      );
    }
    // Whether we opened Stripe or not, advance the step so the user can
    // proceed to sign. (Permit doesn't require USDC balance at sign time —
    // it's an authorisation, not a transfer.)
    setStep(3);
  }

  // ── Step 3: Sign the permit ───────────────────────────────────────────
  async function handleSignPermit() {
    setError(null);
    setSigning(true);
    try {
      if (PRIVY_ENABLED && userWallet) {
        // Real signing path: build a viem WalletClient on top of the
        // user's connected wallet (embedded or external) and call
        // signUsdcPermit() against USDC's EIP-712 domain.
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
      } else {
        // Mocked fallback for dev / Privy-disabled builds. Same shape as
        // the real signed permit so downstream UI works identically.
        const deadline = permitDeadlineFromNow();
        const fake: SignedPermit = {
          owner:     "0x0000000000000000000000000000000000000001",
          spender:   MARKETPLACE_SPENDER,
          value:     DEFAULT_DAILY_CAP_USDC_BASE,
          nonce:     BigInt(0),
          deadline,
          chainId:   8453,
          v:         27,
          r:         "0x" + "11".repeat(32) as `0x${string}`,
          s:         "0x" + "22".repeat(32) as `0x${string}`,
          usdc:      USDC_ADDRESS[8453],
          signature: ("0x" + "11".repeat(32) + "22".repeat(32) + "1b") as `0x${string}`,
        };
        setPermit(fake);
        setEncodedPermit(encodePermit(fake));
      }
      trackEvent("v2_permit_signed", {
        chain_id: 8453,
        cap_usdc: 25,
        validity_days: 90,
        path: PRIVY_ENABLED ? "real" : "mock",
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
          <p className="font-bold">🍋 新しい仕組み — LemonCake は USDC を一切預かりません</p>
          <p className="mt-1 leading-relaxed">
            金融庁照会（Q1-Q11）を完了し、非カストディ設計が登録不要であることを確認しました。
            お客様の USDC はお客様自身のウォレットに残ったまま、AI エージェントが直接 API 提供者に支払います。
          </p>
        </div>

        <h1 className="text-3xl font-bold text-gray-900">2 分で始める</h1>
        <p className="mt-2 text-gray-600">サインは 90 日に 1 回。以降は完全ノーサインで AI が API を呼びます。</p>

        {!PRIVY_ENABLED && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-xs font-bold text-gray-600">
            ⚠️ Privy App ID 未設定 — 署名はモックで動作中（本番では実署名）
          </div>
        )}

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
              <h2 className="text-xl font-bold">Step 1 · Google でサインイン</h2>
              <p className="mt-2 text-sm text-gray-600">
                Privy が裏でウォレットを自動生成します。秘密鍵はあなたのデバイスにのみ存在し、LemonCake は触りません。
              </p>
              <button
                onClick={handleSignIn}
                disabled={PRIVY_ENABLED && !isPrivyReady}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {PRIVY_ENABLED && !isPrivyReady
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
              <h2 className="text-xl font-bold">Step 2 · USDC を $20 入金</h2>
              <p className="mt-2 text-sm text-gray-600">
                クレジットカードで USDC を直接購入し、あなたのウォレットに届きます。LemonCake は経由しません。
              </p>
              {userWallet?.address && (
                <p className="mt-3 text-xs font-mono text-gray-500">
                  送金先（自分のウォレット）: {userWallet.address}
                </p>
              )}
              <button
                onClick={handleTopup}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-white hover:bg-amber-600"
              >
                {STRIPE_ONRAMP_PK ? "クレジットカードで入金（Stripe Crypto）" : "クレジットカードで入金"}
              </button>
              <button
                onClick={() => setStep(3)}
                className="ml-2 mt-6 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-3 text-xs font-bold text-gray-700 hover:border-gray-400"
              >
                既に USDC を持っている
              </button>
              {!STRIPE_ONRAMP_PK && (
                <p className="mt-3 text-xs text-gray-500">
                  ⚠️ Stripe Crypto on-ramp 未設定 — オンランプボタンはダミー動作です（本番では実遷移）
                </p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-bold">Step 3 · 1 回だけ署名</h2>
              <p className="mt-2 text-sm text-gray-600">
                「90 日間、最大 $25/日まで LemonCake API マーケットに使ってよい」と署名します。
                これだけで以降は完全ノーサインで AI が API を呼びます。
              </p>
              <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs font-mono leading-relaxed text-gray-700">
                <div>spender:  {MARKETPLACE_SPENDER}</div>
                <div>cap:      25 USDC / day</div>
                <div>validity: 90 days</div>
                <div>chain:    Base (8453)</div>
                {userWallet?.address && <div>owner:    {userWallet.address}</div>}
              </div>
              {error && (
                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              <button
                onClick={handleSignPermit}
                disabled={signing || (PRIVY_ENABLED && !userWallet)}
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
