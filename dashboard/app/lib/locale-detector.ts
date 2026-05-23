/**
 * Locale → default currency detection.
 *
 * The Tokyo metropolitan stablecoin grant requires JPYC to be the
 * default for Japanese users. Everyone else should land on USDC because
 * that's what's already wired through Coinbase Onramp / Apple Pay.
 *
 * Detection priority (highest first — the first source that returns a
 * concrete answer wins):
 *
 *   1. User preference saved in localStorage from a previous visit.
 *      This is what the on-screen toggle writes to. Whenever the user
 *      manually picks a currency we honour that forever.
 *   2. URL query param `?currency=JPYC|USDC`. Lets external campaigns
 *      and partner sites pre-select the right rail.
 *   3. Server-detected country (passed in via prop from Vercel Edge or
 *      Cloudflare). When present, JP → JPYC, everything else → USDC.
 *   4. Browser `navigator.language`. `ja*` → JPYC.
 *   5. Hard-coded fallback: USDC (existing v2 default — no regression
 *      for clients that bypass detection).
 *
 * Both `detectDefaultCurrency()` (client) and `detectDefaultCurrencyForCountry()`
 * (server) live here so the routing logic stays in one place; the server
 * variant just skips steps that depend on `window`.
 */

import type { Currency } from "./permit";

export type CurrencyDetectionInput = {
  /** ISO country code from edge headers, e.g. "JP", "US". */
  country?: string | null;
  /** Forced override from URL query / cookie — wins over heuristics. */
  forced?: Currency | null;
};

/** localStorage key — bumped whenever the storage format changes. */
const STORAGE_KEY = "lemon.currency.preference.v1";

/**
 * Server-safe detection. Use this from React server components / route
 * handlers where `window` is undefined. The country code typically
 * comes from `geolocation(headers).country` (Vercel) or
 * `headers["cf-ipcountry"]` (Cloudflare).
 */
export function detectDefaultCurrencyForCountry(country: string | null | undefined): Currency {
  if (country && country.toUpperCase() === "JP") return "JPYC";
  return "USDC";
}

/**
 * Client-side detection. Reads localStorage + query params + navigator,
 * then falls back to the server hint if provided.
 *
 * Returns synchronously so it can drive the initial render of the
 * /start/v2 wizard without a flash of USDC for Japanese users.
 */
export function detectDefaultCurrency(input: CurrencyDetectionInput = {}): Currency {
  // 1. Explicit user preference — highest priority.
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "USDC" || stored === "JPYC") return stored;
    } catch {
      // localStorage can throw in privacy mode / iframes; ignore and
      // fall through to the next signal.
    }
  }

  // 2. Forced override (URL query, partner widget params).
  if (input.forced === "USDC" || input.forced === "JPYC") {
    return input.forced;
  }
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("currency");
    if (q === "USDC" || q === "JPYC") return q;
  }

  // 3. Server-detected country (passed in by SSR).
  if (input.country) {
    return detectDefaultCurrencyForCountry(input.country);
  }

  // 4. Browser locale heuristic — catches users who landed via direct
  //    URL with no edge hint.
  if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    const lang = navigator.language || (navigator as { userLanguage?: string }).userLanguage || "";
    if (lang.toLowerCase().startsWith("ja")) return "JPYC";
  }

  // 5. Conservative fallback — keeps the existing USDC v2 experience
  //    for anyone the heuristics don't recognise.
  return "USDC";
}

/**
 * Persist a manual override so subsequent visits keep the same rail.
 * Call this whenever the user flips the toggle in /start/v2.
 */
export function saveCurrencyPreference(currency: Currency): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, currency);
  } catch {
    // Swallow — quota / privacy mode.
  }
}

/** Clear the override (used for QA / "reset to default" flows). */
export function clearCurrencyPreference(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Swallow.
  }
}
