/**
 * GET /api/telemetry/client-usage  — SDK/プラグイン利用状況の集計（管理者）
 *
 * `Token.clientUserAgent` に保存した User-Agent を集計して、
 * どのクライアント（eliza-plugin-lemoncake/x.y.z, lemon-cake-mcp/... 等）が
 * 何件の Pay Token を発行しているか返す。
 *
 * 個人特定情報は含まず、匿名のクライアント識別文字列と件数のみ。
 */

import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { prisma } from "../lib/prisma.js";
import { verifyAdminToken } from "../lib/jwt.js";

export const telemetryRouter = new OpenAPIHono();

// ─── スキーマ定義 ──────────────────────────────────────────
const ClientBucketSchema = z.object({
  client:        z.string().describe("User-Agent 文字列（例: eliza-plugin-lemoncake/0.2.0 (node/23.x; darwin arm64)）"),
  family:        z.string().describe("クライアント種別のみ抽出した識別子（例: eliza-plugin-lemoncake）"),
  version:       z.string().nullable().describe("抽出したバージョン（例: 0.2.0）"),
  tokenCount:    z.number().int().describe("発行された Pay Token 数"),
  chargeCount:   z.number().int().describe("そのクライアント経由の課金件数"),
  totalUsdc:     z.string().describe("そのクライアント経由の課金総額（USDC）"),
  buyerCount:    z.number().int().describe("ユニークなバイヤー数"),
  firstSeen:     z.string().describe("初回トークン発行日時"),
  lastSeen:      z.string().describe("最新トークン発行日時"),
});

const UsageResponseSchema = z.object({
  windowDays:    z.number().describe("集計対象の日数"),
  generatedAt:   z.string(),
  totals: z.object({
    identifiedTokens:   z.number().int(),
    unidentifiedTokens: z.number().int().describe("User-Agent を持たない古い/直接呼び出しのトークン数"),
    totalClients:       z.number().int(),
  }),
  clients: z.array(ClientBucketSchema),
});

const ErrorSchema = z.object({ error: z.string() });

