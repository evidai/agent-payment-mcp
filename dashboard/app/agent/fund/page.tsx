"use client";

/**
 * /agent/fund — Phase 1b card-save entry (hosted Stripe Checkout, setup mode).
 *
 * The operator pastes their Buyer Key (bk_…), sees the wallet, and clicks "Save
 * a card" → redirected to a Stripe-hosted page (3DS there). After saving, the
 * agent can top up off-session. Test harness: in Stripe test mode, use card
 * 4242 4242 4242 4242.
 */
import { useEffect, useState } from "react";

type Wallet = {
  balanceCents: number;
  activeTokens: number;
  spentTodayCents: number;
  spentMonthCents: number;
  caps: { perMintCents: number; dailyCents: number; monthlyCents: number };
  lowThresholdPct: number;
};

const usd = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function AgentFundPage() {
  const [bk, setBk] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [canceled, setCanceled] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCanceled(new URLSearchParams(window.location.search).get("canceled") === "1");
    }
  }, []);

  async function loadWallet() {
    if (!bk.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/lc/agent/wallet", { headers: { Authorization: `Bearer ${bk.trim()}` } });
      const j = await r.json();
      if (!r.ok) { setErr(j.error || "failed"); setWallet(null); }
      else setWallet(j.wallet);
    } catch { setErr("network_error"); } finally { setBusy(false); }
  }

  async function saveCard() {
    if (!bk.trim()) { setErr("Enter your Buyer Key first."); return; }
    setErr(null);
    setBusy(true);
    try {
      const r = await fetch("/api/lc/agent/setup-checkout", { method: "POST", headers: { Authorization: `Bearer ${bk.trim()}` } });
      const j = await r.json();
      if (!r.ok || !j.url) { setErr(j.error || "failed"); return; }
      window.location.href = j.url as string;
    } catch { setErr("network_error"); } finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased px-6 py-12">
      <div className="max-w-[480px] mx-auto">
        <h1 className="text-[24px] font-black mb-1">Fund your agent</h1>
        <p className="text-[13px] text-[#1a0f00]/60 mb-6 leading-relaxed">
          Save a card once. Your agent then tops up its prepaid balance off-session, capped by your limits. LemonCake never holds your funds.
        </p>

        {canceled && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">Card setup canceled.</p>
        )}

        <label className="block text-[11px] font-bold uppercase tracking-widest text-[#1a0f00]/55 mb-1">Buyer Key</label>
        <div className="flex gap-2 mb-2">
          <input
            type="password"
            value={bk}
            onChange={(e) => setBk(e.target.value)}
            placeholder="bk_…"
            className="flex-1 min-w-0 px-3 py-2 bg-white border border-[#1a0f00]/15 rounded-lg text-[13px] font-mono focus:outline-none focus:border-[#1a0f00]/55"
          />
          <button type="button" onClick={loadWallet} disabled={busy || !bk.trim()} className="flex-shrink-0 px-3 py-2 bg-white border border-[#1a0f00]/15 text-[12px] font-semibold rounded-lg hover:bg-[#1a0f00]/[0.03] disabled:opacity-50">Check</button>
        </div>

        {wallet && (
          <div className="mb-4 rounded-xl bg-white border border-[#1a0f00]/10 p-4 text-[12.5px]">
            <div className="flex justify-between mb-1"><span className="text-[#1a0f00]/60">Balance</span><span className="font-mono font-bold">{usd(wallet.balanceCents)}</span></div>
            <div className="flex justify-between mb-1"><span className="text-[#1a0f00]/60">Active tokens</span><span className="font-mono">{wallet.activeTokens}</span></div>
            <div className="flex justify-between mb-1"><span className="text-[#1a0f00]/60">Spent today / cap</span><span className="font-mono">{usd(wallet.spentTodayCents)} / {usd(wallet.caps.dailyCents)}</span></div>
            <div className="flex justify-between"><span className="text-[#1a0f00]/60">Auto-refill threshold</span><span className="font-mono">{wallet.lowThresholdPct}%</span></div>
          </div>
        )}

        <button
          type="button"
          onClick={saveCard}
          disabled={busy || !bk.trim()}
          className="w-full py-3 bg-[#635BFF] text-white font-bold text-[14px] rounded-xl hover:bg-[#7A73FF] transition-colors disabled:opacity-50"
        >
          {busy ? "…" : "Save a card →"}
        </button>

        {err && <p className="mt-3 text-[12px] text-[#DC2626]">Error: {err}</p>}

        <p className="mt-6 text-[11px] text-[#1a0f00]/45 leading-relaxed">
          You&apos;ll be redirected to Stripe to enter card details (3-D Secure handled there). Card data never touches LemonCake. Test mode card: 4242 4242 4242 4242.
        </p>
      </div>
    </main>
  );
}
