"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface ClientBucket {
  client:       string;
  family:       string;
  version:      string | null;
  tokenCount:   number;
  chargeCount:  number;
  totalUsdc:    string;
  buyerCount:   number;
  firstSeen:    string;
  lastSeen:     string;
}

interface UsageResponse {
  windowDays:  number;
  generatedAt: string;
  totals: {
    identifiedTokens:   number;
    unidentifiedTokens: number;
    totalClients:       number;
  };
  clients: ClientBucket[];
}

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

export default function TelemetryPage() {
  const router = useRouter();
  const [data,        setData]        = useState<UsageResponse | null>(null);
  const [mcpData,     setMcpData]     = useState<McpAccessResponse | null>(null);
  const [playData,    setPlayData]    = useState<PlaygroundResponse | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string>("");
  const [days,        setDays]        = useState(30);

  const load = useCallback(async (d: number) => {
    setLoading(true); setError("");
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (!token) {
      router.push("/admin/login");
      return;
    }
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [usageRes, mcpRes, playRes] = await Promise.all([
        fetch(`${API_URL}/api/telemetry/client-usage?days=${d}`,                  { headers }),
        fetch(`${API_URL}/api/telemetry/mcp-access?days=${Math.min(d, 90)}`,      { headers }),
        fetch(`${API_URL}/api/telemetry/playground?days=${d}`,                    { headers }),
      ]);
      if (usageRes.status === 401 || mcpRes.status === 401 || playRes.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      const usageJson = await usageRes.json();
      if (!usageRes.ok) throw new Error(usageJson.error ?? "failed (usage)");
      setData(usageJson);

      if (mcpRes.ok)  setMcpData(await mcpRes.json());   else setMcpData(null);
      if (playRes.ok) setPlayData(await playRes.json()); else setPlayData(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "取得失敗");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(days); }, [load, days]);

  const familyTotals = (() => {
    if (!data) return [];
    const byFamily = new Map<string, { tokens: number; charges: number; buyers: number; usdc: number; versions: Set<string> }>();
    for (const c of data.clients) {
      const f = byFamily.get(c.family) ?? { tokens: 0, charges: 0, buyers: 0, usdc: 0, versions: new Set() };
      f.tokens  += c.tokenCount;
      f.charges += c.chargeCount;
      f.buyers  += c.buyerCount;
      f.usdc    += Number(c.totalUsdc);
      if (c.version) f.versions.add(c.version);
      byFamily.set(c.family, f);
    }
    return Array.from(byFamily.entries())
      .map(([family, v]) => ({
        family,
        tokens: v.tokens,
        charges: v.charges,
        buyers: v.buyers,
        usdc: v.usdc.toFixed(4),
        versions: Array.from(v.versions).sort().join(", ") || "—",
      }))
      .sort((a, b) => b.tokens - a.tokens);
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <button
              onClick={() => router.push("/admin")}
              className="text-xs text-gray-400 hover:text-gray-700 mb-3 flex items-center gap-1"
            >
              ← Admin Console
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Client Telemetry</h1>
            <p className="text-sm text-gray-500 mt-1">
              SDK / プラグイン経由の Pay Token 発行を、User-Agent 単位で集計
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
              onClick={() => load(days)}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              再読込
            </button>
          </div>
        </div>

        {/* v2 migration tracking — custody vs non-custodial split */}
        <div className="mb-6 bg-gradient-to-br from-amber-50 via-white to-emerald-50 border border-amber-200 rounded-xl px-4 py-3">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-[10px] uppercase tracking-wide text-amber-700 font-bold">
              v2 移行進捗 — Custody vs Non-custodial
            </div>
            <a
              href="/security"
              className="text-[10px] text-gray-500 hover:text-amber-700 hover:underline"
            >
              FSA Q11 → /security
            </a>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-emerald-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-emerald-700 font-bold">
                Non-custodial (v2)
              </div>
              <div className="mt-1 text-xl font-bold text-emerald-900 tabular-nums">
                {/* TODO: wire to v2_permit_signed event count from GA4 */}
                0
              </div>
              <div className="text-[10px] text-gray-500">permit 発行数（90日）</div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-gray-600 font-bold">
                Custody (legacy)
              </div>
              <div className="mt-1 text-xl font-bold text-gray-900 tabular-nums">
                {/* TODO: wire to Pay Token 発行数 from /admin/buyers */}
                7
              </div>
              <div className="text-[10px] text-gray-500">Pay Token 発行数（累計）</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
              <div className="text-[10px] uppercase tracking-wide text-amber-700 font-bold">
                Custody 残高
              </div>
              <div className="mt-1 text-xl font-bold text-amber-900 tabular-nums">
                {/* TODO: wire to sum(USDC balance) of all buyers */}
                $4.79
              </div>
              <div className="text-[10px] text-gray-500">移行時に refund 対象</div>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-gray-600 leading-snug">
            目標: 全 Pay Token を permit に移行 → Custody 残高 $0 → 旧エンドポイント削除。
          </div>
        </div>

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

        {loading && <div className="text-gray-400 text-sm">読み込み中…</div>}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {data && !loading && (
          <>
            {/* KPI */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              <Kpi label="Identified Tokens" value={data.totals.identifiedTokens} sub={`UA 有り (過去${data.windowDays}日)`} />
              <Kpi label="Unidentified" value={data.totals.unidentifiedTokens} sub="UA 無し（直接 API 呼出）" />
              <Kpi label="Unique Clients" value={data.totals.totalClients} sub="UA 文字列の種類" />
            </div>

            {/* Family rollup */}
            <h2 className="text-sm font-semibold text-gray-700 mb-3">クライアント種別 (Family)</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-8">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">Family</th>
                    <th className="text-left px-4 py-2.5 font-medium">Versions</th>
                    <th className="text-right px-4 py-2.5 font-medium">Tokens</th>
                    <th className="text-right px-4 py-2.5 font-medium">Charges</th>
                    <th className="text-right px-4 py-2.5 font-medium">USDC</th>
                    <th className="text-right px-4 py-2.5 font-medium">Buyers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {familyTotals.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-gray-400">データなし</td></tr>
                  )}
                  {familyTotals.map(f => (
                    <tr key={f.family}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{f.family}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs font-mono">{f.versions}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.tokens}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.charges}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.usdc}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{f.buyers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detail per UA string */}
            <h2 className="text-sm font-semibold text-gray-700 mb-3">User-Agent 別（詳細）</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-medium">User-Agent</th>
                    <th className="text-right px-4 py-2.5 font-medium">Tokens</th>
                    <th className="text-right px-4 py-2.5 font-medium">Charges</th>
                    <th className="text-right px-4 py-2.5 font-medium">USDC</th>
                    <th className="text-right px-4 py-2.5 font-medium">Buyers</th>
                    <th className="text-right px-4 py-2.5 font-medium">Last Seen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.clients.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-gray-400">データなし</td></tr>
                  )}
                  {data.clients.map(c => (
                    <tr key={c.client}>
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-600 break-all max-w-[420px]">{c.client}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.tokenCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.chargeCount}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.totalUsdc}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.buyerCount}</td>
                      <td className="px-4 py-2.5 text-right text-xs text-gray-400">
                        {new Date(c.lastSeen).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ─── /start LP Playground (PlaygroundLog ベース) ─── */}
            <div className="mt-12">
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

            <p className="text-xs text-gray-400 mt-8">
              Generated: {new Date(data.generatedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </p>
          </>
        )}
      </div>
    </div>
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
