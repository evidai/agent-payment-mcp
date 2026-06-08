"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

/* ─────────────────────────── types ─────────────────────────── */

type Session = {
  jwt: string;
  shortId: string;
  gatewayPath: string;
  endpoint: { name: string; pricePerCall: number };
  token: { jti: string; budget: number; maxCalls: number; expiresAt: string };
};

type Run = {
  n: number;
  ok: boolean;
  status: number;
  ms: number;
  charge: number;
  label: string;
};

/* ─────────────────────────── icons ─────────────────────────── */

const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const IconBolt = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const IconKey = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

/* ─────────────────────────── component ─────────────────────────── */

export default function DemoClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [minting, setMinting] = useState(false);
  const [calling, setCalling] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const successfulCalls = useMemo(() => runs.filter((r) => r.ok).length, [runs]);
  const revenue = useMemo(() => runs.reduce((s, r) => s + (r.ok ? r.charge : 0), 0), [runs]);
  const callsLeft = session ? Math.max(0, session.token.maxCalls - successfulCalls) : 0;
  const exhausted = !!session && callsLeft <= 0;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://www.lemoncake.xyz";

  async function mintToken() {
    setMinting(true);
    setError(null);
    try {
      const res = await fetch("/api/lc/demo/token", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error === "backend_not_configured" ? "Demo backend is warming up — try again shortly." : (json?.error ?? "Could not mint a token."));
        return;
      }
      setSession(json as Session);
      setRuns([]);
    } catch {
      setError("Network error — please retry.");
    } finally {
      setMinting(false);
    }
  }

  async function testCall() {
    if (!session || calling || exhausted) return;
    setCalling(true);
    setError(null);
    try {
      const res = await fetch(session.gatewayPath, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.jwt}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ping: runs.length + 1, from: "lemoncake-demo" }),
      });
      const charge = Number(res.headers.get("x-lemoncake-charge") ?? session.endpoint.pricePerCall);
      const ms = Number(res.headers.get("x-lemoncake-upstream-ms") ?? 0);
      let label = "paid call";
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        label = (j && j.error) || `HTTP ${res.status}`;
      }
      setRuns((prev) => [
        { n: prev.length + 1, ok: res.ok, status: res.status, ms, charge: res.ok ? charge : 0, label },
        ...prev,
      ]);
    } catch {
      setError("Network error — please retry.");
    } finally {
      setCalling(false);
    }
  }

  const curlCmd = session
    ? `curl -s -X POST ${origin}${session.gatewayPath} \\
  -H "Authorization: Bearer ${session.jwt}" \\
  -H "Content-Type: application/json" \\
  -d '{"ping":1}'`
    : "";

  async function copyCurl() {
    if (!curlCmd) return;
    try {
      await navigator.clipboard.writeText(curlCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className="grid md:grid-cols-2 gap-5">
      {/* ── Control panel ── */}
      <div className="rounded-3xl bg-white border border-[#1a0f00]/10 p-6 md:p-7 flex flex-col">
        {/* demo API summary */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-1">Demo API</p>
            <p className="text-[15px] font-black">LemonCake Demo API</p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#fffd43] text-[#1a0f00] text-[11px] font-bold">$0.01 / call</span>
        </div>

        {/* Step 1 */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-[#1a0f00] text-[#fffd43] text-[11px] font-black flex items-center justify-center">1</span>
            <p className="text-[13px] font-bold">Mint a Pay Token</p>
          </div>
          <p className="text-[12px] text-[#1a0f00]/55 mb-3 pl-7 leading-relaxed">
            A bounded, signed token — $0.20 budget, 20 calls, expires in 1 hour. No sign-up.
          </p>
          <div className="pl-7">
            <button
              onClick={mintToken}
              disabled={minting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1a0f00] text-[#fffd43] text-[13px] font-bold hover:bg-[#1a0f00]/85 transition-colors disabled:opacity-50"
            >
              <IconKey />
              {minting ? "Minting…" : session ? "Mint a fresh token" : "Mint a Pay Token"}
            </button>
          </div>

          {session && (
            <div className="pl-7 mt-3 animate-fade-in">
              <div className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/10 p-3 font-mono text-[11px] text-[#1a0f00]/70 break-all">
                <span className="text-[#1a0f00]/40">Bearer </span>
                {session.jwt.slice(0, 28)}…{session.jwt.slice(-8)}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[#1a0f00]/55">
                <span>budget <b className="text-[#1a0f00]">${session.token.budget.toFixed(2)}</b></span>
                <span>calls left <b className="text-[#1a0f00]">{callsLeft}/{session.token.maxCalls}</b></span>
                <span>gateway <b className="text-[#1a0f00] font-mono">{session.gatewayPath}</b></span>
              </div>
            </div>
          )}
        </div>

        {/* Step 2 */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-5 h-5 rounded-full bg-[#1a0f00] text-[#fffd43] text-[11px] font-black flex items-center justify-center">2</span>
            <p className="text-[13px] font-bold">Make a paid call</p>
          </div>
          <p className="text-[12px] text-[#1a0f00]/55 mb-3 pl-7 leading-relaxed">
            Sends a real request through the production gateway. Metering happens server-side.
          </p>
          <div className="pl-7">
            <button
              onClick={testCall}
              disabled={!session || calling || exhausted}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fffd43] text-[#1a0f00] text-[13px] font-bold hover:bg-[#fffd43]/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <IconBolt />
              {calling ? "Calling…" : exhausted ? "Token spent" : "Test Call"}
            </button>
            {exhausted && (
              <p className="text-[11px] text-[#1a0f00]/50 mt-2">Token spent — mint a fresh one to keep going.</p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-[#FEF2F2] border border-[#DC2626]/20 px-3 py-2 text-[12px] text-[#DC2626] mb-4">
            {error}
          </div>
        )}

        {/* curl reproduction */}
        {session && (
          <div className="mt-auto pt-2 animate-fade-in">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest">Reproduce with curl</p>
              <button onClick={copyCurl} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors">
                <IconCopy />{copied ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="rounded-xl bg-[#1a0f00] text-[#fffd43]/90 p-3 text-[10.5px] leading-relaxed overflow-x-auto font-mono">{curlCmd}</pre>
          </div>
        )}
      </div>

      {/* ── Usage ledger ── */}
      <div className="rounded-3xl bg-white border border-[#1a0f00]/10 p-6 md:p-7 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-1">Usage ledger</p>
            <p className="text-[15px] font-black">Live metering</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-[#1a0f00]/45">Revenue</p>
            <p className="text-[20px] font-black tabular-nums">${revenue.toFixed(2)}</p>
          </div>
        </div>

        {/* economics strip */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-2.5 text-center">
            <p className="text-[10px] text-[#1a0f00]/45 uppercase tracking-wider">Calls</p>
            <p className="text-[15px] font-black tabular-nums">{successfulCalls}</p>
          </div>
          <div className="rounded-xl bg-[#F0FDF4] border border-[#16A34A]/15 p-2.5 text-center">
            <p className="text-[10px] text-[#16A34A] uppercase tracking-wider">You keep</p>
            <p className="text-[15px] font-black tabular-nums text-[#16A34A]">97%</p>
          </div>
          <div className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-2.5 text-center">
            <p className="text-[10px] text-[#1a0f00]/45 uppercase tracking-wider">Fee</p>
            <p className="text-[15px] font-black tabular-nums">3%</p>
          </div>
        </div>

        {/* ledger rows */}
        <div className="flex-1 min-h-[180px]">
          {runs.length === 0 ? (
            <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[#1a0f00]/12">
              <p className="text-[13px] text-[#1a0f00]/45 font-medium">No calls yet</p>
              <p className="text-[11.5px] text-[#1a0f00]/35 mt-1">Mint a token, then hit <b>Test Call</b>.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {/* header row */}
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-3 text-[10px] font-bold text-[#1a0f00]/35 uppercase tracking-wider">
                <span>#</span><span>Result</span><span className="text-right">Latency</span><span className="text-right">Charge</span>
              </div>
              {runs.map((r) => (
                <div
                  key={r.n}
                  className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-3 py-2 rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 text-[12px] animate-fade-in"
                >
                  <span className="font-mono text-[#1a0f00]/40 tabular-nums">{r.n}</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${r.ok ? "bg-[#16A34A]" : "bg-[#DC2626]"}`} />
                    <span className={`font-semibold ${r.ok ? "text-[#1a0f00]" : "text-[#DC2626]"}`}>
                      {r.ok ? `${r.status} ${r.label}` : r.label}
                    </span>
                  </span>
                  <span className="text-right font-mono text-[#1a0f00]/55 tabular-nums">{r.ms}ms</span>
                  <span className="text-right font-mono font-bold tabular-nums">{r.ok ? `$${r.charge.toFixed(2)}` : "—"}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[10.5px] text-[#1a0f00]/35 mt-4 leading-relaxed">
          Sandbox ledger — no real funds move. Your first 3,000 live calls are fee-free for the lifetime of the seller account; the 3% monetization fee applies only after that.
        </p>
      </div>

      {/* ── CTA below the grid ── */}
      <div className="md:col-span-2 rounded-3xl bg-[#fffd43] p-8 md:p-10 text-center mt-1">
        <h2 className="text-2xl md:text-3xl font-black leading-tight mb-2">Now do it with your own API.</h2>
        <p className="text-[13.5px] text-[#1a0f00]/65 mb-6 max-w-md mx-auto">
          Paste a URL, get a paid gateway endpoint and a Pay Token in under a minute. No monthly fee.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/app" className="inline-flex items-center gap-2 px-7 py-3 bg-[#1a0f00] text-[#fffd43] font-bold rounded-xl hover:bg-[#1a0f00]/85 transition-colors text-[14px]">
            Open the dashboard <IconArrow />
          </Link>
          <Link href="/docs" className="inline-flex items-center gap-2 px-7 py-3 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold rounded-xl hover:bg-white/85 transition-colors text-[14px]">
            Read the docs
          </Link>
        </div>
      </div>
    </div>
  );
}
