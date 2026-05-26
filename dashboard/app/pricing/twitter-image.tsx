// Twitter / X uses the same large-card 1200×630 image as Open Graph.
// Route-segment config (runtime, alt, size, contentType) must be declared
// locally — Next.js forbids re-exporting them from another file. We only
// reuse the default render function.

import OG from "./opengraph-image";

export const runtime     = "edge";
export const alt         = "LemonCake pricing — free up to 1k tx/mo, $0.005/tx after. MPP-compatible facilitator on Base/USDC.";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

export default OG;
