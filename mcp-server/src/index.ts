#!/usr/bin/env node
/**
 * agent-payment-mcp
 *
 * AIエージェントに LemonCake の非カストディ USDC 決済インフラを提供する MCP サーバー。
 *
 * Tools:
 *  - setup             : 初回セットアップガイド（認証不要）
 *  - list_services     : マーケットプレイスの公開サービス一覧（認証不要）
 *  - get_service_stats : サービスの利用統計（認証不要）
 *  - check_tax         : 日本の税務コンプライアンス確認（認証不要）
 *  - check_balance     : USDC残高 + permit クォータ確認（demo: モック / live: PERMIT）
 *  - call_service      : Pay-per-call API プロキシ（demo: 認証なし / live: LEMON_CAKE_PERMIT）
 *
 * v2 (since 0.8): ERC-2612 permit ベース非カストディフロー。LemonCake は USDC を
 *   一切保持しない。lemoncake.xyz/start/v2 で 1 度署名すれば 90 日 / $25/日 cap で
 *   AI エージェントが代理支払い。Pay Token JWT は v0.7 で廃止。
 *
 * 環境変数:
 *  LEMON_CAKE_PERMIT     : ERC-2612 permit blob（/start/v2 で発行）。未設定なら Demo Mode。
 *  LEMON_CAKE_API_URL    : APIベース URL（省略可）
 *  LEMONCAKE_CALL_TIMEOUT_MS : 上流呼び出しの timeout（ms, 1000–600000、default 30000）
 *
 * 後方互換（非ドキュメント、deprecated）:
 *  LEMON_CAKE_PAY_TOKEN / LEMON_CAKE_BUYER_JWT — v1 custody モード。
 *    既存ユーザーが壊れないよう内部的にだけ残してある。新規セットアップでは設定しない。
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── 設定 ──────────────────────────────────────────────────────────────────────

const API_URL   = (process.env.LEMON_CAKE_API_URL  ?? "https://api.lemoncake.xyz").replace(/\/$/, "");
const PAY_TOKEN = process.env.LEMON_CAKE_PAY_TOKEN ?? "";
const BUYER_JWT = process.env.LEMON_CAKE_BUYER_JWT ?? "";

// Non-custodial path (post-FSA-Q11 architecture). If a permit blob is
// supplied, the MCP server runs in NON-CUSTODIAL mode: LemonCake never
// holds the buyer's USDC, the agent's calls settle directly against the
// buyer's wallet via ERC-2612 permit. The legacy Pay Token JWT path
// remains supported in parallel until the migration finishes.
// See dashboard/app/lib/permit.ts and lemoncake-mcp-sdk/src/permit.ts.
const PERMIT_TOKEN = process.env.LEMON_CAKE_PERMIT ?? "";
const NON_CUSTODIAL_MODE = PERMIT_TOKEN.length > 0;

// ── バージョン・ユーザーエージェント ─────────────────────────────────────
// 単一ソース化: package.json の version を読む。ESM の import attributes を
// 使わずに createRequire 経由にすることで、バンドラなしで Node 22 でも動く。
import { createRequire } from "node:module";
const requireFromHere = createRequire(import.meta.url);
const MCP_VERSION: string = (requireFromHere("../package.json") as { version: string }).version;
const USER_AGENT  = `pay-per-call-mcp/${MCP_VERSION} (node/${process.versions.node}; ${process.platform} ${process.arch})`;

// ── デモモード（認証情報なしで Glama Inspector / 新規ユーザーが試せるように） ──
// LEMON_CAKE_PERMIT があれば non-custodial 本番モード（FSA Q11 準拠 / v2 既定）。
// レガシー PAY_TOKEN/BUYER_JWT も検出するが、新規セットアップでは設定しない。
// いずれも未設定なら Demo Mode（Glama Inspector で即試せる）。
const DEMO_MODE = !PAY_TOKEN && !BUYER_JWT && !NON_CUSTODIAL_MODE;

type DemoHandler = (path: string, body: Record<string, unknown> | undefined) => Promise<unknown> | unknown;

/**
 * Fire-and-forget fetch with a hard timeout. Returns null on any failure
 * so demo handlers can fall back to canned data without blocking the user.
 */
