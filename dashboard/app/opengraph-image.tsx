import { ImageResponse } from "next/og";

// Default OG image — used by /, /about, and any page that doesn't have its
// own opengraph-image.tsx. 1200x630 canonical (Twitter/X, Slack, Discord, LinkedIn).

export const runtime    = "edge";
export const alt        = "LemonCake — Non-custodial USDC payments for AI agents";
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
          background: "linear-gradient(135deg, #fffd43 0%, #fff89c 50%, #fff5dc 100%)",
          color:    "#1a0f00",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* dark vignette */}
        <div
          style={{
            position: "absolute",
            bottom:   -200,
            right:    -200,
            width:    720,
            height:   720,
            borderRadius: "50%",
            background:   "radial-gradient(circle, rgba(26,15,0,0.08) 0%, rgba(26,15,0,0) 65%)",
            display: "flex",
          }}
        />

        {/* logo + badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 32 }}>
          <div style={{ fontSize: 52, display: "flex" }}>🍋</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, color: "#1a0f00", display: "flex" }}>LemonCake</div>
            <div style={{ fontSize: 16, color: "rgba(26,15,0,0.55)", fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: 1.5, marginTop: 2, display: "flex" }}>agent-payment-mcp</div>
          </div>
        </div>

        {/* H1 */}
        <div
          style={{
            display:    "flex",
            fontSize:   84,
            fontWeight: 900,
            lineHeight: 1.04,
            letterSpacing: -2.5,
            marginBottom: 22,
            color:     "#1a0f00",
          }}
        >
          Code pays code.
        </div>
        <div
          style={{
            display:    "flex",
            fontSize:   72,
            fontWeight: 900,
            lineHeight: 1.04,
            letterSpacing: -2,
            marginBottom: 36,
            color:     "rgba(26,15,0,0.55)",
          }}
        >
          We never touch the funds.
        </div>

        {/* subtitle */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            color: "rgba(26,15,0,0.7)",
            lineHeight: 1.4,
            maxWidth: 1000,
          }}
        >
          AI エージェント向け非カストディ USDC 決済基盤。1 度の permit 署名で 90 日間ノーサイン運用。
        </div>

        {/* footer badges */}
        <div
          style={{
            position:   "absolute",
            bottom:     56,
            left:       72,
            right:      72,
            display:    "flex",
            alignItems: "center",
            justifyContent: "space-between",
            color:      "rgba(26,15,0,0.6)",
            fontSize:   18,
            fontFamily: "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          <div style={{ display: "flex", gap: 18 }}>
            <span>🇯🇵 FSA 確認済</span>
            <span>·</span>
            <span>x402 native</span>
            <span>·</span>
            <span>Coinbase Bazaar</span>
            <span>·</span>
            <span>AWS AgentCore</span>
          </div>
          <div style={{ fontWeight: 700, color: "#1a0f00", display: "flex" }}>lemoncake.xyz</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
