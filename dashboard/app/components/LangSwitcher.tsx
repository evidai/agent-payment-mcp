"use client";

/**
 * Locale 切替ボタン。クリックで `lemon_locale` cookie をセットし、
 * 対応する locale のパスにリダイレクト。
 *
 * 既存 middleware.ts がこの cookie を優先するので、以降のページ
 * 遷移は自動で正しい locale に振り分けられる。
 */

interface LangSwitcherProps {
  /** 現在の locale */
  current: "ja" | "en";
  /** 現在のパス (e.g. "/start", "/sellers"). locale prefix は除く */
  basePath: string;
  /** dark = 黒背景のナビ用 / light = 白〜amber 系背景用。デフォは dark */
  variant?: "dark" | "light";
}

export function LangSwitcher({ current, basePath, variant = "dark" }: LangSwitcherProps) {
  function switchTo(loc: "ja" | "en") {
    document.cookie = `lemon_locale=${loc}; max-age=31536000; path=/`;
    const target = loc === "en"
      ? `${basePath}/en`   // EN 正規 URL は suffix 形式 (e.g. /about/en)
      : basePath;   // ja のときは suffix なしの canonical path に戻す
    window.location.href = target;
  }

  const isDark = variant === "dark";
  const wrapperCls = isDark
    ? "inline-flex rounded-md border border-white/10 overflow-hidden text-[11px] font-mono uppercase tracking-wider"
    : "inline-flex rounded-md border border-gray-300 overflow-hidden text-[11px] font-mono uppercase tracking-wider";

  const activeCls   = isDark ? "bg-white text-[#06060a]"
                              : "bg-gray-900 text-white";
  const inactiveCls = isDark ? "text-white/40 hover:text-white/80"
                              : "text-gray-500 hover:text-gray-900 bg-white";

  return (
    <div className={wrapperCls}>
      <button
        type="button"
        onClick={() => switchTo("ja")}
        className={`px-2 py-1 transition-colors ${current === "ja" ? activeCls : inactiveCls}`}
      >
        JA
      </button>
      <button
        type="button"
        onClick={() => switchTo("en")}
        className={`px-2 py-1 transition-colors ${current === "en" ? activeCls : inactiveCls}`}
      >
        EN
      </button>
    </div>
  );
}
