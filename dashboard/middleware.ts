/**
 * Edge middleware — 2 つの責務:
 *   (1) `/` を locale 検出して `/about` または `/about/en` に強制リダイレクト
 *   (2) `/about` を訪れた EN visitor を `/about/en` に振り分け
 *
 * Vercel `x-vercel-ip-country` ヘッダで IP geo を読む。
 * `lemon_locale` cookie で手動 override 可能（言語切替ボタンでセット）。
 *
 * 2026-05-28: 旧 buyer dashboard (`app/page.tsx`, 4,341 行) を撤去したため、
 *   `/` の auth check 分岐も削除。`/` は常に LP に流す。
 *   page.tsx 側にも redirect() stub を残してあるが、middleware で先に弾く。
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

  // ───── (1) `/` は常に LP にリダイレクト ─────
  if (pathname === "/") {
    const locale = detectLocale(req);
    const target = locale === "en" ? "/about/en" : "/about";
    return NextResponse.redirect(new URL(target, req.url));
  }

  // ───── (2) `/about` のロケール振り分け ─────
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
