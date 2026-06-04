#!/usr/bin/env node
/**
 * agent-payment-mcp
 *
 * The x402 payment rail for AI agents, as an MCP server. An agent calls a paid
 * HTTP API through LemonCake's gateway with a prepaid, spend-capped Pay Token —
 * no per-call key, custody-free (Stripe Connect Direct Charge).
 *
 * Tools:
 *  - setup         : first-run guide (no auth)
 *  - list_demos    : list 8 free demo tools (no auth)
 *  - call_demo     : run a free demo tool — real upstreams, no charge (no auth)
 *  - call_paid_api : call a paid endpoint via the gateway with a Pay Token
 *
 * Env vars:
 *  LC_PAY_TOKEN  : a Pay Token (JWT) for a paid endpoint. Get one by prepaying
 *                  at lemoncake.xyz/buy/<shortId>, or issue a Buyer Key at
 *                  lemoncake.xyz/app and mint one. If unset → Demo Mode.
 *  LC_GATEWAY    : gateway base URL (default https://www.lemoncake.xyz).
 *  LC_CALL_TIMEOUT_MS : upstream call timeout (ms, 1000–600000, default 30000).
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ── Config ──────────────────────────────────────────────────────────────────

const GATEWAY = (process.env.LC_GATEWAY ?? "https://www.lemoncake.xyz").replace(/\/$/, "");

// The only buyer credential is a Pay Token (a signed JWT). If absent, the
// server runs in Demo Mode (8 free real-API tools, no signup, no charge).
const PAY_TOKEN = (process.env.LC_PAY_TOKEN ?? "").trim();
const HAS_TOKEN = PAY_TOKEN.length > 0;
const DEMO_MODE = !HAS_TOKEN;

// ── Version / user agent ──────────────────────────────────────────────────────
import { createRequire } from "node:module";
const requireFromHere = createRequire(import.meta.url);
const MCP_VERSION: string = (requireFromHere("../package.json") as { version: string }).version;
const USER_AGENT = `agent-payment-mcp/${MCP_VERSION} (node/${process.versions.node}; ${process.platform} ${process.arch})`;

// x402 challenge parsing (kept for upstream challenges).
import { parseX402Challenge } from "./x402.js";

// ── Onboarding URLs (UTM-tagged) ──────────────────────────────────────────────
const UTM = "utm_source=mcp-server&utm_medium=cli";
const APP_URL = `${GATEWAY}/app?${UTM}`;
const FUND_URL = `${GATEWAY}/agent/fund?${UTM}`;
const PRICING_URL = `${GATEWAY}/pricing?${UTM}`;
const DEMO_URL = `${GATEWAY}/demo?${UTM}`;

const DEMO_NOTICE =
  "🎮 DEMO — no charge, no signup. To call paid APIs, get a Pay Token: prepay at /buy/<shortId>, or issue a Buyer Key at /app and save a card at /agent/fund. Run `setup` for details.";

// ── Demo tools (real free upstreams, no auth) ─────────────────────────────────

type DemoHandler = (body: Record<string, unknown> | undefined) => Promise<unknown> | unknown;

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

const DEMO_SERVICES: Array<{ id: string; name: string; upstream: string; description: string; example: Record<string, unknown>; handler: DemoHandler }> = [
  {
    id: "demo_search",
    name: "Demo Search (Wikipedia)",
    upstream: "en.wikipedia.org",
    description: "Search English Wikipedia. Body: { q }. Returns up to 5 titles + snippets + URLs.",
    example: { q: "Model Context Protocol" },
    handler: async (body) => {
      const q = (body?.q as string | undefined) ?? "Model Context Protocol";
      const data = await tryFetch(`https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=5&format=json&namespace=0&origin=*`) as unknown[];
      if (Array.isArray(data) && data.length === 4 && Array.isArray(data[1])) {
        const titles = data[1] as string[];
        const descriptions = (data[2] as string[]) ?? [];
        const urls = (data[3] as string[]) ?? [];
        return { query: q, results: titles.map((title, i) => ({ title, snippet: descriptions[i] ?? "", url: urls[i] ?? "" })), upstream: "en.wikipedia.org (real)" };
      }
      return { query: q, results: [], upstream: "canned (Wikipedia unreachable)" };
    },
  },
  {
    id: "demo_echo",
    name: "Demo Echo (httpbin.org)",
    upstream: "httpbin.org",
    description: "Echoes your request via httpbin.org/anything. Returns headers, query, body. Useful to verify request shape.",
    example: { hello: "world" },
    handler: async (body) => {
      const data = await tryFetch(`https://httpbin.org/anything`, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (data) return { ...(data as object), upstream: "httpbin.org (real)" };
      return { receivedBody: body ?? null, timestamp: new Date().toISOString(), upstream: "canned (httpbin unreachable)" };
    },
  },
  {
    id: "demo_fx",
    name: "Demo FX rates (open.er-api.com)",
    upstream: "open.er-api.com",
    description: "Real USD-base FX rates (160+ currencies, daily). No body needed.",
    example: {},
    handler: async () => {
      const data = await tryFetch("https://open.er-api.com/v6/latest/USD") as any;
      if (data && data.rates) {
        return { base: data.base_code ?? "USD", rates: { JPY: data.rates.JPY, EUR: data.rates.EUR, GBP: data.rates.GBP, CNY: data.rates.CNY, KRW: data.rates.KRW }, asOf: data.time_last_update_utc ?? null, upstream: "open.er-api.com (real)" };
      }
      return { base: "USD", rates: { JPY: 150.42, EUR: 0.92, GBP: 0.79, CNY: 7.12 }, upstream: "canned (er-api unreachable)" };
    },
  },
  {
    id: "demo_translate",
    name: "Demo Translate (MyMemory)",
    upstream: "api.mymemory.translated.net",
    description: "Translate between 80+ languages. Body: { text, from, to } (ISO codes). Defaults en→ja.",
    example: { text: "Hello, world", from: "en", to: "ja" },
    handler: async (body) => {
      const text = (body?.text as string | undefined) ?? "Hello, world";
      const from = (body?.from as string | undefined) ?? "en";
      const to = (body?.to as string | undefined) ?? "ja";
      const data = await tryFetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`) as any;
      if (data?.responseData?.translatedText) {
        return { source: text, translated: data.responseData.translatedText, from, to, upstream: "api.mymemory.translated.net (real)" };
      }
      return { source: text, translated: `[demo] ${text} (${from}→${to})`, from, to, upstream: "canned (MyMemory unreachable)" };
    },
  },
  {
    id: "demo_weather",
    name: "Demo Weather (Open-Meteo)",
    upstream: "api.open-meteo.com",
    description: "Current weather for coordinates. Body: { latitude, longitude }. Defaults Tokyo.",
    example: { latitude: 35.6812, longitude: 139.7671 },
    handler: async (body) => {
      const lat = (body?.latitude as number | undefined) ?? 35.6812;
      const lon = (body?.longitude as number | undefined) ?? 139.7671;
      const data = await tryFetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`) as any;
      if (data?.current) {
        const codeMap: Record<number, string> = { 0: "clear", 1: "mostly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 51: "light drizzle", 61: "light rain", 63: "rain", 65: "heavy rain", 71: "light snow", 80: "showers", 95: "thunderstorm" };
        return { latitude: lat, longitude: lon, temperatureC: data.current.temperature_2m, humidityPct: data.current.relative_humidity_2m, windKmh: data.current.wind_speed_10m, condition: codeMap[data.current.weather_code] ?? `code-${data.current.weather_code}`, asOf: data.current.time, upstream: "api.open-meteo.com (real)" };
      }
      return { latitude: lat, longitude: lon, condition: "unknown", upstream: "canned (Open-Meteo unreachable)" };
    },
  },
  {
    id: "demo_geocode",
    name: "Demo Geocode (Nominatim/OSM)",
    upstream: "nominatim.openstreetmap.org",
    description: "Place name → lat/lon. Body: { q }. Pair with demo_weather for location→weather.",
    example: { q: "Shibuya, Tokyo" },
    handler: async (body) => {
      const q = (body?.q as string | undefined) ?? "Tokyo";
      const data = await tryFetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3`, { headers: { "User-Agent": "agent-payment-mcp/demo (https://lemoncake.xyz)" } }) as any[];
      if (Array.isArray(data) && data.length > 0) {
        return { query: q, results: data.slice(0, 3).map((r) => ({ displayName: r.display_name, latitude: Number(r.lat), longitude: Number(r.lon), type: r.type })), upstream: "nominatim.openstreetmap.org (real)" };
      }
      return { query: q, results: [], upstream: "canned (Nominatim unreachable)" };
    },
  },
  {
    id: "demo_time",
    name: "Demo World Time (worldtimeapi)",
    upstream: "worldtimeapi.org",
    description: "Current time + DST for any IANA timezone. Body: { timezone }.",
    example: { timezone: "Asia/Tokyo" },
    handler: async (body) => {
      const tz = (body?.timezone as string | undefined) ?? "Asia/Tokyo";
      const data = await tryFetch(`https://worldtimeapi.org/api/timezone/${encodeURIComponent(tz)}`) as any;
      if (data?.datetime) {
        return { timezone: data.timezone, datetime: data.datetime, utcOffset: data.utc_offset, isDst: data.dst, upstream: "worldtimeapi.org (real)" };
      }
      return { timezone: tz, datetime: new Date().toISOString(), upstream: "canned (worldtimeapi unreachable)" };
    },
  },
  {
    id: "demo_dictionary",
    name: "Demo Dictionary (dictionaryapi.dev)",
    upstream: "api.dictionaryapi.dev",
    description: "English definitions / synonyms / phonetics. Body: { word }.",
    example: { word: "ephemeral" },
    handler: async (body) => {
      const word = (body?.word as string | undefined) ?? "ephemeral";
      const data = await tryFetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`) as any[];
      if (Array.isArray(data) && data.length > 0) {
        const entry = data[0];
        return { word: entry.word, phonetic: entry.phonetic ?? entry.phonetics?.[0]?.text ?? null, meanings: (entry.meanings ?? []).slice(0, 3).map((m: any) => ({ partOfSpeech: m.partOfSpeech, definitions: (m.definitions ?? []).slice(0, 2).map((d: any) => ({ definition: d.definition, example: d.example ?? null })), synonyms: (m.synonyms ?? []).slice(0, 5) })), upstream: "api.dictionaryapi.dev (real)" };
      }
      return { word, meanings: [], upstream: "canned (dictionaryapi unreachable)" };
    },
  },
];

function findDemo(id: string) {
  return DEMO_SERVICES.find((s) => s.id === id);
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// ── Boot banner (shows in MCP client logs) ────────────────────────────────────

console.error("[LemonCake MCP] Starting...");
console.error(`[LemonCake MCP]   gateway   : ${GATEWAY}`);
console.error(`[LemonCake MCP]   pay token : ${HAS_TOKEN ? "✓ set" : "✗ not set"}`);
console.error(`[LemonCake MCP]   mode      : ${HAS_TOKEN ? "💳 PAID (Pay Token set)" : "🎮 DEMO (no signup; 8 free real-API tools)"}`);
if (DEMO_MODE) {
  console.error("[LemonCake MCP]");
  console.error("[LemonCake MCP]   🎮 Demo mode — try without any signup:");
  console.error("[LemonCake MCP]     • list_demos  → the 8 free tools");
  console.error("[LemonCake MCP]     • call_demo   → search / fx / translate / weather / geocode / time / dictionary / echo (real upstreams)");
  console.error(`[LemonCake MCP]   To call paid APIs: get a Pay Token →  ${APP_URL}`);
}
console.error(`[LemonCake MCP]   pricing (3,000 calls free, then 3%): ${PRICING_URL}`);

// ── Server ────────────────────────────────────────────────────────────────────

const SERVER_INSTRUCTIONS = DEMO_MODE
  ? [
      "🎮 DEMO MODE — no signup, no key, no charge.",
      "",
      "  • list_demos → the 8 free tools",
      "  • call_demo(service='demo_search', body={q:'...'}) → real Wikipedia search",
      "  • call_demo(service='demo_fx') → live FX rates",
      "",
      "To call a PAID API, set LC_PAY_TOKEN (a Pay Token JWT):",
      "  • Prepay at lemoncake.xyz/buy/<shortId> → token issued automatically, or",
      "  • Issue a Buyer Key at lemoncake.xyz/app + save a card at /agent/fund.",
      "Then use call_paid_api(shortId, body). Custody-free; you keep 97%, 3% only after 3,000 free calls.",
    ].join("\n")
  : [
      "💳 LemonCake MCP — Pay Token set. call_paid_api routes through the x402 gateway.",
      "",
      "  • call_paid_api(shortId, method?, body?) → calls /g/<shortId> with your Pay Token.",
      "  • On 402 the gateway returns accepts[] (buyUrl/mintUrl) so you can top up.",
      "  • list_demos / call_demo remain free for testing.",
    ].join("\n");

const server = new Server(
  { name: "lemon-cake-mcp", version: MCP_VERSION },
  { capabilities: { tools: {}, prompts: {}, logging: {} }, instructions: SERVER_INSTRUCTIONS },
);

// ── Tool definitions ──────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "setup",
      description: [
        "Show the first-run setup guide. No authentication required. Call this FIRST.",
        "",
        "Without LC_PAY_TOKEN the server is in DEMO MODE: list_demos + call_demo give 8 free",
        "real-API tools (search / fx / translate / weather / geocode / time / dictionary / echo).",
        "To call a paid API, get a Pay Token (prepay at /buy/<shortId>, or issue a Buyer Key at",
        "/app + save a card at /agent/fund) and set LC_PAY_TOKEN.",
        "",
        "Returns: { version, gateway, mode, payTokenSet, tools, howToGetToken, sampleConfig }",
      ].join("\n"),
      annotations: { title: "Setup guide", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "list_demos",
      description: [
        "List the 8 free demo tools. No authentication, no charge. Each hits a real free upstream.",
        "Use call_demo with the returned `id` to invoke one.",
        "Returns: array of { id, name, upstream, description, example }.",
      ].join("\n"),
      annotations: { title: "List free demo tools", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "call_demo",
      description: [
        "Run one of the 8 free demo tools (real upstreams, no charge, no auth).",
        "service must be one of: demo_search, demo_echo, demo_fx, demo_translate, demo_weather,",
        "demo_geocode, demo_time, demo_dictionary. Pass body per the tool's `example` (see list_demos).",
        "Returns: { service, response }.",
      ].join("\n"),
      annotations: { title: "Call a free demo tool", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["service"],
        additionalProperties: false,
        properties: {
          service: { type: "string", description: "Demo tool id (from list_demos).", minLength: 1 },
          body: { type: "object", description: "Request body for the demo tool (see its `example`).", additionalProperties: true },
        },
      },
    },
    {
      name: "call_paid_api",
      description: [
        "Call a paid API through the LemonCake x402 gateway using your Pay Token.",
        "Routes to https://<gateway>/g/<shortId> with Authorization: Bearer <LC_PAY_TOKEN>.",
        "The gateway verifies the token, meters the call, and forwards to the seller's API.",
        "",
        "PRECONDITIONS:",
        "  • LC_PAY_TOKEN must be set. Get one by prepaying at /buy/<shortId> (token issued",
        "    automatically), or issue a Buyer Key at /app and save a card at /agent/fund.",
        "  • shortId identifies the paid endpoint (the part after /g/ or /buy/).",
        "",
        "BEHAVIOR:",
        "  • 200 → { status, charge, response } (charge = USD debited from the prepaid token).",
        "  • 402 → { status: 402, error, accepts } — budget exhausted or token missing/expired.",
        "    accepts[] contains buyUrl (human) + mintUrl (machine) so the agent can top up.",
        "    Returned as a normal result (not thrown) so the agent can stop spending autonomously.",
        "  • This tool spends prepaid credit and contacts an external service (side effects).",
        "",
        "Returns: { status, charge?, response, accepts?, hint? }",
      ].join("\n"),
      annotations: { title: "Call a paid API (spends prepaid credit)", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      inputSchema: {
        type: "object",
        required: ["shortId"],
        additionalProperties: false,
        properties: {
          shortId: { type: "string", description: "Endpoint short id (the part after /g/ or /buy/).", minLength: 1 },
          method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"], description: "HTTP method. Defaults to POST.", default: "POST" },
          body: { type: "object", description: "JSON request body forwarded to the API (for POST/PUT/PATCH).", additionalProperties: true },
        },
      },
    },
  ],
}));

// ── Prompts ─────────────────────────────────────────────────────────────────

const PROMPTS = [
  {
    name: "explore-demo",
    title: "👉 START HERE — Try the demo (no signup, no key)",
    description: "[FREE · no auth] Walks through several of the 8 free demo tools (search, fx, translate, weather, geocode, time). Best first step to confirm the server works.",
    template: [
      "Use the LemonCake MCP server (agent-payment-mcp) in demo mode (no auth) to:",
      "1. Run `setup` to confirm demo mode.",
      "2. Run `list_demos`.",
      "3. call_demo(service='demo_search', body={q:'Model Context Protocol'}).",
      "4. call_demo(service='demo_fx') → report USD/JPY.",
      "5. call_demo(service='demo_geocode', body={q:'Akihabara, Tokyo'}) then call_demo(service='demo_weather', body={latitude:<lat>, longitude:<lon>}).",
      "Then in 2 sentences, explain what LemonCake adds: an x402 gateway so an agent pays per call with a hard-capped prepaid Pay Token.",
    ].join("\n"),
  },
  {
    name: "pay-with-token",
    title: "💳 Call a paid API with a Pay Token",
    description: "[REQUIRES LC_PAY_TOKEN — get one at lemoncake.xyz/app] Calls a paid endpoint through the gateway and handles the 402 top-up case.",
    arguments: [
      { name: "shortId", description: "Endpoint short id (after /g/ or /buy/)", required: true },
      { name: "query", description: "Optional request body field", required: false },
    ],
    template: (args: Record<string, string | undefined>) => [
      `Call the paid API shortId='${args.shortId ?? "<shortId>"}' via \`call_paid_api\`${args.query ? ` with body={\"q\":\"${args.query}\"}` : ""}.`,
      "Report the `charge` (USD debited) and the response.",
      "If you get status 402, read accepts[] and tell me the buyUrl to prepay or mintUrl to top up — do NOT keep retrying.",
    ].join("\n"),
  },
  {
    name: "monetize-your-api",
    title: "🏪 How to monetize your own API",
    description: "[INFO] Explains how a seller turns any HTTP API into a paid endpoint on LemonCake.",
    template: [
      "Explain, in 5 steps, how I monetize my own HTTP API with LemonCake:",
      "1. Sign in at lemoncake.xyz/app and click Add API (paste my URL, set a price per call).",
      "2. Get a gateway URL /g/<shortId> instantly — my tool code is unchanged.",
      "3. Share the buy link /buy/<shortId>; buyers prepay and get a Pay Token automatically.",
      "4. First 3,000 calls are free, then LemonCake takes 3% once at checkout (custody-free).",
      "5. Agents can call /g/<shortId> autonomously with a Pay Token, hard-capped.",
    ].join("\n"),
  },
] as const;

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: PROMPTS.map((p) => ({ name: p.name, title: p.title, description: p.description, arguments: "arguments" in p ? p.arguments : undefined })),
}));

server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const prompt = PROMPTS.find((p) => p.name === req.params.name);
  if (!prompt) throw new Error(`Unknown prompt: ${req.params.name}`);
  const args = (req.params.arguments ?? {}) as Record<string, string | undefined>;
  const text = typeof prompt.template === "function" ? prompt.template(args) : prompt.template;
  return { description: prompt.description, messages: [{ role: "user", content: { type: "text", text } }] };
});

// ── Tool implementations ──────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;

  try {
    switch (name) {
      case "setup": {
        return json({
          version: MCP_VERSION,
          gateway: GATEWAY,
          mode: HAS_TOKEN ? "paid" : "demo",
          payTokenSet: HAS_TOKEN,
          tools: {
            noAuth: ["setup", "list_demos", "call_demo (8 free tools)"],
            needPayToken: ["call_paid_api"],
          },
          demoTools: DEMO_SERVICES.map((d) => d.id),
          howToGetToken: HAS_TOKEN
            ? "✓ LC_PAY_TOKEN is set — call_paid_api is ready."
            : [
                "To call paid APIs, get a Pay Token (a JWT) one of two ways:",
                `  A) Prepay: open lemoncake.xyz/buy/<shortId>, pay by card → token issued automatically.`,
                `  B) Agent: issue a Buyer Key (bk_) at ${APP_URL} → save a card at ${FUND_URL} → mint a token.`,
                "Then set it in your MCP client config (env.LC_PAY_TOKEN) and restart.",
              ].join("\n"),
          sampleConfig: {
            mcpServers: {
              lemon: {
                command: "npx",
                args: ["-y", "agent-payment-mcp"],
                env: { LC_PAY_TOKEN: HAS_TOKEN ? "(set)" : "<paste a Pay Token JWT, or omit for demo mode>" },
              },
            },
          },
          links: { dashboard: APP_URL, fundAgent: FUND_URL, pricing: PRICING_URL, demo: DEMO_URL, docs: "https://github.com/evidai/agent-payment-mcp" },
        });
      }

      case "list_demos": {
        return json(DEMO_SERVICES.map((d) => ({ id: d.id, name: d.name, upstream: d.upstream, description: d.description, example: d.example })));
      }

      case "call_demo": {
        const service = args.service as string;
        const body = args.body as Record<string, unknown> | undefined;
        const demo = findDemo(service);
        if (!demo) {
          return json({ error: `Unknown demo tool: ${service}`, available: DEMO_SERVICES.map((d) => d.id), note: DEMO_NOTICE });
        }
        return json({ service, response: await demo.handler(body), note: DEMO_NOTICE });
      }

      case "call_paid_api": {
        const shortId = args.shortId as string;
        const method = (args.method as string | undefined) ?? "POST";
        const body = args.body as Record<string, unknown> | undefined;

        if (!HAS_TOKEN) {
          return {
            content: [{ type: "text" as const, text: JSON.stringify({
              error: "LC_PAY_TOKEN is not set. call_paid_api needs a Pay Token.",
              code: "PAY_TOKEN_MISSING",
              howToFix: [
                `A) Prepay at ${GATEWAY}/buy/${shortId} — a Pay Token is issued automatically on payment.`,
                `B) Issue a Buyer Key at ${APP_URL}, save a card at ${FUND_URL}, then mint a token.`,
                "Set the token as env.LC_PAY_TOKEN in your MCP client config and restart.",
              ],
              tip: "Try `call_demo` first to see how the tools work without any signup.",
            }, null, 2) }],
            isError: true,
          };
        }

        const url = `${GATEWAY}/g/${encodeURIComponent(shortId)}`;
        const headers: Record<string, string> = {
          "Authorization": `Bearer ${PAY_TOKEN}`,
          "Content-Type": "application/json",
          "User-Agent": USER_AGENT,
        };

        const timeoutRaw = parseInt(process.env.LC_CALL_TIMEOUT_MS ?? "30000", 10);
        const timeoutMs = Math.min(Math.max(isNaN(timeoutRaw) ? 30000 : timeoutRaw, 1000), 600000);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const opts: RequestInit = { method, headers, signal: controller.signal };
        if (body && ["POST", "PUT", "PATCH"].includes(method)) opts.body = JSON.stringify(body);

        let res: Response;
        try {
          res = await fetch(url, opts);
        } catch (err) {
          if ((err as { name?: string }).name === "AbortError") throw new Error(`Gateway call exceeded ${timeoutMs}ms timeout`);
          throw err;
        } finally {
          clearTimeout(timeoutId);
        }

        const charge = res.headers.get("x-lemoncake-charge");
        const ct = res.headers.get("content-type") ?? "";
        const responseBody = ct.includes("application/json") ? await res.json() : await res.text();

        const result: Record<string, unknown> = { status: res.status, charge, response: responseBody };

        if (res.status === 402) {
          // Gateway x402 challenge: { error, accepts:[{ pricePerCall, buyUrl, mintUrl }] }
          const b = responseBody as { error?: string; accepts?: unknown[] };
          result.error = b?.error ?? "payment_required";
          if (b?.accepts) result.accepts = b.accepts;
          else {
            const ch = parseX402Challenge(res.headers, responseBody);
            if (ch) result.x402Challenge = ch;
          }
          result.hint = "Budget exhausted or token missing/expired. Use accepts[].buyUrl (human) or accepts[].mintUrl (machine) to top up. Do NOT keep retrying without funding.";
          return json(result);
        }

        if (res.status >= 400) {
          let hint: string | undefined;
          if (res.status === 401) hint = "Pay Token invalid or revoked. Get a fresh one via the buy link or your dashboard.";
          else if (res.status === 404) hint = "Endpoint not found. Check the shortId.";
          else if (res.status === 409) hint = "Endpoint paused by the seller. Try later or pick another endpoint.";
          else if (res.status === 429) hint = "Rate limited. Back off and retry.";
          else if (res.status >= 500) hint = "Gateway or upstream error. Retry once, then escalate.";
          if (hint) result.hint = hint;
        }

        return json(result);
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text" as const, text: `Error: ${msg}` }], isError: true };
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[LemonCake MCP] Ready.");
  try {
    await server.notification({
      method: "notifications/message",
      params: {
        level: "info",
        logger: "agent-payment-mcp",
        data: DEMO_MODE
          ? "🎮 DEMO MODE — connected without credentials. Try the `explore-demo` prompt or call `setup`. No signup needed."
          : `LemonCake MCP v${MCP_VERSION} ready. call_paid_api routes through the x402 gateway with your Pay Token.`,
      },
    });
  } catch {
    /* older clients may reject notifications before initialize completes */
  }
}

main().catch((err) => {
  console.error("[LemonCake MCP] Fatal:", err);
  process.exit(1);
});
