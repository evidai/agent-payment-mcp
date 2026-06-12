// Single source of truth for the public origin. Imported by sitemap.ts and
// robots.ts so crawler-facing surfaces can never drift to a stale domain
// again (robots.txt previously sat in public/ and kept lemoncake.aievid.com
// long after the move to lemoncake.xyz).
export const SITE_BASE = "https://lemoncake.xyz";
