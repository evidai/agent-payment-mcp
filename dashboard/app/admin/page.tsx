"use client";

import { useState, useEffect, useCallback } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

// ── auth ────────────────────────────────────────────────────────────────────
// すべての /api/admin/lc/* は httpOnly の owner セッション Cookie で保護される
// （admin = ADMIN_EMAILS に載った認証済みメールの owner）。Cookie は同一オリジン
// fetch で自動送信されるので、明示ヘッダは不要。
function authHeaders(): HeadersInit {
  return {};
}

// ── Types ─────────────────────────────────────────────────────────────────────
// ピボット後 (2026-05) のコンソール。買い手が /buy/[shortId] で Stripe 前払い →
// Pay Token 1 枚発行、3% 手数料は Checkout で 1 回だけ。旧 m2m/サブスク/オフランプ
// のセクションは廃止。KPI は live な lc_* テーブルから直接集計する。
type NavSection = "overview" | "providers" | "endpoints" | "tokens" | "activity" | "invoices";

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ico = {
  Overview: ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></svg>,
  Finance:  ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx="10" cy="10" r="7"/><path d="M10 7v1.5a1.5 1.5 0 000 3 1.5 1.5 0 010 3V16M10 7a2 2 0 012 2M10 16a2 2 0 01-2-2" strokeLinecap="round"/></svg>,
  Alert:    ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><path d="M8 2l6 11H2L8 2z" strokeLinejoin="round"/><path d="M8 7v3M8 12h.01"/></svg>,
  User:     ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="8" cy="5" r="3"/><path d="M2 14a6 6 0 0112 0" strokeLinecap="round"/></svg>,
  Bolt:     ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M9 2L4 9h4l-1 5 6-7H9l1-5z"/></svg>,
  Plug:     ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><path d="M5 2v4M11 2v4M4 6h8v2.5a4 4 0 01-8 0V6zM8 12.5V15"/></svg>,
  Key:      ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><circle cx="5.5" cy="10.5" r="2.8"/><path d="M7.8 8.2L14 2M11.5 4.5l2 2M9.5 6.5l2 2"/></svg>,
};

// ── Shared components ─────────────────────────────────────────────────────────
function Pill({label, variant}: {label:string; variant:"green"|"red"|"amber"|"gray"|"blue"|"violet"}) {
  const c = {
    green:  "bg-green-50 text-green-700 border-green-200",
    red:    "bg-red-50 text-red-700 border-red-200",
    amber:  "bg-amber-50 text-amber-700 border-amber-200",
    gray:   "bg-gray-100 text-gray-500 border-gray-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    violet: "bg-violet-50 text-violet-700 border-violet-200",
  }[variant];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${c}`}>{label}</span>;
}

function KpiCard({label,value,unit,delta,color="default"}:{label:string;value:string|number;unit?:string;delta?:string;color?:"default"|"green"|"red"|"blue"|"amber"|"violet"}) {
  const vc = {default:"text-gray-900",green:"text-green-600",red:"text-red-600",blue:"text-blue-600",amber:"text-amber-600",violet:"text-violet-600"}[color];
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <p className="text-xs font-medium text-gray-400 mb-2">{label}</p>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold font-mono tabular-nums ${vc}`}>{value}</span>
        {unit && <span className="text-sm text-gray-400">{unit}</span>}
      </div>
      {delta && <p className="text-xs text-gray-400 mt-1">{delta}</p>}
    </div>
  );
}

function Th({children,right}:{children:React.ReactNode;right?:boolean}) {
  return <th className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100 whitespace-nowrap ${right?"text-right":"text-left"}`}>{children}</th>;
}

function Td({children,right,mono,cls}:{children:React.ReactNode;right?:boolean;mono?:boolean;cls?:string}) {
  return <td className={`px-3 py-2.5 text-xs border-b border-gray-50 align-middle ${right?"text-right":"text-left"} ${mono?"font-mono tabular-nums":""} ${cls??""}`}>{children}</td>;
}

function TaskItem({icon, label, count, urgent, onClick}: {icon:React.ReactNode; label:string; count:number; urgent?:boolean; onClick?:()=>void}) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all w-full text-left ${urgent?"border-red-200 bg-red-50 hover:bg-red-100":"border-gray-200 bg-white hover:bg-gray-50"}`}>
      <span className={`flex-shrink-0 ${urgent?"text-red-500":"text-gray-400"}`}>{icon}</span>
      <span className="flex-1 text-sm text-gray-700 font-medium">{label}</span>
      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${urgent?"bg-red-500 text-white":"bg-gray-200 text-gray-600"}`}>{count}</span>
    </button>
  );
}

function Toast({msg, type, onDone}: {msg:string; type:"success"|"error"|"info"; onDone:()=>void}) {
  useEffect(() => { const t = setTimeout(onDone, 2500); return ()=>clearTimeout(t); }, [onDone]);
  const bg = type==="success"?"bg-navy text-white" : type==="error"?"bg-red-600 text-white" : "bg-blue-600 text-white";
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold ${bg} animate-fade-in`}>
      {type==="success" && <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8l3.5 3.5L13 4"/></svg>}
      {type==="error"   && <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>}
      {msg}
    </div>
  );
}

