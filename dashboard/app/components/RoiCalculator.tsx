"use client";

import { useMemo, useState } from "react";
import { trackEvent } from "@/lib/analytics";

/* Interactive ROI calculator for /about (JA + EN).
 * Lets a seller feel the economics: LemonCake (3% after 3,000 free calls)
 * vs Stripe per-charge pricing (2.9% + $0.30), which goes NEGATIVE for
 * sub-cent calls — the core "different stack" argument, now in numbers. */

const COPY = {
  ja: {
    kicker: "Try the math",
    title: "あなたの API、いくらになる？",
    sub: "スライダーを動かすだけ。LemonCake と「Stripe で同じことをした場合」を並べて計算します。",
    calls: "月間コール数",
    price: "1 コール単価",
    yourTake: "あなたの手取り / 月",
    lcFee: "LemonCake 手数料 (3%)",
    freeNote: "最初の 3,000 コールは手数料 0 円",
    stripeTitle: "Stripe で 1 コールずつ課金すると…",
    stripeFee: "Stripe 手数料 (2.9% + $0.30/件)",
    stripeNegative: "1 コールごとに赤字 — サブセント課金は構造的に不可能",
    stripeTake: "手取り / 月",
    perCall: "コールあたり",
    cta: "この数字で始める →",
  },
  en: {
    kicker: "Try the math",
    title: "What would your API earn?",
    sub: "Drag the sliders. We compare LemonCake against running the same per-call billing on Stripe.",
    calls: "Calls per month",
    price: "Price per call",
    yourTake: "Your take / month",
    lcFee: "LemonCake fee (3%)",
    freeNote: "First 3,000 calls are fee-free",
    stripeTitle: "The same thing on Stripe…",
    stripeFee: "Stripe fee (2.9% + $0.30/charge)",
    stripeNegative: "Loses money on every call — sub-cent pricing is structurally impossible",
    stripeTake: "Take / month",
    perCall: "per call",
    cta: "Start with these numbers →",
  },
} as const;

const CALL_STOPS = [1_000, 3_000, 10_000, 30_000, 100_000, 300_000, 1_000_000, 3_000_000, 10_000_000];
const PRICE_STOPS = [0.005, 0.01, 0.02, 0.05, 0.1, 0.25, 0.5, 1];

function fmtUsd(n: number, digits = 0): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function fmtCalls(n: number): string {
  return n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1_000 ? `${n / 1_000}k` : String(n);
}

export function RoiCalculator({ locale }: { locale: "ja" | "en" }) {
  const t = COPY[locale];
  const [callIdx, setCallIdx] = useState(4); // 100k
  const [priceIdx, setPriceIdx] = useState(1); // $0.01

  const { calls, price, gross, lcFee, lcNet, stripeFee, stripeNet } = useMemo(() => {
    const calls = CALL_STOPS[callIdx];
    const price = PRICE_STOPS[priceIdx];
    const gross = calls * price;
    // LemonCake: first 3,000 calls fee-free (one-time; modeled monthly here as a floor), then 3%
    const billable = Math.max(0, calls - 3_000);
    const lcFee = billable * price * 0.03;
    const lcNet = gross - lcFee;
    // Stripe per-charge: 2.9% + $0.30 each
    const stripeFee = calls * (price * 0.029 + 0.3);
    const stripeNet = gross - stripeFee;
    return { calls, price, gross, lcFee, lcNet, stripeFee, stripeNet };
  }, [callIdx, priceIdx]);

  const stripeIsNegative = stripeNet < 0;
  const lcPct = gross > 0 ? Math.max(2, Math.round((lcNet / gross) * 100)) : 0;
  const stripePct = gross > 0 ? Math.round((Math.max(0, stripeNet) / gross) * 100) : 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-10">
      <p className="text-center text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-4">{t.kicker}</p>
      <h2 className="text-center text-3xl md:text-4xl font-black text-white mb-3 leading-tight">{t.title}</h2>
      <p className="text-center text-[14px] text-white/40 mb-10 max-w-xl mx-auto">{t.sub}</p>

      {/* sliders */}
      <div className="grid gap-6 md:grid-cols-2 max-w-3xl mx-auto mb-10">
        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-[11px] text-white/45 mb-2">
            {t.calls}
            <b className="text-[16px] text-[#fffd43]">{fmtCalls(calls)}</b>
          </span>
          <input
            type="range" min={0} max={CALL_STOPS.length - 1} step={1} value={callIdx}
            onChange={(e) => { setCallIdx(Number(e.target.value)); trackEvent("roi_calc_used", { knob: "calls" }); }}
            className="w-full accent-[#fffd43]"
            aria-label={t.calls}
          />
        </label>
        <label className="block">
          <span className="flex items-baseline justify-between font-mono text-[11px] text-white/45 mb-2">
            {t.price}
            <b className="text-[16px] text-[#fffd43]">${price}</b>
          </span>
          <input
            type="range" min={0} max={PRICE_STOPS.length - 1} step={1} value={priceIdx}
            onChange={(e) => { setPriceIdx(Number(e.target.value)); trackEvent("roi_calc_used", { knob: "price" }); }}
            className="w-full accent-[#fffd43]"
            aria-label={t.price}
          />
        </label>
      </div>

      {/* results */}
      <div className="grid gap-5 md:grid-cols-2 max-w-4xl mx-auto">
        {/* LemonCake */}
        <div className="rounded-2xl border border-[#fffd43]/30 bg-[#fffd43]/[0.06] p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#fffd43]/70 mb-3">LemonCake</p>
          <p className="text-[34px] md:text-[40px] font-black leading-none text-[#fffd43] tabular-nums">{fmtUsd(lcNet)}</p>
          <p className="mt-1 text-[12px] text-white/50">{t.yourTake}</p>
          <div className="mt-4 h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-[#fffd43] to-[#ffe066] transition-all duration-300" style={{ width: `${lcPct}%` }} />
          </div>
          <div className="mt-3 flex justify-between font-mono text-[11px] text-white/45">
            <span>{t.lcFee}: {fmtUsd(lcFee, lcFee < 100 ? 2 : 0)}</span>
            <span className="text-[#fffd43]/70">{t.freeNote}</span>
          </div>
        </div>
        {/* Stripe */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/40 mb-3">{t.stripeTitle}</p>
          <p className={`text-[34px] md:text-[40px] font-black leading-none tabular-nums ${stripeIsNegative ? "text-red-400" : "text-white/80"}`}>
            {fmtUsd(stripeNet)}
          </p>
          <p className="mt-1 text-[12px] text-white/50">{t.stripeTake}</p>
          <div className="mt-4 h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-300 ${stripeIsNegative ? "bg-red-500/70" : "bg-white/30"}`} style={{ width: `${stripeIsNegative ? 100 : stripePct}%` }} />
          </div>
          <div className="mt-3 font-mono text-[11px] text-white/45">
            {t.stripeFee}: {fmtUsd(stripeFee)}
            {stripeIsNegative && (
              <span className="mt-1 block font-bold text-red-400">
                −{fmtUsd(Math.abs(stripeNet / calls), 2)} {t.perCall} — {t.stripeNegative}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 text-center">
        <a
          href="/app"
          onClick={() => trackEvent("cta_click", { cta: "roi_calc_start", page: `about_${locale}` })}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#fffd43] text-[#1a0f00] font-bold rounded-lg hover:bg-[#ffe066] transition-colors text-sm"
        >
          {t.cta}
        </a>
      </div>
    </div>
  );
}
