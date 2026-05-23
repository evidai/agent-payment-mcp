// Twitter / X uses the same large-card 1200×630 image as Open Graph.
// We declare the route-segment config locally (Next.js forbids re-exporting
// `runtime` from another file) but reuse the renderer.

import OG from "./opengraph-image";

export const runtime     = "edge";
export const alt         = "agent-payment-mcp — Pay-per-call USDC for any HTTP API";
export const size        = { width: 1200, height: 630 };
export const contentType = "image/png";

export default OG;
