// Twitter / X uses the same large-card 1200×630 image as Open Graph.
// Route-segment config (runtime, alt, size, contentType) must be declared
// locally — Next.js forbids re-exporting them from another file. We only
// reuse the default render function.

import OG from "./opengraph-image";

export const runtime     = "edge";
export const alt         = "LemonCake pricing — no monthly fee. First 3,000 calls free, then 3% only when your API earns.";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

export default OG;
