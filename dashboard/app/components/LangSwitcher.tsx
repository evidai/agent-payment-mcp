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
}

export function LangSwitcher({ current, basePath }: LangSwitcherProps) {
  function switchTo(loc: "ja" | "en") {
    document.cookie = `lemon_locale=${loc}; max-age=31536000; path=/`;
    const target = loc === "en"
      ? `/en${basePath}`
      : basePath;   // ja のときは prefix なしの canonical path に戻す
    window.location.href = target;
  }

  return (
    <div className="inline-flex rounded-md border border-white/10 overflow-hidden text-[11px] font-mono uppercase tracking-wider">
      <button
        type="button"
        onClick={() => switchTo("ja")}
        className={`px-2 py-1 transition-colors ${current === "ja" ? "bg-white text-[#06060a]" : "text-white/40 hover:text-white/80"}`}
      >
        JA
      </button>
      <button
        type="button"
        onClick={() => switchTo("en")}
        className={`px-2 py-1 transition-colors ${current === "en" ? "bg-white text-[#06060a]" : "text-white/40 hover:text-white/80"}`}
      >
        EN
      </button>
    </div>
  );
}