async function tryFetch(url: string, init?: RequestInit, timeoutMs = 4000): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, headers: { "User-Agent": USER_AGENT, ...(init?.headers ?? {}) } });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    return ct.includes("application/json") ? await res.json() : await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const DEMO_SERVICES: Array<{ id: string; name: string; provider: string; type: "API"; pricePerCall: string; description: string; example: { path: string; method: string; body?: unknown }; handler: DemoHandler }> = [
  {
    id:           "demo_search",
    name:         "Demo Search (Wikipedia, free)",
    provider:     "LemonCake DEMO → Wikipedia",
    type:         "API",
    pricePerCall: "0.00 USDC (free demo, real upstream)",
    description:  "Searches English Wikipedia via opensearch API. Returns up to 5 matching titles with snippets and URLs for any query. No auth required.",
    example:      { path: "/search", method: "POST", body: { q: "Model Context Protocol" } },
    handler: async (_path, body) => {
      const q = (body?.q as string | undefined) ?? "Model Context Protocol";
      const data = await tryFetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&format=json&namespace=0&origin=*`) as unknown[];
      // opensearch returns [query, titles[], descriptions[], urls[]]
      if (Array.isArray(data) && data.length === 4 && Array.isArray(data[1])) {
        const titles       = data[1] as string[];
        const descriptions = (data[2] as string[]) ?? [];
        const urls         = (data[3] as string[]) ?? [];
        return {
          query:    q,
          results:  titles.map((title, i) => ({ title, snippet: descriptions[i] ?? "", url: urls[i] ?? "" })),
          upstream: "en.wikipedia.org/opensearch (real)",
        };
      }
      // Fallback if upstream is down
      return {
        query: q,
        results: [
          { title: "LemonCake — Give your AI agent a wallet", url: "https://lemoncake.xyz",           snippet: "Pay-per-call USDC payments for any HTTP API." },
          { title: "Model Context Protocol",                  url: "https://modelcontextprotocol.io", snippet: "Open standard for connecting AI agents to tools." },
        ],
        upstream: "canned (Wikipedia unreachable)",
      };
    },
  },
  {
    id:           "demo_echo",
    name:         "Demo Echo (httpbin.org, free)",
    provider:     "LemonCake DEMO → httpbin.org",
    type:         "API",
    pricePerCall: "0.00 USDC (free demo, real upstream)",
    description:  "Echoes your request via httpbin.org/anything. Returns headers, query params, and body — useful to verify your call_service request shape against a real HTTP server.",
    example:      { path: "/anything", method: "POST", body: { hello: "world" } },
    handler: async (path, body) => {
      const data = await tryFetch(`https://httpbin.org/anything${path}`, {
        method:  body ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body:    body ? JSON.stringify(body) : undefined,
      });
      if (data) return { ...(data as object), upstream: "httpbin.org (real)" };
      return { receivedPath: path, receivedBody: body ?? null, timestamp: new Date().toISOString(), upstream: "canned (httpbin unreachable)" };
    },
  },
  {
    id:           "demo_fx",
    name:         "Demo FX rates (open.er-api.com, free)",
    provider:     "LemonCake DEMO → open.er-api.com",
    type:         "API",
    pricePerCall: "0.00 USDC (free demo, real upstream)",
    description:  "Real USD-base FX rates from open.er-api.com (free, no auth). Returns 160+ currencies updated daily.",
    example:      { path: "/latest", method: "GET" },
    handler: async () => {
      const data = await tryFetch("https://open.er-api.com/v6/latest/USD") as any;
      if (data && data.rates) {
        return {
          base:    data.base_code ?? "USD",
          rates:   { JPY: data.rates.JPY, EUR: data.rates.EUR, GBP: data.rates.GBP, CNY: data.rates.CNY, KRW: data.rates.KRW },
          asOf:    data.time_last_update_utc ?? null,
          upstream: "open.er-api.com (real)",
        };
      }
      return { base: "USD", rates: { JPY: 150.42, EUR: 0.92, GBP: 0.79, CNY: 7.12 }, asOf: new Date().toISOString().slice(0, 10), upstream: "canned (er-api unreachable)" };
    },
  },
  {
    id:           "demo_translate",
    name:         "Demo Translate (MyMemory, free)",
    provider:     "LemonCake DEMO → MyMemory",
    type:         "API",
    pricePerCall: "0.00 USDC (free demo, real upstream)",
    description:  "Translate text between 80+ languages via MyMemory (free, no auth, 5000 chars/day per IP). Body: { text, from, to } where from/to are ISO codes (en/ja/es/fr/de/zh/ko/etc). Defaults to en→ja.",
    example:      { path: "/translate", method: "POST", body: { text: "Hello, world", from: "en", to: "ja" } },
    handler: async (_path, body) => {
      const text = (body?.text as string | undefined) ?? "Hello, world";
      const from = (body?.from as string | undefined) ?? "en";
      const to   = (body?.to   as string | undefined) ?? "ja";
      const data = await tryFetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`,
      ) as any;
      if (data?.responseData?.translatedText) {
        return {
          source:        text,
          translated:    data.responseData.translatedText,
          from, to,
          matchQuality:  data.responseData.match ?? null,
          upstream:      "api.mymemory.translated.net (real)",
        };
      }
      return {
        source: text, translated: `[demo] ${text} (${from}→${to})`,
        from, to, upstream: "canned (MyMemory unreachable)",
      };
    },
  },
  {
    id:           "demo_weather",
    name:         "Demo Weather (Open-Meteo, free)",
    provider:     "LemonCake DEMO → Open-Meteo",
    type:         "API",
    pricePerCall: "0.00 USDC (free demo, real upstream)",
    description:  "Current weather for any coordinates via Open-Meteo (free, no auth, no limit). Body: { latitude, longitude }. Returns temperature, wind, weather code. Defaults to Tokyo.",
    example:      { path: "/current", method: "POST", body: { latitude: 35.6812, longitude: 139.7671 } },
    handler: async (_path, body) => {
      const lat = (body?.latitude  as number | undefined) ?? 35.6812;
      const lon = (body?.longitude as number | undefined) ?? 139.7671;
      const data = await tryFetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`,
      ) as any;
      if (data?.current) {
        const codeMap: Record<number, string> = {
          0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast",
          45: "fog", 48: "rime fog", 51: "light drizzle", 53: "drizzle", 55: "heavy drizzle",
          61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 73: "snow", 75: "heavy snow",
          80: "light showers", 81: "showers", 82: "heavy showers", 95: "thunderstorm",
        };
        return {
          latitude:    lat,
          longitude:   lon,
          temperatureC: data.current.temperature_2m,
          humidityPct:  data.current.relative_humidity_2m,
          windKmh:      data.current.wind_speed_10m,
          condition:    codeMap[data.current.weather_code] ?? `code-${data.current.weather_code}`,
          asOf:         data.current.time,
          upstream:     "api.open-meteo.com (real)",
        };
      }
      return { latitude: lat, longitude: lon, temperatureC: 20, condition: "unknown", upstream: "canned (Open-Meteo unreachable)" };
    },
  },
  {
    id:           "demo_geocode",
    name:         "Demo Geocode (Nominatim/OSM, free)",
    provider:     "LemonCake DEMO → Nominatim",
    type:         "API",
    pricePerCall: "0.00 USDC (free demo, real upstream)",
    description:  "Convert a place name to lat/lon via OpenStreetMap's Nominatim (free, no auth, 1 req/sec policy). Pair with demo_weather for end-to-end location → weather flows. Body: { q }.",
    example:      { path: "/search", method: "POST", body: { q: "Shibuya, Tokyo" } },
    handler: async (_path, body) => {
      const q = (body?.q as string | undefined) ?? "Tokyo";
      const data = await tryFetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3`,
        { headers: { "User-Agent": "agent-payment-mcp/demo (https://lemoncake.xyz)" } },
      ) as any[];
      if (Array.isArray(data) && data.length > 0) {
        return {
          query: q,
          results: data.slice(0, 3).map((r) => ({
            displayName: r.display_name,
            latitude:    Number(r.lat),
            longitude:   Number(r.lon),
            type:        r.type,
            class:       r.class,
          })),
          upstream: "nominatim.openstreetmap.org (real)",
        };
      }
      return { query: q, results: [], upstream: "canned (Nominatim unreachable)" };
    },
  },
  {
    id:           "demo_time",
    name:         "Demo World Time (worldtimeapi, free)",
    provider:     "LemonCake DEMO → worldtimeapi.org",
    type:         "API",
    pricePerCall: "0.00 USDC (free demo, real upstream)",
    description:  "Current time + timezone + DST status for any IANA timezone (Asia/Tokyo, America/New_York, …). Useful for scheduling agents. Body: { timezone }.",
    example:      { path: "/timezone", method: "POST", body: { timezone: "Asia/Tokyo" } },
    handler: async (_path, body) => {
      const tz = (body?.timezone as string | undefined) ?? "Asia/Tokyo";
      const data = await tryFetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(tz)}`) as any;
      if (data?.datetime) {
        return {
          timezone:    data.timezone,
          datetime:    data.datetime,
          utcOffset:   data.utc_offset,
          isDst:       data.dst,
          dayOfWeek:   data.day_of_week,
          weekNumber:  data.week_number,
          unixtime:    data.unixtime,
          upstream:    "worldtimeapi.org (real)",
        };
      }
      const now = new Date();
      return { timezone: tz, datetime: now.toISOString(), upstream: "canned (worldtimeapi unreachable)" };
    },
  },
  {
    id:           "demo_dictionary",
    name:         "Demo Dictionary (dictionaryapi.dev, free)",
    provider:     "LemonCake DEMO → dictionaryapi.dev",
    type:         "API",
    pricePerCall: "0.00 USDC (free demo, real upstream)",
    description:  "English dictionary: definitions, parts of speech, examples, synonyms, phonetics. Free, no auth. Body: { word }.",
    example:      { path: "/define", method: "POST", body: { word: "ephemeral" } },
    handler: async (_path, body) => {
      const word = (body?.word as string | undefined) ?? "ephemeral";
      const data = await tryFetch(
        `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      ) as any[];
      if (Array.isArray(data) && data.length > 0) {
        const entry = data[0];
        return {
          word:        entry.word,
          phonetic:    entry.phonetic ?? entry.phonetics?.[0]?.text ?? null,
          meanings:    (entry.meanings ?? []).slice(0, 3).map((m: any) => ({
            partOfSpeech: m.partOfSpeech,
            definitions:  (m.definitions ?? []).slice(0, 2).map((d: any) => ({
              definition: d.definition,
              example:    d.example ?? null,
            })),
            synonyms:     (m.synonyms ?? []).slice(0, 5),
          })),
          upstream:    "api.dictionaryapi.dev (real)",
        };
      }
      return { word, meanings: [], upstream: "canned (dictionaryapi unreachable)" };
    },
  },
];

function findDemoService(id: string) {
  return DEMO_SERVICES.find((s) => s.id === id);
}

const DEMO_NOTICE = "🎮 DEMO MODE — no real charge, no signup. To unlock paid services, sign one ERC-2612 permit at https://lemoncake.xyz/start/v2 and set LEMON_CAKE_PERMIT. Run `setup` for instructions.";

// x402 互換ユーティリティは src/x402.ts に切り出してテスト可能化。
import { buildX402Receipt, parseX402Challenge } from "./x402.js";

// ── サインアップ / ダッシュボード URL（UTM 付きで経由クライアントを区別） ──
const UTM            = "utm_source=mcp-server&utm_medium=cli";
// v2 では一度の permit 署名で済むので "register" ではなく "permit issue" 動線。
const PERMIT_URL     = `https://lemoncake.xyz/start/v2?${UTM}&utm_campaign=credential-missing`;
const DASHBOARD_URL  = `https://lemoncake.xyz/?${UTM}`;
const DOCS_URL       = `https://lemoncake.xyz/about?${UTM}`;

// ── 起動時: 認証状態を stderr に出力（MCP クライアントのログに残る）───────────

const hasPayToken = PAY_TOKEN.length > 0;
const hasBuyerJwt = BUYER_JWT.length > 0;
const hasPermit   = NON_CUSTODIAL_MODE;
const hasLegacy   = hasPayToken || hasBuyerJwt;

console.error("[LemonCake MCP] Starting...");
console.error(`[LemonCake MCP]   API URL : ${API_URL}`);
console.error(`[LemonCake MCP]   PERMIT  : ${hasPermit ? "✓ set (non-custodial, FSA Q11 compliant)" : "✗ not set"}`);
if (hasLegacy) {
  console.error(`[LemonCake MCP]   LEGACY  : ⚠ Pay Token / Buyer JWT detected — deprecated since v0.8, please migrate to LEMON_CAKE_PERMIT`);
}
const modeLabel =
  hasPermit ? "🍋 NON-CUSTODIAL (recommended; LemonCake never touches your USDC)" :
  DEMO_MODE ? "🎮 DEMO (no signup; demo_* services + mock balance)"               :
              "LEGACY (custody — please migrate to LEMON_CAKE_PERMIT)";
console.error(`[LemonCake MCP]   MODE    : ${modeLabel}`);

if (DEMO_MODE) {
  console.error("[LemonCake MCP]");
  console.error("[LemonCake MCP]   🎮 Demo mode active — you can try these without any signup:");
  console.error("[LemonCake MCP]     • list_services      → real marketplace + 3 demo services");
  console.error("[LemonCake MCP]     • call_service       → 8 demo services (search / echo / fx / translate / weather / geocode / time / dictionary) — real upstreams, no auth");
  console.error("[LemonCake MCP]     • check_balance      → mock $1.00 demo balance");
  console.error("[LemonCake MCP]     • check_tax / get_service_stats → real (no auth needed)");
  console.error("[LemonCake MCP]");
  console.error(`[LemonCake MCP]   To unlock paid services: sign 1 permit at  →  ${PERMIT_URL}`);
}

// ── ヘルパー ──────────────────────────────────────────────────────────────────

async function apiGet(path: string, auth?: string) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type":       "application/json",
      "User-Agent":         USER_AGENT,
      "X-LemonCake-Client": USER_AGENT,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function apiPost(path: string, data: unknown, auth?: string, extraHeaders?: Record<string, string>) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type":       "application/json",
      "User-Agent":         USER_AGENT,
      "X-LemonCake-Client": USER_AGENT,
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/**
 * サービス名から呼び方ヒントを返す。
 * エージェントが call_service で正しい path/method/body を即座に推測できるよう
 * 既知の人気サービスについて推奨呼び出しを示す。
 */
function usageHintFor(name: string): { path: string; method: string; body?: unknown; description: string } | undefined {
  const n = name.toLowerCase();
  if (n.includes("serper"))           return { path: "/search",       method: "POST", body: { q: "<query>", num: 5 },               description: "Google検索 (organic, news, images, knowledge graph)" };
  if (n.includes("hunter"))           return { path: "/domain-search?domain=<domain>&limit=5", method: "GET",                       description: "ドメインから企業の連絡先メール一覧 (役職・信頼度付き)" };
  if (n.includes("jina"))             return { path: "/?url=<url>",   method: "GET",                                                 description: "Webページを LLM-ready Markdown に変換" };
  if (n.includes("firecrawl"))        return { path: "/scrape",       method: "POST", body: { url: "<url>" },                       description: "JS実行ありのWebスクレイピング → Markdown" };
  if (n.includes("ipinfo"))           return { path: "/<ip>",         method: "GET",                                                 description: "IP geolocation・ISP・ASN・risk score" };
  if (n.includes("exchange") || n.includes("為替")) return { path: "/latest.json", method: "GET",                                    description: "USD基準の170+通貨レート (1日1回更新)" };
  if (n.includes("slack"))            return { path: "/chat.postMessage", method: "POST", body: { channel: "<id>", text: "<msg>" }, description: "Slackメッセージ送信、人間の判断仰ぎに最適" };
  if (n.includes("gbiz") || n.includes("法人")) return { path: "/hojin/<corporate_number>", method: "GET",                            description: "経産省 gBizINFO 法人情報 (法人番号13桁)" };
  if (n.includes("インボイス") || n.includes("invoice")) return { path: "/check?id=T<13桁>", method: "GET",                            description: "国税庁 適格請求書発行事業者番号の照合" };
  if (n.includes("e-gov") || n.includes("法令")) return { path: "/keyword?keyword=<語>", method: "GET",                                description: "日本の法律・政令・省令を全文検索" };
  if (n.includes("vat") || n.includes("abstract")) return { path: "/validate?vat_number=<vat>", method: "GET",                        description: "EU VAT番号有効性検証" };
  if (n.includes("coze") || n.includes("test")) return { path: "/anything", method: "POST", body: { test: "any" },                   description: "Echoサーバ (リクエストをそのまま200で返す、デバッグ用)" };
  return undefined;
}

/** 未設定の認証情報に対して、取得方法を含む分かりやすいエラーを返す */
function credentialError(_envVar: string, toolName: string) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        error: `LEMON_CAKE_PERMIT is not configured. ${toolName} requires a v2 permit signature.`,
        code:  "PERMIT_MISSING",
        howToFix: [
          `1. Open ${PERMIT_URL} and sign in with Google (Privy embedded wallet, ~30s).`,
          `2. Top up USDC via Apple Pay / Coinbase / JPY bank transfer (built in).`,
          `3. Click "署名する" — one EIP-712 signature, no gas fee, valid 90 days with a $25/day hard cap.`,
          `4. Copy the LEMON_CAKE_PERMIT blob into your MCP client config:`,
          `   "env": { "LEMON_CAKE_PERMIT": "<paste permit here>" }`,
          `5. Restart your MCP client.`,
        ],
        whyPermit: [
          "Permits are non-custodial: LemonCake never holds your USDC.",
          "The daily cap is enforced on-chain by USDC itself — the agent literally cannot exceed it.",
          "One signature lasts 90 days; no per-call popups, no JWT juggling.",
        ],
        docs: DOCS_URL,
        tip: `Try the 'explore-demo' prompt first to see how the tools work without signing up.`,
      }, null, 2),
    }],
    isError: true,
  };
}

