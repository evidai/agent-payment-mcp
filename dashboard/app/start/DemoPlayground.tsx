"use client";

import { useEffect, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";

type ServiceId = "demo_search" | "demo_fx" | "demo_echo";

type Service = {
  id:          ServiceId;
  label:       string;
  desc:        string;
  inputLabel?: string;
  inputName?:  string;
  defaultBody: Record<string, unknown>;
  upstream:    string;
};

const SERVICES: ReadonlyArray<Service> = [
  {
    id:          "demo_search",
    label:       "demo_search",
    desc:        "Wikipedia search via opensearch API.",
    inputLabel:  "Search query",
    inputName:   "q",
    defaultBody: { q: "Model Context Protocol" },
    upstream:    "en.wikipedia.org",
  },
  {
    id:          "demo_fx",
    label:       "demo_fx",
    desc:        "Live USD-base FX rates (no input needed).",
    defaultBody: {},
    upstream:    "open.er-api.com",
  },
  {
    id:          "demo_echo",
    label:       "demo_echo",
    desc:        "POST anything; httpbin echoes it back.",
    inputLabel:  "JSON body",
    inputName:   "__json__",
    defaultBody: { hello: "world", from: "lemoncake.xyz/start" },
    upstream:    "httpbin.org",
  },
];

type Result =
  | null
  | { kind: "ok";    body: unknown; latencyMs: number; chargeId: string; x402Receipt: Record<string, unknown> }
  | { kind: "err";   message: string };

export function DemoPlayground() {
  const [active,  setActive]  = useState<ServiceId>("demo_search");
  const [input,   setInput]   = useState<string>("Model Context Protocol");
  const [result,  setResult]  = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const ranOnceRef = useRef(false);

  const svc = SERVICES.find(s => s.id === active)!;

  // Reset input when switching service
  useEffect(() => {
    if (svc.id === "demo_search") setInput("Model Context Protocol");
    else if (svc.id === "demo_echo") setInput(JSON.stringify(svc.defaultBody, null, 2));
    else setInput("");
    setResult(null);
  }, [svc.id, svc.defaultBody]);

  async function run() {
    setLoading(true);
    setResult(null);
    trackEvent("lp_demo_run", { service: svc.id });
    try {
      let body: Record<string, unknown> = {};
      if (svc.id === "demo_search") {
        body = { q: input.trim() || "Model Context Protocol" };
      } else if (svc.id === "demo_echo") {
        try { body = JSON.parse(input); } catch { body = { raw: input }; }
      }
      const t0 = performance.now();
      const res = await fetch(`/api/playground/${svc.id}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      const wallMs = Math.round(performance.now() - t0);
      if (!res.ok) {
        setResult({ kind: "err", message: data.error ?? `HTTP ${res.status}` });
      } else {
        setResult({
          kind:        "ok",
          body:        data.response,
          latencyMs:   data.latencyMs ?? wallMs,
          chargeId:    data.chargeId,
          x402Receipt: data.x402Receipt,
        });
      }
    } catch (e) {
      setResult({ kind: "err", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
      ranOnceRef.current = true;
    }
  }

  // Auto-run once on mount so the panel isn't empty
  useEffect(() => {
    if (!ranOnceRef.current) {
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-transparent overflow-hidden">
      {/* tab strip */}
      <div className="flex border-b border-white/10 bg-black/30">
        {SERVICES.map(s => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex-1 px-4 py-3 text-sm font-mono transition border-r border-white/10 last:border-r-0 ${
              active === s.id
                ? "bg-[#fffd43]/10 text-[#fffd43] border-b-2 border-b-[#fffd43] -mb-px"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="p-5 md:p-6 space-y-4">
        <p className="text-xs text-white/50 leading-relaxed">
          {svc.desc}{" "}
          Hits real <span className="text-[#fffd43]/80 font-mono">{svc.upstream}</span> · same response as <code className="font-mono">call_service(serviceId=&quot;{svc.id}&quot;)</code> from <code className="font-mono">npx&nbsp;-y&nbsp;agent-payment-mcp</code>.
        </p>

        {/* input */}
        {svc.inputLabel && (
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-white/40 mb-1.5">
              {svc.inputLabel}
            </label>
            {svc.id === "demo_echo" ? (
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                spellCheck={false}
                rows={4}
                className="w-full font-mono text-sm bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-[#fffd43]/50"
              />
            ) : (
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !loading && run()}
                spellCheck={false}
                className="w-full font-mono text-sm bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-white/90 focus:outline-none focus:border-[#fffd43]/50"
              />
            )}
          </div>
        )}

        <button
          onClick={run}
          disabled={loading}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#fffd43] text-[#06060a] font-semibold text-sm hover:bg-[#fffd43]/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Spinner /> Calling {svc.label}…
            </>
          ) : (
            <>▶ Run {svc.label}</>
          )}
        </button>

        {/* result */}
        {result && (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-[11px] font-mono uppercase tracking-wider">
              <span className="text-white/40">Result</span>
              {result.kind === "ok" && (
                <span className="text-emerald-300/80">
                  ✓ {result.latencyMs}ms · chargeId={result.chargeId}
                </span>
              )}
              {result.kind === "err" && <span className="text-red-300/80">✗ error</span>}
            </div>
            <pre className="rounded-lg bg-black/60 border border-white/10 p-4 overflow-x-auto text-[12px] font-mono text-white/85 max-h-[280px] overflow-y-auto">
{result.kind === "ok"
  ? JSON.stringify(result.body, null, 2)
  : result.message}
            </pre>
            {result.kind === "ok" && (
              <details className="text-[11px] font-mono">
                <summary className="cursor-pointer text-white/40 hover:text-white/70 select-none">
                  ▸ x402Receipt (proof of pay-per-call settlement)
                </summary>
                <pre className="mt-2 rounded-lg bg-black/60 border border-white/10 p-3 overflow-x-auto text-white/70">
{JSON.stringify(result.x402Receipt, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        <p className="text-[11px] text-white/30 leading-relaxed">
          This widget hits the same upstream as the published MCP server — no signup, no permit, $0 charged. Switch to a real service ($0.005/call typical) by setting <code className="font-mono">LEMON_CAKE_PERMIT</code> after <a href="/register" className="text-[#fffd43]/70 hover:underline">creating an account</a>.
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block w-3 h-3 rounded-full border-2 border-[#06060a]/40 border-t-[#06060a] animate-spin"
    />
  );
}
