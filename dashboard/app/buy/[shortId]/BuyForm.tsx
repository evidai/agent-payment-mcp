"use client";

import { useEffect, useState } from "react";

const PRESETS = [5, 20, 50];

export default function BuyForm({
  shortId,
  name,
  pricePerCall,
}: {
  shortId: string;
  name: string;
  pricePerCall: string;
}) {
  const [amount, setAmount] = useState<number>(20);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("canceled")) setCanceled(true);
  }, []);

  const price = Number(pricePerCall);
  const estCalls = price > 0 && amount > 0 ? Math.floor(amount / price).toLocaleString() : "—";

  async function buy() {
    setErr(null);
    if (!(amount >= 1)) { setErr("最低 $1 から購入できます。"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/lc/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortId, amount }),
      });
      const j = await r.json();
      if (!r.ok || !j.url) {
        setErr(j.message || j.error || "決済を開始できませんでした。");
        setBusy(false);
        return;
      }
      window.location.href = j.url; // → Stripe-hosted Checkout
    } catch {
      setErr("ネットワークエラーが発生しました。");
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-black/10 p-7 shadow-sm">
      <div className="text-2xl mb-3">🍋</div>
      <p className="text-[11px] font-bold tracking-widest text-black/40 uppercase mb-1">API クレジットを購入</p>
      <h1 className="text-xl font-bold leading-tight mb-1.5">{name}</h1>
      <p className="text-[13px] text-black/55 mb-5">
        前払いした分だけ API を呼び出せます。1 回あたり{" "}
        <span className="font-semibold text-black/75">${price}</span>。
      </p>

      {canceled && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[12.5px] text-amber-800">
          決済はキャンセルされました。もう一度お試しください。
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setAmount(p)}
            className={`py-2.5 rounded-xl text-sm font-bold border transition ${
              amount === p
                ? "bg-[#1a0f00] text-white border-[#1a0f00]"
                : "bg-white text-[#1a0f00] border-black/15 hover:border-black/35"
            }`}
          >
            ${p}
          </button>
        ))}
      </div>

      <label className="block mb-1 text-[12px] font-semibold text-black/55">カスタム金額 (USD)</label>
      <div className="flex items-center mb-4 rounded-xl border border-black/15 px-3 focus-within:border-black/40">
        <span className="text-black/40 font-semibold">$</span>
        <input
          type="number"
          min={1}
          max={5000}
          step={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
          className="w-full px-2 py-2.5 outline-none bg-transparent text-sm font-semibold"
        />
      </div>

      <p className="text-[12.5px] text-black/55 mb-5">
        ≈ <span className="font-bold text-black/80">{estCalls}</span> 回分のリクエスト
      </p>

      {err && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12.5px] text-red-700">
          {err}
        </div>
      )}

      <button
        type="button"
        onClick={buy}
        disabled={busy}
        className="w-full py-3 rounded-xl bg-[#635bff] text-white font-bold text-sm hover:brightness-110 transition disabled:opacity-50"
      >
        {busy ? "リダイレクト中…" : `Stripe で $${amount} を支払う`}
      </button>

      <p className="mt-4 text-[11px] leading-relaxed text-black/40 text-center">
        決済は Stripe により安全に処理されます。完了後、API キー（Pay Token）が発行されます。
      </p>
    </div>
  );
}