// ─── ルート ───────────────────────────────────────────────
const route = createRoute({
  method: "get",
  path:   "/client-usage",
  tags:   ["Telemetry"],
  summary: "SDK/プラグイン利用状況の集計",
  description:
    "`Token.clientUserAgent` を集計し、クライアント種別ごとに発行トークン数・課金件数・" +
    "ユニークバイヤー数を返す。管理者JWT が必要。",
  request: {
    query: z.object({
      days: z.coerce.number().int().min(1).max(365).default(30),
    }),
  },
  responses: {
    200: { description: "OK",           content: { "application/json": { schema: UsageResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
});

// ─── UA 文字列から family / version を抽出 ──────────────────
function parseClient(ua: string): { family: string; version: string | null } {
  // `eliza-plugin-lemoncake/0.2.0 (node/23.x; darwin arm64)` のような形式を想定
  const m = ua.match(/^([^/\s]+)\/([^\s]+)/);
  if (m) return { family: m[1], version: m[2] };
  // 想定外の文字列は family=ua 全体 で 128 文字に丸める
  return { family: ua.slice(0, 40), version: null };
}

telemetryRouter.openapi(route, async (c) => {
  // ── 管理者 JWT 認証 ─────────────────────────────────────
  const auth = c.req.header("Authorization");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(await verifyAdminToken(auth.slice(7)))) return c.json({ error: "Invalid token" }, 401) as any;

  const { days } = c.req.valid("query");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // ── Token を全件取得（件数が膨大になったら groupBy に切替）──
  const tokens = await prisma.token.findMany({
    where: { createdAt: { gte: since } },
    select: {
      id:              true,
      buyerId:         true,
      clientUserAgent: true,
      createdAt:       true,
    },
  });

  const identified = tokens.filter(t => t.clientUserAgent !== null);
  const unidentifiedCount = tokens.length - identified.length;

  // ── Charge を集計（Token.id → aggregates） ────────────────
  const tokenIds = identified.map(t => t.id);
  const chargeRows = tokenIds.length === 0 ? [] : await prisma.charge.findMany({
    where:  { tokenId: { in: tokenIds }, status: "COMPLETED" },
    select: { tokenId: true, amountUsdc: true },
  });
  const chargeByToken = new Map<string, { count: number; sumUsdc: number }>();
  for (const row of chargeRows) {
    const entry = chargeByToken.get(row.tokenId) ?? { count: 0, sumUsdc: 0 };
    entry.count += 1;
    entry.sumUsdc += Number(row.amountUsdc);
    chargeByToken.set(row.tokenId, entry);
  }

  // ── クライアント別バケット ────────────────────────────────
  type Bucket = {
    client:      string;
    family:      string;
    version:     string | null;
    tokenCount:  number;
    chargeCount: number;
    totalUsdc:   number;
    buyers:      Set<string>;
    firstSeen:   Date;
    lastSeen:    Date;
  };
  const buckets = new Map<string, Bucket>();

  for (const t of identified) {
    const ua = t.clientUserAgent!;
    const parsed = parseClient(ua);
    let b = buckets.get(ua);
    if (!b) {
      b = {
        client:      ua,
        family:      parsed.family,
        version:     parsed.version,
        tokenCount:  0,
        chargeCount: 0,
        totalUsdc:   0,
        buyers:      new Set(),
        firstSeen:   t.createdAt,
        lastSeen:    t.createdAt,
      };
      buckets.set(ua, b);
    }
    b.tokenCount += 1;
    b.buyers.add(t.buyerId);
    if (t.createdAt < b.firstSeen) b.firstSeen = t.createdAt;
    if (t.createdAt > b.lastSeen)  b.lastSeen  = t.createdAt;

    const agg = chargeByToken.get(t.id);
    if (agg) {
      b.chargeCount += agg.count;
      b.totalUsdc   += agg.sumUsdc;
    }
  }

  const clients = Array.from(buckets.values())
    .sort((a, b) => b.tokenCount - a.tokenCount)
    .map(b => ({
      client:       b.client,
      family:       b.family,
      version:      b.version,
      tokenCount:   b.tokenCount,
      chargeCount:  b.chargeCount,
      totalUsdc:    b.totalUsdc.toFixed(6),
      buyerCount:   b.buyers.size,
      firstSeen:    b.firstSeen.toISOString(),
      lastSeen:     b.lastSeen.toISOString(),
    }));

  return c.json({
    windowDays:  days,
    generatedAt: new Date().toISOString(),
    totals: {
      identifiedTokens:   identified.length,
      unidentifiedTokens: unidentifiedCount,
      totalClients:       clients.length,
    },
    clients,
  });
});

// ─── GET /api/telemetry/mcp-access ──────────────────────────
// SDK/MCP family の API リクエスト集計（McpAccessLog ベース）
// 既存の client-usage は Token 発行ベース（dashboard 経由のみ映る）
// だが、こちらは「実際に lemon-cake-mcp / プラグインから API が
// 叩かれた回数」を family × version × path × status で集計する。

const McpFamilyBucketSchema = z.object({
  family:        z.string(),
  version:       z.string(),
  totalRequests: z.number().int(),
  uniqueDays:    z.number().int().describe("リクエストのあった日数"),
  paths: z.array(z.object({
    path:   z.string(),
    method: z.string(),
    count:  z.number().int(),
    status2xx: z.number().int(),
    status4xx: z.number().int(),
    status5xx: z.number().int(),
  })),
  firstSeen: z.string(),
  lastSeen:  z.string(),
});

const McpAccessResponseSchema = z.object({
  windowDays:  z.number(),
  generatedAt: z.string(),
  totals: z.object({
    totalRequests: z.number().int(),
    uniqueFamilies: z.number().int(),
    uniqueVersions: z.number().int(),
  }),
  families: z.array(McpFamilyBucketSchema),
});

const mcpAccessRoute = createRoute({
  method: "get",
  path:   "/mcp-access",
  tags:   ["Telemetry"],
  summary: "MCP / SDK family のアクセス集計",
  description:
    "McpAccessLog テーブルを集計して、family × version 単位でリクエスト数・" +
    "成功/失敗内訳・主要 path を返す。管理者JWT が必要。",
  request: {
    query: z.object({
      days: z.coerce.number().int().min(1).max(90).default(30),
    }),
  },
  responses: {
    200: { description: "OK",           content: { "application/json": { schema: McpAccessResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
});

telemetryRouter.openapi(mcpAccessRoute, async (c) => {
  const auth = c.req.header("Authorization");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(await verifyAdminToken(auth.slice(7)))) return c.json({ error: "Invalid token" }, 401) as any;

  const { days } = c.req.valid("query");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const logs = await prisma.mcpAccessLog.findMany({
    where: { createdAt: { gte: since } },
    select: {
      family:    true,
      version:   true,
      path:      true,
      method:    true,
      status:    true,
      createdAt: true,
    },
  });

  type FamilyKey = string; // `${family}@${version}`
  type PathKey   = string; // `${method} ${path}`
  type FamilyAgg = {
    family: string;
    version: string;
    totalRequests: number;
    days: Set<string>;
    paths: Map<PathKey, { path: string; method: string; count: number; s2: number; s4: number; s5: number }>;
    firstSeen: Date;
    lastSeen:  Date;
  };

  const byFamily = new Map<FamilyKey, FamilyAgg>();
  for (const l of logs) {
    const key: FamilyKey = `${l.family}@${l.version}`;
    let f = byFamily.get(key);
    if (!f) {
      f = {
        family:        l.family,
        version:       l.version,
        totalRequests: 0,
        days:          new Set<string>(),
        paths:         new Map(),
        firstSeen:     l.createdAt,
        lastSeen:      l.createdAt,
      };
      byFamily.set(key, f);
    }
    f.totalRequests += 1;
    f.days.add(l.createdAt.toISOString().slice(0, 10));
    if (l.createdAt < f.firstSeen) f.firstSeen = l.createdAt;
    if (l.createdAt > f.lastSeen)  f.lastSeen  = l.createdAt;

    // Normalize dynamic path segments (proxy/<serviceId>/<rest>) into a single bucket
    const normalizedPath = l.path.replace(/^\/api\/proxy\/[^/]+/, "/api/proxy/:serviceId");
    const pkey: PathKey = `${l.method} ${normalizedPath}`;
    let p = f.paths.get(pkey);
    if (!p) {
      p = { path: normalizedPath, method: l.method, count: 0, s2: 0, s4: 0, s5: 0 };
      f.paths.set(pkey, p);
    }
    p.count += 1;
    if (l.status >= 200 && l.status < 300) p.s2 += 1;
    else if (l.status >= 400 && l.status < 500) p.s4 += 1;
    else if (l.status >= 500) p.s5 += 1;
  }

  const families = Array.from(byFamily.values())
    .sort((a, b) => b.totalRequests - a.totalRequests)
    .map(f => ({
      family:        f.family,
      version:       f.version,
      totalRequests: f.totalRequests,
      uniqueDays:    f.days.size,
      paths: Array.from(f.paths.values())
        .sort((a, b) => b.count - a.count)
        .map(p => ({ path: p.path, method: p.method, count: p.count, status2xx: p.s2, status4xx: p.s4, status5xx: p.s5 })),
      firstSeen: f.firstSeen.toISOString(),
      lastSeen:  f.lastSeen.toISOString(),
    }));

  const uniqueFamilies = new Set(families.map(f => f.family));
  const uniqueVersions = new Set(families.map(f => `${f.family}@${f.version}`));

  return c.json({
    windowDays:  days,
    generatedAt: new Date().toISOString(),
    totals: {
      totalRequests:  logs.length,
      uniqueFamilies: uniqueFamilies.size,
      uniqueVersions: uniqueVersions.size,
    },
    families,
  });
});

// ─── POST /api/telemetry/playground ────────────────────────
// /start LP の playground widget が Run のたびに fire-and-forget で叩く。
// 認証なし（だれでもアクセスできる LP からの呼び出しなので）。
const playgroundLogRoute = createRoute({
  method: "post",
  path:   "/playground",
  tags:   ["Telemetry"],
  summary: "Record one /start LP playground click (public, no auth)",
  description:
    "/start ページの DemoPlayground widget から fire-and-forget で送られる利用ログ。" +
    "PII を含まず、サービス ID + クエリの先頭 60 文字 + ハッシュ + レイテンシのみ。",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            serviceId:    z.string().max(40),
            queryHash:    z.string().max(64).optional(),
            queryPreview: z.string().max(60).optional(),
            latencyMs:    z.number().int().min(0).max(60000),
            status:       z.number().int().optional(),
          }),
        },
      },
    },
  },
  responses: {
    204: { description: "Logged (no body)" },
    400: { description: "Bad request", content: { "application/json": { schema: ErrorSchema } } },
  },
});

