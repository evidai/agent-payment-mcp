import { ImageResponse } from "next/og";

// Next.js convention: this file generates the OG image for /start at build time.
// Hits the URL `/start/opengraph-image`. 1200x630 is the canonical size for
// Twitter/X large card, Slack unfurl, LinkedIn, OG Discord embeds.

export const runtime    = "edge";
export const alt        = "pay-per-call-mcp — Pay-per-call USDC for any HTTP API";
export const size       = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width:    "100%",
          height:   "100%",
          display:  "flex",
          flexDirection: "column",
          padding:  "72px",
          background: "linear-gradient(135deg, #06060a 0%, #0d0d14 100%)",
          color:    "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* subtle yellow vignette */}
        <div
          style={{
            position: "absolute",
            top:    -160,
            left:   -160,
            width:  720,
            height: 720,
            borderRadius: "50%",
            background:   "radial-gradient(circle, rgba(255,253,67,0.18) 0%, rgba(255,253,67,0) 65%)",
            display: "flex",
          }}
        />

        {/* eyebrow tag */}
        <div
          style={{
            display:    "flex",
            alignItems: "center",
            gap:        12,
            color:      "#fffd43",
            fontSize:   22,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
            textTransform: "uppercase",
            letterSpacing: 2,
            marginBottom:  28,
          }}
        >
          <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#fffd43", display: "flex" }} />
          MCP · USDC · x402-compatible
        </div>

        {/* H1 */}
        <div
          style={{
            display:    "flex",
            fontSize:   88,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: -2,
            marginBottom: 28,
          }}
        >
          Pay-per-call USDC for{" "}
          <span style={{ color: "#fffd43", marginLeft: 18 }}>any HTTP API.</span>
        </div>

        {/* subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: 30,
            color: "rgba(255,255,255,0.7)",
            lineHeight: 1.35,
            maxWidth: 980,
            marginBottom: 36,
          }}
        >
          Give your AI agent a wallet. Demo Mode runs in 30s — no signup, no card, no API keys.
        </div>

        {/* code block */}
        <div
          style={{
            display:      "flex",
            alignItems:   "center",
            gap:          18,
            padding:      "22px 32px",
            background:   "rgba(0,0,0,0.55)",
            border:       "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            fontFamily:   "ui-monospace, SFMono-Regular, monospace",
            fontSize:     30,
            color:        "rgba(255,255,255,0.95)",
            width:        "fit-content",
          }}
        >
          <span style={{ color: "rgba(255,253,67,0.7)" }}>$</span>
          <span>npx -y pay-per-call-mcp</span>
        </div>

        {/* footer */}
        <div
          style={{
            position:   "absolute",
            bottom:     56,
            left:       72,
            right:      72,
            display:    "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color:      "rgba(255,255,255,0.5)",
            fontSize:   22,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 30 }}>🍋</span>
            <span style={{ fontWeight: 600, color: "#ffffff" }}>LemonCake</span>
            <span style={{ marginLeft: 8 }}>· lemoncake.xyz/start</span>
          </div>
          <div style={{ display: "flex", gap: 18, fontFamily: "ui-monospace, SFMono-Regular, monospace", fontSize: 18 }}>
            <span>MIT</span>
            <span>MCP 1.10+</span>
            <span>Listed on Glama</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
