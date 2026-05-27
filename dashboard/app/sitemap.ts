import type { MetadataRoute } from "next";

const BASE = "https://lemoncake.xyz";

// Sitemap intentionally lists only live, indexable surfaces. Admin, draft,
// and auth-only routes are excluded. Keep this file in sync with the real
// app/* tree — orphan entries here become broken links in Google's index.

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`,                              lastModified: now, changeFrequency: "weekly",  priority: 1.0 },
    { url: `${BASE}/about`,                         lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/about/en`,                      lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/app`,                           lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/pricing`,                       lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/sellers`,                       lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/start/free`,                    lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    // /start/v2 — non-custodial buyer onramp (FSA Q11 confirmed).
    { url: `${BASE}/start/v2`,                      lastModified: now, changeFrequency: "weekly",  priority: 0.9 },
    { url: `${BASE}/integrations/freee`,            lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/consulting`,                    lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // Docs
    { url: `${BASE}/docs`,                          lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    { url: `${BASE}/docs/quickstart`,               lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/docs/pay-token`,                lastModified: now, changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/docs/permit`,                   lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs/accounting`,               lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs/invoices`,                 lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs/jpy-offramp`,              lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/docs/x402-hybrid`,              lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/docs/migrate-from-coinbase`,    lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/docs/migrate-from-stripe-mpp`,  lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    // Trust / legal
    { url: `${BASE}/security`,                      lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/privacy`,                       lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/legal/terms`,                   lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/legal/dify-plugin`,             lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/support`,                       lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