// ── formatters ────────────────────────────────────────────────────────────────
function fmtJpy(n: number) { return "¥" + Math.round(n).toLocaleString(); }
function fmtUsd(n: number) {
  const max = n !== 0 && Math.abs(n) < 1 ? 4 : 2;
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: max });
}
function shortDate(s: string | null | undefined) { return s ? s.slice(0, 10) : "—"; }
function shortTime(s: string | null | undefined) { return s ? s.slice(0, 19).replace("T", " ") : "—"; }
/** 相対時刻（タイトル属性に ISO を残す前提の表示用）。 */
function timeAgo(s: string | null | undefined): string {
  if (!s) return "—";
  const diff = Date.now() - new Date(s).getTime();
  if (!Number.isFinite(diff)) return "—";
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}日前`;
  return shortDate(s);
}
/** 相対時刻セル — hover で正確な日時。 */
function Ago({ s }: { s: string | null | undefined }) {
  return <span title={shortTime(s)}>{timeAgo(s)}</span>;
}

// ── LemonCake live stats (lc_* テーブル集計) ────────────────────────────────────
interface LcWindow { gross: number; fee: number; net: number; orders: number; calls: number; callGross: number; }
interface LcStats {
  providers: { total: number; withStripe: number; chargesEnabled: number; withSale: number };
  endpoints: { total: number; sellable: number; live: number };
  sales:     { orders: number; buyers: number; gross: number; fee: number; net: number; spent: number; outstanding: number };
  gateway:   { calls: number; grossMetered: number };
  timeseries: { today: LcWindow; month: LcWindow; all: LcWindow };
  funnel?: {
    owners: number; ownersWithEndpoint: number; ownersWithPriced: number;
    ownersWithToken: number; ownersWithPurchase: number; ownersWithPaidCall: number;
    endpoints: number; endpointsPriced: number; endpointsWithPurchase: number; endpointsWithPaidCall: number;
    agents: number; shareEvents7d: number;
  };
  blocked7d: number;
  feeRate:   number;
}

// Activation funnel — shows where the 624→0 dies (each step + drop-off %).
function FunnelView({ f }: { f: NonNullable<LcStats["funnel"]> }) {
  const steps = [
    { label: "Owners (visited /app)", v: f.owners },
    { label: "Created an endpoint", v: f.ownersWithEndpoint },
    { label: "Priced it (sellable)", v: f.ownersWithPriced },
    { label: "Issued a Pay Token", v: f.ownersWithToken },
    { label: "🧱 Real buyer PAID (card)", v: f.ownersWithPurchase },
    { label: "Real paid call (card token)", v: f.ownersWithPaidCall },
  ];
  const top = Math.max(1, f.owners);
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-3">活性化ファネル（どこで死ぬか）<span className="ml-2 text-[10px] font-normal text-gray-400">owner単位 · 各段の到達数と前段比</span></h3>
      <div className="space-y-1.5">
        {steps.map((st, i) => {
          const prev = i === 0 ? st.v : steps[i - 1].v;
          const conv = prev > 0 ? Math.round((st.v / prev) * 100) : 0;
          const widthPct = Math.round((st.v / top) * 100);
          const cliff = i > 0 && prev > 0 && st.v === 0;
          return (
            <div key={st.label} className="flex items-center gap-3">
              <div className="w-44 text-[11px] text-gray-600 flex-shrink-0">{st.label}</div>
              <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                <div className={`h-full ${cliff ? "bg-red-400" : "bg-emerald-400"}`} style={{ width: `${Math.max(widthPct, st.v > 0 ? 4 : 0)}%` }} />
              </div>
              <div className="w-28 text-right text-[11px] flex-shrink-0">
                <span className="font-bold text-gray-900">{st.v.toLocaleString()}</span>
                {i > 0 && <span className={`ml-1.5 ${cliff ? "text-red-500 font-bold" : "text-gray-400"}`}>{conv}%</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
        <div><span className="text-gray-400">Endpoints</span> <b>{f.endpoints}</b> (priced {f.endpointsPriced})</div>
        <div><span className="text-gray-400">有料化EP</span> <b>{f.endpointsWithPurchase}</b> 購入 / {f.endpointsWithPaidCall} 利用</div>
        <div><span className="text-gray-400">Agents</span> <b>{f.agents}</b></div>
        <div><span className="text-gray-400">共有イベント(7d)</span> <b>{f.shareEvents7d}</b></div>
      </div>
      <p className="mt-2 text-[10px] text-gray-400 leading-snug">赤＝そこで全滅した段。最大の崖が次に直すべき箇所。「A real buyer PAID」が0なら需要側、その手前で落ちるなら供給側の摩擦。</p>
    </div>
  );
}

function useLcStats() {
  const [stats, setStats] = useState<LcStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const load = useCallback(() => {
    fetch(`/api/admin/lc/stats`, { headers: authHeaders() })
      .then(async (r) => {
        if (!r.ok) { setError(`stats ${r.status}`); return null; }
        return r.json();
      })
      .then((d) => { if (d) { setStats(d); setError(null); setUpdatedAt(new Date()); } })
      .catch(() => setError("network"))
      .finally(() => setLoading(false));
  }, []);
  // 初回 + 60 秒ごとに自動更新（管理画面は開きっぱなし運用が多い）。
  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);
  return { stats, loading, error, reload: load, updatedAt };
}

// ── Ops data（/api/admin/lc/ops: 日次売上 / 健全性 / EP board / tokens）──────────
interface OpsDaily { day: string; gross: number; orders: number; callGross: number; calls: number; }
interface OpsHealth { calls7d: number; errors7d: number; errorRate: number; avgMs: number | null; p50: number | null; p95: number | null; }
interface OpsEndpoint {
  shortId: string; name: string; status: string; price: number; ownerEmail: string | null;
  purchases: number; purchaseGross: number; calls: number; callGross: number;
  lastCallAt: string | null; blocked7d: number;
}
interface OpsToken {
  id: string; endpoint: string | null; shortId: string | null;
  budget: number; spent: number; callsUsed: number; maxCalls: number;
  status: string; buyer: string | null; purchased: boolean;
  issuedAt: string; expiresAt: string;
}
interface LcOps { revenueDaily: OpsDaily[]; gatewayHealth: OpsHealth; endpointBoard: OpsEndpoint[]; tokens: OpsToken[]; }

function useLcOps() {
  const [ops, setOps] = useState<LcOps | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch(`/api/admin/lc/ops`, { headers: authHeaders() })
      .then(async (r) => { if (!r.ok) { setError(`ops ${r.status}`); return null; } return r.json(); })
      .then((d) => { if (d) { setOps(d); setError(null); } })
      .catch(() => setError("network"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ops, loading, error, reload: load };
}

// 30 日の日次売上バー（CSS のみ — recharts を /admin に持ち込まない）。
function RevenueChart({ daily }: { daily: OpsDaily[] }) {
  const max = Math.max(0.01, ...daily.map((d) => d.gross));
  const total30 = daily.reduce((a, d) => a + d.gross, 0);
  const orders30 = daily.reduce((a, d) => a + d.orders, 0);
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="text-sm font-bold text-gray-900">日次売上（30日）</h3>
        <p className="text-[11px] text-gray-400">計 <b className="text-gray-700 font-mono">{fmtUsd(total30)}</b> / {orders30.toLocaleString()} 注文</p>
      </div>
      <p className="text-[10px] text-gray-400 mb-3">前払い購入（JST 日次）。バー hover で日付と金額。</p>
      <div className="flex items-end gap-[2px] h-24">
        {daily.map((d) => (
          <div key={d.day} className="group relative flex-1 flex items-end h-full">
            <div
              className={`w-full rounded-t ${d.gross > 0 ? "bg-emerald-400 group-hover:bg-emerald-500" : "bg-gray-100"}`}
              style={{ height: `${d.gross > 0 ? Math.max(6, Math.round((d.gross / max) * 100)) : 3}%` }}
              title={`${d.day}\n売上 ${fmtUsd(d.gross)} (${d.orders} 注文)\n呼び出し ${d.calls.toLocaleString()} 回 / ${fmtUsd(d.callGross)}`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1 text-[9px] text-gray-300 font-mono">
        <span>{daily[0]?.day.slice(5)}</span>
        <span>{daily[Math.floor(daily.length / 2)]?.day.slice(5)}</span>
        <span>{daily[daily.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
}

// Gateway 健全性（7日）— レイテンシ百分位 + エラー率。
function GatewayHealthRow({ h }: { h: OpsHealth }) {
  const ms = (v: number | null) => (v == null ? "—" : `${Math.round(v)}`);
  const errPct = (h.errorRate * 100).toFixed(h.errorRate > 0 && h.errorRate < 0.01 ? 2 : 1);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KpiCard label="Gateway 呼び出し (7日)" value={h.calls7d.toLocaleString()} unit="回" />
      <KpiCard label="エラー率 (5xx/不達)" value={`${errPct}%`} color={h.errorRate > 0.05 ? "red" : h.errorRate > 0 ? "amber" : "green"} delta={`${h.errors7d.toLocaleString()} 件`} />
      <KpiCard label="レイテンシ p50" value={ms(h.p50)} unit="ms" color="blue" delta={`平均 ${ms(h.avgMs)}ms`} />
      <KpiCard label="レイテンシ p95" value={ms(h.p95)} unit="ms" color={h.p95 != null && h.p95 > 3000 ? "amber" : "violet"} />
    </div>
  );
}

// ── KillSwitchBanner ──────────────────────────────────────────────────────────
// 緊急停止スイッチ。本番の課金経路（Vercel x402 Gateway + Stripe）を即時に全停止する。
// halt 中は Gateway の課金/転送も、新規 Pay Token のmint(課金)も 503 で止まる。
function KillSwitchBanner() {
  const [halted, setHalted]   = useState(false);
  const [envForced, setEnvForced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast]     = useState<{msg:string; type:"success"|"error"|"info"}|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/killswitch");
        if (!r.ok) return;
        const d = (await r.json()) as { halted?: boolean; envForced?: boolean };
        if (typeof d.halted === "boolean") setHalted(d.halted);
        if (typeof d.envForced === "boolean") setEnvForced(d.envForced);
      } catch { /* noop */ }
    })();
  }, []);

  function showToast(msg: string, type: "success"|"error"|"info" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function toggle() {
    if (loading) return;
    const desired = !halted;
    if (desired && !confirm("本番の課金経路（Gateway + Stripe）を全停止します。\n停止中はすべての有料コールと新規入金が 503 で止まります。よろしいですか？")) return;
    setLoading(true);
    try {
      const r = await fetch("/api/admin/killswitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ halt: desired }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { error?: string };
        showToast(e.error ?? `操作失敗 (${r.status})`, "error");
        return;
      }
      const d = (await r.json()) as { halted?: boolean };
      setHalted(d.halted ?? desired);
      showToast((d.halted ?? desired) ? "課金を全停止しました" : "課金を再開しました");
    } catch {
      showToast("ネットワークエラー", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border ${halted ? "bg-red-50 border-red-300" : "bg-white border-gray-200"}`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${halted ? "bg-red-500 animate-pulse" : "bg-emerald-400"}`}/>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900">
              {halted ? "🚨 緊急停止中 — 本番の課金 (Gateway + Stripe) を全件 503 で拒否中" : "課金経路 稼働中 (Gateway + Stripe)"}
            </p>
            <p className="text-[10px] text-gray-500 hidden sm:block">
              {halted
                ? "「再開」で課金が再び通る。停止中は有料コールも新規入金も止まる"
                : "緊急時は本番の課金経路を即時に全停止（有料コール・新規入金とも 503）"}
              {envForced && "　・env LC_KILL_SWITCH=1 で強制停止中（ボタンでは解除不可）"}
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${halted ? "bg-emerald-600 text-white hover:bg-emerald-500" : "bg-red-600 text-white hover:bg-red-500"}`}
        >
          {loading ? "..." : halted ? "再開" : "停止"}
        </button>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </>
  );
}

