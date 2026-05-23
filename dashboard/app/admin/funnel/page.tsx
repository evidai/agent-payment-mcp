"use client";

/**
 * /admin/funnel — DB グラウンドトゥルース由来の conversion funnel。
 * GA4 に依存せず、自前の DB だけで「LP → Provider 登録 → Sub 開始 → 課金」を可視化。
 *
 * 参照 API: GET /api/telemetry/funnel?days=N (admin Bearer 必須)
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from "recharts";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

interface FunnelDaily {
  date:                 string;
  lpDemoRuns:           number;
  lpUniqueVisitors:     number;
  providersRegistered:  number;
  subscriptionsCreated: number;
  permitChargesCount:   number;
}

interface FunnelResponse {
  windowDays:  number;
  generatedAt: string;
  totals: {
    lpDemoRuns:           number;
    lpUniqueVisitors:     number;
    providersRegistered:  number;
    subscriptionsCreated: number;
    permitChargesCount:   number;
    permitChargesUsdc:    string;
  };
  byPlan: Array<{ plan: string; count: number }>;
  daily:  FunnelDaily[];
  rates: {
    visitorToProvider:    number;
    providerToSubscriber: number;
    providerToCharger:    number;
  };
}

const PLAN_COLOR: Record<string, string> = {
  FREE:       "#9ca3af",
  PRO:        "#f59e0b",
  BUSINESS:   "#8b5cf6",
  SCALE:      "#ef4444",
  ENTERPRISE: "#1f2937",
};

export default function FunnelPage() {
  const router = useRouter();
  const [data,    setData]    = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string>("");
  const [days,    setDays]    = useState(30);

  const load = useCallback(async (d: number) => {
    setLoading(true); setError("");
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    if (!token) { router.push("/admin/login"); return; }
    try {
      const res = await fetch(`${API_URL}/api/telemetry/funnel?days=${d}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得失敗");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(days); }, [load, days]);

  const t = data?.totals;

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
            <h1 className="text-2xl font-bold text-gray-900">Conversion Funnel</h1>
            <p className="text-sm text-gray-500 mt-1">
              LP 訪問 → /sellers 登録 → サブスク → 実課金 の各段階を DB から直接集計
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

        {/* Loading / Error */}
        {loading && (
          <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
            読み込み中…
          </div>
        )}
        {error && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {data && t && !loading && (
          <>
            {/* Funnel stages — 5 cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
              <FunnelCard
                step="01"
                title="LP visitors"
                value={t.lpUniqueVisitors}
                sub={`${t.lpDemoRuns.toLocaleString()} runs`}
                color="gray"
              />
              <FunnelCard
                step="02"
                title="LP demo runs"
                value={t.lpDemoRuns}
                sub="playground 実行"
                color="gray"
                rate={t.lpUniqueVisitors > 0 ? t.lpDemoRuns / t.lpUniqueVisitors : 0}
                rateLabel="runs/visitor"
              />
              <FunnelCard
                step="03"
                title="Providers"
                value={t.providersRegistered}
                sub="/sellers 登録完了"
                color="amber"
                rate={data.rates.visitorToProvider}
                rateLabel="visitor → provider"
              />
              <FunnelCard
                step="04"
                title="Subscribers"
                value={t.subscriptionsCreated}
                sub="PRO 以上"
                color="violet"
                rate={data.rates.providerToSubscriber}
                rateLabel="provider → sub"
              />
              <FunnelCard
                step="05"
                title="Revenue"
                value={`$${parseFloat(t.permitChargesUsdc).toFixed(2)}`}
                sub={`${t.permitChargesCount.toLocaleString()} charges`}
                color="emerald"
                isMonetary
                rate={data.rates.providerToCharger}
                rateLabel="provider → charger"
              />
            </div>

            {/* Daily area chart */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-900">日次推移</h2>
                <span className="text-[10px] text-gray-400">
                  generated: {new Date(data.generatedAt).toLocaleString("ja-JP")}
                </span>
              </div>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={data.daily} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="g_visitors" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#9ca3af" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="g_providers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="g_subs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#8b5cf6" stopOpacity={0.6}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#6b7280" }} />
                    <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }}/>
                    <Area type="monotone" dataKey="lpUniqueVisitors"     name="LP visitors"  stroke="#9ca3af" fill="url(#g_visitors)"  strokeWidth={1.5}/>
                    <Area type="monotone" dataKey="providersRegistered"  name="Providers"    stroke="#f59e0b" fill="url(#g_providers)" strokeWidth={2}/>
                    <Area type="monotone" dataKey="subscriptionsCreated" name="Subs (paid)"  stroke="#8b5cf6" fill="url(#g_subs)"      strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Plan breakdown bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-sm font-bold text-gray-900 mb-3">プラン内訳</h2>
                {data.byPlan.length === 0 ? (
                  <p className="text-xs text-gray-400 py-8 text-center">この期間に有料サブスクなし</p>
                ) : (
                  <div style={{ width: "100%", height: 180 }}>
                    <ResponsiveContainer>
                      <BarChart data={data.byPlan} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6"/>
                        <XAxis type="number" tick={{ fontSize: 10, fill: "#6b7280" }} allowDecimals={false} />
                        <YAxis type="category" dataKey="plan" tick={{ fontSize: 11, fill: "#374151", fontWeight: 600 }} width={80}/>
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }}/>
                        <Bar dataKey="count" name="サブスク数" radius={[0, 6, 6, 0]}>
                          {data.byPlan.map((p) => (
                            <Cell key={p.plan} fill={PLAN_COLOR[p.plan] ?? "#6b7280"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Conversion rates */}
              <div className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="text-sm font-bold text-gray-900 mb-3">Conversion rates</h2>
                <div className="space-y-3">
                  <RateBar
                    label="LP visitor → Provider 登録"
                    rate={data.rates.visitorToProvider}
                    color="bg-amber-500"
                  />
                  <RateBar
                    label="Provider → 有料サブスク"
                    rate={data.rates.providerToSubscriber}
                    color="bg-violet-500"
                  />
                  <RateBar
                    label="Provider → 実課金（distinct payer / provider）"
                    rate={data.rates.providerToCharger}
                    color="bg-emerald-500"
                  />
                </div>
                <p className="mt-4 text-[10px] text-gray-400 leading-relaxed">
                  ※ 課金は <code>PermitCharge.status = COMPLETED</code> をカウント。<br/>
                  ※ visitor は <code>PlaygroundLog.ipHash</code> のユニーク数（playground を踏んだ訪問者のみ。素通り訪問者は GA4 で別途）。
                </p>
              </div>
            </div>

            {/* Raw daily table (last 14) */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">date</th>
                    <th className="px-3 py-2 text-right font-bold">visitors</th>
                    <th className="px-3 py-2 text-right font-bold">demo runs</th>
                    <th className="px-3 py-2 text-right font-bold">providers</th>
                    <th className="px-3 py-2 text-right font-bold">subs</th>
                    <th className="px-3 py-2 text-right font-bold">charges</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 font-mono">
                  {data.daily.slice(-14).reverse().map(d => (
                    <tr key={d.date} className="border-t border-gray-100">
                      <td className="px-3 py-2">{d.date}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.lpUniqueVisitors}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.lpDemoRuns}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.providersRegistered}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.subscriptionsCreated}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.permitChargesCount}</td>
                    </tr>
                  ))}
                  {data.daily.length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">データなし</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── components ─────────────────────────────────────────────

interface FunnelCardProps {
  step:        string;
  title:       string;
  value:       number | string;
  sub:         string;
  color:       "gray" | "amber" | "violet" | "emerald";
  isMonetary?: boolean;
  rate?:       number;
  rateLabel?:  string;
}

const COLOR_CLS: Record<FunnelCardProps["color"], string> = {
  gray:    "border-gray-200    bg-white       text-gray-900",
  amber:   "border-amber-200   bg-amber-50/40 text-amber-900",
  violet:  "border-violet-200  bg-violet-50/40 text-violet-900",
  emerald: "border-emerald-200 bg-emerald-50/40 text-emerald-900",
};
const COLOR_STEP: Record<FunnelCardProps["color"], string> = {
  gray:    "text-gray-400",
  amber:   "text-amber-600",
  violet:  "text-violet-600",
  emerald: "text-emerald-600",
};

function FunnelCard({ step, title, value, sub, color, isMonetary, rate, rateLabel }: FunnelCardProps) {
  return (
    <div className={`rounded-xl border p-4 ${COLOR_CLS[color]}`}>
      <div className={`text-[10px] font-bold tracking-wider ${COLOR_STEP[color]}`}>{step}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-gray-600 font-semibold">{title}</div>
      <div className="mt-2 text-2xl font-bold tabular-nums">
        {isMonetary ? value : (typeof value === "number" ? value.toLocaleString() : value)}
      </div>
      <div className="mt-1 text-[10px] text-gray-500">{sub}</div>
      {typeof rate === "number" && (
        <div className="mt-2 pt-2 border-t border-gray-200/60 text-[10px] text-gray-500">
          <span className="font-mono font-bold text-gray-700">{(rate * 100).toFixed(1)}%</span>{" "}
          <span>{rateLabel}</span>
        </div>
      )}
    </div>
  );
}

function RateBar({ label, rate, color }: { label: string; rate: number; color: string }) {
  const pct = Math.min(100, Math.max(0, rate * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-mono font-bold text-gray-900">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }}/>
      </div>
    </div>
  );
}
