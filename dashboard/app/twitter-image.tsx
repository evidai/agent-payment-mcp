// Twitter/X uses the same image as OG for "summary_large_image" cards.
// Re-export the default OG to keep them in sync without duplicating JSX.

export { default } from "./opengraph-image";
export { runtime, size, contentType, alt } from "./opengraph-image";