// ── サーバー初期化 ────────────────────────────────────────────────────────────

const SERVER_INSTRUCTIONS = DEMO_MODE
  ? [
      "🎮 DEMO MODE ACTIVE — no signup, no API key, no permit required.",
      "",
      "You are connected with no credentials, so this server is in Demo Mode:",
      "  • list_services      → marketplace listing + 3 free demo services",
      "  • call_service(demo_search)  → real Wikipedia search",
      "  • call_service(demo_fx)      → real live FX rates (open.er-api.com)",
      "  • call_service(demo_echo)    → httpbin.org echo",
      "  • check_balance      → mock $1.00 balance",
      "  • check_tax / get_service_stats → real (no auth)",
      "",
      "👉 Quick start: try the `explore-demo` prompt above, or call `setup` for the full guide.",
      "",
      "To unlock paid services (Serper, Hunter.io, gBizINFO, NTA invoice check, etc.),",
      "sign ONE ERC-2612 permit at https://lemoncake.xyz/start/v2 and set LEMON_CAKE_PERMIT.",
      "USDC stays in your wallet — LemonCake never holds it.",
    ].join("\n")
  : NON_CUSTODIAL_MODE
    ? [
        "🍋 LemonCake MCP — Non-custodial pay-per-call USDC payments (v2).",
        "",
        "Permit is set: AI agent can spend up to $25/day from your wallet for 90 days.",
        "USDC settles directly from your wallet to the API provider — LemonCake never touches it.",
        "",
        "Use `list_services` to browse, `call_service` to invoke, `check_balance` for quota.",
      ].join("\n")
    : [
        "LemonCake MCP — Pay-per-call USDC payments for any HTTP API.",
        "",
        "⚠ Legacy custody mode detected (PAY_TOKEN/BUYER_JWT). Please migrate to",
        "  LEMON_CAKE_PERMIT — get one at https://lemoncake.xyz/start/v2 (one signature, 90 days).",
        "",
        "Use `list_services` to browse the marketplace, then `call_service` to invoke.",
      ].join("\n");

