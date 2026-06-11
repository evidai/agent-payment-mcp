import { SITE_BASE } from "./site";

// Shared JSON-LD fragments. Pages must import these instead of inlining
// copies — pricing lives in ONE place so search engines never see two
// different offers (previously copy-pasted in /demo and /about/en).
export const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "LemonCake",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: SITE_BASE,
  description:
    "Usage-based billing and monetization layer for AI APIs and MCP servers. Buyers prepay by card, agents pay per call with spend-capped Pay Tokens, sellers keep 97%. Open-core: MIT-licensed SDK, hosted billing engine.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "First 3,000 API calls free, then 3% per transaction. No monthly fee.",
  },
} as const;

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map(({ name, path }, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: `${SITE_BASE}${path}`,
    })),
  };
}
