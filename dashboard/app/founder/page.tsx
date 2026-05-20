"use client";

/**
 * Founder Cockpit — 単独 founder 用の私用ダッシュボード。
 *
 * 収益、商談パイプライン、アウトリーチログ、ToDo、メモを 1 ページで管理。
 * データは localStorage のみ（外部 API なし → 漏洩リスクなし、復元はブラウザ依存）。
 *
 * アクセス制御：
 *   - NEXT_PUBLIC_FOUNDER_PIN 環境変数の文字列と一致したら入れる
 *   - 一致したら同一ブラウザでは sessionStorage に記憶（タブ閉じるまで再入力不要）
 *   - 環境変数未設定の場合は dev のみ動く（"DEV-ONLY" のダミー PIN）
 *
 * 注意：これは founder の手元メモ用なので、サーバー側保存は意図的に避けてる。
 *      バックアップは右上の「Export JSON」で取れる。
 */

import { useEffect, useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type RevenueEntry = {
  id: string;
  date: string;       // YYYY-MM-DD
  source: string;     // 受託 / LemonCake / アフィリエイト / Gumroad / その他
  client: string;     // 顧客名（任意）
  amountJpy: number;
  note: string;
};

type PipelineStage =
  | "未接触"
  | "接触済"
  | "返信あり"
  | "商談中"
  | "提案済"
  | "成約"
  | "失注";

type PipelineEntry = {
  id: string;
  client: string;
  channel: string;          // X / LinkedIn / Email / DM / Discord
  stage: PipelineStage;
  expectedJpy: number;
  probabilityPct: number;   // 0-100
  nextAction: string;
  nextActionDate: string;
  note: string;
  updatedAt: string;
};

type OutreachEntry = {
  id: string;
  date: string;
  channel: string;
  person: string;
  topic: string;
  result: string;
};

type TodoEntry = {
  id: string;
  done: boolean;
  text: string;
  due?: string;
};

type FounderState = {
  revenue: RevenueEntry[];
  pipeline: PipelineEntry[];
  outreach: OutreachEntry[];
  todos: TodoEntry[];
  notes: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "lemoncake_founder_v1";

// 認証は外している。理由：
//  1. データは localStorage のみで外部にも DB にも保存されない
//  2. ページ自体は noindex（layout.tsx の robots 設定）で検索に出ない
//  3. URL を共有しなければ事実上 private
//  4. Vercel の env var 反映問題で何度もハマったので素直に外した
// 機密性が上がってきたら HTTP Basic auth (middleware.ts) で復活可能。

const STAGES: PipelineStage[] = [
  "未接触",
  "接触済",
  "返信あり",
  "商談中",
  "提案済",
  "成約",
  "失注",
];

const SOURCES = [
  "受託（MCP開発）",
  "受託（freee連携）",
  "受託（その他）",
  "LemonCake課金",
  "アフィリエイト",
  "Gumroad",
  "コンサル",
  "その他",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 10);
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const jpy = (n: number) => `¥${n.toLocaleString("ja-JP")}`;

function emptyState(): FounderState {
  return {
    revenue: [],
    pipeline: [],
    outreach: [],
    todos: [
      { id: uid(), done: false, text: "X 固定ツイートを「受託受付中」に書き換え" },
      { id: uid(), done: false, text: "LinkedIn プロフィールを「MCP Specialist for Hire」に更新" },
      { id: uid(), done: false, text: "FSA Q11 の回答到着確認" },
      { id: uid(), done: false, text: "Roy Meshulam 返信フォロー" },
      { id: uid(), done: false, text: "Glama Tool Calls 数 0 → 1+ 確認（48h後）" },
    ],
    notes: "",
  };
}

function loadState(): FounderState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<FounderState>;
    return {
      revenue: parsed.revenue ?? [],
      pipeline: parsed.pipeline ?? [],
      outreach: parsed.outreach ?? [],
      todos: parsed.todos ?? [],
      notes: parsed.notes ?? "",
    };
  } catch {
    return emptyState();
  }
}

