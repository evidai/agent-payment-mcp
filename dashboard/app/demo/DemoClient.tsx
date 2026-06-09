"use client";

import Link from "next/link";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

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

type CodeTab = "curl" | "mcp" | "node";

const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const IconCheck = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const IconKey = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6" />
    <path d="m15.5 7.5 3 3L22 7l-3-3" />
  </svg>
);

const IconZap = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

export default function DemoClient() {
  const [session, setSession] = useState<Session | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [minting, setMinting] = useState(false);
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [codeTab, setCodeTab] = useState<CodeTab>("curl");
  const [origin, setOrigin] = useState("https://www.lemoncake.xyz");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const successfulCalls = useMemo(() => runs.filter((run) => run.ok).length, [runs]);
  const revenue = useMemo(() => runs.reduce((sum, run) => sum + (run.ok ? run.charge : 0), 0), [runs]);
  const callsLeft = session ? Math.max(0, session.token.maxCalls - successfulCalls) : 0;
  const exhausted = Boolean(session && callsLeft <= 0);

  const eventLog = useMemo(() => {
    const events = [
      {
        label: "Sandbox ready",
        detail: "Demo endpoint is priced at $0.01 per call.",
        state: "done" as const,
      },
      {
        label: "Pay Token issued",
        detail: session ? `$${session.token.budget.toFixed(2)} cap, ${session.token.maxCalls} calls, 1 hour.` : "Click mint to create a bounded credential.",
        state: session ? ("done" as const) : ("next" as const),
      },
      {
        label: "Gateway verified",
        detail: runs.length > 0 ? "Bearer token checked before the upstream API sees traffic." : "Run a metered call to verify the token.",
        state: runs.length > 0 ? ("done" as const) : session ? ("next" as const) : ("idle" as const),
      },
      {
        label: "Seller ledger updated",
        detail: successfulCalls > 0 ? `${successfulCalls} paid call${successfulCalls === 1 ? "" : "s"} recorded.` : "Revenue appears here after a successful call.",
        state: successfulCalls > 0 ? ("done" as const) : ("idle" as const),
      },
    ];
    return events;
  }, [runs.length, session, successfulCalls]);

  const gatewayUrl = session ? `${origin}${session.gatewayPath}` : `${origin}/g/{shortId}`;
  const maskedToken = session ? `${session.jwt.slice(0, 34)}...${session.jwt.slice(-10)}` : "mint_a_token_first";
  const curlCmd = `curl -s -X POST ${gatewayUrl} \\
  -H "Authorization: Bearer ${session ? session.jwt : "$LC_PAY_TOKEN"}" \\
  -H "Content-Type: application/json" \\
  -d '{"ping":1}'`;
  const mcpConfig = `{
  "mcpServers": {
    "paid-api": {
      "command": "npx",
      "args": ["-y", "agent-payment-mcp"],
      "env": {
        "LC_PAY_TOKEN": "${session ? maskedToken : "paste_pay_token_here"}"
      }
    }
  }
}`;
  const nodeSnippet = `const res = await fetch("${gatewayUrl}", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.LC_PAY_TOKEN}\`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ ping: 1 })
});

console.log(await res.json());`;

  const activeSnippet = codeTab === "curl" ? curlCmd : codeTab === "mcp" ? mcpConfig : nodeSnippet;

  async function mintToken() {
    setMinting(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch("/api/lc/demo/token", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error === "backend_not_configured" ? "Demo backend is not configured in this local environment." : (json?.error ?? "Could not mint a token."));
        return;
      }
      setSession(json as Session);
      setRuns([]);
    } catch {
      setError("Network error. Please retry.");
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
        const body = await res.json().catch(() => null);
        label = (body && body.error) || `HTTP ${res.status}`;
      }
      setRuns((prev) => [
        { n: prev.length + 1, ok: res.ok, status: res.status, ms, charge: res.ok ? charge : 0, label },
        ...prev,
      ]);
    } catch {
      setError("Network error. Please retry.");
    } finally {
      setCalling(false);
    }
  }

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(activeSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_410px]">
        <div className="overflow-hidden rounded-lg border border-[#1a0f00]/10 bg-white shadow-sm">
          <div className="border-b border-[#1a0f00]/8 bg-[#f4f6ef] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1a0f00]/42">Playground</p>
                <h1 className="mt-1 text-[26px] font-black leading-tight tracking-tight sm:text-[34px]">
                  Paid MCP/API calls in 30 seconds.
                </h1>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#1a0f00]/62">
                  Mint a sandbox Pay Token, send one metered call, and see the seller ledger update.
                  No account, card, or crypto wallet required.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:w-[260px]">
                <Metric label="Budget" value={session ? `$${session.token.budget.toFixed(2)}` : "$0.20"} />
                <Metric label="Calls left" value={session ? String(callsLeft) : "20"} />
                <Metric label="Seller" value="97%" />
              </div>
            </div>
          </div>

          <div className="grid gap-0 xl:grid-cols-[360px_minmax(0,1fr)]">
            <div className="border-b border-[#1a0f00]/8 p-5 sm:p-6 xl:border-b-0 xl:border-r">
              <div className="space-y-3">
                <ActionButton
                  step="1"
                  title="Mint Pay Token"
                  detail="$0.20 cap, 20 calls, expires in 1 hour."
                  icon={<IconKey />}
                  onClick={mintToken}
                  disabled={minting}
                  primary
                  state={session ? "done" : "next"}
                  label={minting ? "Minting..." : session ? "Mint fresh token" : "Mint token"}
                />
                <ActionButton
                  step="2"
                  title="Run metered call"
                  detail="Gateway verifies the token before forwarding."
                  icon={<IconZap />}
                  onClick={testCall}
                  disabled={!session || calling || exhausted}
                  state={runs.length > 0 ? "done" : session ? "next" : "idle"}
                  label={calling ? "Calling..." : exhausted ? "Token spent" : "Run call"}
                />
              </div>

              {session && (
                <div className="mt-5 rounded-lg border border-[#1a0f00]/10 bg-[#fbfbf4] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#1a0f00]/38">Pay Token</p>
                  <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-[#1a0f00]/68">
                    <span className="text-[#1a0f00]/35">Bearer </span>
                    {maskedToken}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-[#1a0f00]/55">
                    <span>gateway <b className="font-mono text-[#1a0f00]">{session.gatewayPath}</b></span>
                    <span>price <b className="text-[#1a0f00]">${session.endpoint.pricePerCall.toFixed(2)}</b></span>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-lg border border-[#dc2626]/20 bg-[#fff1f1] px-3 py-2 text-[12px] font-semibold text-[#b91c1c]">
                  {error}
                </div>
              )}
            </div>

            <div className="grid gap-0">
              <div className="border-b border-[#1a0f00]/8 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#1a0f00]/42">Live event log</p>
                    <h2 className="mt-1 text-[18px] font-black leading-tight">Gateway checks</h2>
                  </div>
                  <span className="flex-none rounded-full bg-[#fffd43] px-2.5 py-1 text-[11px] font-black whitespace-nowrap">$0 real funds</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {eventLog.map((event) => (
                    <div key={event.label} className="flex gap-3 rounded-lg border border-[#1a0f00]/8 bg-[#fbfbf4] p-3">
                      <span className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[11px] font-black ${
                        event.state === "done"
                          ? "border-[#11995c] bg-[#e9fbf1] text-[#11995c]"
                          : event.state === "next"
                            ? "border-[#1a0f00] bg-[#1a0f00] text-[#fffd43]"
                            : "border-[#1a0f00]/12 bg-[#fbfbf4] text-[#1a0f00]/30"
                      }`}>
                        {event.state === "done" ? <IconCheck /> : ""}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-black leading-tight">{event.label}</p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-[#1a0f00]/55">{event.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#1a0f00]/42">Seller ledger</p>
                    <h2 className="mt-1 text-[18px] font-black leading-tight">Usage and revenue</h2>
                  </div>
                  <div className="flex-none text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#1a0f00]/38">Revenue</p>
                    <p className="text-[24px] font-black tabular-nums">${revenue.toFixed(2)}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Metric label="Calls" value={String(successfulCalls)} compact />
                  <Metric label="Fee" value="3%" compact />
                  <Metric label="Net" value={`$${(revenue * 0.97).toFixed(2)}`} compact />
                </div>
                <div className="mt-4 min-h-[150px]">
                  {runs.length === 0 ? (
                    <div className="flex min-h-[150px] items-center justify-center rounded-lg border border-dashed border-[#1a0f00]/14 bg-[#fbfbf4] px-4 text-center">
                      <p className="text-[12px] font-semibold text-[#1a0f00]/42">Run a call to create the first ledger row.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {runs.map((run) => (
                        <div key={run.n} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-[#1a0f00]/8 bg-[#fbfbf4] px-3 py-2 text-[12px]">
                          <span className="font-mono text-[#1a0f00]/36">#{run.n}</span>
                          <span className="min-w-0">
                            <span className={`font-black ${run.ok ? "text-[#1a0f00]" : "text-[#b91c1c]"}`}>{run.ok ? `${run.status} ${run.label}` : run.label}</span>
                            <span className="ml-2 font-mono text-[#1a0f00]/42">{run.ms}ms</span>
                          </span>
                          <span className="font-mono font-black tabular-nums">{run.ok ? `$${run.charge.toFixed(2)}` : "--"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="self-start rounded-lg border border-[#1a0f00]/10 bg-[#10100d] text-white shadow-sm">
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/38">Use it from code</p>
                <p className="mt-1 text-[14px] font-black">Same call, three ways</p>
              </div>
              <button
                onClick={copySnippet}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/70 hover:bg-white/10 hover:text-white"
              >
                <IconCopy />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-3 rounded-md bg-white/5 p-1">
              {[
                ["curl", "curl"],
                ["mcp", "mcp.json"],
                ["node", "Node"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setCodeTab(id as CodeTab)}
                  className={`rounded px-2 py-1.5 text-[11px] font-black transition-colors ${
                    codeTab === id ? "bg-[#fffd43] text-[#1a0f00]" : "text-white/50 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <pre className="min-h-[150px] overflow-x-auto p-4 text-[11px] leading-relaxed text-[#fffd43]/86">
            <code>{activeSnippet}</code>
          </pre>
          <div className="border-t border-white/10 px-4 py-3 text-[11px] leading-relaxed text-white/42">
            In production, the buyer pays by card and the agent receives a spend-capped Pay Token.
          </div>
        </aside>
      </section>

      <section className="grid gap-3 rounded-lg border border-[#1a0f00]/10 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="text-[18px] font-black">Ready to make your own endpoint paid?</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[#1a0f00]/58">
            Paste a URL, set a per-call price, and share a buy link. First 3,000 lifetime calls are free, then LemonCake takes 3%.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <Link href="/app" className="inline-flex items-center justify-center gap-2 rounded-md bg-[#1a0f00] px-4 py-2.5 text-[13px] font-black text-[#fffd43] hover:bg-[#1a0f00]/88">
            Monetize my API <IconArrow />
          </Link>
          <Link href="/docs" className="inline-flex items-center justify-center rounded-md border border-[#1a0f00]/12 px-4 py-2.5 text-[13px] font-black text-[#1a0f00]/70 hover:bg-[#1a0f00]/5">
            Docs
          </Link>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col rounded-lg border border-[#1a0f00]/8 bg-white ${compact ? "px-3 py-2" : "px-3 py-2.5"}`}>
      <p className="text-[9.5px] font-black uppercase tracking-[0.15em] text-[#1a0f00]/36">{label}</p>
      <p className={`${compact ? "text-[17px]" : "text-[21px]"} mt-auto pt-1 font-black leading-none tabular-nums`}>{value}</p>
    </div>
  );
}

function ActionButton({
  step,
  title,
  detail,
  icon,
  label,
  onClick,
  disabled,
  primary = false,
  state,
}: {
  step: string;
  title: string;
  detail: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
  state: "done" | "next" | "idle";
}) {
  return (
    <div className={`rounded-lg border p-3 ${state === "next" ? "border-[#1a0f00]/22 bg-[#fffef0]" : "border-[#1a0f00]/10 bg-white"}`}>
      <div className="flex gap-3">
        <span className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px] font-black ${
          state === "done" ? "bg-[#e9fbf1] text-[#11995c]" : state === "next" ? "bg-[#1a0f00] text-[#fffd43]" : "bg-[#1a0f00]/6 text-[#1a0f00]/38"
        }`}>
          {state === "done" ? <IconCheck /> : step}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-black">{title}</p>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-[#1a0f00]/54">{detail}</p>
          <button
            onClick={onClick}
            disabled={disabled}
            className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2 text-[12px] font-black transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              primary
                ? "bg-[#1a0f00] text-[#fffd43] hover:bg-[#1a0f00]/88"
                : "bg-[#fffd43] text-[#1a0f00] hover:bg-[#f3ef37]"
            }`}
          >
            {icon}
            {label}
          </button>
        </div>
      </div>
    </div>
  );
}
