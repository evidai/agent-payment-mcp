import { ImageResponse } from "next/og";

// LinkedIn-optimised OG image (1200×630). Designed to convey the value
// prop in 1 second of glance: x402-style agent payments, card-funded
// Pay Tokens, 8 free demos, and a Glama playground CTA.

export const runtime    = "edge";
export const alt        = "agent-payment-mcp — Pay-per-call APIs for AI agents. Card-funded Pay Tokens, no crypto.";
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
          padding:  "64px 72px",
          background: "linear-gradient(135deg, #FFD93D 0%, #FFC73D 60%, #FFA53D 100%)",
          color:    "#1a0f00",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
        }}
      >
        {/* ── Top row: logo + badge ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 52, display: "flex" }}>🍋</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -1, color: "#1a0f00", display: "flex" }}>LemonCake</div>
              <div style={{ fontSize: 14, color: "rgba(26,15,0,0.6)", fontFamily: "ui-monospace, monospace", letterSpacing: 0, marginTop: 2, display: "flex" }}>agent-payment-mcp</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 700, padding: "6px 12px", background: "rgba(26,15,0,0.12)", borderRadius: 999, color: "#1a0f00", display: "flex" }}>x402-compatible</span>
            <span style={{ fontSize: 13, fontWeight: 700, padding: "6px 12px", background: "rgba(26,15,0,0.12)", borderRadius: 999, color: "#1a0f00", display: "flex" }}>non-custodial</span>
          </div>
        </div>

        {/* ── Headline ── */}
        <div
          style={{
            display:       "flex",
            fontSize:      78,
            fontWeight:    900,
            lineHeight:    1.02,
            letterSpacing: -2.5,
            marginBottom:  18,
            color:         "#1a0f00",
          }}
        >
          Paid APIs for AI agents.
        </div>
        <div
          style={{
            display:       "flex",
            fontSize:      60,
            fontWeight:    900,
            lineHeight:    1.05,
            letterSpacing: -1.5,
            marginBottom:  32,
            color:         "rgba(26,15,0,0.45)",
          }}
        >
          Spend-capped. No crypto.
        </div>

        {/* ── 4-pillar value props ── */}
        <div style={{ display: "flex", gap: 12, marginBottom: 28 }}>
          {[
            { big: "x402",     sub: "402 challenge flow" },
            { big: "Stripe",   sub: "card-funded tokens" },
            { big: "8 demos",  sub: "free, no API key" },
            { big: "3%",       sub: "after 3,000 calls" },
          ].map((p) => (
            <div
              key={p.big}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                padding: "16px 18px",
                background: "rgba(255,255,255,0.55)",
                borderRadius: 14,
                border: "1px solid rgba(26,15,0,0.08)",
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 900, color: "#1a0f00", letterSpacing: -1, display: "flex" }}>{p.big}</div>
              <div style={{ fontSize: 14, color: "rgba(26,15,0,0.65)", marginTop: 2, display: "flex" }}>{p.sub}</div>
            </div>
          ))}
        </div>

        {/* ── Footer: CTA URL ── */}
        <div
          style={{
            position:       "absolute",
            bottom:         44,
            left:           72,
            right:          72,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            color:          "rgba(26,15,0,0.7)",
            fontSize:       18,
            fontFamily:     "ui-monospace, SFMono-Regular, monospace",
          }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <span style={{ fontSize: 16, display: "flex" }}>▶</span>
            <span style={{ fontWeight: 700, color: "#1a0f00", display: "flex" }}>glama.ai/mcp/servers/evidai/lemon-cake</span>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", color: "rgba(26,15,0,0.55)", fontSize: 14 }}>
            <span style={{ display: "flex" }}>🇯🇵 FSA-confirmed</span>
            <span style={{ display: "flex" }}>·</span>
            <span style={{ display: "flex" }}>MIT</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
