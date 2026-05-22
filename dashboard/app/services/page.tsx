"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.lemoncake.xyz";

interface ApiService {
  id:               string;
  providerName:     string;
  name:             string;
  type:             "API" | "MCP";
  pricePerCallUsdc: string;
  reviewStatus:     "PENDING" | "APPROVED" | "REJECTED";
  verified:         boolean;
  description?:      string | null;
  longDescription?:  string | null;
  category?:         string | null;
  tags?:             string[];
  iconEmoji?:        string | null;
  useCases?:         string[];
  samplePath?:       string | null;
  sampleMethod?:     string | null;
  documentationUrl?: string | null;
}

// ─── Featured MCP Servers (one-click install) ────────────────

const FEATURED_MCPS = [
  {
    id:       "agent-payment-mcp",
    emoji:    "🍋",
    name:     "agent-payment-mcp",
    tagline:  "AI エージェントに USDC ウォレットを持たせる。Pay-per-call で HTTP API に自律課金。",
    category: "決済",
    npm:      "agent-payment-mcp",
    configKey: "pay-per-call",
    envVars:  [{ key: "LEMON_CAKE_PERMIT", hint: "lemoncake.xyz ダッシュボードから取得。未設定でデモモード動作。", required: false }],
  },
  {
    id:       "alpaca-guard-mcp",
    emoji:    "🦙",
    name:     "alpaca-guard-mcp",
    tagline:  "Alpaca 証券 API に日次 USD キャップを付ける。ペーパートレードがデフォルト。",
    category: "金融",
    npm:      "alpaca-guard-mcp",
    configKey: "alpaca-guard",
    envVars:  [
      { key: "ALPACA_API_KEY",    hint: "Alpaca ダッシュボードから取得",    required: true },
      { key: "ALPACA_SECRET_KEY", hint: "Alpaca ダッシュボードから取得",    required: true },
    ],
  },
  {
    id:       "xstocks-mcp",
    emoji:    "📈",
    name:     "xstocks-mcp",
    tagline:  "Solana × Jupiter DEX で米国株トークン (xStocks) を USDC で直接購入。",
    category: "DeFi",
    npm:      "xstocks-mcp",
    configKey: "xstocks",
    envVars:  [{ key: "SOLANA_WALLET_PRIVATE_KEY", hint: "Solana ウォレットの秘密鍵 (base58)。未設定でドライランモード。", required: false }],
  },
  {
    id:       "polymarket-guard-mcp",
    emoji:    "🔮",
    name:     "polymarket-guard-mcp",
    tagline:  "Polymarket 予測市場の閲覧・取引を AI エージェントに開放。読み取りは無料。",
    category: "予測市場",
    npm:      "polymarket-guard-mcp",
    configKey: "polymarket",
    envVars:  [{ key: "POLYMARKET_PRIVATE_KEY", hint: "Polygon ウォレットの秘密鍵 (0x...)。未設定で読み取り専用。", required: false }],
  },
  {
    id:       "tokenized-stock-mcp",
    emoji:    "🪙",
    name:     "tokenized-stock-mcp",
    tagline:  "Dinari dShares で米国株を USDC で直接売買。日次キャップ付き、Sandbox がデフォルト。",
    category: "RWA",
    npm:      "tokenized-stock-mcp",
    configKey: "tokenized-stock",
    envVars:  [
      { key: "DINARI_API_KEY",    hint: "Dinari ダッシュボードから取得。未設定で Sandbox 動作。", required: false },
      { key: "DINARI_API_SECRET", hint: "Dinari ダッシュボードから取得。",                       required: false },
    ],
  },
];

// ─── Copy-to-clipboard config generator ─────────────────────

function buildConfig(mcp: typeof FEATURED_MCPS[number]): string {
  const envEntries = mcp.envVars.reduce<Record<string, string>>((acc, v) => {
    acc[v.key] = v.required ? `your-${v.key.toLowerCase().replace(/_/g, "-")}` : "";
    return acc;
  }, {});

  return JSON.stringify(
    {
      mcpServers: {
        [mcp.configKey]: {
          command: "npx",
          args: ["-y", mcp.npm],
          ...(Object.keys(envEntries).length > 0 ? { env: envEntries } : {}),
        },
      },
    },
    null,
    2,
  );
}

