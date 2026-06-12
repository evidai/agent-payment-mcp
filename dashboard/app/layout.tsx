import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";
import { PageviewPing } from "./components/PageviewPing";
import { UtmWelcomeBanner } from "./components/UtmWelcomeBanner";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

// Self-hosted via next/font — replaces the render-blocking Google Fonts
// @import in globals.css (saved: CSS-blocking round trips to 2 origins).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jbMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jbmono", display: "swap" });

// GA4 measurement ID — set NEXT_PUBLIC_GA_ID in .env(.local) to enable.
// Leave unset in dev to avoid polluting the property; in prod it must be set.
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a0e27",
};

const SITE_URL  = "https://lemoncake.xyz";
const SITE_NAME = "LemonCake";
const DESC_JA   = "LemonCake は MCP サーバーや HTTP API を5分で有料化する x402 決済レールです。買い手はカードで前払いし、エージェントは上限つき Pay Token で自律利用。暗号資産ウォレット不要、コールごとのAPIキー不要。初回3,000コール無料、以降は売れた時だけ3%。";
const DESC_EN   = "LemonCake is the fastest way to monetize an MCP server or HTTP API. Buyers prepay by card, agents call with spend-capped Pay Tokens, and sellers keep 97%. No crypto wallet, no per-call API keys. First 3,000 calls free, then 3% only when your API earns.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LemonCake — Monetize MCP Servers and APIs in 5 Minutes",
    template: "%s | LemonCake",
  },
  description: DESC_EN,
  applicationName: SITE_NAME,
  authors: [{ name: "evidai", url: "https://aievid.com" }],
  creator: "evidai",
  publisher: "evidai",
  keywords: [
    "AIエージェント",
    "AIエージェント 決済",
    "MCP 課金",
    "MCP 有料化",
    "MCP monetization",
    "paid MCP server",
    "monetize MCP server",
    "agent-payment-mcp",
    "MCP server",
    "MCP サーバー",
    "x402",
    "Pay Token",
    "usage billing",
    "API monetization",
    "pay-per-call API",
    "AI agent payments",
    "agent commerce",
    "machine-to-machine payment",
    "Stripe Connect",
    "Claude Desktop MCP",
    "Cursor MCP",
    "Cline MCP",
    "Anthropic MCP",
    "FSA 確認済",
    "LemonCake",
    "レモンケーキ",
    "evidai",
    "aievid",
  ],
  alternates: {
    canonical: SITE_URL,
    languages: {
      "ja-JP": `${SITE_URL}/about`,
      "en-US": `${SITE_URL}/about/en`,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "LemonCake — MCP / APIを5分で有料化",
    description: DESC_JA,
    locale: "ja_JP",
    alternateLocale: ["en_US"],
    // 動的 OG 画像 (app/opengraph-image.tsx) が自動で /opengraph-image を生成。
    // 個別ページが独自の opengraph-image.tsx を持っていればそれが優先される。
  },
  twitter: {
    card: "summary_large_image",
    site: "@aievid",
    creator: "@aievid",
    title: "LemonCake — Monetize MCP Servers and APIs in 5 Minutes",
    description: DESC_JA,
    // 動的 Twitter image (app/twitter-image.tsx) が自動で生成。
  },
  icons: {
    icon: "/logo.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  category: "technology",
  other: {
    "ai-generated-content": "false",
    "description:en": DESC_EN,
  },
};

// ── JSON-LD: Organization + WebSite + SoftwareApplication ──────────────────
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#organization`,
      name: "LemonCake",
      alternateName: ["レモンケーキ", "LemonCake by evidai"],
      url: SITE_URL,
      logo: `${SITE_URL}/logo.png`,
      email: "contact@aievid.com",
      founder: { "@type": "Organization", name: "evidai", url: "https://aievid.com" },
      description: DESC_JA,
      sameAs: ["https://aievid.com"],
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "contact@aievid.com",
        availableLanguage: ["Japanese", "English"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      url: SITE_URL,
      name: SITE_NAME,
      inLanguage: "ja-JP",
      publisher: { "@id": `${SITE_URL}#organization` },
      description: DESC_JA,
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}#app`,
      name: "LemonCake",
      applicationCategory: "FinanceApplication",
      applicationSubCategory: "MCP and API monetization",
      operatingSystem: "Web, API, MCP",
      url: SITE_URL,
      description: DESC_JA,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "JPY",
        description: "Free tier available. Usage-based pricing after.",
      },
      featureList: [
        "MCP サーバーと HTTP API の従量課金",
        "Stripe-backed Pay Token 発行",
        "Buyer Key による off-session top-up",
        "サーバー側の支出上限・レート制限",
        "usage ledger と blocked-request log",
        "Stripe Connect Direct Charge による Seller 入金",
        "暗号資産ウォレット不要の buyer checkout",
        "Demo Mode と MIT SDK",
      ],
      publisher: { "@id": `${SITE_URL}#organization` },
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${inter.variable} ${jbMono.variable}`}>
      <head>
        <link rel="canonical" href={SITE_URL} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        {/* UTM 由来 welcome banner (Suspense 必須) */}
        <Suspense fallback={null}>
          <UtmWelcomeBanner />
        </Suspense>
        {/* Web3 providers (Privy/Wagmi/OnchainKit) moved to app/start/v2/layout.tsx —
            only that route needs them; everywhere else they were ~hundreds of KB of
            dead client JS on every page. */}
        {children}
        {/* Self-hosted pageview ingest (Suspense 必須: useSearchParams を使う) */}
        <Suspense fallback={null}>
          <PageviewPing />
        </Suspense>
        <Analytics />
        <SpeedInsights />
      </body>
      {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
    </html>
  );
}