telemetryRouter.openapi(playgroundLogRoute, async (c) => {
  const body = c.req.valid("json");

  // simple IP bucket: hash of x-forwarded-for + UA so ipHash collides
  // only for the same visitor making repeated runs
  const ipRaw = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? "";
  const ua = c.req.header("user-agent") ?? "";
  const ipHash = ipRaw ? await sha256Prefix(`${ipRaw}|${ua}`, 16) : null;

  await prisma.playgroundLog.create({
    data: {
      serviceId:    body.serviceId,
      queryHash:    body.queryHash ?? null,
      queryPreview: body.queryPreview ?? null,
      latencyMs:    body.latencyMs,
      status:       body.status ?? 200,
      ipHash,
      userAgent:    ua.slice(0, 500) || null,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.body(null, 204) as any;
});

// ─── GET /api/telemetry/playground ─────────────────────────
// admin/telemetry ダッシュボード用の集計エンドポイント。
const PlaygroundAggSchema = z.object({
  windowDays:  z.number(),
  generatedAt: z.string(),
  totals: z.object({
    totalRuns:       z.number().int(),
    uniqueVisitors:  z.number().int(),
    avgLatencyMs:    z.number().int(),
  }),
  byService: z.array(z.object({
    serviceId:    z.string(),
    runs:         z.number().int(),
    pct:          z.number(),
    avgLatencyMs: z.number().int(),
  })),
  topQueries: z.array(z.object({
    serviceId:    z.string(),
    queryPreview: z.string(),
    runs:         z.number().int(),
  })),
});

const playgroundAggRoute = createRoute({
  method: "get",
  path:   "/playground",
  tags:   ["Telemetry"],
  summary: "/start playground click aggregation (admin only)",
  request: {
    query: z.object({
      days: z.coerce.number().int().min(1).max(365).default(30),
    }),
  },
  responses: {
    200: { description: "OK",           content: { "application/json": { schema: PlaygroundAggSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
});

telemetryRouter.openapi(playgroundAggRoute, async (c) => {
  const auth = c.req.header("Authorization");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!auth?.startsWith("Bearer "))                             return c.json({ error: "Unauthorized" }, 401) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(await verifyAdminToken(auth.slice(7))))                 return c.json({ error: "Invalid token" }, 401) as any;

  const { days } = c.req.valid("query");
  const since = new Date(Date.now() - days * 86400_000);

  const logs = await prisma.playgroundLog.findMany({
    where:   { createdAt: { gte: since } },
    select:  { serviceId: true, queryPreview: true, latencyMs: true, ipHash: true },
    orderBy: { createdAt: "desc" },
    take:    20000,
  });

  const total = logs.length;
  const unique = new Set(logs.map(l => l.ipHash).filter(Boolean)).size;
  const avgLatency = total ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / total) : 0;

  const byServiceMap = new Map<string, { runs: number; latencySum: number }>();
  for (const l of logs) {
    const cur = byServiceMap.get(l.serviceId) ?? { runs: 0, latencySum: 0 };
    cur.runs        += 1;
    cur.latencySum  += l.latencyMs;
    byServiceMap.set(l.serviceId, cur);
  }
  const byService = Array.from(byServiceMap.entries())
    .map(([serviceId, v]) => ({
      serviceId,
      runs:         v.runs,
      pct:          total ? Math.round((v.runs / total) * 1000) / 10 : 0,
      avgLatencyMs: Math.round(v.latencySum / v.runs),
    }))
    .sort((a, b) => b.runs - a.runs);

  const queryMap = new Map<string, { runs: number }>();
  for (const l of logs) {
    if (!l.queryPreview) continue;
    const key = `${l.serviceId}|${l.queryPreview}`;
    const cur = queryMap.get(key) ?? { runs: 0 };
    cur.runs += 1;
    queryMap.set(key, cur);
  }
  const topQueries = Array.from(queryMap.entries())
    .map(([key, v]) => {
      const idx = key.indexOf("|");
      return { serviceId: key.slice(0, idx), queryPreview: key.slice(idx + 1), runs: v.runs };
    })
    .sort((a, b) => b.runs - a.runs)
    .slice(0, 10);

  return c.json({
    windowDays:  days,
    generatedAt: new Date().toISOString(),
    totals: {
      totalRuns:      total,
      uniqueVisitors: unique,
      avgLatencyMs:   avgLatency,
    },
    byService,
    topQueries,
  });
});

// helper: SHA-256 prefix (hex). Web Crypto, runs in both node and edge.
async function sha256Prefix(input: string, len: number): Promise<string> {
  const buf  = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .slice(0, len / 2)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─────────────────────────────────────────────────────────────
// GET /api/telemetry/funnel
//
// 自前ファネル可視化用集計。GA4 に依存せず、DB のグラウンドトゥルース
// だけで Buyer/Seller の conversion funnel を返す。
// ─────────────────────────────────────────────────────────────
const FunnelDailySchema = z.object({
  date:                  z.string(),  // "YYYY-MM-DD"
  lpDemoRuns:            z.number().int(),
  lpUniqueVisitors:      z.number().int(),
  providersRegistered:   z.number().int(),
  subscriptionsCreated:  z.number().int(),
  permitChargesCount:    z.number().int(),
});

const FunnelTotalsSchema = z.object({
  lpDemoRuns:           z.number().int(),
  lpUniqueVisitors:     z.number().int(),
  providersRegistered:  z.number().int(),
  subscriptionsCreated: z.number().int(),
  permitChargesCount:   z.number().int(),
  permitChargesUsdc:    z.string(),
});

const FunnelResponseSchema = z.object({
  windowDays:  z.number(),
  generatedAt: z.string(),
  totals:      FunnelTotalsSchema,
  byPlan: z.array(z.object({
    plan:  z.string(),
    count: z.number().int(),
  })),
  daily: z.array(FunnelDailySchema),
  rates: z.object({
    visitorToProvider:    z.number(),  // providersRegistered / lpUniqueVisitors
    providerToSubscriber: z.number(),  // subscriptionsCreated / providersRegistered
    providerToCharger:    z.number(),  // distinct charge senders / providersRegistered
  }),
});

const funnelRoute = createRoute({
  method:  "get",
  path:    "/funnel",
  tags:    ["Telemetry"],
  summary: "Conversion funnel from DB ground truth (admin only)",
  description:
    "LP demo runs → Providers registered → Subscriptions upgraded → PermitCharges, 日次集計と全期間合計、conversion rates を返す。",
  request: {
    query: z.object({
      days: z.coerce.number().int().min(1).max(365).default(30),
    }),
  },
  responses: {
    200: { description: "OK",           content: { "application/json": { schema: FunnelResponseSchema } } },
    401: { description: "Unauthorized", content: { "application/json": { schema: ErrorSchema } } },
  },
});

telemetryRouter.openapi(funnelRoute, async (c) => {
  const auth = c.req.header("Authorization");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!auth?.startsWith("Bearer "))             return c.json({ error: "Unauthorized" }, 401) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(await verifyAdminToken(auth.slice(7)))) return c.json({ error: "Invalid token" }, 401) as any;

  const { days } = c.req.valid("query");
  const since = new Date(Date.now() - days * 86400_000);

  const [playLogs, providers, subscriptions, charges] = await Promise.all([
    prisma.playgroundLog.findMany({
      where:  { createdAt: { gte: since } },
      select: { createdAt: true, ipHash: true },
    }),
    prisma.providerV2.findMany({
      where:  { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.subscription.findMany({
      where:  { createdAt: { gte: since }, plan: { not: "FREE" } },
      select: { createdAt: true, plan: true },
    }),
    prisma.permitCharge.findMany({
      where:  { createdAt: { gte: since }, status: "COMPLETED" },
      select: { createdAt: true, amountUsdc: true, ownerAddress: true },
    }),
  ]);

  // ── daily buckets ──
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const daily = new Map<string, {
    lpDemoRuns:           number;
    lpVisitors:           Set<string>;
    providersRegistered:  number;
    subscriptionsCreated: number;
    permitChargesCount:   number;
  }>();
  const bucket = (k: string) => {
    let b = daily.get(k);
    if (!b) {
      b = { lpDemoRuns: 0, lpVisitors: new Set(), providersRegistered: 0, subscriptionsCreated: 0, permitChargesCount: 0 };
      daily.set(k, b);
    }
    return b;
  };

  for (const l of playLogs) {
    const b = bucket(dayKey(l.createdAt));
    b.lpDemoRuns += 1;
    if (l.ipHash) b.lpVisitors.add(l.ipHash);
  }
  for (const p of providers)     bucket(dayKey(p.createdAt)).providersRegistered  += 1;
  for (const s of subscriptions) bucket(dayKey(s.createdAt)).subscriptionsCreated += 1;
  for (const c of charges)       bucket(dayKey(c.createdAt)).permitChargesCount   += 1;

  const dailyArr = Array.from(daily.entries())
    .map(([date, v]) => ({
      date,
      lpDemoRuns:           v.lpDemoRuns,
      lpUniqueVisitors:     v.lpVisitors.size,
      providersRegistered:  v.providersRegistered,
      subscriptionsCreated: v.subscriptionsCreated,
      permitChargesCount:   v.permitChargesCount,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── totals ──
  const allVisitors = new Set(playLogs.map(l => l.ipHash).filter(Boolean) as string[]);
  const usdcSum = charges
    .reduce((s, c) => s + Number(c.amountUsdc), 0)
    .toFixed(6);
  const distinctChargers = new Set(charges.map(c => c.ownerAddress.toLowerCase())).size;

  const totals = {
    lpDemoRuns:           playLogs.length,
    lpUniqueVisitors:     allVisitors.size,
    providersRegistered:  providers.length,
    subscriptionsCreated: subscriptions.length,
    permitChargesCount:   charges.length,
    permitChargesUsdc:    usdcSum,
  };

  // ── byPlan ──
  const planMap = new Map<string, number>();
  for (const s of subscriptions) planMap.set(s.plan, (planMap.get(s.plan) ?? 0) + 1);
  const byPlan = Array.from(planMap.entries())
    .map(([plan, count]) => ({ plan, count }))
    .sort((a, b) => b.count - a.count);

  // ── rates (NaN → 0) ──
  const safeRate = (num: number, den: number) => den > 0 ? Math.round((num / den) * 10000) / 10000 : 0;
  const rates = {
    visitorToProvider:    safeRate(providers.length, allVisitors.size),
    providerToSubscriber: safeRate(subscriptions.length, providers.length),
    providerToCharger:    safeRate(distinctChargers, providers.length),
  };

  return c.json({
    windowDays:  days,
    generatedAt: new Date().toISOString(),
    totals,
    byPlan,
    daily: dailyArr,
    rates,
  });
});

// ─── GET /api/telemetry/glance ─────────────────────────────────
// 「ぱっと見」用に集計を1つにまとめる。/admin/telemetry のヒーロー
// セクション専用。Self-IP（管理者の IP hash）を渡すと、self / external
// を分離して返す。

const GlanceQuerySchema = z.object({
  selfIp: z.string().optional().describe("除外したい IP の hash（管理者自身）"),
});

const GlanceResponseSchema = z.object({
  signal: z.enum(["NO_TRAFFIC", "SELF_ONLY", "EXTERNAL_SEEN", "EXTERNAL_ACTIVE"]),
  weeklyCalls: z.number(),
  weeklyExternalCalls: z.number(),
  weeklySelfCalls: z.number(),
  weeklyExternalIps: z.number(),
  weeklyVsLastWeek: z.number().describe("week-over-week ratio (1.0 = same)"),
  topPaths: z.array(z.object({ path: z.string(), count: z.number() })),
  yourIpHash: z.string().nullable().describe("呼び出し元 IP の hash（このまま selfIp に保存）"),
  message: z.string(),
});

telemetryRouter.openapi(
  createRoute({
    method:  "get",
    path:    "/glance",
    tags:    ["Telemetry"],
    summary: "1 つの API で全グランス KPI を返す（admin dashboard 用）",
    request: { query: GlanceQuerySchema },
    responses: {
      200: { content: { "application/json": { schema: GlanceResponseSchema } }, description: "Glance" },
      401: { content: { "application/json": { schema: z.object({ error: z.string() }) } }, description: "Unauthorized" },
    },
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (c: any) => {
    const auth = c.req.header("Authorization");
    if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);
    if (!(await verifyAdminToken(auth.slice(7)))) return c.json({ error: "Invalid token" }, 401);

    const { selfIp } = c.req.valid("query");
    const now = new Date();
    const weekAgo  = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeks = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 呼び出し元 IP（管理者が自分の IP hash を確認できるように）
    const xff = c.req.header("x-forwarded-for");
    const clientIp = xff ? xff.split(",")[0]!.trim()
      : (c.req.header("x-real-ip") ?? c.req.header("cf-connecting-ip") ?? null);
    const crypto = await import("node:crypto");
    const yourIpHash = clientIp
      ? crypto.createHash("sha256").update(clientIp).digest("hex").slice(0, 16)
      : null;

    // 過去 7 日 + 過去 14 日 のログを 1 回でフェッチ
    const logs = await prisma.mcpAccessLog.findMany({
      where: { createdAt: { gte: twoWeeks } },
      select: { ipHash: true, path: true, createdAt: true },
    });

    const thisWeek = logs.filter((l) => l.createdAt >= weekAgo);
    const lastWeek = logs.filter((l) => l.createdAt <  weekAgo);

    const isSelf = (h: string | null) => selfIp ? h === selfIp : false;

    const weeklyCalls = thisWeek.length;
    const weeklySelfCalls = thisWeek.filter((l) => isSelf(l.ipHash)).length;
    const weeklyExternalCalls = weeklyCalls - weeklySelfCalls;
    const weeklyExternalIps = new Set(
      thisWeek.filter((l) => l.ipHash && !isSelf(l.ipHash)).map((l) => l.ipHash),
    ).size;

    const lastWeekCount = lastWeek.length || 0.001;
    const weeklyVsLastWeek = Math.round((weeklyCalls / lastWeekCount) * 100) / 100;

    // 直近 7 日の top paths
    const pathCounts = new Map<string, number>();
    for (const l of thisWeek) {
      pathCounts.set(l.path, (pathCounts.get(l.path) ?? 0) + 1);
    }
    const topPaths = [...pathCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([path, count]) => ({ path, count }));

    let signal: "NO_TRAFFIC" | "SELF_ONLY" | "EXTERNAL_SEEN" | "EXTERNAL_ACTIVE";
    let message: string;
    if (weeklyCalls === 0) {
      signal = "NO_TRAFFIC";
      message = "🔴 今週まだ API call なし。Glama / npm DL があってもサーバー呼び出しまで到達してない。";
    } else if (weeklyExternalCalls === 0) {
      signal = "SELF_ONLY";
      message = "🟡 今週の call は全部あなたの IP から。実ユーザーはまだ。";
    } else if (weeklyExternalCalls < 10) {
      signal = "EXTERNAL_SEEN";
      message = `🟢 外部 IP から ${weeklyExternalCalls} call 検知。実利用が始まりつつある。`;
    } else {
      signal = "EXTERNAL_ACTIVE";
      message = `🚀 外部 IP × ${weeklyExternalIps} から週 ${weeklyExternalCalls} call。実利用継続中。`;
    }

    return c.json({
      signal,
      weeklyCalls,
      weeklyExternalCalls,
      weeklySelfCalls,
      weeklyExternalIps,
      weeklyVsLastWeek,
      topPaths,
      yourIpHash,
      message,
    });
  },
);