const server = new Server(
  { name: "lemon-cake-mcp", version: MCP_VERSION },
  {
    capabilities: { tools: {}, prompts: {}, logging: {} },
    instructions: SERVER_INSTRUCTIONS,
  },
);

// ── ツール定義 ────────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [

    // ─── setup（認証不要） ────────────────────────────────────────────────
    {
      name: "setup",
      description: [
        "Show the LemonCake MCP first-run setup guide. No authentication required.",
        "Call this tool FIRST to learn what is missing and how to obtain a permit.",
        "",
        "If LEMON_CAKE_PERMIT is not set, the server is in DEMO MODE: list_services returns",
        "8 free demo services (search / echo / fx / translate / weather / geocode / time / dictionary)",
        "powered by real upstreams (Wikipedia, httpbin, Open-Meteo, Nominatim, etc.). call_service",
        "and check_balance respond with mock data so you can verify integration before signing.",
        "",
        "Returns the current credential status (permit presence), demo-mode flag, and",
        "step-by-step instructions for getting a permit at /start/v2, including a sample MCP",
        "client config snippet ready to paste.",
        "",
        "Returns: { version, apiUrl, mode, credentials, availableTools, setupSteps, permitUrl, docs }",
        "Errors: none — this tool always succeeds.",
      ].join("\n"),
      annotations: {
        title:           "Setup guide",
        readOnlyHint:    true,
        destructiveHint: false,
        idempotentHint:  true,
        openWorldHint:   false,
      },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },

    // ─── list_services（認証不要） ───────────────────────────────────────
    {
      name: "list_services",
      description: [
        "List approved API services available on the LemonCake marketplace. No authentication required.",
        "",
        "Use this BEFORE call_service to discover serviceId values and per-call USDC pricing.",
        "",
        "When LEMON_CAKE_PERMIT is missing, 8 demo services are prepended:",
        "  demo_search     → Wikipedia opensearch",
        "  demo_echo       → httpbin.org/anything",
        "  demo_fx         → live FX rates (open.er-api)",
        "  demo_translate  → 80+ languages (MyMemory)",
        "  demo_weather    → current weather any lat/lon (Open-Meteo)",
        "  demo_geocode    → place name → lat/lon (OpenStreetMap Nominatim)",
        "  demo_time       → IANA timezone time + DST (worldtimeapi)",
        "  demo_dictionary → English definitions / synonyms (dictionaryapi.dev)",
        "All real upstreams, no auth, free. Live users (permit set) see real",
        "marketplace entries; demo_* IDs remain callable directly.",
        "",
        "Each item: { id, name, provider, type ('API' | 'MCP'), pricePerCall, [usage], [mode] }.",
        "Errors: HTTP-level errors are returned as `Error: API <status>: <body>`.",
      ].join("\n"),
      annotations: {
        title:           "List marketplace services",
        readOnlyHint:    true,
        destructiveHint: false,
        idempotentHint:  true,
        openWorldHint:   true,
      },
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          limit: {
            type:        "integer",
            minimum:     1,
            maximum:     100,
            default:     50,
            description: "Maximum number of services to return (default 50, max 100).",
          },
        },
      },
    },

    // ─── call_service（permit 必須 / demo_* は不要） ─────────────────────
    {
      name: "call_service",
      description: [
        "Invoke an upstream API service through LemonCake's pay-per-call proxy.",
        "Each successful call automatically debits USDC from your wallet via the permit you signed.",
        "LemonCake never holds your USDC — the transfer is direct wallet → provider on Base.",
        "",
        "PRECONDITIONS:",
        "  • LEMON_CAKE_PERMIT env var must be set for real services. Get one in ~30 seconds at",
        "    https://lemoncake.xyz/start/v2 (sign in with Google, sign 1 EIP-712 permit, copy the blob).",
        "    If missing, the tool returns a structured PERMIT_MISSING error with how-to-fix steps.",
        "  • DEMO MODE: any serviceId starting with `demo_` works WITHOUT a permit and hits real",
        "    free upstreams (Wikipedia / httpbin / Open-Meteo / Nominatim / MyMemory / dictionaryapi /",
        "    worldtimeapi / open.er-api). 8 demos cover search / echo / fx / translate / weather /",
        "    geocode / time / dictionary — useful for Glama Inspector or new-user trial. They are",
        "    marked with `mode: \"demo\"` and incur no charge.",
        "  • serviceId must come from list_services.",
        "",
        "BEHAVIOR:",
        "  • Returns the upstream response body verbatim (JSON or text), plus the X-Charge-Id",
        "    and X-Amount-Usdc headers reported by the proxy.",
        "  • HTTP 402 Payment Required is returned as a normal result (NOT thrown) so the",
        "    agent can autonomously stop spending when the daily $25 permit cap is exhausted.",
        "  • Pass the same idempotencyKey to retry safely without double-charging.",
        "  • This tool spends real money and contacts an external service — it is",
        "    non-idempotent by default and has external side effects.",
        "",
        "x402-COMPATIBLE INTERFACE:",
        "  • Successful calls include an `x402Receipt` field with { scheme, chain, asset, amount,",
        "    recipient, paymentIntentId, settledAt }. Same shape as on-chain x402 receipts so the",
        "    agent's payment-handling logic is portable.",
        "  • If upstream returns an x402 challenge (WWW-Authenticate: x402, X-402-* headers, or",
        "    body.x402), it's parsed into `x402Challenge` for the agent to reason about.",
        "  • If upstream returns 202 + Retry-After + X-Payment-Status: pending, the result is",
        "    `{ status: \"PAYMENT_PENDING\", paymentIntentId, retryAfterMs, retryContract }`.",
        "    Re-call with the same idempotencyKey to resume — no double-charge.",
        "",
        "Returns: { status, chargeId, amountUsdc, response, x402Receipt?, x402Challenge?, hint? }",
      ].join("\n"),
      annotations: {
        title:           "Call a paid service (charges USDC)",
        readOnlyHint:    false,
        destructiveHint: false,
        idempotentHint:  false,
        openWorldHint:   true,
      },
      inputSchema: {
        type: "object",
        required: ["serviceId"],
        additionalProperties: false,
        properties: {
          serviceId: {
            type:        "string",
            description: "ID of the service to call (obtain from list_services).",
            minLength:   1,
          },
          path: {
            type:        "string",
            description: "Sub-path on the service (e.g. \"/search\", \"/v1/completions\"). Defaults to \"/\".",
            default:     "/",
            pattern:     "^/.*",
          },
          method: {
            type:        "string",
            enum:        ["GET", "POST", "PUT", "PATCH", "DELETE"],
            description: "HTTP method to use against the service. Defaults to GET.",
            default:     "GET",
          },
          body: {
            type:                 "object",
            description:          "JSON request body (only used for POST/PUT/PATCH).",
            additionalProperties: true,
          },
          idempotencyKey: {
            type:        "string",
            description: "Optional idempotency key (UUID recommended). Identical keys within the proxy's retention window return the cached result without re-charging.",
            format:      "uuid",
          },
        },
      },
    },

    // ─── check_balance（permit / DEMO_MODE 時は mock） ───────────────────
    {
      name: "check_balance",
      description: [
        "Check the current on-chain USDC balance of the wallet that owns the configured permit.",
        "",
        "PRECONDITIONS:",
        "  • DEMO MODE (no LEMON_CAKE_PERMIT): returns a canned $1.00 demo balance so trial",
        "    users see something useful before signing.",
        "  • LIVE: queries Base USDC.balanceOf(owner) directly + reports remaining daily permit",
        "    cap. LemonCake's backend doesn't store the balance — it's read from the chain.",
        "",
        "Use BEFORE call_service to confirm sufficient funds and remaining daily cap.",
        "",
        "Returns: { balanceUsdc, dailyCap, remainingToday, ownerAddress, [mode], [note] }",
      ].join("\n"),
      annotations: {
        title:           "Check USDC balance",
        readOnlyHint:    true,
        destructiveHint: false,
        idempotentHint:  true,
        openWorldHint:   true,
      },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },

    // ─── check_tax（認証不要） ───────────────────────────────────────────
    {
      name: "check_tax",
      description: [
        "Run a Japanese tax compliance check on a single transaction. No authentication required.",
        "",
        "Performs three checks in one call:",
        "  1. Validates the qualified-invoice registration number (T-number) against the NTA registry.",
        "  2. Determines whether source-withholding (源泉徴収) applies based on the service description.",
        "  3. If withholding applies, computes the withholding amount and net payable.",
        "",
        "Intended for Japanese corporations that pay AI / API services and need to file",
        "withholding correctly under the qualified-invoice (インボイス制度) regime.",
        "",
        "Returns: { invoice: { valid, name, ... }, withholding: { required, rate, amount, net } }",
        "Errors: invalid registrationNumber returns invoice.valid = false (not an exception).",
      ].join("\n"),
      annotations: {
        title:           "Japanese tax compliance check",
        readOnlyHint:    true,
        destructiveHint: false,
        idempotentHint:  true,
        openWorldHint:   true,
      },
      inputSchema: {
        type: "object",
        required: ["registrationNumber", "serviceDescription", "grossAmountJpy"],
        additionalProperties: false,
        properties: {
          registrationNumber: {
            type:        "string",
            description: "Qualified-invoice registration number issued by the Japanese NTA (e.g. \"T1234567890123\").",
            pattern:     "^T?\\d{13}$",
          },
          serviceDescription: {
            type:        "string",
            description: "Plain-text description of what was purchased. Used to classify whether source-withholding applies.",
            minLength:   1,
          },
          grossAmountJpy: {
            type:        "number",
            description: "Gross transaction amount in JPY, tax inclusive.",
            exclusiveMinimum: 0,
          },
        },
      },
    },

    // ─── get_service_stats（認証不要） ───────────────────────────────────
    {
      name: "get_service_stats",
      description: [
        "Return public usage statistics for every approved service on the marketplace. No authentication required.",
        "",
        "Use this AFTER list_services and BEFORE call_service to pick a service based on",
        "real-world traction (call counts, USDC revenue, last-used timestamp).",
        "",
        "Returns: an array of { serviceId, callCount, totalRevenueUsdc, lastCalledAt }.",
      ].join("\n"),
      annotations: {
        title:           "Marketplace usage stats",
        readOnlyHint:    true,
        destructiveHint: false,
        idempotentHint:  true,
        openWorldHint:   true,
      },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },

  ],
}));

