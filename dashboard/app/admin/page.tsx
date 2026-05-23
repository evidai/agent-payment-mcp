"use client";

import { useState, useEffect } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";


// ── Types ─────────────────────────────────────────────────────────────────────
// v2 admin nav. Custody-era sections (buyers / jpyc / marketplace / monitoring
// / finance) all deleted post-2026-05 (non-custodial pivot)。Killswitch は
// overview にバナーとして移植済み。
type NavSection =
  | "overview"
  | "providers"
  | "subscriptions"
  | "activity"
  | "invoices"
  | "offramp";

// ── Icons ─────────────────────────────────────────────────────────────────────
const Ico = {
  Overview: ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></svg>,
  Finance:  ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}><circle cx="10" cy="10" r="7"/><path d="M10 7v1.5a1.5 1.5 0 000 3 1.5 1.5 0 010 3V16M10 7a2 2 0 012 2M10 16a2 2 0 01-2-2" strokeLinecap="round"/></svg>,
  Alert:    ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><path d="M8 2l6 11H2L8 2z" strokeLinejoin="round"/><path d="M8 7v3M8 12h.01"/></svg>,
  User:     ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx="8" cy="5" r="3"/><path d="M2 14a6 6 0 0112 0" strokeLinecap="round"/></svg>,
  Bolt:     ({cls}:{cls?:string}) => <svg className={cls} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M9 2L4 9h4l-1 5 6-7H9l1-5z"/></svg>,
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

