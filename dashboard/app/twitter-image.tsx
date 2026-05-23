// Twitter/X uses the same image as OG for "summary_large_image" cards.
// Re-export the default OG renderer, but declare the config fields directly
// here — Next.js 16's Turbopack can't statically parse re-exported route
// segment config (runtime / size / contentType / alt). The values are kept
// in sync manually with opengraph-image.tsx (1200x630, edge runtime).

export { default } from "./opengraph-image";

export const runtime     = "edge";
export const alt         = "LemonCake — Non-custodial USDC payments for AI agents";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";
