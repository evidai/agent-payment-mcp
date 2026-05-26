"use client";

/**
 * PageviewPing — 全 public ページから fire-and-forget で pageview を送信
 *
 * layout.tsx に <PageviewPing/> として 1 度マウントすれば、
 * pathname が変わるたびに /api/telemetry/pageview を叩く。
 *
 * 設計方針:
 *   - 重複送信防止: 同一 pathname は 1 sessionStorage 期間に 1 回だけ
 *   - 除外パス: /admin/* /api/* /_next/* （ダッシュボード内 nav）
 *   - referrer は document.referrer（外部からの流入のみ意味あり、
 *     internal navigation だと前 LP path になるので取り扱い注意）
 *   - utm_*: URL から抽出
 *   - 失敗しても黙る（user 体験ゼロ影響）
 *
 * バックエンド側で bot 判定（User-Agent）+ 国コード（x-vercel-ip-country）+
 * ipHash を付与するので、client はメタデータの最小限だけ送る。
 */

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://skillful-blessing-production.up.railway.app";

// /admin は内部ツール、/api と /_next は API/静的アセット。
// 計測対象は LP / docs / Buyer dashboard / Seller wizard など public 系のみ。
const EXCLUDED_PREFIXES = ["/admin", "/api", "/_next"];

function shouldTrack(pathname: string): boolean {
  return !EXCLUDED_PREFIXES.some(p => pathname.startsWith(p));
}

// session 内重複送信回避（同一 path への back/forward / 再 mount 等）
function alreadyPingedThisSession(key: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const seen = sessionStorage.getItem(`lemon_pv_${key}`);
    if (seen) return true;
    sessionStorage.setItem(`lemon_pv_${key}`, "1");
    return false;
  } catch {
    return false;  // sessionStorage 不可 → 常に送る
  }
}

export function PageviewPing() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname || !shouldTrack(pathname)) return;

    // utm_source + path 単位で重複制御（同じ campaign で同じ path は 1 回）
    const utmSource = searchParams?.get("utm_source") ?? "";
    const dedupeKey = `${pathname}|${utmSource}`;
    if (alreadyPingedThisSession(dedupeKey)) return;

    const body = {
      path:        pathname,
      referrer:    typeof document !== "undefined" ? (document.referrer || undefined) : undefined,
      utmSource:   searchParams?.get("utm_source")   ?? undefined,
      utmMedium:   searchParams?.get("utm_medium")   ?? undefined,
      utmCampaign: searchParams?.get("utm_campaign") ?? undefined,
    };

    // fire-and-forget. navigator.sendBeacon が使えれば確実に届く
    // （ページ離脱直後でも送信完了）が、Railway endpoint が POST JSON 期待
    // なので fetch keepalive で代替。
    try {
      fetch(`${API_URL}/api/telemetry/pageview`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
        keepalive: true,
      }).catch(() => { /* 失敗しても何もしない */ });
    } catch {
      /* network unavailable - silent */
    }
  }, [pathname, searchParams]);

  return null;
}