// ── プロンプト定義 ────────────────────────────────────────────────────────────
// MCP Prompts: Glama Inspector / Claude Desktop / Cursor の prompt-picker に
// 「Try this」ボタンとして表示される pre-written conversation starters。
// Demo Mode（auth 不要）でもすぐ動くものを優先しているので、新規ユーザーが
// click 1 つで実プロダクトの挙動を確認できる。

const PROMPTS = [
  {
    name: "explore-demo",
    title: "👉 START HERE — Try the demo (no signup, no API key)",
    description: "[FREE · no auth needed] Walks Claude through all 8 demo services (search, fx, translate, weather, geocode, time, dictionary, echo). Best first step on Glama Inspector to confirm the server is alive and useful even without a permit.",
    template: [
      "Use the LemonCake MCP server (agent-payment-mcp) in demo mode (no auth needed) to:",
      "1. Run `setup` to confirm we're in demo mode.",
      "2. Run `list_services` — note the 8 demo_* entries.",
      "3. demo_search: q='Model Context Protocol' → show Wikipedia results.",
      "4. demo_fx: report current USD/JPY.",
      "5. demo_translate: text='Pay-per-call API access for AI agents', from='en', to='ja'.",
      "6. demo_geocode: q='Akihabara, Tokyo' → get lat/lon.",
      "7. demo_weather: use the lat/lon from step 6 to report current weather.",
      "8. demo_time: timezone='Asia/Tokyo' → current time + DST.",
      "9. demo_dictionary: word='ephemeral' → definitions.",
      "Then in 3 sentences, summarize what LemonCake adds vs raw API access (hint: USDC per-call, permit-bound spending cap, no JWT juggling).",
    ].join("\n"),
  },
  {
    name: "japan-tax-check",
    title: "🇯🇵 Validate a Japanese invoice number (FREE)",
    description: "[FREE · no auth needed] Uses the check_tax tool to verify a 適格請求書発行事業者番号 against the NTA registry. ChatGPT/Gemini cannot do this — they hallucinate registration numbers. Real second demo.",
    arguments: [
      { name: "registrationNumber", description: "T + 13 digit number. Leave empty to use a sample (T1234567890123).", required: false },
      { name: "amountJpy", description: "Gross amount in JPY. Defaults to 110000.", required: false },
    ],
    template: (args: Record<string, string | undefined>) => [
      `Use the \`check_tax\` tool to validate registration number ${args.registrationNumber ?? "T1234567890123"}.`,
      args.amountJpy ? `The transaction amount is ${args.amountJpy} JPY (tax-inclusive).` : "Use a sample amount of 110000 JPY.",
      "Report: (1) is the number valid? (2) registered name and address. (3) does source-withholding (源泉徴収) apply, and how much?",
    ].join("\n"),
  },
  {
    name: "discover-marketplace",
    title: "🛍 Discover marketplace services (FREE browse)",
    description: "[FREE · no auth needed] Lists every approved service with its category and price. Useful before deciding whether to sign a permit.",
    template: [
      "Using this server's `list_services` tool, list every approved service with its category and price.",
      "Then recommend the top 3 for an AI agent that needs to: (a) find recent news, (b) verify a Japanese invoice number, (c) translate text.",
      "For each recommendation, show the exact `call_service` arguments to invoke it.",
    ].join("\n"),
  },
  {
    name: "spend-with-budget",
    title: "💰 Spend with a strict budget cap (permit required)",
    description: "[REQUIRES permit — sign one free at lemoncake.xyz/start/v2] Pattern: check_balance → call_service → check_balance again, demonstrating the on-chain daily cap enforced by the permit.",
    arguments: [
      { name: "serviceId", description: "Marketplace service ID (omit for demo_search)", required: false },
      { name: "query", description: "Search query (for search/data services)", required: false },
    ],
    template: (args: Record<string, string | undefined>) => {
      const sid = args.serviceId ?? "demo_search";
      const q = args.query ?? "AI agent payments 2026";
      return [
        `Demonstrate the LemonCake spending pattern with serviceId=\`${sid}\`:`,
        "1. Call `check_balance` and report current USDC balance + remaining daily cap.",
        `2. Call \`call_service\` with serviceId='${sid}', method='POST', path='/search', body={\"q\":\"${q}\"}.`,
        "3. Call `check_balance` again and report the delta. If we're in demo mode, note that no real charge happened.",
        "Throughout, mention any 4xx hints the proxy returns so I learn the failure modes.",
      ].join("\n");
    },
  },
  {
    name: "real-vs-demo",
    title: "🔄 Compare demo vs real upstream (permit required for real)",
    description: "[FREE for demo half · permit needed for real half] Hits the same logical query against demo_search (Wikipedia, free) and a real marketplace search service to see the difference. Gracefully skips the paid half if no permit is set.",
    template: [
      "Compare LemonCake's demo vs real search:",
      "1. Call `call_service` with serviceId='demo_search', body={\"q\":\"Model Context Protocol\"}. Note the Wikipedia results.",
      "2. From `list_services`, find a real Serper / search service (category='検索') and call it with the same query.",
      "3. Tabulate: result count, top result title, latency feel (you'll see chargeId only for the real one).",
      "If LEMON_CAKE_PERMIT isn't set, gracefully skip step 2 and explain how to get one at lemoncake.xyz/start/v2.",
    ].join("\n"),
  },
  {
    name: "japan-finance-bundle",
    title: "🏯 Japan finance research bundle (permit required)",
    description: "[REQUIRES permit for gBizINFO + e-Gov · check_tax part is free] Combines gBizINFO 法人情報 + 国税庁 invoice check + e-Gov 法令 in one workflow.",
    arguments: [
      { name: "corporateNumber", description: "13-digit corporate number (法人番号)", required: false },
    ],
    template: (args: Record<string, string | undefined>) => {
      const cn = args.corporateNumber ?? "3010001088782";
      return [
        `Run a Japan finance research workflow with 法人番号 ${cn}:`,
        "1. `list_services` — confirm gBizINFO / 国税庁インボイス / e-Gov are available (category='日本特化').",
        `2. Call gBizINFO with path='/hojin/${cn}'. Report company name, address, capital, representative.`,
        `3. Call 国税庁インボイス with path='/check?id=T${cn}'. Verify if this corp is a registered invoice issuer.`,
        "4. Call e-Gov with keyword='インボイス制度'. Find 1-2 relevant law articles.",
        "Summarize all findings in a single executive briefing.",
      ].join("\n");
    },
  },
] as const;

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: PROMPTS.map((p) => ({
    name:        p.name,
    title:       p.title,
    description: p.description,
    arguments:   "arguments" in p ? p.arguments : undefined,
  })),
}));

