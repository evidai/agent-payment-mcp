"use client";

/**
 * /start/v2 — Non-custodial onboarding prototype.
 *
 * This is the post-FSA-Q11 architecture: LemonCake never holds USDC.
 * The user signs ONE ERC-2612 permit (~90 days valid) and the resulting
 * signature replaces the legacy Pay Token JWT entirely.
 *
 * Flow (target: 2 minutes, 1 wallet signature, then noop forever):
 *   1. Privy "Sign in with Google" → embedded wallet auto-created.
 *   2. (Out of scope here) Stripe/Coinbase on-ramp → USDC arrives in the
 *      user's wallet on Base.
 *   3. One ERC-2612 permit signature: "spend up to $25/day from my wallet,
 *      valid 90 days, only to this LemonCake marketplace spender address".
 *   4. Show the encoded permit blob — paste into MCP config as
 *      `LEMON_CAKE_PERMIT` and we're done.
 *
 * This file is intentionally a thin client-side shell — all the regulated
 * concerns (USDC custody, JWT issuance) are gone. The "secret" lives in
 * the user's wallet and travels as a signature, never as state on our
 * servers.
 *
 * Production hardening (later, not this prototype):
 *   - Wrap with <PrivyProvider> in app/layout.tsx
 *   - Hook up Wagmi for chain switching + USDC balance read
 *   - Stripe Crypto on-ramp button
 *   - Persist permit to user's account so they can re-fetch it on a new device
 */

import { useState } from "react";
import { encodePermit, permitDeadlineFromNow, type SignedPermit } from "@/lib/permit";

// The marketplace spender — for the prototype, hardcode a single
// LemonCake-controlled (but USDC-untouching) paymaster address. In
// production this comes from a discovery API and can be per-service.
const MARKETPLACE_SPENDER = "0x000000000000000000000000000000000000dEaD" as const;

// $25.00 USDC daily cap (USDC uses 6 decimals) — sane default for the
// permit value. Users will be able to raise / lower on the real flow.
const DEFAULT_DAILY_CAP_USDC_BASE = BigInt(25_000_000);

const STEPS = [
  { id: 1, label: "Google でサインイン", detail: "Privy 経由でウォレットを自動作成" },
  { id: 2, label: "USDC を入金",           detail: "クレカ → USDC（Stripe / Coinbase onramp）" },
  { id: 3, label: "1 回だけ署名",          detail: "ERC-2612 permit — 90日間有効" },
  { id: 4, label: "完了",                   detail: "以降は完全ノーサイン" },
] as const;

export default function StartV2Page() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [permit, setPermit] = useState<SignedPermit | null>(null);
  const [encodedPermit, setEncodedPermit] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Step 1: Connect (mocked Privy login for the prototype) ─────────────
  async function handleSignIn() {
    // Real impl: const { user, login } = usePrivy(); await login();
    // For the prototype just advance the step.
    setStep(2);
  }

  // ── Step 2: USDC top-up (mocked onramp) ───────────────────────────────
  async function handleTopup() {
    // Real impl: open Stripe Crypto onramp targeting the user's embedded
    // wallet address on Base. The USDC arrives directly in the user's
    // wallet — LemonCake never sees it.
    setStep(3);
  }

  // ── Step 3: Sign the permit ───────────────────────────────────────────
  async function handleSignPermit() {
    setError(null);
    try {
      // Real impl: get walletClient from Privy, query USDC.nonces(owner),
      // then call signUsdcPermit({ walletClient, chainId: 8453, owner,
      // spender: MARKETPLACE_SPENDER, value: DEFAULT_DAILY_CAP_USDC_BASE,
      // nonce, deadline }).
      //
      // For the prototype, fabricate a permit shape so the UI flow can be
      // demoed without a connected wallet. The real signing call returns
      // the same shape — only `signature`, `v`, `r`, `s` change.
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
        usdc:      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        signature: ("0x" + "11".repeat(32) + "22".repeat(32) + "1b") as `0x${string}`,
      };
      setPermit(fake);
      setEncodedPermit(encodePermit(fake));
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "署名に失敗しました");
    }
  }

  async function copyToken() {
    await navigator.clipboard.writeText(encodedPermit);
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
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white hover:bg-gray-800"
              >
                Google でサインイン
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-bold">Step 2 · USDC を $20 入金</h2>
              <p className="mt-2 text-sm text-gray-600">
                クレジットカードで USDC を直接購入し、あなたのウォレットに届きます。LemonCake は経由しません。
              </p>
              <button
                onClick={handleTopup}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-white hover:bg-amber-600"
              >
                クレジットカードで入金
              </button>
              <button
                onClick={() => setStep(3)}
                className="ml-2 mt-6 inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-6 py-3 text-xs font-bold text-gray-700 hover:border-gray-400"
              >
                既に USDC を持っている
              </button>
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
              </div>
              {error && (
                <div className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  {error}
                </div>
              )}
              <button
                onClick={handleSignPermit}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-500 px-6 py-3 text-sm font-bold text-white hover:bg-amber-600"
              >
                署名する（1 回のみ）
              </button>
            </>
          )}

          {step === 4 && permit && (
            <>
              <h2 className="text-xl font-bold">Step 4 · 完了 🎉</h2>
              <p className="mt-2 text-sm text-gray-600">
                以下のトークンを MCP クライアントの設定にコピペして使ってください。
                90 日後に更新通知が届きます。それまで完全ノーサインです。
              </p>

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
          ※ このページは非カストディ版（v2）プロトタイプです。USDC は常にあなたのウォレットに残り、
          LemonCake は ERC-2612 permit 署名のみを受け取ります。金融庁 Fintech サポートデスクへの
          照会 (Q1-Q11) を完了済み。
        </p>
      </div>
    </main>
  );
}
