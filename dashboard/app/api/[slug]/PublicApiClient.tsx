"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type ShareType =
  | "copy_gateway_url"
  | "copy_curl"
  | "copy_readme_badge"
  | "copy_x_post"
  | "copy_docs_snippet"
  | "copy_mcp_listing"
  | "view_public_page"
  | "click_try_demo_from_public_page"
  | "click_create_own_api_from_public_page";

type Props = {
  endpointId: string;
  slug: string;
  shortId: string;
  gatewayUrl: string;
  badgeUrl: string;
  rateLimit: number;
  snippets: { curl: string; readme: string; xpost: string; docs: string; mcp: string };
  usage: {
    totalCalls: number;
    recent: { status: number | null; ms: number | null; at: string }[];
  };
};

const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);
const IconCopy = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}
function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export default function PublicApiClient(props: Props) {
  const { endpointId, slug, shortId, gatewayUrl, badgeUrl, rateLimit, snippets, usage } = props;
  const [copied, setCopied] = useState<string | null>(null);
  const viewLogged = useRef(false);

  // Fire view_public_page once per mount (StrictMode-safe via ref guard).
  useEffect(() => {
    if (viewLogged.current) return;
    viewLogged.current = true;
    track("view_public_page");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function track(shareType: ShareType) {
    try {
      void fetch("/api/lc/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ shareType, endpointId, slug, shortId }),
      });
    } catch {
      /* analytics best-effort */
    }
  }

  async function copy(text: string, key: string, shareType: ShareType) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
      track(shareType);
    } catch {
      /* clipboard blocked */
    }
  }

  const xIntent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(snippets.xpost)}`;

  return (
    <>
      <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
        {/* ── Call this API ── */}
        <div className="rounded-3xl bg-white border border-[#1a0f00]/10 p-6 md:p-7">
          <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-4">Call this API</p>

          {/* Gateway URL */}
          <label className="text-[12px] font-bold text-[#1a0f00]/70">Gateway endpoint</label>
          <div className="flex items-center gap-2 mt-1.5 mb-4">
            <code className="flex-1 rounded-xl bg-[#fafaf7] border border-[#1a0f00]/10 px-3 py-2 font-mono text-[12px] text-[#1a0f00]/80 break-all">
              POST {gatewayUrl}
            </code>
            <button
              onClick={() => copy(gatewayUrl, "gw", "copy_gateway_url")}
              className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors px-2 py-2"
            >
              <IconCopy />{copied === "gw" ? "Copied" : "Copy"}
            </button>
          </div>

          {/* Pay Token + caps */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-3">
              <p className="text-[10px] text-[#1a0f00]/45 uppercase tracking-wider mb-0.5">Auth</p>
              <p className="text-[12.5px] font-bold">Pay Token (Bearer)</p>
            </div>
            <div className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 p-3">
              <p className="text-[10px] text-[#1a0f00]/45 uppercase tracking-wider mb-0.5">Rate limit</p>
              <p className="text-[12.5px] font-bold tabular-nums">{rateLimit}/min</p>
            </div>
          </div>
          <p className="text-[11.5px] text-[#1a0f00]/50 leading-relaxed mb-5">
            Each Pay Token carries its own spend cap and call limit, set by the seller. Calls are metered per request.
          </p>

          {/* curl */}
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest">Quickstart (curl)</p>
            <button onClick={() => copy(snippets.curl, "curl", "copy_curl")} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors">
              <IconCopy />{copied === "curl" ? "Copied" : "Copy"}
            </button>
          </div>
          <pre className="rounded-xl bg-[#1a0f00] text-[#fffd43]/90 p-3.5 text-[11px] leading-relaxed overflow-x-auto font-mono">{snippets.curl}</pre>
        </div>

        {/* ── Usage ledger ── */}
        <div className="rounded-3xl bg-white border border-[#1a0f00]/10 p-6 md:p-7 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest">Usage ledger</p>
            <div className="text-right">
              <p className="text-[10px] text-[#1a0f00]/45 uppercase tracking-wider">Total calls</p>
              <p className="text-[18px] font-black tabular-nums">{usage.totalCalls}</p>
            </div>
          </div>

          <div className="flex-1 min-h-[180px]">
            {usage.recent.length === 0 ? (
              <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-[#1a0f00]/12">
                <p className="text-[13px] text-[#1a0f00]/45 font-medium">No calls yet</p>
                <p className="text-[11.5px] text-[#1a0f00]/35 mt-1">Calls appear here as buyers use the API.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 text-[10px] font-bold text-[#1a0f00]/35 uppercase tracking-wider">
                  <span>When</span><span className="text-right">Status</span><span className="text-right">Latency</span>
                </div>
                {usage.recent.map((r, i) => {
                  const ok = (r.status ?? 0) >= 200 && (r.status ?? 0) < 500;
                  return (
                    <div key={i} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-2 rounded-xl bg-[#fafaf7] border border-[#1a0f00]/8 text-[12px]">
                      <span className="text-[#1a0f00]/60 tabular-nums">{fmtTime(r.at)}</span>
                      <span className="text-right flex items-center justify-end gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-[#16A34A]" : "bg-[#DC2626]"}`} />
                        <span className="font-mono font-semibold tabular-nums">{r.status ?? "—"}</span>
                      </span>
                      <span className="text-right font-mono text-[#1a0f00]/55 tabular-nums">{r.ms != null ? `${r.ms}ms` : "—"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <p className="text-[10.5px] text-[#1a0f00]/35 mt-4 leading-relaxed">
            Live usage metering. Settlement optional — connect Stripe (or x402) later to collect.
          </p>
        </div>
      </div>

      {/* ── Share / integrate ── */}
      <div className="rounded-3xl bg-white border border-[#1a0f00]/10 p-6 md:p-7 mt-5">
        <p className="text-[11px] font-bold text-[#1a0f00]/40 uppercase tracking-widest mb-1">Share &amp; integrate</p>
        <h3 className="text-[16px] font-black mb-5">Add this API to your README, docs, or launch post.</h3>

        <div className="grid md:grid-cols-2 gap-5">
          {/* README badge */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-bold text-[#1a0f00]/70">README badge</p>
              <button onClick={() => copy(snippets.readme, "readme", "copy_readme_badge")} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors">
                <IconCopy />{copied === "readme" ? "Copied" : "Copy"}
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={badgeUrl} alt="Paid access powered by LemonCake" className="h-5 mb-2" />
            <pre className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/10 p-3 text-[10.5px] leading-relaxed overflow-x-auto font-mono text-[#1a0f00]/75 whitespace-pre-wrap break-all">{snippets.readme}</pre>
          </div>

          {/* X post */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-bold text-[#1a0f00]/70">Launch post (X)</p>
              <button onClick={() => copy(snippets.xpost, "xpost", "copy_x_post")} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors">
                <IconCopy />{copied === "xpost" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/10 p-3 text-[11px] leading-relaxed overflow-x-auto font-mono text-[#1a0f00]/75 whitespace-pre-wrap">{snippets.xpost}</pre>
            <a
              href={xIntent}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("copy_x_post")}
              className="inline-flex items-center gap-1.5 mt-2 text-[11.5px] font-semibold text-[#1a0f00]/65 hover:text-[#1a0f00] transition-colors"
            >
              Open in X <IconArrow />
            </a>
          </div>

          {/* docs snippet */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-bold text-[#1a0f00]/70">Docs snippet (Markdown)</p>
              <button onClick={() => copy(snippets.docs, "docs", "copy_docs_snippet")} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors">
                <IconCopy />{copied === "docs" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/10 p-3 text-[10.5px] leading-relaxed overflow-x-auto font-mono text-[#1a0f00]/75 max-h-40 whitespace-pre-wrap break-words">{snippets.docs}</pre>
          </div>

          {/* MCP / directory listing text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[12px] font-bold text-[#1a0f00]/70">Listing text (MCP / directory)</p>
              <button onClick={() => copy(snippets.mcp, "mcp", "copy_mcp_listing")} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1a0f00]/55 hover:text-[#1a0f00] transition-colors">
                <IconCopy />{copied === "mcp" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="rounded-xl bg-[#fafaf7] border border-[#1a0f00]/10 p-3 text-[10.5px] leading-relaxed overflow-x-auto font-mono text-[#1a0f00]/75 whitespace-pre-wrap break-words">{snippets.mcp}</pre>
          </div>
        </div>
      </div>

      {/* ── CTAs ── */}
      <div className="rounded-3xl bg-[#fffd43] p-8 md:p-10 text-center mt-5">
        <p className="text-[11px] font-bold text-[#1a0f00]/45 uppercase tracking-widest mb-2">Paid access powered by LemonCake</p>
        <h2 className="text-2xl md:text-3xl font-black leading-tight mb-2">Want your own paid-access API?</h2>
        <p className="text-[13.5px] text-[#1a0f00]/65 mb-6 max-w-md mx-auto">
          Wrap any HTTP API, hand out Pay Tokens, and meter every call. No monthly fee — first 3,000 calls / month are free.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/app"
            onClick={() => track("click_create_own_api_from_public_page")}
            className="inline-flex items-center gap-2 px-7 py-3 bg-[#1a0f00] text-[#fffd43] font-bold rounded-xl hover:bg-[#1a0f00]/85 transition-colors text-[14px]"
          >
            Create your own paid-access API <IconArrow />
          </Link>
          <Link
            href="/demo"
            onClick={() => track("click_try_demo_from_public_page")}
            className="inline-flex items-center gap-2 px-7 py-3 bg-white border border-[#1a0f00]/15 text-[#1a0f00] font-semibold rounded-xl hover:bg-white/85 transition-colors text-[14px]"
          >
            Try the LemonCake demo
          </Link>
        </div>
      </div>
    </>
  );
}