server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, string | undefined>;
  const prompt = PROMPTS.find((p) => p.name === name);
  if (!prompt) {
    throw new Error(`Unknown prompt: ${name}`);
  }
  const text =
    typeof prompt.template === "function"
      ? prompt.template(args)
      : prompt.template;
  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: { type: "text", text },
      },
    ],
  };
});

// ── ツール実装 ────────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    switch (name) {

      // ─── setup ──────────────────────────────────────────────────────────
      case "setup": {
        const status: Record<string, string> = {
          permit: hasPermit ? "✓ 設定済み" : "✗ 未設定（call_service が demo_* 以外で使えません）",
        };
        if (hasLegacy) {
          status.legacy = "⚠ Pay Token / Buyer JWT を検出（v0.8 で deprecated、permit に移行してください）";
        }

        const steps: string[] = [];

        if (!hasPermit) {
          steps.push("=== セットアップ手順（約 1 分）===");
          steps.push("");
          steps.push("1. /start/v2 をブラウザで開く");
          steps.push(`   → ${PERMIT_URL}`);
          steps.push("");
          steps.push("2. Google でサインイン（Privy が embedded wallet を自動生成、秘密鍵はあなたのデバイスに保管）");
          steps.push("");
          steps.push("3. USDC を入手（どれか 1 つ）");
          steps.push("   • Apple Pay / Google Pay / クレカ → Coinbase Onramp（USD）");
          steps.push("   • 銀行振込 / コンビニ払い → Transak（JPY）");
          steps.push("   • 既に Base 上で USDC を保有しているならスキップ可");
          steps.push("");
          steps.push("4. ERC-2612 permit に 1 回だけ署名（ガス代なし）");
          steps.push("   ・上限: $25/日（USDC コントラクトが強制）");
          steps.push("   ・有効期間: 90 日");
          steps.push("   ・経路: あなたのウォレット → API 提供者ウォレット（直接、LemonCake は経由しない）");
          steps.push("");
          steps.push("5. 発行された LEMON_CAKE_PERMIT blob を MCP 設定ファイルに貼る");
          steps.push("");
        }

        steps.push("=== MCP 設定ファイルのサンプル ===");
        steps.push("");
        steps.push(JSON.stringify({
          mcpServers: {
            lemon: {
              command: "npx",
              args:    ["-y", "agent-payment-mcp"],
              env: {
                LEMON_CAKE_PERMIT: hasPermit ? "(設定済み)" : "<lemoncake.xyz/start/v2 で発行した permit blob>",
              },
            },
          },
        }, null, 2));
        steps.push("");
        steps.push("※ 旧パッケージ名 `lemon-cake-mcp` / bin alias `pay-per-call-mcp` も同じバイナリに解決されます。");

        return json({
          version:       MCP_VERSION,
          apiUrl:        API_URL,
          mode:          NON_CUSTODIAL_MODE ? "non-custodial" : DEMO_MODE ? "demo" : "legacy",
          credentials:   status,
          availableTools: DEMO_MODE
            ? {
                noAuth:        ["setup", "list_services", "get_service_stats", "check_tax", "check_balance (mock)", "call_service (demo_* only)"],
                demoServices:  DEMO_SERVICES.map((d) => d.id),
                upgradeHint:   `Sign one permit at ${PERMIT_URL} (~30s) and set LEMON_CAKE_PERMIT to unlock paid services.`,
              }
            : {
                noAuth:       ["setup", "list_services", "get_service_stats", "check_tax"],
                needPermit:   ["call_service", "check_balance"],
              },
          setupSteps: steps.length > 0 ? steps.join("\n") : "✅ permit が設定済みです — paid services を利用できます。",
          permitUrl:  PERMIT_URL,
          dashboard:  DASHBOARD_URL,
          docs:       "https://github.com/evidai/agent-payment-mcp",
          // x402 互換性メタデータ。エージェントが「この MCP は x402 形式の receipt /
          // challenge を返す」と知った上で payment-handling logic を組めるように。
          x402: {
            interface:        "compatible",
            scheme:           "lemoncake-permit-v2",
            settlement:       NON_CUSTODIAL_MODE ? "on-chain via ERC-2612 permit (Base + USDC)" : "off-chain (legacy Pay Token)",
            facilitator:      "https://skillful-blessing-production.up.railway.app/api/x402",
            receiptShape:     ["scheme", "x402Compatible", "chain", "asset", "amount", "recipient", "paymentIntentId", "settledAt"],
            challengeParser:  ["WWW-Authenticate: x402 ...", "X-402-* headers", "body.x402"],
            pendingSemantics: "upstream 202 + Retry-After + X-Payment-Status: pending → status: PAYMENT_PENDING with retryContract; safe to retry with same idempotencyKey",
          },
        });
      }

      // ─── list_services ───────────────────────────────────────────────────
      case "list_services": {
        const limit = (args.limit as number | undefined) ?? 50;
        const services = await apiGet(`/api/services?reviewStatus=APPROVED&limit=${limit}`) as any[];
        const real = services
          .filter((s: any) => s.verified)
          .map((s: any) => ({
            id:           s.id,
            name:         s.name,
            provider:     s.providerName,
            type:         s.type,
            pricePerCall: `${s.pricePerCallUsdc} USDC`,
            usage:        usageHintFor(s.name),
          }));
        // Demo モード（permit も legacy も無い）なら demo_* を先頭に prepend して
        // 新規ユーザーが list_services 結果からそのまま試せるようにする。permit
        // が設定済みなら real services のみ返してリストをすっきり保つ。
        if (DEMO_MODE) {
          const demos = DEMO_SERVICES.map((d) => ({
            id:           d.id,
            name:         d.name,
            provider:     d.provider,
            type:         d.type,
            pricePerCall: d.pricePerCall,
            description:  d.description,
            usage:        d.example,
            mode:         "demo",
          }));
          return json([...demos, ...real]);
        }
        return json(real);
      }

      // ─── call_service ────────────────────────────────────────────────────
      case "call_service": {
        const serviceId      = args.serviceId as string;
        const subPath        = (args.path as string | undefined) ?? "/";
        const method         = (args.method as string | undefined) ?? "GET";
        const body           = args.body as Record<string, unknown> | undefined;
        const idempotencyKey = args.idempotencyKey as string | undefined;

        const normalizedPath = subPath.startsWith("/") ? subPath : `/${subPath}`;

        // Demo mode: handle demo_* services without auth so Glama Inspector
        // and new users can verify the call shape before signing up.
        const demoSvc = findDemoService(serviceId);
        if (demoSvc) {
          const demoChargeId = `demo_${Date.now().toString(36)}`;
          const demoAmount   = demoSvc.pricePerCall.split(" ")[0];
          return json({
            status:     200,
            chargeId:   demoChargeId,
            amountUsdc: demoAmount,
            response:   await demoSvc.handler(normalizedPath, body),
            mode:       "demo",
            note:       DEMO_NOTICE,
            // x402-compatible receipt — same shape live calls return.
            // Lets agents write payment-handling logic once, against the
            // demo, and ship it unchanged to production.
            x402Receipt: buildX402Receipt({
              chargeId:   demoChargeId,
              amountUsdc: demoAmount,
              serviceId,
              mode:       "demo",
            }),
          });
        }

        // v0.8+: prefer PERMIT. PAY_TOKEN is silent fallback for legacy users.
        if (!hasPermit && !PAY_TOKEN) return credentialError("LEMON_CAKE_PERMIT", "call_service");
        const url = `${API_URL}/api/proxy/${serviceId}${normalizedPath}`;

        // PERMIT は X-LemonCake-Permit ヘッダで送る（バックエンド側で透過対応）。
        // PAY_TOKEN しかなければ従来通り Authorization Bearer。両方あれば permit 優先。
        const headers: Record<string, string> = {
          "Content-Type":       "application/json",
          "User-Agent":         USER_AGENT,
          "X-LemonCake-Client": USER_AGENT,
        };
        if (hasPermit) {
          headers["X-LemonCake-Permit"] = PERMIT_TOKEN;
        }
        if (PAY_TOKEN) {
          headers["Authorization"] = `Bearer ${PAY_TOKEN}`;
        }
        if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

        // SECURITY / RESILIENCE: previously there was no fetch timeout — a
        // slow / hung upstream could keep the agent's call open indefinitely.
        // (H-06 of the 2026-05 @kleosr forensic audit.)
        // Default to 30s; callers can override per-call via
        // LEMONCAKE_CALL_TIMEOUT_MS env var (1s–600s).
        const timeoutRaw = parseInt(process.env.LEMONCAKE_CALL_TIMEOUT_MS ?? "30000", 10);
        const timeoutMs = Math.min(Math.max(isNaN(timeoutRaw) ? 30000 : timeoutRaw, 1000), 600000);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const fetchOptions: RequestInit = { method, headers, signal: controller.signal };
        if (body && ["POST", "PUT", "PATCH"].includes(method)) {
          fetchOptions.body = JSON.stringify(body);
        }

        let res: Response;
        try {
          res = await fetch(url, fetchOptions);
        } catch (err) {
          if ((err as { name?: string }).name === "AbortError") {
            throw new Error(`Upstream call exceeded ${timeoutMs}ms timeout`);
          }
          throw err;
        } finally {
          clearTimeout(timeoutId);
        }
        const chargeId   = res.headers.get("X-Charge-Id");
        const amountUsdc = res.headers.get("X-Amount-Usdc");

        let responseBody: unknown;
        if ((res.headers.get("content-type") ?? "").includes("application/json")) {
          responseBody = await res.json();
        } else {
          responseBody = await res.text();
        }

        // 402 の場合もエラーではなく構造化レスポンスとして返す
        // （エージェントが自律的に停止判断できるように）
        const result: Record<string, unknown> = { status: res.status, chargeId, amountUsdc, response: responseBody };

        // ── x402: PAYMENT_PENDING 検知 ─────────────────────────────────
        // 上流が 202 + Retry-After + X-Payment-Status: pending を返したら、
        // エージェントには「リトライしろ、idempotencyKey で安全」と伝える
        if (res.status === 202 && res.headers.get("x-payment-status")?.toLowerCase() === "pending") {
          const retryAfterMs = parseInt(res.headers.get("retry-after") ?? "5", 10) * 1000;
          result.status = "PAYMENT_PENDING";
          result.paymentIntentId = res.headers.get("x-payment-intent-id") ?? chargeId ?? `pending_${Date.now().toString(36)}`;
          result.retryAfterMs    = retryAfterMs;
          result.retryContract   = `Call \`call_service\` again with the SAME idempotencyKey="${idempotencyKey ?? "<set one and retry>"}" after ${retryAfterMs}ms. The original request will resume; no double-charge.`;
          return json(result);
        }

        // ── x402: 上流チャレンジ検知 ───────────────────────────────────
        // 上流が x402 challenge（WWW-Authenticate / X-402-* / body.x402）を
        // 返したら parse してエージェントに構造化情報として渡す
        if (res.status === 402) {
          const challenge = parseX402Challenge(res.headers, responseBody);
          if (challenge) {
            result.x402Challenge = challenge;
            result.hint = `Upstream returned x402 challenge (chain=${challenge.chain ?? "?"} asset=${challenge.asset ?? "?"} amount=${challenge.amount ?? "?"}). On-chain auto-pay is gated; for now, escalate to human or pick another service.`;
          }
        }

        // よくある 4xx に対するエージェント向けヒントを付与
        if (res.status >= 400 && !result.hint) {
          let hint: string | undefined;
          const bodyStr = typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody ?? "");
          if (res.status === 401)                               hint = "Upstream authentication failed. The service's API key may be invalid or expired. Try a different service.";
          else if (res.status === 402)                          hint = "Daily permit cap exhausted or wallet balance insufficient. Stop further calls and notify the user to top up USDC or wait until tomorrow.";
          else if (res.status === 403)                          hint = "Forbidden. The permit may not cover this serviceId, or the service is not approved.";
          else if (res.status === 404)                          hint = "Path not found on upstream. Re-check the `path` argument — common shapes vary by service.";
          else if (res.status === 422 && bodyStr.includes("service_uneconomical")) hint = "This service is below the platform's minimum revenue floor. Cannot be called regardless of buyer balance.";
          else if (res.status === 429)                          hint = "Upstream rate-limited. Retry after backoff or pick a different service.";
          else if (res.status === 501)                          hint = "Service has no proxy endpoint configured. Pick a different service from list_services.";
          else if (res.status >= 500)                           hint = "Upstream server error. Retry once with the same idempotencyKey, then escalate or switch service.";
          if (hint) result.hint = hint;
        }

        // ── x402: 成功時 receipt ───────────────────────────────────────
        // 課金成功時のみ x402 互換 receipt を付与。エージェントは on-chain
        // x402 と同じパースロジックで amount/recipient/paymentIntentId を読める
        if (res.status >= 200 && res.status < 300 && chargeId) {
          result.x402Receipt = buildX402Receipt({
            chargeId,
            amountUsdc,
            serviceId,
            mode: "live",
          });
        }

        return json(result);
      }

      // ─── check_balance ───────────────────────────────────────────────────
      case "check_balance": {
        // Demo モード: モック残高
        if (DEMO_MODE) return json({
          balanceUsdc:    "1.00",
          dailyCap:       "25.00",
          remainingToday: "1.00",
          ownerAddress:   "0xDEMO000000000000000000000000000000000000",
          mode:           "demo",
          note:           DEMO_NOTICE,
        });

        // v2 non-custodial: permit からオーナーアドレスを抽出 → on-chain 残高 + cap
        if (hasPermit) {
          try {
            // permit は base64-JSON。owner + value (daily cap) を取り出す。
            const decoded = JSON.parse(Buffer.from(PERMIT_TOKEN, "base64").toString("utf-8"));
            const owner = decoded.owner as string;
            const dailyCapRaw = BigInt(decoded.value ?? "0");
            const dailyCapUsdc = (Number(dailyCapRaw) / 1_000_000).toFixed(2);
            // バランスは Base RPC 直叩きで取得
            const balResp = await tryFetch(`${API_URL}/api/charges/permit/quota?ownerAddress=${owner}`, {}, 4000) as { balanceUsdc?: string; remainingToday?: string } | null;
            return json({
              balanceUsdc:    balResp?.balanceUsdc ?? "(query failed — try again later)",
              dailyCap:       dailyCapUsdc,
              remainingToday: balResp?.remainingToday ?? dailyCapUsdc,
              ownerAddress:   owner,
              permitExpiry:   new Date(Number(decoded.deadline ?? 0) * 1000).toISOString(),
              mode:           "non-custodial",
            });
          } catch (e) {
            return json({
              balanceUsdc: "(permit decode failed)",
              error:       e instanceof Error ? e.message : String(e),
              hint:        "permit blob が壊れています。/start/v2 で再発行してください。",
              mode:        "non-custodial",
            });
          }
        }

        // legacy fallback
        if (BUYER_JWT) {
          const me = await apiGet("/api/auth/me", BUYER_JWT) as any;
          return json({
            balanceUsdc: me.buyer?.balanceUsdc ?? me.balanceUsdc,
            kycTier:     me.buyer?.kycTier     ?? me.kycTier,
            email:       me.email,
            name:        me.name,
            mode:        "legacy",
            note:        "Legacy custody mode. Please migrate to LEMON_CAKE_PERMIT.",
          });
        }
        return credentialError("LEMON_CAKE_PERMIT", "check_balance");
      }

      // ─── check_tax ───────────────────────────────────────────────────────
      case "check_tax": {
        const result = await apiPost("/api/tax/full-check", {
          registrationNumber: args.registrationNumber,
          serviceDescription: args.serviceDescription,
          grossAmountJpy:     args.grossAmountJpy,
        });
        return json(result);
      }

      // ─── get_service_stats ───────────────────────────────────────────────
      case "get_service_stats": {
        const stats = await apiGet("/api/services/stats");
        return json(stats);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: "text" as const, text: `Error: ${msg}` }],
      isError: true,
    };
  }
});

// ── 起動 ──────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[LemonCake MCP] Ready.");

  // 接続直後に Inspector の Request Log にバナーを出す。
  // Glama UI の env-var ダイアログを抜けて Inspector まで来た人に
  // 「空のまま動いてる、Demo Mode だよ」を即座に伝えるのが目的。
  try {
    await server.notification({
      method: "notifications/message",
      params: {
        level: "info",
        logger: "pay-per-call-mcp",
        data: DEMO_MODE
          ? "🎮 DEMO MODE — connected without credentials. Try the `explore-demo` prompt or call `setup` for guided onboarding. No signup needed."
          : `LemonCake MCP v${MCP_VERSION} ready. Run \`setup\` to verify credentials and \`list_services\` to browse paid APIs.`,
      },
    });
  } catch {
    // Older clients may not accept notifications before initialize completes.
    // The console.error banners above already cover stdio-only environments.
  }
}

main().catch((err) => {
  console.error("[LemonCake MCP] Fatal:", err);
  process.exit(1);
});