function saveState(s: FounderState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ─── Components ───────────────────────────────────────────────────────────────

// Auth コンポーネントは削除済み（PIN ゲートを外したため）。

function Card({
  title, action, children,
}: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-gray-100">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg p-4">
      <div className="text-xs text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-yellow-300 tabular-nums mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FounderCockpit() {
  const [state, setState] = useState<FounderState>(emptyState());

  // Load state once on mount
  useEffect(() => {
    setState(loadState());
  }, []);

  // Persist on every change
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Derived metrics
  const monthYM = today().slice(0, 7);
  const thisMonthRev = useMemo(
    () => state.revenue.filter((r) => r.date.startsWith(monthYM)).reduce((s, r) => s + r.amountJpy, 0),
    [state.revenue, monthYM]
  );
  const totalRev = useMemo(
    () => state.revenue.reduce((s, r) => s + r.amountJpy, 0),
    [state.revenue]
  );
  const weightedPipeline = useMemo(
    () =>
      state.pipeline
        .filter((p) => p.stage !== "成約" && p.stage !== "失注")
        .reduce((s, p) => s + (p.expectedJpy * p.probabilityPct) / 100, 0),
    [state.pipeline]
  );
  const closedCount = useMemo(
    () => state.pipeline.filter((p) => p.stage === "成約").length,
    [state.pipeline]
  );
  const openTodos = state.todos.filter((t) => !t.done).length;

  // Forms
  const [newRevenue, setNewRevenue] = useState<Partial<RevenueEntry>>({ date: today(), source: SOURCES[0] });
  const [newPipeline, setNewPipeline] = useState<Partial<PipelineEntry>>({
    stage: "未接触",
    channel: "X",
    probabilityPct: 20,
    nextActionDate: today(),
  });
  const [newOutreach, setNewOutreach] = useState<Partial<OutreachEntry>>({ date: today(), channel: "X" });
  const [newTodo, setNewTodo] = useState("");

  // Handlers
  function addRevenue() {
    if (!newRevenue.amountJpy || !newRevenue.source) return;
    setState((s) => ({
      ...s,
      revenue: [
        { id: uid(), date: newRevenue.date ?? today(), source: newRevenue.source!,
          client: newRevenue.client ?? "", amountJpy: Number(newRevenue.amountJpy),
          note: newRevenue.note ?? "" },
        ...s.revenue,
      ],
    }));
    setNewRevenue({ date: today(), source: SOURCES[0] });
  }
  function delRevenue(id: string) {
    setState((s) => ({ ...s, revenue: s.revenue.filter((r) => r.id !== id) }));
  }

  function addPipeline() {
    if (!newPipeline.client) return;
    setState((s) => ({
      ...s,
      pipeline: [
        { id: uid(), client: newPipeline.client!, channel: newPipeline.channel ?? "X",
          stage: (newPipeline.stage as PipelineStage) ?? "未接触",
          expectedJpy: Number(newPipeline.expectedJpy ?? 0),
          probabilityPct: Number(newPipeline.probabilityPct ?? 20),
          nextAction: newPipeline.nextAction ?? "",
          nextActionDate: newPipeline.nextActionDate ?? today(),
          note: newPipeline.note ?? "",
          updatedAt: now() },
        ...s.pipeline,
      ],
    }));
    setNewPipeline({ stage: "未接触", channel: "X", probabilityPct: 20, nextActionDate: today() });
  }
  function updatePipeline(id: string, patch: Partial<PipelineEntry>) {
    setState((s) => ({
      ...s,
      pipeline: s.pipeline.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: now() } : p)),
    }));
  }
  function delPipeline(id: string) {
    setState((s) => ({ ...s, pipeline: s.pipeline.filter((p) => p.id !== id) }));
  }

  function addOutreach() {
    if (!newOutreach.person) return;
    setState((s) => ({
      ...s,
      outreach: [
        { id: uid(), date: newOutreach.date ?? today(), channel: newOutreach.channel ?? "X",
          person: newOutreach.person!, topic: newOutreach.topic ?? "",
          result: newOutreach.result ?? "" },
        ...s.outreach,
      ],
    }));
    setNewOutreach({ date: today(), channel: "X" });
  }
  function delOutreach(id: string) {
    setState((s) => ({ ...s, outreach: s.outreach.filter((o) => o.id !== id) }));
  }

  function addTodo() {
    if (!newTodo.trim()) return;
    setState((s) => ({
      ...s,
      todos: [{ id: uid(), done: false, text: newTodo.trim() }, ...s.todos],
    }));
    setNewTodo("");
  }
  function toggleTodo(id: string) {
    setState((s) => ({
      ...s,
      todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    }));
  }
  function delTodo(id: string) {
    setState((s) => ({ ...s, todos: s.todos.filter((t) => t.id !== id) }));
  }

  // Backup
  function exportJson() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lemoncake-founder-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importJson(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as FounderState;
        setState(parsed);
      } catch {
        alert("JSONの読み込みに失敗しました");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">🍋 Founder Cockpit</h1>
            <p className="text-sm text-gray-400">{today()} · 収益・パイプライン・アウトリーチを一元管理</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportJson} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm">
              Export JSON
            </button>
            <label className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-sm cursor-pointer">
              Import
              <input type="file" accept=".json" hidden onChange={(e) => {
                const f = e.target.files?.[0]; if (f) importJson(f);
              }} />
            </label>
          </div>
        </header>

        {/* Top metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Metric label="今月の収益" value={jpy(thisMonthRev)} hint={`累計 ${jpy(totalRev)}`} />
          <Metric label="パイプライン期待値" value={jpy(weightedPipeline)} hint="確率加重" />
          <Metric label="成約数" value={`${closedCount}`} hint="累計" />
          <Metric label="未完了ToDo" value={`${openTodos}`} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 収益 */}
          <Card title="💰 収益記録">
            <div className="space-y-2 mb-4 grid grid-cols-2 gap-2">
              <input type="date" value={newRevenue.date}
                onChange={(e) => setNewRevenue({ ...newRevenue, date: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm" />
              <select value={newRevenue.source}
                onChange={(e) => setNewRevenue({ ...newRevenue, source: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm">
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input placeholder="顧客名（任意）" value={newRevenue.client ?? ""}
                onChange={(e) => setNewRevenue({ ...newRevenue, client: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm" />
              <input type="number" placeholder="金額 (¥)" value={newRevenue.amountJpy ?? ""}
                onChange={(e) => setNewRevenue({ ...newRevenue, amountJpy: Number(e.target.value) })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm" />
              <input placeholder="メモ" value={newRevenue.note ?? ""}
                onChange={(e) => setNewRevenue({ ...newRevenue, note: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm col-span-2" />
              <button onClick={addRevenue}
                className="col-span-2 bg-yellow-400 text-gray-900 rounded py-1.5 text-sm font-bold hover:bg-yellow-300">
                追加
              </button>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {state.revenue.length === 0 && <p className="text-xs text-gray-500">まだ収益記録なし</p>}
              {state.revenue.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-gray-900/50 rounded px-3 py-2 text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold tabular-nums text-yellow-300">{jpy(r.amountJpy)}</div>
                    <div className="text-xs text-gray-400">
                      {r.date} · {r.source}{r.client && ` · ${r.client}`}
                    </div>
                    {r.note && <div className="text-xs text-gray-500 truncate">{r.note}</div>}
                  </div>
                  <button onClick={() => delRevenue(r.id)} className="text-red-500 hover:text-red-400 px-2">×</button>
                </div>
              ))}
            </div>
          </Card>

          {/* パイプライン */}
          <Card title="🎯 商談パイプライン">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <input placeholder="顧客名" value={newPipeline.client ?? ""}
                onChange={(e) => setNewPipeline({ ...newPipeline, client: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm col-span-2" />
              <select value={newPipeline.channel}
                onChange={(e) => setNewPipeline({ ...newPipeline, channel: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm">
                <option>X</option><option>LinkedIn</option><option>Email</option>
                <option>DM</option><option>Discord</option><option>紹介</option>
              </select>
              <select value={newPipeline.stage}
                onChange={(e) => setNewPipeline({ ...newPipeline, stage: e.target.value as PipelineStage })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm">
                {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <input type="number" placeholder="期待値 (¥)" value={newPipeline.expectedJpy ?? ""}
                onChange={(e) => setNewPipeline({ ...newPipeline, expectedJpy: Number(e.target.value) })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm" />
              <input type="number" placeholder="確率%" min={0} max={100}
                value={newPipeline.probabilityPct ?? 20}
                onChange={(e) => setNewPipeline({ ...newPipeline, probabilityPct: Number(e.target.value) })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm" />
              <input placeholder="次のアクション" value={newPipeline.nextAction ?? ""}
                onChange={(e) => setNewPipeline({ ...newPipeline, nextAction: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm col-span-2" />
              <button onClick={addPipeline}
                className="col-span-2 bg-yellow-400 text-gray-900 rounded py-1.5 text-sm font-bold hover:bg-yellow-300">
                追加
              </button>
            </div>
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {state.pipeline.length === 0 && <p className="text-xs text-gray-500">まだ商談なし</p>}
              {state.pipeline.map((p) => (
                <div key={p.id} className="bg-gray-900/50 rounded px-3 py-2 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{p.client}</div>
                      <div className="text-xs text-gray-400">{p.channel} · {jpy(p.expectedJpy)} × {p.probabilityPct}%</div>
                      {p.nextAction && <div className="text-xs text-gray-500 truncate">→ {p.nextAction} ({p.nextActionDate})</div>}
                    </div>
                    <select value={p.stage}
                      onChange={(e) => updatePipeline(p.id, { stage: e.target.value as PipelineStage })}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs">
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => delPipeline(p.id)} className="text-red-500 hover:text-red-400 px-1">×</button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* アウトリーチログ */}
          <Card title="📞 アウトリーチログ">
            <div className="grid grid-cols-2 gap-2 mb-4">
              <input type="date" value={newOutreach.date}
                onChange={(e) => setNewOutreach({ ...newOutreach, date: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm" />
              <select value={newOutreach.channel}
                onChange={(e) => setNewOutreach({ ...newOutreach, channel: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm">
                <option>X</option><option>LinkedIn</option><option>Email</option>
                <option>Discord</option><option>GitHub Issue</option>
              </select>
              <input placeholder="相手" value={newOutreach.person ?? ""}
                onChange={(e) => setNewOutreach({ ...newOutreach, person: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm" />
              <input placeholder="トピック" value={newOutreach.topic ?? ""}
                onChange={(e) => setNewOutreach({ ...newOutreach, topic: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm" />
              <input placeholder="結果（返信あり/なし/etc）" value={newOutreach.result ?? ""}
                onChange={(e) => setNewOutreach({ ...newOutreach, result: e.target.value })}
                className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm col-span-2" />
              <button onClick={addOutreach}
                className="col-span-2 bg-yellow-400 text-gray-900 rounded py-1.5 text-sm font-bold hover:bg-yellow-300">
                追加
              </button>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {state.outreach.length === 0 && <p className="text-xs text-gray-500">ログなし</p>}
              {state.outreach.map((o) => (
                <div key={o.id} className="flex items-start justify-between bg-gray-900/50 rounded px-3 py-2 text-sm gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{o.person}</div>
                    <div className="text-xs text-gray-400">{o.date} · {o.channel} · {o.topic}</div>
                    {o.result && <div className="text-xs text-gray-500">{o.result}</div>}
                  </div>
                  <button onClick={() => delOutreach(o.id)} className="text-red-500 hover:text-red-400 px-2">×</button>
                </div>
              ))}
            </div>
          </Card>

          {/* ToDo */}
          <Card title="✅ ToDo">
            <div className="flex gap-2 mb-4">
              <input value={newTodo}
                onKeyDown={(e) => { if (e.key === "Enter") addTodo(); }}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="新しいタスク"
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm" />
              <button onClick={addTodo}
                className="bg-yellow-400 text-gray-900 rounded px-4 text-sm font-bold hover:bg-yellow-300">
                追加
              </button>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {state.todos.map((t) => (
                <div key={t.id} className="flex items-center gap-2 bg-gray-900/50 rounded px-3 py-2 text-sm">
                  <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t.id)}
                    className="w-4 h-4 accent-yellow-400" />
                  <span className={`flex-1 ${t.done ? "line-through text-gray-500" : "text-gray-100"}`}>
                    {t.text}
                  </span>
                  <button onClick={() => delTodo(t.id)} className="text-red-500 hover:text-red-400 px-2">×</button>
                </div>
              ))}
            </div>
          </Card>

          {/* メモ */}
          <Card title="📝 メモ">
            <textarea value={state.notes}
              onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
              placeholder="自由メモ。アイデア・連絡先・思考の整理など"
              className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-sm h-48 font-mono" />
          </Card>

          {/* リンク集 */}
          <Card title="🔗 よく使うリンク">
            <ul className="text-sm space-y-2">
              <li><a href="/admin/telemetry" className="text-yellow-300 hover:underline">→ LemonCake テレメトリ</a></li>
              <li><a href="/admin" className="text-yellow-300 hover:underline">→ Admin ダッシュボード</a></li>
              <li><a href="https://analytics.google.com" target="_blank" rel="noreferrer" className="text-yellow-300 hover:underline">→ Google Analytics 4</a></li>
              <li><a href="https://glama.ai/mcp/servers/evidai/lemon-cake" target="_blank" rel="noreferrer" className="text-yellow-300 hover:underline">→ Glama analytics</a></li>
              <li><a href="https://www.npmjs.com/package/agent-payment-mcp" target="_blank" rel="noreferrer" className="text-yellow-300 hover:underline">→ npm (agent-payment-mcp)</a></li>
              <li><a href="https://vercel.com/contact-2985s-projects/dashboard/analytics" target="_blank" rel="noreferrer" className="text-yellow-300 hover:underline">→ Vercel Analytics</a></li>
              <li><a href="https://github.com/evidai/agent-payment-mcp/security/advisories" target="_blank" rel="noreferrer" className="text-yellow-300 hover:underline">→ GitHub Security Advisories</a></li>
            </ul>
          </Card>
        </div>

        <footer className="mt-8 text-xs text-gray-600 text-center">
          データは localStorage のみに保存されています（サーバー送信なし）。<br/>
          定期的に Export JSON でバックアップしてください。
        </footer>
      </div>
    </div>
  );
}