function McpCard({ mcp }: { mcp: typeof FEATURED_MCPS[number] }) {
  const [open,   setOpen]   = useState(false);
  const [copied, setCopied] = useState(false);
  const config = buildConfig(mcp);

  function copy() {
    navigator.clipboard.writeText(config).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 hover:border-gray-300 hover:shadow-sm transition-all">
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 flex-shrink-0 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl select-none">
          {mcp.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 font-mono text-sm leading-tight">{mcp.name}</p>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full mt-1 inline-block">{mcp.category}</span>
        </div>
        <a
          href={`https://www.npmjs.com/package/${mcp.npm}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap mt-1"
        >
          npm ↗
        </a>
      </div>

      <p className="text-sm text-gray-600 mb-4 leading-relaxed">{mcp.tagline}</p>

      {/* Env vars */}
      {mcp.envVars.length > 0 && (
        <div className="mb-4 space-y-1">
          {mcp.envVars.map(v => (
            <div key={v.key} className="flex items-start gap-2 text-[11px]">
              <code className={`px-1.5 py-0.5 rounded font-mono whitespace-nowrap ${v.required ? "bg-amber-50 text-amber-700 border border-amber-100" : "bg-gray-50 text-gray-500"}`}>
                {v.key}
              </code>
              <span className="text-gray-400 leading-relaxed">{v.hint}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => { setOpen(o => !o); }}
          className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors"
        >
          {open ? "設定を閉じる" : "Claude Desktop に追加 →"}
        </button>
        <a
          href={`https://github.com/evidai/lemon-cake/tree/main/${mcp.id === "agent-payment-mcp" ? "mcp-server" : mcp.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:border-gray-400 transition-colors"
        >
          GitHub
        </a>
      </div>

      {/* Config panel */}
      {open && (
        <div className="mt-4 rounded-xl bg-gray-950 p-4 relative">
          <p className="text-[10px] text-gray-500 mb-2">
            <code>claude_desktop_config.json</code> の <code>mcpServers</code> にコピー&ペースト
          </p>
          <pre className="text-[11px] text-green-400 font-mono overflow-x-auto whitespace-pre leading-relaxed">{config}</pre>
          <button
            onClick={copy}
            className={`mt-3 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${copied ? "bg-green-500 text-white" : "bg-gray-700 text-gray-200 hover:bg-gray-600"}`}
          >
            {copied ? "✓ コピー済み" : "コピー"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── API services catalog (existing) ────────────────────────

const CATEGORY_ORDER = ["検索", "Web取得", "営業/B2B", "金融", "日本特化", "通知", "本人確認", "ドキュメント", "データ", "テスト", "その他"];

const categoryColors: Record<string, string> = {
  "検索":         "bg-blue-50 text-blue-700 border-blue-100",
  "Web取得":      "bg-purple-50 text-purple-700 border-purple-100",
  "営業/B2B":     "bg-pink-50 text-pink-700 border-pink-100",
  "金融":         "bg-green-50 text-green-700 border-green-100",
  "日本特化":     "bg-rose-50 text-rose-700 border-rose-100",
  "通知":         "bg-amber-50 text-amber-700 border-amber-100",
  "本人確認":     "bg-cyan-50 text-cyan-700 border-cyan-100",
  "ドキュメント": "bg-indigo-50 text-indigo-700 border-indigo-100",
  "データ":       "bg-teal-50 text-teal-700 border-teal-100",
  "テスト":       "bg-gray-100 text-gray-600 border-gray-200",
  "その他":       "bg-gray-100 text-gray-600 border-gray-200",
};

const categoryFallbackEmoji: Record<string, string> = {
  "検索": "🔍", "Web取得": "🕸️", "営業/B2B": "✉️", "金融": "💱",
  "日本特化": "🇯🇵", "通知": "💬", "本人確認": "🪪", "ドキュメント": "📝",
  "データ": "🌐", "テスト": "🧪", "その他": "📦",
};

function viewmodel(s: ApiService) {
  const category    = s.category    ?? "その他";
  const iconEmoji   = s.iconEmoji   ?? categoryFallbackEmoji[category] ?? "📦";
  const description = s.description ?? "";
  const tags        = s.tags        ?? [];
  return { ...s, category, iconEmoji, description, tags };
}

// ─── Page ────────────────────────────────────────────────────

export default function ServicesPage() {
  const [services, setServices] = useState<ApiService[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search,  setSearch]    = useState("");
  const [filter,  setFilter]    = useState<string>("ALL");

  useEffect(() => {
    fetch(`${API_URL}/api/services?reviewStatus=APPROVED&limit=100`)
      .then(r => r.json())
      .then((data: ApiService[]) => {
        setServices((data ?? []).filter(s => s.verified));
      })
      .catch(e => console.error("[ServicesPage]", e))
      .finally(() => setLoading(false));
  }, []);

  const enriched = useMemo(() => services.map(viewmodel), [services]);
  const categories = useMemo(() => {
    const set = new Set(enriched.map(s => s.category));
    return CATEGORY_ORDER.filter(c => set.has(c));
  }, [enriched]);

  const filtered = useMemo(() => {
    return enriched.filter(s => {
      if (filter !== "ALL" && s.category !== filter) return false;
      if (search) {
        const hay = `${s.name} ${s.providerName} ${s.tags.join(" ")} ${s.description} ${s.longDescription ?? ""}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [enriched, filter, search]);

  const grouped = useMemo(() => {
    const out: Array<{ cat: string; services: typeof filtered }> = [];
    for (const c of categories) {
      const items = filtered.filter(s => s.category === c);
      if (items.length) out.push({ cat: c, services: items });
    }
    return out;
  }, [filtered, categories]);

  return (
    <main className="min-h-screen bg-gray-50">
      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <Link href="/" className="text-sm text-gray-400 hover:text-gray-600 mb-4 sm:mb-6 inline-block">← LemonCake</Link>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 sm:mb-3">MCP カタログ</h1>
              <p className="text-sm sm:text-base text-gray-500 max-w-2xl">
                AI エージェントがワンクリックで追加できる MCP サーバーと、permit で自律課金できる API の一覧。
              </p>
            </div>
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums">{FEATURED_MCPS.length + services.length}</div>
              <div className="text-xs text-gray-400 mt-1">登録済みツール</div>
            </div>
          </div>
          <div className="mt-4 sm:mt-6 flex gap-3 flex-wrap">
            <Link href="/start/v2" className="px-4 py-2 bg-yellow-300 text-gray-900 text-sm font-semibold rounded-xl hover:bg-yellow-400 transition-colors">
              permit に署名する →
            </Link>
            <Link href="/about" className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:border-gray-400 transition-colors">
              仕組みを知る
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">

        {/* ── Featured MCP Servers ─────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">LemonCake MCP サーバー</h2>
              <p className="text-xs text-gray-400 mt-0.5">「Claude Desktop に追加」を押すと設定 JSON が表示されます</p>
            </div>
            <span className="text-[11px] text-gray-400">{FEATURED_MCPS.length} 件</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {FEATURED_MCPS.map(mcp => (
              <McpCard key={mcp.id} mcp={mcp} />
            ))}
          </div>
        </section>

        {/* ── API Catalog ──────────────────────────────── */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">Pay-per-call API</h2>
              <p className="text-xs text-gray-400 mt-0.5">agent-payment-mcp の <code className="font-mono">call_service</code> で呼び出せる API 一覧</p>
            </div>
            <span className="text-[11px] text-gray-400">{services.length} 件</span>
          </div>

          {/* Filter bar */}
          <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="サービス名・タグ・用途で検索…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 min-w-[180px] px-3 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20"
            />
            <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
              <button
                onClick={() => setFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${filter === "ALL" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                すべて ({enriched.length})
              </button>
              {categories.map(c => {
                const count = enriched.filter(s => s.category === c).length;
                return (
                  <button key={c} onClick={() => setFilter(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${filter === c ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {c} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid */}
          {loading && <div className="text-center text-gray-400 py-12">読み込み中…</div>}
          {!loading && filtered.length === 0 && <div className="text-center text-gray-400 py-12">該当するサービスがありません</div>}
          <div className="space-y-10">
            {grouped.map(({ cat, services }) => (
              <section key={cat}>
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{cat}</h3>
                  <span className="text-[11px] text-gray-400">{services.length} 件</span>
                </div>
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
                  {services.map((svc) => (
                    <Link
                      key={svc.id}
                      href={`/services/${svc.id}`}
                      className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 hover:border-gray-400 hover:shadow-md transition-all block group"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-xl sm:text-2xl select-none">
                          {svc.iconEmoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 leading-tight group-hover:text-gray-700 transition-colors">{svc.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{svc.providerName}</p>
                        </div>
                        <span className={`text-[10px] sm:text-xs font-medium px-2 sm:px-2.5 py-1 rounded-full whitespace-nowrap border ${categoryColors[svc.category] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                          {svc.category}
                        </span>
                      </div>
                      {svc.description ? (
                        <p className="text-sm text-gray-600 mb-3 sm:mb-4 leading-relaxed line-clamp-2">{svc.description}</p>
                      ) : (
                        <p className="text-sm text-gray-300 italic mb-3 sm:mb-4">説明文未設定</p>
                      )}
                      {svc.useCases && svc.useCases.length > 0 && (
                        <ul className="text-[11px] text-gray-500 mb-3 sm:mb-4 space-y-1">
                          {svc.useCases.slice(0, 2).map((uc, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <span className="text-gray-300 mt-0.5">•</span>
                              <span className="line-clamp-1">{uc}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-50">
                        <div className="flex gap-1 flex-wrap min-w-0">
                          {svc.tags.slice(0, 3).map((t) => (
                            <span key={t} className="text-[10px] bg-gray-50 text-gray-500 px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap">{t}</span>
                          ))}
                          {svc.tags.length > 3 && (
                            <span className="text-[10px] text-gray-300 px-1 py-0.5">+{svc.tags.length - 3}</span>
                          )}
                        </div>
                        <span className="text-sm font-mono font-semibold text-gray-900 whitespace-nowrap">
                          ${parseFloat(svc.pricePerCallUsdc).toFixed(4)}<span className="text-gray-400 font-normal text-xs">/call</span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────── */}
        <div className="bg-gray-900 rounded-2xl p-6 sm:p-8 text-center">
          <p className="text-white font-semibold text-base sm:text-lg mb-2">自分の MCP / API を登録したい？</p>
          <p className="text-gray-400 text-sm mb-6">Seller として登録すると、あなたのツールを AI エージェントに販売できます。</p>
          <Link href="/register" className="px-6 py-3 bg-yellow-300 text-gray-900 text-sm font-semibold rounded-xl hover:bg-yellow-400 transition-colors inline-block">
            Seller 登録する
          </Link>
        </div>
      </div>
    </main>
  );
}
