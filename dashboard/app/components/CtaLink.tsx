"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { trackCta } from "@/lib/analytics";

/* Drop-in replacement for next/link on marketing CTAs: fires a GA4
 * cta_click event (lib/analytics no-ops when GA is unset) so we can see
 * which CTA actually moves people — start-free vs live-demo vs docs. */
export function CtaLink({
  href,
  cta,
  page,
  className,
  children,
}: {
  href: string;
  cta: string;
  page?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => trackCta(cta, page)}>
      {children}
    </Link>
  );
}
