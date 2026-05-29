/**
 * Growth-loop pure helpers — share snippets, badge SVG, slug + URL builders,
 * directory categories.
 *
 * IMPORTANT: this module must stay free of any server-only imports (no
 * `postgres`, no `next/headers`). It's imported by both the public page's
 * client component AND server routes, so everything here is a pure function.
 */

/* ──────────────── site + path helpers ──────────────── */

export const SITE_URL = "https://www.lemoncake.xyz";

export function gatewayUrl(shortId: string): string {
  return `${SITE_URL}/g/${shortId}`;
}

export function publicPagePath(slug: string): string {
  return `/api/${slug}`;
}

export function publicPageUrl(slug: string): string {
  return `${SITE_URL}${publicPagePath(slug)}`;
}

export function badgePath(apiId: string): string {
  return `/badge/${apiId}.svg`;
}

export function badgeUrl(apiId: string): string {
  return `${SITE_URL}${badgePath(apiId)}`;
}

/* ──────────────── directory categories ──────────────── */

export const CATEGORIES = [
  "MCP Servers",
  "AI Search",
  "Scraping",
  "Browser Automation",
  "PDF/OCR",
  "Research",
  "Data Enrichment",
  "LLM Wrappers",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isValidCategory(c: string): c is Category {
  return (CATEGORIES as readonly string[]).includes(c);
}

/* ──────────────── slug sanitize (pure copy of lc-backend's) ──────────────── */

/** Sanitize an arbitrary string into a slug fragment (lowercase, hyphenated). */
export function sanitizeSlug(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return s || "api";
}

/* ──────────────── price formatting ──────────────── */

/** Format a numeric/string price into "$0.01" (trims trailing zeros, min 2dp). */
export function fmtPrice(price: number | string): string {
  const n = typeof price === "string" ? Number(price) : price;
  if (!isFinite(n)) return "$0.00";
  // Show up to 6 decimals but drop pointless trailing zeros (keep ≥2 dp).
  let s = n.toFixed(6).replace(/0+$/, "");
  if (s.endsWith(".")) s += "00";
  const dot = s.indexOf(".");
  if (dot >= 0 && s.length - dot - 1 < 2) s = n.toFixed(2);
  return `$${s}`;
}

/* ──────────────── copy snippets ──────────────── */

/** `curl` example hitting the gateway with a Pay Token. */
export function curlExample(opts: { shortId: string; sampleBody?: string }): string {
  const body = opts.sampleBody ?? `{"hello":"world"}`;
  return [
    `curl -X POST ${gatewayUrl(opts.shortId)} \\`,
    `  -H "Authorization: Bearer $PAY_TOKEN" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${body}'`,
  ].join("\n");
}

/** Markdown README badge linking the badge SVG to the public API page. */
export function readmeBadgeMarkdown(opts: { apiId: string; slug: string }): string {
  return `[![Paid access powered by LemonCake](${badgeUrl(opts.apiId)})](${publicPageUrl(opts.slug)})`;
}

/** Short X / launch post. Kept well under the character limit. */
export function xPostText(opts: { name: string; price: number | string; slug: string }): string {
  return [
    `I put my API behind pay-per-call access: ${opts.name}`,
    ``,
    `${fmtPrice(opts.price)}/call · Pay Token required · usage-metered, no signup`,
    ``,
    `Try it → ${publicPageUrl(opts.slug)}`,
  ].join("\n");
}

/** One-paragraph listing blurb for an MCP / tools directory or README table. */
export function mcpListingText(opts: {
  name: string;
  description?: string | null;
  shortId: string;
  price: number | string;
  slug: string;
}): string {
  const desc = (opts.description || "").trim();
  const lines = [
    `**${opts.name}**${desc ? ` — ${desc}` : ""}`,
    `Paid access · ${fmtPrice(opts.price)}/call · Pay Token (Bearer)`,
    `Endpoint: ${gatewayUrl(opts.shortId)}`,
    `Details: ${publicPageUrl(opts.slug)}`,
  ];
  return lines.join("\n");
}

/** Fuller docs block (markdown) for a README "Usage" section. */
export function docsSnippet(opts: {
  name: string;
  description?: string | null;
  shortId: string;
  price: number | string;
  slug: string;
}): string {
  const desc = (opts.description || "").trim();
  const lines = [
    `## ${opts.name}`,
    ``,
  ];
  if (desc) lines.push(desc, ``);
  lines.push(
    `Calls are pay-per-call: **${fmtPrice(opts.price)} per call**, authorized with a LemonCake Pay Token.`,
    ``,
    "```bash",
    `curl -X POST ${gatewayUrl(opts.shortId)} \\`,
    `  -H "Authorization: Bearer $PAY_TOKEN" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"hello":"world"}'`,
    "```",
    ``,
    `Get a Pay Token and see live usage → ${publicPageUrl(opts.slug)}`,
  );
  return lines.join("\n");
}

/* ──────────────── README badge SVG ──────────────── */

// Rough per-character advance width at 11px DejaVu Sans (shields.io style).
function textWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    if (/[ .,:;'|!iIlt]/.test(ch)) w += 3.4;
    else if (/[mwMW@]/.test(ch)) w += 9.5;
    else if (/[A-Z0-9]/.test(ch)) w += 7.2;
    else w += 6.4;
  }
  return Math.ceil(w);
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Build a flat README badge SVG.
 *   left  segment: dark (#1a0f00), off-white text — "paid access"
 *   right segment: lemon (#fffd43), dark text — price or "paused"
 * GitHub renders this fine since it's served as an <img src>.
 */
export function badgeSvg(opts: {
  price?: number | string | null;
  paused?: boolean;
  muted?: boolean;
  message?: string;
}): string {
  const label = "paid access";
  const message =
    opts.message ??
    (opts.muted
      ? "unknown"
      : opts.paused
        ? "paused"
        : opts.price != null
          ? `${fmtPrice(opts.price)}/call`
          : "live");
  const muted = opts.muted || opts.paused;

  const PAD = 10;
  const H = 20;
  const lw = textWidth(label) + PAD * 2;
  const mw = textWidth(message) + PAD * 2;
  const W = lw + mw;

  const leftBg = "#1a0f00";
  const rightBg = muted ? "#9ca3af" : "#fffd43";
  const leftText = "#fafaf7";
  const rightText = "#1a0f00";

  // text x-anchors (centered in each segment), 10x scaled for crisp transform.
  const lx = (lw / 2) * 10;
  const mx = (lw + mw / 2) * 10;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" role="img" aria-label="${esc(label)}: ${esc(message)}">
  <title>${esc(label)}: ${esc(message)}</title>
  <clipPath id="r"><rect width="${W}" height="${H}" rx="4" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="${lw}" height="${H}" fill="${leftBg}"/>
    <rect x="${lw}" width="${mw}" height="${H}" fill="${rightBg}"/>
  </g>
  <g fill="${leftText}" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="110" transform="scale(.1)">
    <text x="${lx}" y="140" fill="#000" fill-opacity=".25">${esc(label)}</text>
    <text x="${lx}" y="130">${esc(label)}</text>
  </g>
  <g fill="${rightText}" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="110" font-weight="600" transform="scale(.1)">
    <text x="${mx}" y="130">${esc(message)}</text>
  </g>
</svg>`;
}
