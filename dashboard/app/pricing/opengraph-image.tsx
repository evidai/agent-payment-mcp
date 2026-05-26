import { ImageResponse } from "next/og";

// Next.js convention: this file generates the OG image for /pricing at build time.
// Hits the URL `/pricing/opengraph-image`. Reuses the visual language of
// /start/opengraph-image so the brand identity is consistent across surfaces.
//
// The card is meant to do two things in 1 second of preview:
//   (1) communicate "transparent pricing" — the headline price IS the image
//   (2) defuse the "wait, isn't this Stripe MPP territory now?" objection
//       via the eyebrow chip ("MPP-compatible") and the footer comparison.

export const runtime    = "edge";
export const alt        = "LemonCake pricing — free up to 1k tx/mo, $0.005/tx after. MPP-compatible facilitator on Base/USDC.";
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
            right:  -160,
            width:  720,
            height: 720,
            borderRadius: "50%",
            background:   "radial-gradient(circle, rgba(255,253,67,0.20) 0%, rgba(255,253,67,0) 65%)",
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
          MPP-compatible · Non-custodial · USDC on Base
        </div>

        {/* H1 */}
        <div
          style={{
            display:    "flex",
            flexDirection: "column",
            fontSize:   80,
            fontWeight: 900,
            lineHeight: 1.04,
            letterSpacing: -2,
            marginBottom: 28,
          }}
        >
          <div style={{ display: "flex" }}>Transparent pricing.</div>
          <div style={{ display: "flex", color: "#fffd43" }}>Free up to 1k tx / month.</div>
        </div>

        {/* tier strip — 3 mini cards */}
        <div
          style={{
            display: "flex",
            gap:     16,
            marginBottom: 30,
          }}
        >
          {[
            { name: "Free",       price: "$0",    sub: "1k tx / mo",         featured: false },
            { name: "Pro",        price: "$50",   sub: "+ $0.005 / tx",      featured: true  },
            { name: "Enterprise", price: "$500+", sub: "KYA bundle · SLA",   featured: false },
          ].map((t) => (
            <div
              key={t.name}
              style={{
                display:      "flex",
                flexDirection: "column",
                padding:      "20px 24px",
                borderRadius: 16,
                background:   t.featured ? "rgba(255,253,67,0.12)" : "rgba(255,255,255,0.04)",
                border:       t.featured ? "1px solid rgba(255,253,67,0.40)" : "1px solid rgba(255,255,255,0.10)",
                flex:         1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 14,
                  fontFamily: "ui-monospace, SFMono-Regular, monospace",
                  color: t.featured ? "#fffd43" : "rgba(255,255,255,0.45)",
                  textTransform: "uppercase",
                  letterSpacing: 1.5,
                  marginBottom: 8,
                }}
              >
                {t.name}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 38,
                  fontWeight: 900,
                  lineHeight: 1,
                  marginBottom: 6,
                }}
              >
                {t.price}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 16,
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {t.sub}
              </div>
            </div>
          ))}
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
            <span style={{ marginLeft: 8 }}>· lemoncake.xyz/pricing</span>
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              fontFamily: "ui-monospace, SFMono-Regular, monospace",
              fontSize: 16,
            }}
          >
            <span>vs Coinbase $0.001/tx</span>
            <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
            <span>vs Crossmint $0.05/MAW</span>
            <span style={{ color: "rgba(255,255,255,0.25)" }}>·</span>
            <span style={{ color: "rgba(255,253,67,0.85)" }}>JP onramp included</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
