"use client";

/**
 * Lightweight, dependency-free i18n for the /app client surface.
 *
 * Why not next-intl: this dashboard is a single "use client" tree, so a React
 * context + a `t()` lookup covers everything without locale-segmented routing
 * or a server/client message split. Locale is persisted in the `lc_locale`
 * cookie (1y) and mirrored onto <html lang> so the browser stops offering to
 * auto-translate (which is what produced the mojibake like "電話" for "calls").
 *
 * First visit, no cookie → fall back to navigator.language (ja/es/en).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { en, type MessageKey, type Messages } from "./messages/en";
import { ja } from "./messages/ja";
import { es } from "./messages/es";

export const LOCALES = ["en", "ja", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  ja: "日本語",
  es: "Español",
};
export const DEFAULT_LOCALE: Locale = "en";

const DICTS: Record<Locale, Messages> = { en, ja, es };
const COOKIE = "lc_locale";

function isLocale(v: string | null | undefined): v is Locale {
  return v === "en" || v === "ja" || v === "es";
}

function readCookieLocale(): Locale | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  const v = m ? decodeURIComponent(m[1]) : null;
  return isLocale(v) ? v : null;
}

function writeCookieLocale(l: Locale) {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const langs = [navigator.language, ...(navigator.languages ?? [])];
  for (const raw of langs) {
    const low = (raw ?? "").toLowerCase();
    if (low.startsWith("ja")) return "ja";
    if (low.startsWith("es")) return "es";
    if (low.startsWith("en")) return "en";
  }
  return DEFAULT_LOCALE;
}

type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;
type LocaleCtxValue = { locale: Locale; setLocale: (l: Locale) => void; t: TFn };

const LocaleCtx = createContext<LocaleCtxValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: (key) => en[key] ?? key,
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  // Start at DEFAULT on both server and client so the first render matches
  // (no hydration mismatch); resolve the real locale in an effect right after.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    const resolved = readCookieLocale() ?? detectBrowserLocale();
    setLocaleState(resolved);
    if (typeof document !== "undefined") document.documentElement.lang = resolved;
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    writeCookieLocale(l);
    if (typeof document !== "undefined") document.documentElement.lang = l;
  }, []);

  const t = useCallback<TFn>(
    (key, vars) => {
      let s: string = DICTS[locale][key] ?? en[key] ?? key;
      if (vars) {
        for (const [vk, vv] of Object.entries(vars)) {
          s = s.replace(new RegExp(`\\{${vk}\\}`, "g"), String(vv));
        }
      }
      return s;
    },
    [locale],
  );

  return <LocaleCtx.Provider value={{ locale, setLocale, t }}>{children}</LocaleCtx.Provider>;
}

export function useT(): LocaleCtxValue {
  return useContext(LocaleCtx);
}

/** Compact globe + native <select> language picker. Reads/writes the context. */
export function LanguageSelector({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useT();
  return (
    <label
      className={`inline-flex items-center gap-1.5 text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors cursor-pointer ${className}`}
      title={t("lang.label")}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
      <span className="sr-only">{t("lang.label")}</span>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("lang.label")}
        className="bg-transparent text-[13px] font-medium focus:outline-none cursor-pointer pr-0.5"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