// ── Overview ────────────────────────────────────────────────────────────────
function LcOverviewPage({ setNav }: { setNav: (n: NavSection) => void }) {
  const { stats, loading, error, reload, updatedAt } = useLcStats();
  const { ops } = useLcOps();

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>;
  if (!stats)  return <p className="text-sm text-red-500 text-center py-12">集計 API に接続できません（/api/admin/lc/stats{error ? ` — ${error}` : ""}）</p>;

  const s = stats;
  const noStripe = Math.max(0, s.providers.total - s.providers.withStripe);
  const noSale   = Math.max(0, s.providers.total - s.providers.withSale);

  return (
    <div className="space-y-6">
      {/* killswitch — m2m 課金経路のみ停止 */}
      <KillSwitchBanner />

      {/* hero KPI: 前払い売上の流れ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="前払い売上 (総額)" value={fmtUsd(s.sales.gross)} color="green" delta={`${s.sales.orders.toLocaleString()} 注文 / ${s.sales.buyers.toLocaleString()} 購入者`}/>
        <KpiCard label={`手数料収益 (${Math.round(s.feeRate*100)}%)`} value={fmtUsd(s.sales.fee)} color="amber" delta="Checkout で 1 回徴収"/>
        <KpiCard label="出品者受取 (net)" value={fmtUsd(s.sales.net)} color="blue" delta={`売上の ${Math.round((1-s.feeRate)*100)}% を還元`}/>
        <KpiCard label="Gateway 呼び出し" value={s.gateway.calls.toLocaleString()} unit="回" color="violet" delta={`課金額 ${fmtUsd(s.gateway.grossMetered)}`}/>
      </div>

      {/* 日次売上 + Gateway 健全性（/api/admin/lc/ops）*/}
      {ops && <RevenueChart daily={ops.revenueDaily} />}
      {ops && <GatewayHealthRow h={ops.gatewayHealth} />}

      {/* activation funnel — where the 624→0 dies */}
      {s.funnel && <FunnelView f={s.funnel} />}

      <p className="text-[10px] text-gray-400 text-right -mt-3">
        自動更新 60 秒 ・ 最終 {updatedAt ? updatedAt.toLocaleTimeString("ja-JP", { hour12: false }) : "—"}
        <button onClick={reload} className="ml-2 font-bold text-amber-700 hover:underline">今すぐ更新</button>
      </p>

      {/* 2nd row: Provider / クレジット / ブロック */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Provider 数" value={s.providers.total} unit="者" delta={`Stripe接続 ${s.providers.withStripe} / 売上あり ${s.providers.withSale}`}/>
        <KpiCard label="出品 API (有料)" value={s.endpoints.sellable} unit="本" delta={`総 ${s.endpoints.total} / 稼働 ${s.endpoints.live}`}/>
        <KpiCard label="未消化クレジット" value={fmtUsd(s.sales.outstanding)} color="default" delta={`消化済 ${fmtUsd(s.sales.spent)}`}/>
        <KpiCard label="ブロック (7日)" value={s.blocked7d} unit="件" color={s.blocked7d > 0 ? "red" : "default"} delta="上限超過 / 期限切れ等"/>
      </div>

      {/* 期間サマリー — 今日 / 今月 / 累計 */}
      {s.timeseries && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-1">期間サマリー</h3>
          <p className="text-[10px] text-gray-400 mb-4">JST 基準。前払い売上 / 手数料 / Gateway 呼び出し</p>
          <div className="grid grid-cols-3 gap-4">
            {([
              { label: "今日", w: s.timeseries.today },
              { label: "今月", w: s.timeseries.month },
              { label: "累計", w: s.timeseries.all },
            ] as const).map(({ label, w }) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-gray-50/50 p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">{label}</p>
                <p className="text-xl font-bold text-gray-900 font-mono tabular-nums">{fmtUsd(w.gross)}</p>
                <p className="text-[10px] text-gray-400">{w.orders.toLocaleString()} 注文</p>
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-0.5">
                  <p className="text-[11px] text-gray-500 flex justify-between"><span>手数料</span><span className="font-mono text-amber-700">{fmtUsd(w.fee)}</span></p>
                  <p className="text-[11px] text-gray-500 flex justify-between"><span>呼び出し</span><span className="font-mono text-gray-700">{w.calls.toLocaleString()}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 運営タスク */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">運営タスク</h3>
          <button onClick={() => setNav("activity")} className="text-xs text-blue-600 hover:underline">アクティビティ →</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <TaskItem icon={<Ico.Finance cls="w-4 h-4"/>} label="Stripe 未接続の Provider"  count={noStripe}      urgent={noStripe > 0}      onClick={() => setNav("providers")}/>
          <TaskItem icon={<Ico.User cls="w-4 h-4"/>}    label="まだ売上ゼロの Provider"    count={noSale}                                  onClick={() => setNav("providers")}/>
          <TaskItem icon={<Ico.Alert cls="w-4 h-4"/>}   label="ブロックされた呼び出し(7日)" count={s.blocked7d}  urgent={s.blocked7d > 0}   onClick={() => setNav("activity")}/>
        </div>
      </div>
    </div>
  );
}

// ── Providers ─────────────────────────────────────────────────────────────────
interface LcProvider {
  ownerId: string; email: string | null; createdAt: string;
  stripeConnected: boolean; chargesEnabled: boolean; payoutsEnabled: boolean; detailsSubmitted: boolean;
  endpoints: number; sellable: number;
  orders: number; gross: number; fee: number; net: number; spent: number; outstanding: number;
  calls: number; lastSale: string | null;
}

// Stripe Connect の入金健全性を 1 セルに凝縮。primary pill = 一番の詰まり、
// 下段に 課金(charges)/入金(payouts) の可否ドット。
function StripeStatus({ p }: { p: LcProvider }) {
  let pill: React.ReactNode;
  if (!p.stripeConnected)                       pill = <Pill label="未接続"   variant="gray"/>;
  else if (p.chargesEnabled && p.payoutsEnabled) pill = <Pill label="入金可"   variant="green"/>;
  else if (!p.detailsSubmitted)                  pill = <Pill label="登録途中" variant="gray"/>;
  else                                           pill = <Pill label="審査中"   variant="amber"/>;
  const dot = (ok: boolean, label: string) => (
    <span className={`inline-flex items-center gap-0.5 ${ok ? "text-green-600" : "text-gray-300"}`}>
      <span className="text-[8px] leading-none">●</span>{label}
    </span>
  );
  return (
    <div className="space-y-1">
      {pill}
      {p.stripeConnected && (
        <div className="flex gap-2 text-[9px] font-medium">
          {dot(p.chargesEnabled, "課金")}
          {dot(p.payoutsEnabled, "入金")}
        </div>
      )}
    </div>
  );
}

function LcProvidersPage() {
  const [rows, setRows] = useState<LcProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch(`/api/admin/lc/providers`, { headers: authHeaders() })
      .then(async (r) => { if (!r.ok) { setError(`providers ${r.status}`); return null; } return r.json(); })
      .then((d) => { if (d?.providers) setRows(d.providers); })
      .catch(() => setError("network"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter((r) =>
    !q || `${r.email ?? ""} ${r.ownerId}`.toLowerCase().includes(q.toLowerCase())
  );

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>;
  if (error)   return <p className="text-sm text-red-500 text-center py-12">取得失敗（/api/admin/lc/providers — {error}）</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="検索: Email / Owner ID"
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"/>
        <span className="text-xs text-gray-500">{filtered.length} 者</span>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full">
          <thead><tr><Th>Provider</Th><Th>Stripe</Th><Th right>出品/稼働</Th><Th right>注文</Th><Th right>前払い</Th><Th right>手数料</Th><Th right>受取</Th><Th right>未消化</Th><Th right>呼び出し</Th><Th>最終売上</Th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.ownerId} className="hover:bg-gray-50">
                <Td>
                  <p className="font-medium text-gray-900 text-sm">{r.email ?? "（メール未設定）"}</p>
                  <p className="text-[10px] text-gray-300 font-mono">{r.ownerId}</p>
                </Td>
                <Td><StripeStatus p={r}/></Td>
                <Td right mono>{r.sellable}/{r.endpoints}</Td>
                <Td right mono>{r.orders.toLocaleString()}</Td>
                <Td right mono cls="text-gray-900">{fmtUsd(r.gross)}</Td>
                <Td right mono cls="text-amber-700">{fmtUsd(r.fee)}</Td>
                <Td right mono cls="text-blue-700">{fmtUsd(r.net)}</Td>
                <Td right mono cls="text-gray-500">{fmtUsd(r.outstanding)}</Td>
                <Td right mono>{r.calls.toLocaleString()}</Td>
                <Td cls="text-[10px] text-gray-500">{shortDate(r.lastSale)}</Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-xs text-gray-400">該当なし</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Endpoints board ───────────────────────────────────────────────────────────
type EpSort = "gross" | "calls" | "last";
function LcEndpointsPage() {
  const { ops, loading, error, reload } = useLcOps();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<EpSort>("gross");

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>;
  if (error || !ops) return <p className="text-sm text-red-500 text-center py-12">取得失敗（/api/admin/lc/ops — {error}）</p>;

  const rows = ops.endpointBoard
    .filter((e) => !q || `${e.name} ${e.shortId} ${e.ownerEmail ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) =>
      sort === "gross" ? b.purchaseGross - a.purchaseGross
      : sort === "calls" ? b.calls - a.calls
      : (b.lastCallAt ? new Date(b.lastCallAt).getTime() : 0) - (a.lastCallAt ? new Date(a.lastCallAt).getTime() : 0));

  const SortBtn = ({ id, label }: { id: EpSort; label: string }) => (
    <button onClick={() => setSort(id)}
      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition ${sort === id ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索: API名 / shortId / オーナー"
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"/>
        <span className="text-[11px] text-gray-400">並び替え:</span>
        <SortBtn id="gross" label="売上順"/>
        <SortBtn id="calls" label="呼び出し順"/>
        <SortBtn id="last"  label="最終利用順"/>
        <span className="text-xs text-gray-500">{rows.length} 本</span>
        <button onClick={reload} className="text-xs font-bold text-amber-700 hover:underline">再読み込み</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full">
          <thead><tr><Th>API</Th><Th>オーナー</Th><Th>状態</Th><Th right>単価</Th><Th right>購入</Th><Th right>売上</Th><Th right>呼び出し</Th><Th right>課金額</Th><Th right>ブロック(7d)</Th><Th>最終利用</Th><Th>リンク</Th></tr></thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.shortId} className="hover:bg-gray-50">
                <Td>
                  <p className="text-xs font-medium text-gray-900">{e.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono">/{e.shortId}</p>
                </Td>
                <Td cls="text-[11px] text-gray-500">{e.ownerEmail ?? "—"}</Td>
                <Td>{e.status === "live" ? <Pill label="稼働" variant="green"/> : <Pill label="停止" variant="gray"/>}</Td>
                <Td right mono>{fmtUsd(e.price)}</Td>
                <Td right mono>{e.purchases.toLocaleString()}</Td>
                <Td right mono cls="text-gray-900">{fmtUsd(e.purchaseGross)}</Td>
                <Td right mono>{e.calls.toLocaleString()}</Td>
                <Td right mono cls="text-blue-700">{fmtUsd(e.callGross)}</Td>
                <Td right mono cls={e.blocked7d > 0 ? "text-red-600 font-bold" : "text-gray-300"}>{e.blocked7d}</Td>
                <Td cls="text-[11px] text-gray-500"><Ago s={e.lastCallAt}/></Td>
                <Td><a href={`/buy/${e.shortId}`} target="_blank" rel="noopener" className="text-[11px] font-bold text-amber-700 hover:underline">/buy →</a></Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-xs text-gray-400">エンドポイントなし — Provider が /app で URL を貼ると、ここに並びます</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Pay Tokens（横断ビュー + 緊急失効）─────────────────────────────────────────
function LcTokensPage() {
  const { ops, loading, error, reload } = useLcOps();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "revoked" | "exhausted" | "expired">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>;
  if (error || !ops) return <p className="text-sm text-red-500 text-center py-12">取得失敗（/api/admin/lc/ops — {error}）</p>;

  const rows = ops.tokens
    .filter((t) => statusFilter === "all" || t.status === statusFilter)
    .filter((t) => !q || `${t.id} ${t.endpoint ?? ""} ${t.buyer ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  async function revoke(t: OpsToken) {
    if (!confirm(`Pay Token を失効させます。\n\n${t.id}\nAPI: ${t.endpoint ?? "—"} / 残額 ${fmtUsd(Math.max(0, t.budget - t.spent))}\n\n以後この token の呼び出しは全て拒否されます。よろしいですか？`)) return;
    setBusyId(t.id);
    try {
      const r = await fetch(`/api/admin/lc/tokens/revoke`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setToast({ msg: d.error ?? `失効失敗 (${r.status})`, type: "error" }); return; }
      setToast({ msg: `失効しました: ${t.id}`, type: "success" });
      reload();
    } catch {
      setToast({ msg: "ネットワークエラー", type: "error" });
    } finally {
      setBusyId(null);
    }
  }

  const FILTERS: { id: typeof statusFilter; label: string }[] = [
    { id: "all", label: "すべて" }, { id: "active", label: "有効" },
    { id: "exhausted", label: "使い切り" }, { id: "expired", label: "期限切れ" }, { id: "revoked", label: "失効" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {FILTERS.map((f) => (
          <button key={f.id} onClick={() => setStatusFilter(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${statusFilter === f.id ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
            {f.label}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="検索: token ID / API / 購入者"
          className="flex-1 min-w-[180px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"/>
        <span className="text-xs text-gray-500">{rows.length} 枚</span>
        <button onClick={reload} className="text-xs font-bold text-amber-700 hover:underline">再読み込み</button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full">
          <thead><tr><Th>Token</Th><Th>API</Th><Th>購入者</Th><Th right>予算</Th><Th right>消化</Th><Th right>残額</Th><Th right>calls</Th><Th>状態</Th><Th>発行</Th><Th>期限</Th><Th>操作</Th></tr></thead>
          <tbody>
            {rows.map((t) => {
              const left = Math.max(0, t.budget - t.spent);
              const pct = t.budget > 0 ? Math.min(100, Math.round((t.spent / t.budget) * 100)) : 0;
              return (
                <tr key={t.id} className="hover:bg-gray-50">
                  <Td>
                    <p className="text-[10px] font-mono text-gray-700">{t.id}</p>
                    {t.purchased ? <Pill label="購入" variant="blue"/> : <Pill label="テスト" variant="gray"/>}
                  </Td>
                  <Td>
                    <p className="text-xs text-gray-900">{t.endpoint ?? "—"}</p>
                    {t.shortId && <p className="text-[10px] text-gray-400 font-mono">/{t.shortId}</p>}
                  </Td>
                  <Td cls="text-[11px] text-gray-500">{t.buyer ?? "—"}</Td>
                  <Td right mono>{fmtUsd(t.budget)}</Td>
                  <Td right>
                    <span className="font-mono text-xs">{fmtUsd(t.spent)}</span>
                    <div className="mt-1 h-1 w-16 ml-auto rounded bg-gray-100 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${pct}%` }}/></div>
                  </Td>
                  <Td right mono cls={left > 0 ? "text-gray-900" : "text-gray-300"}>{fmtUsd(left)}</Td>
                  <Td right mono cls="text-gray-500">{t.callsUsed}/{t.maxCalls}</Td>
                  <Td>
                    {t.status === "active"    ? <Pill label="有効" variant="green"/> :
                     t.status === "exhausted" ? <Pill label="使い切り" variant="gray"/> :
                     t.status === "expired"   ? <Pill label="期限切れ" variant="amber"/> :
                     t.status === "revoked"   ? <Pill label="失効" variant="red"/> :
                                                <Pill label={t.status} variant="gray"/>}
                  </Td>
                  <Td cls="text-[11px] text-gray-500"><Ago s={t.issuedAt}/></Td>
                  <Td cls="text-[10px] text-gray-400">{shortDate(t.expiresAt)}</Td>
                  <Td>
                    {t.status === "active" ? (
                      <button onClick={() => revoke(t)} disabled={busyId === t.id}
                        className="px-2 py-1 rounded-md text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50">
                        {busyId === t.id ? "..." : "失効"}
                      </button>
                    ) : <span className="text-[10px] text-gray-300">—</span>}
                  </Td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-xs text-gray-400">該当する Pay Token はありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-gray-400">「失効」は即時。次の呼び出しから gateway が拒否し、ブロックログに token_revoked として記録されます。</p>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </div>
  );
}

// ── Activity ──────────────────────────────────────────────────────────────────
interface LcPurchase { id:string; endpoint:string|null; shortId:string|null; amount:number; fee:number; buyer:string|null; status:string; at:string; }
interface LcCall     { id:string; endpoint:string|null; shortId:string|null; gross:number; fee:number; net:number; upstreamStatus:number|null; upstreamMs:number|null; at:string; }
interface LcBlock    { id:string; endpoint:string|null; shortId:string|null; reason:string; attempted:number; at:string; }

const BLOCK_REASON_LABEL: Record<string, string> = {
  rate_limit_exceeded: "レート上限",
  spend_cap_exceeded:  "予算超過",
  token_expired:       "期限切れ",
  token_revoked:       "失効",
  endpoint_paused:     "停止中",
  upstream_error:      "上流エラー",
};

function LcActivityPage() {
  const [purchases, setPurchases] = useState<LcPurchase[]>([]);
  const [calls, setCalls] = useState<LcCall[]>([]);
  const [blocks, setBlocks] = useState<LcBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"purchases"|"calls"|"blocks">("purchases");
  const [reasonFilter, setReasonFilter] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/lc/activity`, { headers: authHeaders() })
      .then(async (r) => { if (!r.ok) { setError(`activity ${r.status}`); return null; } return r.json(); })
      .then((d) => {
        if (!d) return;
        setPurchases(d.purchases ?? []);
        setCalls(d.calls ?? []);
        setBlocks(d.blocks ?? []);
      })
      .catch(() => setError("network"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const TABS: { id: typeof tab; label: string; count: number }[] = [
    { id: "purchases", label: "前払い購入", count: purchases.length },
    { id: "calls",     label: "Gateway 呼び出し", count: calls.length },
    { id: "blocks",    label: "ブロック", count: blocks.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${tab===t.id ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
            {t.label} <span className="text-gray-400">({t.count})</span>
          </button>
        ))}
        <button onClick={load} className="text-xs font-bold text-amber-700 hover:underline ml-auto">再読み込み</button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>
      ) : error ? (
        <p className="text-sm text-red-500 text-center py-12">取得失敗（/api/admin/lc/activity — {error}）</p>
      ) : tab === "purchases" ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead><tr><Th>日時</Th><Th>API</Th><Th>購入者</Th><Th right>金額</Th><Th right>手数料</Th><Th>状態</Th></tr></thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <Td cls="text-[11px] text-gray-500"><Ago s={p.at}/></Td>
                  <Td>
                    <p className="text-xs text-gray-900">{p.endpoint ?? "—"}</p>
                    {p.shortId && <p className="text-[10px] text-gray-400 font-mono">/{p.shortId}</p>}
                  </Td>
                  <Td cls="text-[11px] text-gray-500">{p.buyer ?? "—"}</Td>
                  <Td right mono cls="text-gray-900">{fmtUsd(p.amount)}</Td>
                  <Td right mono cls="text-amber-700">{fmtUsd(p.fee)}</Td>
                  <Td>
                    {p.status === "active"    ? <Pill label="有効" variant="green"/> :
                     p.status === "exhausted" ? <Pill label="使い切り" variant="gray"/> :
                     p.status === "expired"   ? <Pill label="期限切れ" variant="amber"/> :
                     p.status === "revoked"   ? <Pill label="失効" variant="red"/> :
                                                <Pill label={p.status} variant="gray"/>}
                  </Td>
                </tr>
              ))}
              {purchases.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">前払い購入はまだありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : tab === "calls" ? (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead><tr><Th>日時</Th><Th>API</Th><Th right>課金</Th><Th right>手数料</Th><Th right>net</Th><Th>上流</Th><Th right>ms</Th></tr></thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <Td cls="text-[11px] text-gray-500"><Ago s={c.at}/></Td>
                  <Td>
                    <p className="text-xs text-gray-900">{c.endpoint ?? "—"}</p>
                    {c.shortId && <p className="text-[10px] text-gray-400 font-mono">/{c.shortId}</p>}
                  </Td>
                  <Td right mono cls="text-gray-900">{fmtUsd(c.gross)}</Td>
                  <Td right mono cls="text-amber-700">{fmtUsd(c.fee)}</Td>
                  <Td right mono cls="text-blue-700">{fmtUsd(c.net)}</Td>
                  <Td>
                    {c.upstreamStatus == null ? <span className="text-[10px] text-gray-300">—</span> :
                     c.upstreamStatus < 400 ? <Pill label={String(c.upstreamStatus)} variant="green"/> :
                                              <Pill label={String(c.upstreamStatus)} variant="red"/>}
                  </Td>
                  <Td right mono cls="text-gray-500">{c.upstreamMs ?? "—"}</Td>
                </tr>
              ))}
              {calls.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">Gateway 呼び出しはまだありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 理由の分布 + 多発エンドポイント（直近 300 件から集計） */}
          {blocks.length > 0 && (() => {
            const byReason = new Map<string, number>();
            const byEp = new Map<string, { name: string; count: number }>();
            for (const b of blocks) {
              byReason.set(b.reason, (byReason.get(b.reason) ?? 0) + 1);
              const k = b.shortId ?? "—";
              const cur = byEp.get(k) ?? { name: b.endpoint ?? "—", count: 0 };
              cur.count += 1; byEp.set(k, cur);
            }
            const reasons = [...byReason.entries()].sort((a, b2) => b2[1] - a[1]);
            const topEps = [...byEp.entries()].sort((a, b2) => b2[1].count - a[1].count).slice(0, 5);
            const maxR = reasons[0]?.[1] ?? 1;
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-gray-900 mb-2">理由の分布 <span className="font-normal text-gray-400">(クリックで絞り込み)</span></h4>
                  <div className="space-y-1.5">
                    {reasons.map(([r, n]) => (
                      <button key={r} onClick={() => setReasonFilter(reasonFilter === r ? null : r)}
                        className={`flex items-center gap-2 w-full text-left rounded-md px-1 py-0.5 ${reasonFilter === r ? "bg-amber-50 ring-1 ring-amber-200" : "hover:bg-gray-50"}`}>
                        <span className="w-24 text-[11px] text-gray-600 flex-shrink-0">{BLOCK_REASON_LABEL[r] ?? r}</span>
                        <span className="flex-1 h-3 bg-gray-100 rounded overflow-hidden"><span className="block h-full bg-red-400" style={{ width: `${Math.round((n / maxR) * 100)}%` }}/></span>
                        <span className="w-10 text-right text-[11px] font-bold text-gray-700">{n}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-gray-900 mb-2">ブロック多発 API（上位5）</h4>
                  <div className="space-y-1.5">
                    {topEps.map(([sid, v]) => (
                      <div key={sid} className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-700">{v.name} <span className="text-gray-400 font-mono">/{sid}</span></span>
                        <span className="font-bold text-red-600">{v.count} 件</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-gray-400">同一 API に集中している場合は買い手の暴走 or 上限設定ミスの可能性。</p>
                </div>
              </div>
            );
          })()}

        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full">
            <thead><tr><Th>日時</Th><Th>API</Th><Th>理由</Th><Th right>試行額</Th></tr></thead>
            <tbody>
              {(reasonFilter ? blocks.filter((b) => b.reason === reasonFilter) : blocks).map((b) => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <Td cls="text-[11px] text-gray-500"><Ago s={b.at}/></Td>
                  <Td>
                    <p className="text-xs text-gray-900">{b.endpoint ?? "—"}</p>
                    {b.shortId && <p className="text-[10px] text-gray-400 font-mono">/{b.shortId}</p>}
                  </Td>
                  <Td><Pill label={BLOCK_REASON_LABEL[b.reason] ?? b.reason} variant="red"/></Td>
                  <Td right mono cls="text-gray-500">{fmtUsd(b.attempted)}</Td>
                </tr>
              ))}
              {blocks.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-xs text-gray-400">ブロックはありません — Pay Token の上限が守られている状態です</td></tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}

// ── Invoices (legacy v2 API) ────────────────────────────────────────────────
// 適格請求書 (JP T+13)。発行ロジックは旧 Express /api/admin/v2/invoices のまま。
// ピボット後の前払いモデルとは別系統だが、JP 税制対応のため残置。
interface V2Invoice {
  id: string; providerName: string | null; buyerAddress: string;
  callCount: number; totalJpy: string; totalUsdc: string;
  status: string; periodFrom: string; periodTo: string; issuedAt: string;
}

function InvoicesPage() {
  const [rows, setRows] = useState<V2Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/v2/invoices?limit=200`)
      .then(r => r.ok ? r.json() : []).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-gray-400">適格請求書は旧 m2m (USDC) 課金の集計から発行されます。Stripe 前払いの領収書は Stripe 側で発行されます。</p>
      <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
        <table className="w-full">
          <thead><tr><Th>発行日</Th><Th>Provider</Th><Th>Buyer</Th><Th>期間</Th><Th right>件数</Th><Th right>JPY</Th><Th>状態</Th><Th>PDF</Th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <Td mono cls="text-[10px] text-gray-500">{shortDate(r.issuedAt)}</Td>
                <Td cls="text-xs text-gray-900">{r.providerName ?? "—"}</Td>
                <Td mono cls="text-[10px] text-gray-500">{r.buyerAddress.slice(0,6)}…{r.buyerAddress.slice(-4)}</Td>
                <Td mono cls="text-[10px] text-gray-500">{shortDate(r.periodFrom)}〜{shortDate(r.periodTo)}</Td>
                <Td right mono>{r.callCount.toLocaleString()}</Td>
                <Td right mono>{fmtJpy(parseFloat(r.totalJpy))}</Td>
                <Td>
                  {r.status === "DRAFT"  && <Pill label="下書き" variant="gray"/>}
                  {r.status === "ISSUED" && <Pill label="発行済" variant="blue"/>}
                  {r.status === "SENT"   && <Pill label="送信済" variant="green"/>}
                  {r.status === "PAID"   && <Pill label="入金済" variant="green"/>}
                  {r.status === "VOIDED" && <Pill label="取消" variant="red"/>}
                </Td>
                <Td>
                  <a href={`${API_URL}/api/invoices/${r.id}/pdf`} target="_blank" rel="noopener" className="text-[11px] font-bold text-amber-700 hover:underline">表示</a>
                </Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-gray-400">インボイスなし</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Admin Sidebar ─────────────────────────────────────────────────────────────
const NAV: {id:NavSection; label:string; sub:string; Icon: ({cls}:{cls?:string})=>React.JSX.Element}[] = [
  { id:"overview",  label:"概要",            sub:"売上 / 健全性 / KPI",          Icon: Ico.Overview },
  { id:"providers", label:"Provider",        sub:"出品者 + Stripe + 売上",      Icon: Ico.User     },
  { id:"endpoints", label:"エンドポイント",  sub:"API 別の売上 / 利用 / 停止",   Icon: Ico.Plug     },
  { id:"tokens",    label:"Pay Token",       sub:"横断ビュー + 緊急失効",        Icon: Ico.Key      },
  { id:"activity",  label:"アクティビティ",  sub:"購入 / 呼び出し / ブロック",  Icon: Ico.Bolt     },
  { id:"invoices",  label:"インボイス",      sub:"適格請求書 (legacy m2m)",     Icon: Ico.Finance  },
];

function AdminSidebar({nav, setNav}: {nav:NavSection; setNav:(n:NavSection)=>void}) {
  return (
    <aside className="w-[260px] sm:w-60 h-full flex flex-col bg-white border-r border-gray-200 flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover flex-shrink-0" />
          <div>
            <p className="text-gray-900 text-[13px] font-bold leading-tight">LemonCake</p>
            <p className="text-gray-400 text-[10px]">管理コンソール</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto min-h-0">
        <p className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">コンソール</p>
        <div className="space-y-1">
          {NAV.map(item => {
            const active = nav === item.id;
            return (
              <button key={item.id} onClick={()=>setNav(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all group ${active?"bg-amber-50 text-gray-900 ring-1 ring-amber-200":"text-gray-500 hover:bg-gray-50 hover:text-gray-800"}`}>
                <item.Icon cls={`w-5 h-5 flex-shrink-0 ${active?"text-amber-600":"text-gray-400 group-hover:text-gray-600"}`}/>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold leading-tight ${active?"text-gray-900":"text-gray-600"}`}>{item.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.sub}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Cross-page jump (separate admin pages) */}
        <p className="px-3 mt-6 mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">他の管理ページ</p>
        <div className="space-y-1">
          <a href="/admin/telemetry" className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all border border-amber-200">
            <span className="text-base leading-none flex-shrink-0">🔍</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-bold leading-tight">実ユーザー検知</p>
              <p className="text-[10px] text-amber-600 mt-0.5 truncate">外部 IP 数 / 週次 call / 信号機</p>
            </div>
          </a>
          <a href="/admin/funnel" className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all">
            <span className="text-base leading-none flex-shrink-0">📉</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium leading-tight">ファネル</p>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">DB 直結のコンバージョン漏斗</p>
            </div>
          </a>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-100">
        <a href="/" className="flex items-center gap-2 text-gray-400 hover:text-gray-700 transition-colors text-xs">
          <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><path d="M10 3L5 8l5 5"/></svg>
          購入者ダッシュボードへ
        </a>
      </div>
    </aside>
  );
}

// ── Page titles & descriptions ────────────────────────────────────────────────
const PAGE_META: Record<NavSection, {title:string; desc:string}> = {
  overview:  { title:"概要",             desc:"日次売上・Gateway 健全性・KPI（60秒ごと自動更新）" },
  providers: { title:"Provider",         desc:"出品者一覧（Stripe 接続 + 前払い売上 + 受取）" },
  endpoints: { title:"エンドポイント",   desc:"API 別の売上・呼び出し・ブロック（売上順 / 利用順）" },
  tokens:    { title:"Pay Token",        desc:"全オーナー横断の発行済みトークン + 緊急失効" },
  activity:  { title:"アクティビティ",   desc:"前払い購入 / Gateway 呼び出し / ブロック分析" },
  invoices:  { title:"インボイス",       desc:"適格請求書（legacy m2m 課金の集計）" },
};

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AdminRoot() {
  const [nav, setNav] = useState<NavSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const [, setAuthReady] = useState(false);

  // 認証チェック: httpOnly owner Cookie のセッションで判定。admin 用エンドポイントを
  // 1回叩いて 200 なら admin、401 ならログインへ（Cookie は自動送信される）。
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/lc/stats", { cache: "no-store" });
        if (r.status === 401) { window.location.href = "/admin/login"; return; }
      } catch { /* network: fall through, page will show its own error */ }
      setAuthReady(true);
    })();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date().toLocaleTimeString("ja-JP", {hour12:false})), 1000);
    return () => clearInterval(t);
  }, []);

  const meta = PAGE_META[nav];

  const setNavAndClose = (n: NavSection) => { setNav(n); setMobileNavOpen(false); };

  // Lock body scroll when drawer open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileNavOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileNavOpen]);

  // Close drawer on Escape
  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileNavOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileNavOpen]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile backdrop with fade */}
      <div
        onClick={() => setMobileNavOpen(false)}
        className={`md:hidden fixed inset-0 bg-black/50 backdrop-blur-[2px] z-40 transition-opacity duration-300 ${mobileNavOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        aria-hidden="true"
      />

      <div
        role={mobileNavOpen ? "dialog" : undefined}
        aria-modal={mobileNavOpen || undefined}
        aria-hidden={!mobileNavOpen ? undefined : false}
        className={`fixed md:static inset-y-0 left-0 z-40 flex transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] shadow-2xl md:shadow-none ${mobileNavOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      >
        {/* Close button inside drawer (mobile only) */}
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="md:hidden absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 active:scale-95 transition"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
        </button>
        <AdminSidebar nav={nav} setNav={setNavAndClose}/>
      </div>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-7 py-3 sm:py-4 flex-shrink-0 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-700 active:bg-gray-100 flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="17" y2="6"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="14" x2="17" y2="14"/></svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 truncate">{meta.title}</h1>
              <p className="text-xs text-gray-400 mt-0.5 truncate hidden sm:block">{meta.desc}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <span className="font-mono text-xs text-gray-400 tabular-nums hidden sm:inline">{clock}</span>
            <button
              onClick={async () => { try { await fetch("/api/lc/auth/logout", { method: "POST" }); } catch {} window.location.href = "/app"; }}
              className="px-2 sm:px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-4 sm:py-6">
          {nav === "overview"  && <LcOverviewPage setNav={setNav}/>}
          {nav === "providers" && <LcProvidersPage/>}
          {nav === "endpoints" && <LcEndpointsPage/>}
          {nav === "tokens"    && <LcTokensPage/>}
          {nav === "activity"  && <LcActivityPage/>}
          {nav === "invoices"  && <InvoicesPage/>}
        </div>
      </main>
    </div>
  );
}
