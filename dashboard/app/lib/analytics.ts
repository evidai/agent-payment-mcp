/**
 * GA4 event tracking helpers.
 *
 * Usage:
 *   import { trackEvent } from "@/app/lib/analytics";
 *   trackEvent("token_issued", { scope: "ALL", limit_usd: 1 });
 *
 * - Safe to call on the server (no-ops).
 * - Safe to call before the gtag script has loaded (queues to dataLayer).
 * - Silently no-ops if NEXT_PUBLIC_GA_ID is unset.
 */

type GtagArgs = [string, string, Record<string, unknown>?];

declare global {
  interface Window {
    dataLayer?: GtagArgs[];
    gtag?: (...args: GtagArgs) => void;
  }
}

const enabled = typeof process !== "undefined" && !!process.env.NEXT_PUBLIC_GA_ID;

/**
 * Fire a GA4 custom event.
 *
 * Common event names we use:
 *   - signup_started     (register page CTA clicked)
 *   - signup_completed   (registration POST succeeded)
 *   - login_completed
 *   - token_issued       (Pay Token created)
 *   - token_stopped      (Pay Token revoked)
 *   - usdc_topup_started
 *   - usdc_topup_completed
 *   - service_install_copied  (one-click install JSON copied to clipboard)
 *   - cta_click          (any marketing CTA — pass {cta: "..."}, {page: "..."})
 *   - mcp_demo_run       (Demo Mode tool invocation visible in chat)
 */
export function trackEvent(
  name: string,
  params: Record<string, unknown> = {}
): void {
  if (!enabled) return;
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag("event", name, params);
    return;
  }
  // gtag may not be loaded yet — push to dataLayer so it fires when ready.
  window.dataLayer = window.dataLayer ?? [];
  window.dataLayer.push(["event", name, params]);
}

/**
 * Convenience wrapper for marketing CTA clicks.
 *   <button onClick={() => trackCta("install_claude", "services")}>…</button>
 */
export function trackCta(cta: string, page?: string): void {
  trackEvent("cta_click", { cta, ...(page ? { page } : {}) });
}
