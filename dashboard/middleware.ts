/**
 * Edge middleware — 2 つの責務を統合:
 *   (1) 未ログインユーザーを / → /about（or /about/en）に振り分け
 *   (2) IP geo + cookie で日本以外からの /about アクセスを /about/en に振り分け
 *
 * Vercel `x-vercel-ip-country` ヘッダで IP geo を読む。
 * `lemon_locale` cookie で手動 override 可能（言語切替ボタンでセット）。
 *
 * 自動振り分け対象（EN 翻訳が存在する LP のみ）:
 *   /about → /about/en
 * 除外:
 *   /api、/_next、/admin、/start/v2 (permit 署名フロー)
 *
 * 2026-05-28: dead /en/* prefix routes (/en/about /en/sellers /en/start) を
 *   全削除したため、middleware も /en/* prefix への振り分けをやめ、
 *   ネイティブ /about/en にだけ送るシンプルなロジックに切り替え。
 */

import { NextResponse, type NextRequest } from "next/server";

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

  // ───── (1) ダッシュボードの auth check ─────
  if (pathname === "/") {
    const authed = req.cookies.get("lc_auth");
    if (!authed) {
      const locale = detectLocale(req);
      const target = locale === "en" ? "/about/en" : "/about";
      return NextResponse.redirect(new URL(target, req.url));
    }
    return NextResponse.next();
  }

  // ───── (2) /about のロケール振り分け ─────
  // /about (exact) を訪れた EN ユーザーは /about/en に送る。
  // /about/en は触らない（EN ページ本体）。
  if (pathname === "/about") {
    const locale = detectLocale(req);
    if (locale === "en") {
      return NextResponse.redirect(new URL("/about/en", req.url), 307);
    }
  }

  return NextResponse.next();
}

export const config = {
  // 静的アセットは除外
  matcher: ["/((?!_next|favicon|logo|.*\\..*).*)"],
};
