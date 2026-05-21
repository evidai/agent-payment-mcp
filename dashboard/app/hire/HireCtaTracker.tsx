"use client";

/**
 * Client-side CTA tracker for /hire.
 *
 * Why a separate component:
 *   The /hire page is a server component for SEO. Any onClick handler
 *   needs to live in a client component, but we don't want to make the
 *   whole page client-side (would hurt First Contentful Paint).
 *
 *   This tiny component attaches a `data-cta` based GA4 event listener
 *   to the document so any element with `data-cta="<name>"` fires the
 *   `hire_cta_click` event on click. Zero re-render impact.
 */

import { useEffect } from "react";
import { trackCta } from "@/lib/analytics";

export default function HireCtaTracker() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      // Walk up the DOM until we find an element with data-cta.
      const cta = t.closest<HTMLElement>("[data-cta]");
      if (!cta) return;
      const name = cta.getAttribute("data-cta") ?? "unknown";
      trackCta(name, "hire");
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