function Btn({label,color,size="sm",onClick,disabled}:{label:string;color:"red"|"green"|"violet"|"sky"|"gray"|"amber";size?:"sm"|"xs";onClick?:()=>void;disabled?:boolean}) {
  const c = {
    red:    "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    green:  "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
    violet: "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100",
    sky:    "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
    gray:   "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100",
    amber:  "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  }[color];
  const s = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return <button onClick={onClick} disabled={disabled} className={`rounded-md border font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${c} ${s}`}>{label}</button>;
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

function SectionHeader({title, count, children}: {title:string; count?:number; children?: React.ReactNode}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {count !== undefined && <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function Th({children,right}:{children:React.ReactNode;right?:boolean}) {
  return <th className={`px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-50 border-b border-gray-100 whitespace-nowrap ${right?"text-right":"text-left"}`}>{children}</th>;
}

function Td({children,right,mono,cls}:{children:React.ReactNode;right?:boolean;mono?:boolean;cls?:string}) {
  return <td className={`px-3 py-2.5 text-xs border-b border-gray-50 align-middle ${right?"text-right":"text-left"} ${mono?"font-mono tabular-nums":""} ${cls??""}`}>{children}</td>;
}

// ── TaskBadge for overview ─────────────────────────────────────────────────────
function TaskItem({icon, label, count, urgent, onClick}: {icon:React.ReactNode; label:string; count:number; urgent?:boolean; onClick?:()=>void}) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all w-full text-left ${urgent?"border-red-200 bg-red-50 hover:bg-red-100":"border-gray-200 bg-white hover:bg-gray-50"}`}>
      <span className={`flex-shrink-0 ${urgent?"text-red-500":"text-gray-400"}`}>{icon}</span>
      <span className="flex-1 text-sm text-gray-700 font-medium">{label}</span>
      <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${urgent?"bg-red-500 text-white":"bg-gray-200 text-gray-600"}`}>{count}</span>
    </button>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
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

// ── Modal ─────────────────────────────────────────────────────────────────────
function Modal({title, onClose, children, wide}: {title:string; onClose:()=>void; children:React.ReactNode; wide?:boolean}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"/>
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${wide?"max-w-2xl":"max-w-lg"} max-h-[88vh] overflow-y-auto`} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────
// v2 panels — admin-v2 API を叩いて読み取り専用で表示するシンプルなテーブル群
// ─────────────────────────────────────────────────────────────

interface V2Stats {
  mrrJpy: number;
  annualizedArrJpy: number;
  activeSubscriptions: { FREE: number; PRO: number; BUSINESS: number; ENTERPRISE: number };
  providers: { total: number; active: number; suspended: number };
  charges: { todayCount: number; todayVolumeUsdc: string; monthCount: number; monthVolumeUsdc: string; allTimeCount: number; allTimeVolumeUsdc: string };
  invoices: { draft: number; issued: number; sent: number };
  offramp:  { pending: number; completed: number; failed: number };
}

function useV2Stats() {
  const [stats, setStats] = useState<V2Stats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API_URL}/api/admin/v2/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);
  return { stats, loading };
}

function fmtJpy(n: number) { return "¥" + Math.round(n).toLocaleString(); }
function fmtUsdc(s: string | number) {
  const n = typeof s === "string" ? parseFloat(s) : s;
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

// ── v2 Providers ─────────────────────────────────────────────
interface V2Provider {
  id: string; name: string; email: string;
  baseWalletAddress: string;
  pricePerCallUsdc: string; freeCallsPerMonth: number;
  registrationNumber: string | null; autoIssueInvoices: boolean;
  active: boolean;
  plan: "FREE"|"PRO"|"BUSINESS"|"ENTERPRISE";
  subscriptionStatus: string;
  createdAt: string;
}

function V2ProvidersPage() {
  const [rows, setRows] = useState<V2Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [planFilter, setPlanFilter] = useState<"all"|"FREE"|"PRO"|"BUSINESS">("all");

  useEffect(() => {
    fetch(`${API_URL}/api/admin/v2/providers?limit=200`)
      .then(r => r.ok ? r.json() : [])
      .then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r => {
    if (planFilter !== "all" && r.plan !== planFilter) return false;
    if (q && !`${r.name} ${r.email} ${r.id}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const planBadge = (plan: V2Provider["plan"]) => {
    const cfg: Record<V2Provider["plan"], { v: "gray"|"amber"|"violet"|"green"; l: string }> = {
      FREE:       { v: "gray",   l: "Free" },
      PRO:        { v: "amber",  l: "Pro" },
      BUSINESS:   { v: "violet", l: "Business" },
      ENTERPRISE: { v: "green",  l: "Enterprise" },
    };
    return <Pill label={cfg[plan].l} variant={cfg[plan].v}/>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="検索: 名前 / Email / ID"
          className="flex-1 min-w-[200px] rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"/>
        <select value={planFilter} onChange={(e)=>setPlanFilter(e.target.value as typeof planFilter)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="all">全プラン</option>
          <option value="FREE">Free</option>
          <option value="PRO">Pro</option>
          <option value="BUSINESS">Business</option>
        </select>
        <span className="text-xs text-gray-500">{filtered.length} 件</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead><tr><Th>Provider</Th><Th>プラン</Th><Th>受取 Wallet</Th><Th right>単価</Th><Th right>無料枠</Th><Th>T番号</Th><Th>状態</Th><Th>登録日</Th></tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <Td>
                    <p className="font-medium text-gray-900 text-sm">{r.name}</p>
                    <p className="text-[10px] text-gray-400">{r.email}</p>
                    <p className="text-[10px] text-gray-300 font-mono">{r.id.slice(0,12)}…</p>
                  </Td>
                  <Td>{planBadge(r.plan)}</Td>
                  <Td mono cls="text-xs text-gray-500">{r.baseWalletAddress.slice(0,6)}…{r.baseWalletAddress.slice(-4)}</Td>
                  <Td right mono>${r.pricePerCallUsdc}</Td>
                  <Td right mono>{r.freeCallsPerMonth.toLocaleString()}</Td>
                  <Td mono cls="text-[10px] text-gray-500">{r.registrationNumber ?? "—"}</Td>
                  <Td>{r.active ? <Pill label="active" variant="green"/> : <Pill label="suspended" variant="red"/>}</Td>
                  <Td cls="text-[10px] text-gray-500">{r.createdAt.slice(0,10)}</Td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-gray-400">該当なし</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── v2 Subscriptions（KPI ベース、プラン分布） ────────────────
function V2SubscriptionsPage() {
  const { stats, loading } = useV2Stats();

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>;
  if (!stats)  return <p className="text-sm text-red-500 text-center py-12">API 接続失敗</p>;

  const totalActive = stats.activeSubscriptions.PRO + stats.activeSubscriptions.BUSINESS + stats.activeSubscriptions.ENTERPRISE;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="MRR" value={fmtJpy(stats.mrrJpy)} color="green" delta={`ARR ${fmtJpy(stats.annualizedArrJpy)}`}/>
        <KpiCard label="有料サブスク" value={totalActive} unit="件" color="amber"/>
        <KpiCard label="Free Provider" value={stats.activeSubscriptions.FREE} unit="件" color="default" delta={`総 ${stats.providers.total}`}/>
        <KpiCard label="停止中" value={stats.providers.suspended} unit="件" color={stats.providers.suspended > 0 ? "red" : "default"}/>
      </div>

      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">プラン分布</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {([
            { plan: "FREE",       label: "Free",       jpy: 0,     count: stats.activeSubscriptions.FREE,       color: "border-gray-200" },
            { plan: "PRO",        label: "Pro",        jpy: 4980,  count: stats.activeSubscriptions.PRO,        color: "border-amber-300 bg-amber-50/30" },
            { plan: "BUSINESS",   label: "Business",   jpy: 14800, count: stats.activeSubscriptions.BUSINESS,   color: "border-violet-300 bg-violet-50/30" },
            { plan: "ENTERPRISE", label: "Enterprise", jpy: 0,     count: stats.activeSubscriptions.ENTERPRISE, color: "border-emerald-300 bg-emerald-50/30" },
          ] as const).map(p => (
            <div key={p.plan} className={`rounded-2xl border-2 ${p.color} p-5`}>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{p.label}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900 font-mono">{p.count}</p>
              <p className="text-xs text-gray-400 mt-1">{p.jpy > 0 ? `¥${p.jpy.toLocaleString()} / 月` : "—"}</p>
              <p className="mt-3 text-xs text-gray-600">
                月貢献: <strong className="font-mono">{fmtJpy(p.jpy * p.count)}</strong>
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── v2 Activity（PermitCharge live feed） ─────────────────────
interface V2Charge {
  id: string; ownerAddress: string; serviceId: string; providerName: string | null;
  amountUsdc: string; txHash: string | null;
  status: string; failureReason: string | null;
  createdAt: string; completedAt: string | null;
}

function V2ActivityPage() {
  const [rows, setRows] = useState<V2Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all"|"COMPLETED"|"FAILED"|"PENDING">("all");

  const load = () => {
    setLoading(true);
    const url = `${API_URL}/api/admin/v2/charges?limit=200${statusFilter !== "all" ? `&status=${statusFilter}` : ""}`;
    fetch(url).then(r => r.ok ? r.json() : []).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <select value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value as typeof statusFilter)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
          <option value="all">全状態</option>
          <option value="COMPLETED">完了</option>
          <option value="PENDING">処理中</option>
          <option value="FAILED">失敗</option>
        </select>
        <button onClick={load} className="text-xs font-bold text-amber-700 hover:underline">再読み込み</button>
        <span className="text-xs text-gray-500 ml-auto">{rows.length} 件</span>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead><tr><Th>日時</Th><Th>Provider</Th><Th>Buyer Wallet</Th><Th right>金額 (USDC)</Th><Th>状態</Th><Th>Tx</Th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <Td mono cls="text-[10px] text-gray-500">{r.createdAt.slice(0,19).replace("T"," ")}</Td>
                  <Td>
                    <p className="text-xs text-gray-900">{r.providerName ?? "—"}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{r.serviceId.slice(0,12)}…</p>
                  </Td>
                  <Td mono cls="text-[10px] text-gray-500">{r.ownerAddress.slice(0,6)}…{r.ownerAddress.slice(-4)}</Td>
                  <Td right mono cls="text-gray-900">{r.amountUsdc}</Td>
                  <Td>
                    {r.status === "COMPLETED" ? <Pill label="完了" variant="green"/> :
                     r.status === "FAILED"    ? <Pill label="失敗" variant="red"/> :
                                                <Pill label="処理中" variant="amber"/>}
                  </Td>
                  <Td>
                    {r.txHash ? (
                      <a href={`https://basescan.org/tx/${r.txHash}`} target="_blank" rel="noopener" className="text-[10px] font-mono text-blue-600 hover:underline">{r.txHash.slice(0,10)}…</a>
                    ) : <span className="text-[10px] text-gray-300">—</span>}
                  </Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-400">該当なし</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── v2 Invoices ──────────────────────────────────────────────
interface V2Invoice {
  id: string; providerName: string | null; buyerAddress: string;
  callCount: number; totalJpy: string; totalUsdc: string;
  status: string; periodFrom: string; periodTo: string; issuedAt: string;
}

function V2InvoicesPage() {
  const [rows, setRows] = useState<V2Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/v2/invoices?limit=200`)
      .then(r => r.ok ? r.json() : []).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr><Th>発行日</Th><Th>Provider</Th><Th>Buyer</Th><Th>期間</Th><Th right>件数</Th><Th right>JPY</Th><Th>状態</Th><Th>PDF</Th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <Td mono cls="text-[10px] text-gray-500">{r.issuedAt.slice(0,10)}</Td>
                <Td cls="text-xs text-gray-900">{r.providerName ?? "—"}</Td>
                <Td mono cls="text-[10px] text-gray-500">{r.buyerAddress.slice(0,6)}…{r.buyerAddress.slice(-4)}</Td>
                <Td mono cls="text-[10px] text-gray-500">{r.periodFrom.slice(0,10)}〜{r.periodTo.slice(0,10)}</Td>
                <Td right mono>{r.callCount.toLocaleString()}</Td>
                <Td right mono>¥{Math.round(parseFloat(r.totalJpy)).toLocaleString()}</Td>
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

// ── v2 Offramp ──────────────────────────────────────────────
interface V2Offramp {
  id: string; providerName: string | null; exchange: string;
  usdcAmount: string; withdrawnJpy: string | null;
  status: string; failureReason: string | null;
  createdAt: string;
}

function V2OfframpPage() {
  const [rows, setRows] = useState<V2Offramp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/admin/v2/offramp?limit=200`)
      .then(r => r.ok ? r.json() : []).then(setRows).catch(() => setRows([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead><tr><Th>日時</Th><Th>Provider</Th><Th>取引所</Th><Th right>USDC</Th><Th right>出金 JPY</Th><Th>状態</Th><Th>失敗理由</Th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-gray-50">
                <Td mono cls="text-[10px] text-gray-500">{r.createdAt.slice(0,19).replace("T"," ")}</Td>
                <Td cls="text-xs text-gray-900">{r.providerName ?? "—"}</Td>
                <Td><Pill label={r.exchange} variant="blue"/></Td>
                <Td right mono>{r.usdcAmount}</Td>
                <Td right mono>{r.withdrawnJpy ? "¥" + Math.round(parseFloat(r.withdrawnJpy)).toLocaleString() : "—"}</Td>
                <Td>
                  {r.status === "WITHDRAWN" && <Pill label="完了" variant="green"/>}
                  {r.status === "FAILED"    && <Pill label="失敗" variant="red"/>}
                  {(r.status === "PENDING" || r.status === "USDC_SENT" || r.status === "SOLD") && <Pill label={r.status} variant="amber"/>}
                </Td>
                <Td cls="text-[10px] text-red-600 max-w-[200px] truncate">{r.failureReason ?? ""}</Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-400">オフランプ履歴なし</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── v2 Overview ──────────────────────────────────────────────
// ── KillSwitchBanner ──────────────────────────────────────────────────────────
// 全システム停止スイッチ。/api/admin/killswitch を叩いて spender wallet を
// halt させる（PermitCharge が新規に走らなくなる）。普段は閉じた状態、
// 押下時に確認ダイアログ。MonitoringPage（v1）からこちらに移植。
function KillSwitchBanner() {
  const [halted, setHalted]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [toast, setToast]       = useState<{msg:string; type:"success"|"error"|"info"}|null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/admin/killswitch");
        if (!r.ok) return;
        const d = (await r.json()) as { isHalted?: boolean };
        if (typeof d.isHalted === "boolean") setHalted(d.isHalted);
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
    if (desired && !confirm("システム全体を停止します。\n全 Provider の PermitCharge が即時拒否されます。よろしいですか？")) return;
    setLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const r = await fetch("/api/admin/killswitch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ halt: desired }),
      });
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { error?: string };
        showToast(e.error ?? `操作失敗 (${r.status})`, "error");
        return;
      }
      const d = (await r.json()) as { isHalted?: boolean };
      setHalted(d.isHalted ?? desired);
      showToast(d.isHalted ? "システムを停止しました" : "システムを再開しました");
    } catch {
      showToast("ネットワークエラー", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border ${
        halted
          ? "bg-red-50 border-red-300"
          : "bg-white border-gray-200"
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`flex-shrink-0 w-2 h-2 rounded-full ${halted ? "bg-red-500 animate-pulse" : "bg-emerald-400"}`}/>
          <div className="min-w-0">
            <p className="text-xs font-bold text-gray-900">
              {halted ? "🚨 緊急停止中 — Permit 課金は全件拒否されています" : "システム稼働中"}
            </p>
            <p className="text-[10px] text-gray-500 hidden sm:block">
              {halted ? "「再開」を押すと PermitCharge が再び通る状態に戻る" : "緊急時は右の「停止」で全 Provider の課金を即時止められる"}
            </p>
          </div>
        </div>
        <button
          onClick={toggle}
          disabled={loading}
          className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
            halted
              ? "bg-emerald-600 text-white hover:bg-emerald-500"
              : "bg-red-600 text-white hover:bg-red-500"
          }`}
        >
          {loading ? "..." : halted ? "再開" : "停止"}
        </button>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)}/>}
    </>
  );
}

function V2OverviewPage({ setNav }: { setNav: (n: NavSection) => void }) {
  const { stats, loading } = useV2Stats();

  if (loading) return <p className="text-sm text-gray-400 text-center py-12">読み込み中…</p>;
  if (!stats)  return <p className="text-sm text-red-500 text-center py-12">API 接続失敗（/api/admin/v2/stats）</p>;

  const totalPaid = stats.activeSubscriptions.PRO + stats.activeSubscriptions.BUSINESS + stats.activeSubscriptions.ENTERPRISE;
  const conversionRate = stats.providers.total > 0 ? (totalPaid / stats.providers.total) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* killswitch banner — 緊急時のみ操作。普段は閉じてる */}
      <KillSwitchBanner />

      {/* hero KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="MRR" value={fmtJpy(stats.mrrJpy)} color="green" delta={`ARR ${fmtJpy(stats.annualizedArrJpy)}`}/>
        <KpiCard label="今月の流通量" value={fmtUsdc(stats.charges.monthVolumeUsdc)} color="blue" delta={`${stats.charges.monthCount.toLocaleString()} call`}/>
        <KpiCard label="Provider 数" value={stats.providers.total} unit="件" color="amber" delta={`有料化 ${conversionRate.toFixed(1)}%`}/>
        <KpiCard label="今日の課金" value={stats.charges.todayCount} unit="件" color="violet" delta={fmtUsdc(stats.charges.todayVolumeUsdc)}/>
      </div>

      {/* plan distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">プラン分布</h3>
            <button onClick={() => setNav("subscriptions")} className="text-xs text-blue-600 hover:underline">詳細 →</button>
          </div>
          <div className="space-y-3">
            {([
              { plan: "Pro",        count: stats.activeSubscriptions.PRO,        color: "bg-amber-400",   total: stats.providers.total },
              { plan: "Business",   count: stats.activeSubscriptions.BUSINESS,   color: "bg-violet-400",  total: stats.providers.total },
              { plan: "Enterprise", count: stats.activeSubscriptions.ENTERPRISE, color: "bg-emerald-400", total: stats.providers.total },
              { plan: "Free",       count: stats.activeSubscriptions.FREE,       color: "bg-gray-300",    total: stats.providers.total },
            ] as const).map(p => {
              const pct = p.total > 0 ? (p.count / p.total) * 100 : 0;
              return (
                <div key={p.plan}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700 font-medium">{p.plan}</span>
                    <span className="text-xs font-mono text-gray-900">{p.count} <span className="text-gray-400">({pct.toFixed(1)}%)</span></span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${p.color}`} style={{ width: `${pct}%` }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">運営タスク</h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <TaskItem icon={<Ico.Finance cls="w-4 h-4"/>} label="未発行インボイス（DRAFT）" count={stats.invoices.draft}                              onClick={() => setNav("invoices")}/>
            <TaskItem icon={<Ico.Finance cls="w-4 h-4"/>} label="未送信インボイス（ISSUED）" count={stats.invoices.issued}                            onClick={() => setNav("invoices")}/>
            <TaskItem icon={<Ico.Bolt cls="w-4 h-4"/>}    label="進行中オフランプ"           count={stats.offramp.pending}                            onClick={() => setNav("offramp")}/>
            <TaskItem icon={<Ico.Alert cls="w-4 h-4"/>}   label="失敗オフランプ"             count={stats.offramp.failed}    urgent={stats.offramp.failed > 0} onClick={() => setNav("offramp")}/>
          </div>
        </div>
      </div>

      {/* charges summary */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">課金サマリー</h3>
          <button onClick={() => setNav("activity")} className="text-xs text-blue-600 hover:underline">アクティビティ →</button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-400">本日</p>
            <p className="mt-1 text-xl font-bold text-gray-900 font-mono">{fmtUsdc(stats.charges.todayVolumeUsdc)}</p>
            <p className="text-[10px] text-gray-500">{stats.charges.todayCount.toLocaleString()} 件</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">今月</p>
            <p className="mt-1 text-xl font-bold text-gray-900 font-mono">{fmtUsdc(stats.charges.monthVolumeUsdc)}</p>
            <p className="text-[10px] text-gray-500">{stats.charges.monthCount.toLocaleString()} 件</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">累計</p>
            <p className="mt-1 text-xl font-bold text-gray-900 font-mono">{fmtUsdc(stats.charges.allTimeVolumeUsdc)}</p>
            <p className="text-[10px] text-gray-500">{stats.charges.allTimeCount.toLocaleString()} 件</p>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Admin Sidebar ─────────────────────────────────────────────────────────────
const NAV: {id:NavSection; label:string; sub:string; Icon: ({cls}:{cls?:string})=>React.JSX.Element}[] = [
  { id:"overview",      label:"概要",            sub:"MRR / 流通量 / 主要 KPI", Icon: Ico.Overview },
  { id:"providers",     label:"Provider",        sub:"v2 提供者一覧 + プラン",  Icon: Ico.User     },
  { id:"subscriptions", label:"サブスク",        sub:"Stripe 連動・プラン分布", Icon: Ico.Finance  },
  { id:"activity",      label:"アクティビティ",  sub:"PermitCharge ライブ",     Icon: Ico.Bolt     },
  { id:"invoices",      label:"インボイス",      sub:"適格請求書 (T+13)",       Icon: Ico.Finance  },
  { id:"offramp",       label:"オフランプ",      sub:"USDC → JPY 出金履歴",      Icon: Ico.Bolt     },
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
          <a href="/founder" className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-all">
            <span className="text-base leading-none flex-shrink-0">📝</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium leading-tight">創業者メモ</p>
              <p className="text-[10px] text-gray-400 mt-0.5 truncate">個人運営メモ + リンク集</p>
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
  overview:      { title:"概要",                 desc:"MRR・流通量・要対応タスク" },
  providers:     { title:"Provider",             desc:"v2 提供者一覧（permit 受取 + プラン）" },
  subscriptions: { title:"サブスクリプション",    desc:"Stripe 連動のプラン分布 / MRR 集計" },
  activity:      { title:"アクティビティ",       desc:"PermitCharge ライブフィード（全 provider 横断）" },
  invoices:      { title:"インボイス",           desc:"適格請求書（T+13）発行・送信状況" },
  offramp:       { title:"オフランプ",           desc:"USDC → JPY 出金（Coincheck）の履歴と失敗監視" },
};

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AdminRoot() {
  const [nav, setNav] = useState<NavSection>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const [authReady, setAuthReady] = useState(false);

  // 認証チェック: localStorage からトークン取得、なければログインへ
  useEffect(() => {
    const stored = localStorage.getItem("admin_token");
    if (!stored) {
      window.location.href = "/admin/login";
      return;
    }
    setAuthReady(true);
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
              onClick={() => { localStorage.removeItem("admin_token"); window.location.href = "/admin/login"; }}
              className="px-2 sm:px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            >
              ログアウト
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-7 py-4 sm:py-6">
          {nav === "overview"      && <V2OverviewPage setNav={setNav}/>}
          {nav === "providers"     && <V2ProvidersPage/>}
          {nav === "subscriptions" && <V2SubscriptionsPage/>}
          {nav === "activity"      && <V2ActivityPage/>}
          {nav === "invoices"      && <V2InvoicesPage/>}
          {nav === "offramp"       && <V2OfframpPage/>}
        </div>
      </main>
    </div>
  );
}
