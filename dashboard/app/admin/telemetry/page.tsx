"use client";

/**
 * /admin/telemetry — クライアント / トラフィックの兆候ダッシュボード。
 *
 * NOTE (pivot 後): 旧 Pay Token / Charge ベースのクライアント内訳
 * (User-Agent 別 Token/Charge/USDC) は pivot 前の m2m モデル依存で、現行の
 * プリペイド課金には繋がっていないため UI から撤去した。現行の購入・呼び出しは
 * オペレータコンソール (/admin) を参照。ここでは外部トラフィックの兆候
 * (glance / pageView)・LP playground・SDK/MCP アクセスのみを集計する。
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "../_components/AdminPageNav";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface McpFamilyBucket {
  family:        string;
  version:       string;
  totalRequests: number;
  uniqueDays:    number;
  paths: Array<{
    path:   string;
    method: string;
    count:  number;
    status2xx: number;
    status4xx: number;
    status5xx: number;
  }>;
  firstSeen: string;
  lastSeen:  string;
}

interface McpAccessResponse {
  windowDays:  number;
  generatedAt: string;
  totals: {
    totalRequests:  number;
    uniqueFamilies: number;
    uniqueVersions: number;
  };
  families: McpFamilyBucket[];
}

interface PlaygroundResponse {
  windowDays:  number;
  generatedAt: string;
  totals: {
    totalRuns:      number;
    uniqueVisitors: number;
    avgLatencyMs:   number;
  };
  byService: Array<{
    serviceId:    string;
    runs:         number;
    pct:          number;
    avgLatencyMs: number;
  }>;
  topQueries: Array<{
    serviceId:    string;
    queryPreview: string;
    runs:         number;
  }>;
}

interface GlanceResponse {
  signal: "NO_TRAFFIC" | "SELF_ONLY" | "EXTERNAL_SEEN" | "EXTERNAL_ACTIVE" | "UNKNOWN_ONLY";
  weeklyCalls: number;
  weeklyExternalCalls: number;
  weeklySelfCalls: number;
  weeklyUnknownCalls: number;
  weeklyExternalIps: number;
  weeklyVsLastWeek: number;
  topPaths: Array<{ path: string; count: number }>;
  yourIpHash: string | null;
  message: string;
}

export default function TelemetryPage() {
  const router = useRouter();
  const [mcpData,     setMcpData]     = useState<McpAccessResponse | null>(null);
  const [playData,    setPlayData]    = useState<PlaygroundResponse | null>(null);
  const [glance,      setGlance]      = useState<GlanceResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string>("");
  const [days,        setDays]        = useState(30);
  // 「自分の IP」を localStorage に保存して、その IP からの call は外部から除外
  const [selfIp,      setSelfIp]      = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSelfIp(localStorage.getItem("admin_self_ip_hash") ?? "");
    }
  }, []);

  const load = useCallback(async (d: number, selfIpHash: string) => {
    setLoading(true); setError("");
    // Auth = httpOnly owner cookie (admin = email ∈ ADMIN_EMAILS). The legacy
    // localStorage token is gone — we no longer bounce to /admin/login on its
    // absence (that caused a loop for valid admins). This telemetry data still
    // comes from the legacy backend; if it's unreachable we show an error, not
    // a redirect.
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    try {
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const glanceUrl = `${API_URL}/api/telemetry/glance${selfIpHash ? `?selfIp=${encodeURIComponent(selfIpHash)}` : ""}`;
      const [mcpRes, playRes, glanceRes] = await Promise.all([
        fetch(`${API_URL}/api/telemetry/mcp-access?days=${Math.min(d, 90)}`,      { headers, credentials: "include" }),
        fetch(`${API_URL}/api/telemetry/playground?days=${d}`,                    { headers, credentials: "include" }),
        fetch(glanceUrl,                                                          { headers, credentials: "include" }),
      ]);
      if (mcpRes.status === 401 || playRes.status === 401 || glanceRes.status === 401) {
        setError("テレメトリ(legacy)バックエンドに接続できません。/admin の概要をご利用ください。");
        return;
      }
      if (mcpRes.ok)    setMcpData(await mcpRes.json());     else setMcpData(null);
      if (playRes.ok)   setPlayData(await playRes.json());   else setPlayData(null);
      if (glanceRes.ok) setGlance(await glanceRes.json());   else setGlance(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "取得失敗");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(days, selfIp); }, [load, days, selfIp]);

  function markSelfIp() {
    if (!glance?.yourIpHash) return;
    localStorage.setItem("admin_self_ip_hash", glance.yourIpHash);
    setSelfIp(glance.yourIpHash);
  }
  function clearSelfIp() {
    localStorage.removeItem("admin_self_ip_hash");
    setSelfIp("");
  }

  const generatedAt = playData?.generatedAt ?? mcpData?.generatedAt ?? null;

  return (
    <AdminShell title="Client Telemetry">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Telemetry</h1>
            <p className="text-sm text-gray-500 mt-1">
              実ユーザーいるかは <strong>1 番上のヒーローカード</strong> で判定。詳細指標は下に。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={days}
              onChange={e => setDays(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            >
              <option value={7}>直近7日</option>
              <option value={30}>直近30日</option>
              <option value={90}>直近90日</option>
              <option value={365}>直近1年</option>
            </select>
            <button
              onClick={() => load(days, selfIp)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              再読込
            </button>
          </div>
        </div>

        {/* ─── Glance Hero (ぱっと見) ───────────────────────────────
            「実ユーザーいる？」を 1 秒で読み取れるよう、ヒーロー位置に
            信号機 + 主要数字 4 つだけを並べる。詳細は下のセクションへ。 */}
        {glance && (
          <div className="mb-6 rounded-2xl border-2 bg-white p-5 shadow-sm" style={{
            borderColor:
              glance.signal === "NO_TRAFFIC"      ? "#ef4444" :
              glance.signal === "UNKNOWN_ONLY"    ? "#9ca3af" :
              glance.signal === "SELF_ONLY"       ? "#f59e0b" :
              glance.signal === "EXTERNAL_SEEN"   ? "#10b981" :
                                                    "#3b82f6",
          }}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">外部ユーザーいる？</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{glance.message}</p>
              </div>
              <div className="flex items-center gap-2">
                {selfIp ? (
                  <div className="flex items-center gap-2 text-[10px] text-gray-500">
                    <span>自分の IP 除外中 ({selfIp.slice(0, 6)}…)</span>
                    <button onClick={clearSelfIp} className="text-amber-700 underline hover:text-amber-900">解除</button>
                  </div>
                ) : (
                  glance.yourIpHash && (
                    <button
                      onClick={markSelfIp}
                      className="text-xs rounded-full bg-amber-500 text-white px-3 py-1.5 font-bold hover:bg-amber-600"
                    >
                      自分の IP を除外する ({glance.yourIpHash.slice(0, 6)}…)
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                {
                  label:  "外部 IP 数（今週）",
                  value:  glance.weeklyExternalIps,
                  sub:    selfIp ? "自分を除外" : "「自分の IP 除外」を押すと正確に",
                },
                {
                  label:  "外部 call",
                  value:  glance.weeklyExternalCalls,
                  sub:    "ipHash あり & 自分以外",
                },
                {
                  label:  "自分 call",
                  value:  glance.weeklySelfCalls,
                  sub:    selfIp ? "登録済 self-IP" : "未登録",
                },
                {
                  label:  "不明（旧）",
                  value:  glance.weeklyUnknownCalls,
                  sub:    "IP 記録前のデータ",
                },
                {
                  label:  "TOP API",
                  value:  glance.topPaths[0]?.path.replace(/^\/api\//, "") ?? "—",
                  sub:    glance.topPaths[0] ? `${glance.topPaths[0].count} 件` : "なし",
                  small:  true,
                },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">{kpi.label}</p>
                  <p className={`mt-0.5 font-bold text-gray-900 ${kpi.small ? "text-sm font-mono break-all leading-tight" : "text-2xl tabular-nums"}`}>{kpi.value}</p>
                  {kpi.sub && <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* External user-behavior dashboards */}
        <div className="mb-8 bg-white border border-gray-200 rounded-xl px-4 py-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-2">外部ユーザー行動ダッシュボード</div>
          <div className="flex flex-wrap gap-2">
            <ExternalLink
              href="https://glama.ai/mcp/servers/evidai/lemon-cake/admin/analytics"
              label="Glama Analytics"
              hint="検索インプレッション / クリック / プロフィール閲覧 / ツール呼出"
              accent="purple"
            />
            <ExternalLink
              href="https://www.npmjs.com/package/agent-payment-mcp"
              label="npm: agent-payment-mcp"
              hint="新パッケージ DL 数（v0.5.0+）"
              accent="red"
            />
            <ExternalLink
              href="https://www.npmjs.com/package/agent-payment-mcp"
              label="npm: agent-payment-mcp"
              hint="旧パッケージ（ラッパー）DL 数"
              accent="red"
            />
            <ExternalLink
              href="https://glama.ai/mcp/servers/evidai/lemon-cake"
              label="Glama Listing"
              hint="公開リスティング（ユーザー視点）"
              accent="gray"
            />
            <ExternalLink
              href="https://github.com/evidai/lemon-cake/pulse"
              label="GitHub Pulse"
              hint="Star / Fork / Issue の推移"
              accent="gray"
            />
            <ExternalLink
              href="https://npm-stat.com/charts.html?package=agent-payment-mcp&package=agent-payment-mcp"
              label="npm-stat 比較"
              hint="新旧パッケージ DL 推移を並べて比較"
              accent="red"
            />
          </div>
        </div>

        {/* pivot 前モデル依存のクライアント内訳は撤去した旨の注記 */}
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
          <span className="font-bold">表示範囲について：</span>
          旧 Pay Token / Charge ベースのクライアント内訳（User-Agent 別 Token/Charge/USDC）は
          pivot 前の m2m モデル依存で、現行のプリペイド課金には繋がっていないため撤去しました。
          現行の購入・呼び出しは{" "}
          <a href="/admin" className="underline font-semibold">オペレータコンソール</a>
          {" "}を参照してください。ここでは外部トラフィックの兆候（ヒーロー）・LP playground・SDK/MCP アクセスのみ集計します。
        </div>

        {loading && <div className="text-gray-400 text-sm">読み込み中…</div>}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {!loading && !error && (
          <>
            {/* ─── /start LP Playground (PlaygroundLog ベース) ─── */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">/start LP Playground</h2>
                <span className="text-[10px] text-gray-400">DemoPlayground 経由の Run クリック · npm install 前段の活性指標</span>
              </div>

              {!playData && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-xs">
                  playground endpoint がまだ未デプロイです。API 再デプロイ後にデータが入ります。
                </div>
              )}

              {playData && (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <Kpi label="Total Run clicks" value={playData.totals.totalRuns}      sub={`過去${playData.windowDays}日`} />
                    <Kpi label="Unique visitors"  value={playData.totals.uniqueVisitors} sub="ip+UA bucket（PII保存なし）" />
                    <Kpi label="Avg latency"      value={playData.totals.avgLatencyMs}   sub="ms（upstream + edge往復）" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* by service */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500">サービス別</div>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs">
                          <tr>
                            <th className="text-left  px-4 py-2 font-medium">Service</th>
                            <th className="text-right px-4 py-2 font-medium">Runs</th>
                            <th className="text-right px-4 py-2 font-medium">%</th>
                            <th className="text-right px-4 py-2 font-medium">Avg ms</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {playData.byService.length === 0 && (
                            <tr><td colSpan={4} className="text-center py-6 text-gray-400">データなし</td></tr>
                          )}
                          {playData.byService.map(s => (
                            <tr key={s.serviceId}>
                              <td className="px-4 py-2 font-mono text-xs text-gray-700">{s.serviceId}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{s.runs}</td>
                              <td className="px-4 py-2 text-right tabular-nums text-gray-500">{s.pct}%</td>
                              <td className="px-4 py-2 text-right tabular-nums text-gray-500">{s.avgLatencyMs}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* top queries */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500">人気クエリ Top 10</div>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-500 text-xs">
                          <tr>
                            <th className="text-left  px-4 py-2 font-medium">Service</th>
                            <th className="text-left  px-4 py-2 font-medium">Query</th>
                            <th className="text-right px-4 py-2 font-medium">Runs</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {playData.topQueries.length === 0 && (
                            <tr><td colSpan={3} className="text-center py-6 text-gray-400">データなし</td></tr>
                          )}
                          {playData.topQueries.map((q, i) => (
                            <tr key={i}>
                              <td className="px-4 py-2 font-mono text-xs text-gray-500">{q.serviceId}</td>
                              <td className="px-4 py-2 text-xs text-gray-800 truncate max-w-xs">{q.queryPreview}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{q.runs}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ─── MCP / SDK access (McpAccessLog ベース) ─────── */}
            <div className="mt-12">
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-700">SDK / MCP 経由のリクエスト</h2>
                <span className="text-[10px] text-gray-400">McpAccessLog · token 発行に依存しない直接トラフィック</span>
              </div>

              {!mcpData && (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl px-4 py-3 text-xs">
                  mcp-access endpoint がまだ未デプロイです。API 再デプロイ後にデータが入ります。
                </div>
              )}

              {mcpData && (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <Kpi label="MCP Requests" value={mcpData.totals.totalRequests} sub={`SDK family のみ (過去${mcpData.windowDays}日)`} />
                    <Kpi label="Unique Families" value={mcpData.totals.uniqueFamilies} sub="agent-payment-mcp / agent-payment-mcp 等の種類" />
                    <Kpi label="Unique Versions" value={mcpData.totals.uniqueVersions} sub="family × version の組み合わせ" />
                  </div>

                  {mcpData.families.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-400 text-sm">
                      まだ SDK / MCP からのリクエストが記録されていません。
                      <br />
                      <span className="text-xs">
                        誰かが <code className="bg-gray-100 px-1 rounded">npx -y agent-payment-mcp</code>（または旧 <code className="bg-gray-100 px-1 rounded">agent-payment-mcp</code>）で起動して setup / list_services を叩けばここに表示されます。
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {mcpData.families.map(f => (
                        <div key={`${f.family}@${f.version}`} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-baseline gap-2">
                              <span className="font-mono font-semibold text-gray-900">{f.family}</span>
                              <span className="font-mono text-xs text-gray-500">v{f.version}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <span className="text-gray-500"><span className="font-bold tabular-nums text-gray-800">{f.totalRequests.toLocaleString()}</span> requests</span>
                              <span className="text-gray-400">·</span>
                              <span className="text-gray-500"><span className="tabular-nums">{f.uniqueDays}</span> days active</span>
                              <span className="text-gray-400">·</span>
                              <span className="text-gray-400">last: {new Date(f.lastSeen).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
                            </div>
                          </div>
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-500 text-[10px]">
                              <tr>
                                <th className="text-left px-4 py-2 font-medium">Path</th>
                                <th className="text-right px-4 py-2 font-medium w-16">Method</th>
                                <th className="text-right px-4 py-2 font-medium w-16">Total</th>
                                <th className="text-right px-4 py-2 font-medium w-12">2xx</th>
                                <th className="text-right px-4 py-2 font-medium w-12">4xx</th>
                                <th className="text-right px-4 py-2 font-medium w-12">5xx</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {f.paths.map(p => (
                                <tr key={`${p.method} ${p.path}`}>
                                  <td className="px-4 py-1.5 font-mono text-xs text-gray-700 break-all">{p.path}</td>
                                  <td className="px-4 py-1.5 text-right font-mono text-[11px] text-gray-500">{p.method}</td>
                                  <td className="px-4 py-1.5 text-right tabular-nums font-semibold">{p.count}</td>
                                  <td className="px-4 py-1.5 text-right tabular-nums text-emerald-600">{p.status2xx || ""}</td>
                                  <td className="px-4 py-1.5 text-right tabular-nums text-amber-600">{p.status4xx || ""}</td>
                                  <td className="px-4 py-1.5 text-right tabular-nums text-red-600">{p.status5xx || ""}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {generatedAt && (
              <p className="text-xs text-gray-400 mt-8">
                Generated: {new Date(generatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </p>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-2 tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}

function ExternalLink({
  href,
  label,
  hint,
  accent,
}: {
  href: string;
  label: string;
  hint: string;
  accent: "purple" | "red" | "gray";
}) {
  const dotClass = {
    purple: "bg-purple-500",
    red:    "bg-red-500",
    gray:   "bg-gray-400",
  }[accent];
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={hint}
      className="group inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-white hover:border-gray-300 hover:shadow-sm transition"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
      <span className="text-gray-300 group-hover:text-gray-500 transition">↗</span>
    </a>
  );
}
