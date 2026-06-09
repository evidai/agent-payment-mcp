"use client";

/**
 * /admin/funnel — DB グラウンドトゥルース由来の LP 活性度ダッシュボード。
 * GA4 に依存せず、自前の DB だけで「LP 訪問・デモ実行の活性度 + 流入源」を可視化。
 *
 * NOTE (pivot 後): Provider 登録 / 有料サブスク / 実課金の各段階は、旧 (pivot 前)
 * の providerV2 / subscription / permitCharge モデル依存で、現行のプリペイド課金
 * には繋がっていないため UI から撤去した。現行の売上・Provider・ゲートウェイ
 * 呼び出しはオペレータコンソール (/admin) を参照。
 *
 * 参照 API: GET /api/telemetry/funnel?days=N (admin Bearer 必須)
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AdminShell } from "../_components/AdminPageNav";

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

interface TrafficSourcesResponse {
  windowDays:  number;
  generatedAt: string;
  totals: {
    humanViews: number;
    botViews:   number;
    uniqueIps:  number;
    botRatio:   number;
  };
  byPath:     Array<{ path: string;     views: number; uniqueIps: number }>;
  byReferrer: Array<{ referrer: string; views: number }>;
  byUtm:      Array<{ source: string; medium: string|null; campaign: string|null; views: number }>;
  byCountry:  Array<{ country: string;  views: number; uniqueIps: number }>;
}

export default function FunnelPage() {
  const router = useRouter();
  const [data,    setData]    = useState<FunnelResponse | null>(null);
  const [traffic, setTraffic] = useState<TrafficSourcesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string>("");
  const [days,    setDays]    = useState(30);

  const load = useCallback(async (d: number) => {
    setLoading(true); setError("");
    // Auth = httpOnly owner cookie (admin = email ∈ ADMIN_EMAILS). Legacy
    // localStorage token removed — no more bounce-loop to /admin/login.
    const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
    try {
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const [funnelRes, trafficRes] = await Promise.all([
        fetch(`${API_URL}/api/telemetry/funnel?days=${d}`,           { headers, credentials: "include" }),
        fetch(`${API_URL}/api/telemetry/traffic-sources?days=${d}`,  { headers, credentials: "include" }),
      ]);
      if (funnelRes.status === 401 || trafficRes.status === 401) {
        setError("ファネル(legacy)バックエンドに接続できません。/admin/lc/stats の funnel をご利用ください。");
        return;
      }
      const funnelJson = await funnelRes.json();
      if (!funnelRes.ok) throw new Error(funnelJson.error ?? `HTTP ${funnelRes.status}`);
      setData(funnelJson);
      if (trafficRes.ok) setTraffic(await trafficRes.json());
      else               setTraffic(null);  // 新 endpoint まだ deploy 前なら null
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得失敗");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(days); }, [load, days]);

  const t = data?.totals;

  return (
    <AdminShell title="Conversion Funnel">
      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">LP 活性度</h1>
            <p className="text-sm text-gray-500 mt-1">
              LP 訪問 → デモ実行 の活性度と流入源を DB から直接集計
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
            {/* pivot 前モデル依存の段階 (登録/サブスク/課金) は撤去。LP 活性度のみ。 */}
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-xs text-amber-800 leading-relaxed">
              <span className="font-bold">表示範囲について：</span>
              Provider 登録 / 有料サブスク / 実課金は旧 (pivot 前) の subscription・PermitCharge
              モデル依存で、現行のプリペイド課金には繋がっていないため撤去しました。
              現行の売上・Provider・ゲートウェイ呼び出しは{" "}
              <a href="/admin" className="underline font-semibold">オペレータコンソール</a>
              {" "}を参照してください。ここでは LP の活性度（訪問・デモ実行）と流入源のみを集計します。
            </div>

            {/* LP activity — 2 cards */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <FunnelCard
                step="01"
                title="LP 訪問者"
                value={t.lpUniqueVisitors}
                sub={`デモ実行 ${t.lpDemoRuns.toLocaleString()} 回`}
                color="gray"
              />
              <FunnelCard
                step="02"
                title="デモ実行"
                value={t.lpDemoRuns}
                sub="playground 実行回数"
                color="gray"
                rate={t.lpUniqueVisitors > 0 ? t.lpDemoRuns / t.lpUniqueVisitors : 0}
                rateLabel="回 / 訪問者"
              />
            </div>

            {/* Daily area chart */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-gray-900">日次推移</h2>
                <span className="text-[10px] text-gray-400">
                  生成時刻: {new Date(data.generatedAt).toLocaleString("ja-JP")}
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
                      <linearGradient id="g_demo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.5}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
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
                    <Area type="monotone" dataKey="lpUniqueVisitors" name="LP 訪問者" stroke="#9ca3af" fill="url(#g_visitors)" strokeWidth={1.5}/>
                    <Area type="monotone" dataKey="lpDemoRuns"       name="デモ実行"  stroke="#f59e0b" fill="url(#g_demo)"      strokeWidth={2}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 流入源セクション — PageView ベース */}
            {traffic ? (
              <TrafficSourcesSection traffic={traffic}/>
            ) : (
              <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-4 text-xs text-gray-500 leading-relaxed">
                <p className="font-bold text-gray-700">流入源データ未収集</p>
                <p className="mt-1">
                  <code className="bg-white px-1 rounded">/api/telemetry/traffic-sources</code> エンドポイントがまだデプロイされていないか、
                  PageView テーブルが空です。layout に <code className="bg-white px-1 rounded">&lt;PageviewPing/&gt;</code> を入れて
                  数時間〜数日待つと表示されます。
                </p>
              </div>
            )}

            {/* Raw daily table (last 14) */}
            <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold">日付</th>
                    <th className="px-3 py-2 text-right font-bold">訪問者</th>
                    <th className="px-3 py-2 text-right font-bold">デモ実行</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 font-mono">
                  {data.daily.slice(-14).reverse().map(d => (
                    <tr key={d.date} className="border-t border-gray-100">
                      <td className="px-3 py-2">{d.date}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.lpUniqueVisitors}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{d.lpDemoRuns}</td>
                    </tr>
                  ))}
                  {data.daily.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-8 text-center text-gray-400">データなし</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminShell>
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


// ─── 流入源セクション ────────────────────────────────────────

function TrafficSourcesSection({ traffic }: { traffic: TrafficSourcesResponse }) {
  const t = traffic.totals;
  const botPct = (t.botRatio * 100).toFixed(1);

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <h2 className="text-base font-bold text-gray-900">流入源</h2>
          <p className="text-[10px] text-gray-400">
            PageView ベース集計（bot 除外） · {traffic.windowDays} 日窓
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-1">
          <Mini label="人間 PV"        value={t.humanViews.toLocaleString()} sub="bot 除外" />
          <Mini label="ユニーク IP"   value={t.uniqueIps.toLocaleString()}  sub="人間のみ" />
          <Mini label="bot PV"        value={t.botViews.toLocaleString()}   sub={`bot 比率 ${botPct}%`} />
          <Mini label="計測カバー"    value={traffic.byPath.length.toString()} sub="ユニーク path 数" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BreakdownTable
          title="ページ別アクセス"
          cols={["パス", "PV", "ユニーク"]}
          rows={traffic.byPath.slice(0, 12).map(p => [p.path, p.views, p.uniqueIps])}
          emptyMsg="ページビュー記録なし"
        />
        <BreakdownTable
          title="参照元（referrer）"
          cols={["元", "PV"]}
          rows={traffic.byReferrer.slice(0, 12).map(r => [r.referrer, r.views])}
          emptyMsg="referrer 情報なし"
        />
        <BreakdownTable
          title="UTM キャンペーン"
          cols={["source / medium / campaign", "PV"]}
          rows={traffic.byUtm.slice(0, 12).map(u => [
            `${u.source}${u.medium ? ` / ${u.medium}` : ""}${u.campaign ? ` / ${u.campaign}` : ""}`,
            u.views,
          ])}
          emptyMsg="UTM 付き流入なし（外部リンクに utm_source 付けて配布すると埋まる）"
        />
        <BreakdownTable
          title="国別アクセス"
          cols={["国", "PV", "ユニーク"]}
          rows={traffic.byCountry.slice(0, 12).map(c => [c.country, c.views, c.uniqueIps])}
          emptyMsg="国コード未取得"
        />
      </div>
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      <p className="mt-0.5 text-[10px] text-gray-400">{sub}</p>
    </div>
  );
}

function BreakdownTable({ title, cols, rows, emptyMsg }: {
  title: string; cols: string[]; rows: (string|number)[][]; emptyMsg: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <div className="px-4 py-2.5 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider text-[10px]">
            <tr>
              {cols.map((c, i) => (
                <th key={i} className={`px-3 py-2 font-bold ${i === 0 ? "text-left" : "text-right"}`}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-gray-700">
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} className="px-3 py-6 text-center text-gray-400 text-[11px] leading-relaxed">
                {emptyMsg}
              </td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="border-t border-gray-100">
                {r.map((cell, ci) => (
                  <td key={ci} className={`px-3 py-2 ${ci === 0 ? "font-mono text-[11px] break-all" : "text-right tabular-nums font-mono"}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
