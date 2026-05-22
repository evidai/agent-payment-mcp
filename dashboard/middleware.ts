/**
 * Edge middleware — 2 つの責務を統合:
 *   (1) 未ログインユーザーを / → /about（or /en/about）に振り分け
 *   (2) IP geo + cookie で日本以外からの LP アクセスを /en/* に振り分け
 *
 * Vercel `x-vercel-ip-country` ヘッダで IP geo を読む。
 * `lemon_locale` cookie で手動 override 可能（言語切替ボタンでセット）。
 *
 * 自動振り分け対象（LP 系のみ）:
 *   /, /start, /sellers, /about, /security, /privacy, /legal/*
 * 除外（locale 関係なく動かす）:
 *   /start/v2 (permit 署名)、/api、/_next、/admin、/founder
 */

import { NextResponse, type NextRequest } from "next/server";

// Locale redirect 対象は LP 系のみ。security / privacy / legal は両言語ユーザーに
// 同じ JP コンテンツを見せる（英訳コストに対して閲覧が少ない）。
const LOCALIZED_PREFIXES = ["/start", "/sellers", "/about"];

function detectLocale(req: NextRequest): "ja" | "en" {
  // 1. cookie で明示されてれば最優先
  const cookieLocale = req.cookies.get("lemon_locale")?.value;
  if (cookieLocale === "ja") return "ja";
  if (cookieLocale === "en") return "en";

  // 2. Vercel Geo ヘッダ（未設定 = local dev → 日本語）
  const country = req.headers.get("x-vercel-ip-country");
  if (!country) return "ja";

  return country === "JP" ? "ja" : "en";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 既に locale prefix が付いてれば触らない
  if (pathname.startsWith("/en/") || pathname.startsWith("/ja/")) {
    return NextResponse.next();
  }

  // ───── (1) ダッシュボードの auth check（既存ロジック維持） ─────
  if (pathname === "/") {
    const authed = req.cookies.get("lc_auth");
    if (!authed) {
      const locale = detectLocale(req);
      const target = locale === "en" ? "/en/about" : "/about";
      return NextResponse.redirect(new URL(target, req.url));
    }
    return NextResponse.next();
  }

  // ───── (2) LP 系のみ locale 振り分け ─────
  const isLP = LOCALIZED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isLP) return NextResponse.next();

  // /start/v2 は除外（permit 署名フロー、locale 関係なく動く必要あり）
  if (pathname.startsWith("/start/v2")) return NextResponse.next();

  const locale = detectLocale(req);
  if (locale === "en") {
    const url = req.nextUrl.clone();
    url.pathname = `/en${url.pathname}`;
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

export const config = {
  // 静的アセットは除外
  matcher: ["/((?!_next|favicon|logo|.*\\..*).*)"],
};
