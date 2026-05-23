/**
 * MCP / SDK / プラグイン経由のアクセスログ書き込み middleware
 *
 * 既存の `/api/telemetry/client-usage` が見ているのは Token.clientUserAgent
 * のみ → dashboard UI から発行されたトークンしか映らず、
 * `lemon-cake-mcp` / `eliza-plugin-lemoncake` 等の SDK が叩いた API
 * リクエストは観測できない問題があった。
 *
 * この middleware は、UA が既知の SDK family にマッチする場合だけ
 * `McpAccessLog` テーブルにレコードを fire-and-forget で書き込む。
 * 認証要否は問わない（list_services のような未認証エンドポイントも記録）。
 *
 * 既知 family（先頭マッチ）:
 *   - lemon-cake-mcp/X.Y.Z
 *   - eliza-plugin-lemoncake/X.Y.Z
 *   - create-lemon-agent/X.Y.Z
 *   - その他 `/^[a-z][a-z0-9-]+\/[\d.]+/` にマッチするもの全般
 *
 * Mozilla / Chrome / curl 等の汎用 UA は記録しない（既存 telemetry でカバー）。
 */

import type { MiddlewareHandler } from "hono";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";

// SHA-256 prefix 16 文字。生 IP は決して保存しない。
function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

function extractIp(c: { req: { header: (k: string) => string | undefined } }): string | null {
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return c.req.header("x-real-ip")
      ?? c.req.header("cf-connecting-ip")
      ?? null;
}

const SDK_FAMILY_REGEX = /^([a-z][a-z0-9-]+)\/([\d.]+)/i;
const KNOWN_FAMILIES = new Set([
  "pay-per-call-mcp",      // canonical MCP package (v0.5.0+)
  "lemon-cake-mcp",        // legacy alias / wrapper — still in use
  "eliza-plugin-lemoncake",
  "create-lemon-agent",
  "lemoncake-mcp",
  "lemoncake-sdk",
]);

function parseClient(ua: string | undefined | null): { family: string; version: string } | null {
  if (!ua) return null;
  // 1) X-LemonCake-Client / lemon-cake-mcp 等の SDK 型 UA
  const m = ua.match(SDK_FAMILY_REGEX);
  if (!m) return null;
  const family = m[1].toLowerCase();
  const version = m[2];
  // 既知 family にマッチするか、family 名に "lemon" or "mcp" or "lemoncake" を
  // 含むものを SDK と扱う（将来の community SDK にも対応）
  if (KNOWN_FAMILIES.has(family) || family.includes("lemon") || family.includes("mcp")) {
    return { family, version };
  }
  return null;
}

export const mcpAccessLog: MiddlewareHandler = async (c, next) => {
  await next();

  // レスポンス確定後にログ。例外は飲み込んで本流に影響させない。
  try {
    const ua = c.req.header("X-LemonCake-Client") ?? c.req.header("User-Agent");
    const parsed = parseClient(ua);
    if (!parsed) return;

    const path   = c.req.path;
    const method = c.req.method;
    const status = c.res.status;

    const ip = extractIp(c);
    const ipHash = ip ? hashIp(ip) : null;

    // fire-and-forget: 失敗してもリクエスト本流に影響しない
    prisma.mcpAccessLog
      .create({
        data: {
          path,
          method,
          family:    parsed.family,
          version:   parsed.version,
          status,
          userAgent: ua?.slice(0, 500) ?? null,
          ipHash,
        },
      })
      .catch((err: unknown) => {
        console.error("[mcpAccessLog] write failed:", err);
      });
  } catch (err) {
    console.error("[mcpAccessLog] middleware error:", err);
  }
};
