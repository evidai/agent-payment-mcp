"use client";

/**
 * UtmWelcomeBanner — utm_source 由来で「ようこそ {元} から」のバナー表示
 *
 * 期待効果: 流入元に紐づいたメッセージ → 「自分向けの場所」と感じてもらえる
 * = 直帰率↓・スクロール率↑・conversion↑
 *
 * 表示条件:
 *   - utm_source が URL にある (?utm_source=reddit など)
 *   - sessionStorage で 1 度閉じたら同セッション中は再表示しない
 *
 * 既知 source ごとにメッセージを差し替え。未知 source は generic な
 * 「{source} から来ていただきありがとうございます」表示。
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

interface SourceConfig {
  label:   string;       // バナー左の小ラベル
  message: string;       // メイン文言
  cta?:    { label: string; href: string };
  emoji:   string;
  // false ならカジュアル theme (light, amber accent), true ならダークテーマで描画
  dark?:   boolean;
}

const KNOWN_SOURCES: Record<string, SourceConfig> = {
  reddit: {
    label:   "From Reddit",
    emoji:   "👋",
    message: "Welcome from r/ClaudeAI! 30 秒で動く Demo Mode から試せます。",
    cta:     { label: "Demo を試す →", href: "/start#demo" },
  },
  hackernews: {
    label:   "From HN",
    emoji:   "🍊",
    message: "Welcome HN reader. Skip the LP, the demo runs without signup.",
    cta:     { label: "Demo Mode →", href: "/start#demo" },
  },
  discord: {
    label:   "From Discord",
    emoji:   "💬",
    message: "Welcome from Discord! 3 lines to monetize your MCP server.",
    cta:     { label: "Open app →", href: "/app" },
  },
  producthunt: {
    label:   "From PH",
    emoji:   "🚀",
    message: "Welcome from Product Hunt — show some love by trying the demo.",
    cta:     { label: "Try demo →", href: "/start#demo" },
  },
  outreach: {
    label:   "Direct invite",
    emoji:   "🤝",
    message: "ご招待ありがとうございます。あなたの API を 60 秒で paid endpoint 化できます。",
    cta:     { label: "Open app →", href: "/app" },
  },
  newsletter: {
    label:   "From newsletter",
    emoji:   "📰",
    message: "Welcome from the newsletter pick. Skip straight to demo.",
    cta:     { label: "Demo →", href: "/start#demo" },
  },
};

function dismissKey(source: string) { return `lemon_utm_dismiss_${source}`; }

export function UtmWelcomeBanner() {
  const searchParams = useSearchParams();
  const utmSource = searchParams?.get("utm_source");
  const [dismissed, setDismissed] = useState(false);

  // セッション中 1 度閉じたら再表示しない
  useEffect(() => {
    if (typeof window === "undefined" || !utmSource) return;
    try {
      if (sessionStorage.getItem(dismissKey(utmSource))) setDismissed(true);
    } catch { /* sessionStorage 不可 → 常に表示 */ }
  }, [utmSource]);

  if (!utmSource || dismissed) return null;

  const cfg = KNOWN_SOURCES[utmSource] ?? {
    label:   `From ${utmSource}`,
    emoji:   "🍋",
    message: `${utmSource} から来ていただきありがとうございます。`,
  };

  function close() {
    setDismissed(true);
    if (utmSource) {
      try { sessionStorage.setItem(dismissKey(utmSource), "1"); } catch {}
    }
  }

  return (
    <div className="sticky top-0 z-30 w-full bg-amber-500 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 text-sm">
        <span className="text-lg leading-none flex-shrink-0">{cfg.emoji}</span>
        <span className="hidden sm:inline px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white/20 rounded-full flex-shrink-0">
          {cfg.label}
        </span>
        <span className="flex-1 font-medium leading-snug">{cfg.message}</span>
        {cfg.cta && (
          <a
            href={cfg.cta.href}
            className="hidden sm:inline-flex flex-shrink-0 px-3 py-1 rounded-full bg-white text-amber-700 text-xs font-bold hover:bg-amber-50 transition"
          >
            {cfg.cta.label}
          </a>
        )}
        <button
          onClick={close}
          aria-label="閉じる"
          className="flex-shrink-0 w-7 h-7 rounded-full hover:bg-white/20 transition flex items-center justify-center"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="3" y1="3" x2="11" y2="11"/><line x1="11" y1="3" x2="3" y2="11"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
