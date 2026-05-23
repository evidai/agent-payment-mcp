import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Providers } from "./Providers";
import "./globals.css";

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
const DESC_JA   = "LemonCake は AI エージェント向け 非カストディ USDC マイクロペイメント基盤。ERC-2612 permit に 1 度署名すれば、90 日間ノーサインで AI が API を自律決済。freee / MoneyForward 自動仕訳、適格請求書（インボイス制度）自動発行、JPY オフランプを内蔵。x402 / Coinbase Bazaar / AWS Bedrock AgentCore 互換。FSA 照会済（登録不要）。$0.001/call から。";
const DESC_EN   = "LemonCake is the non-custodial USDC micropayment infrastructure for AI agents. One ERC-2612 permit signature gives 90 days of bounded autonomous spend on Base. Native x402 facilitator with hybrid Coinbase CDP routing for x402 Bazaar / AWS Bedrock AgentCore discovery. No JWT, no API key juggling, no fund custody. $0.001/call. Globally available.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LemonCake — AI エージェント向け M2M 決済・会計インフラ",
    template: "%s | LemonCake",
  },
  description: DESC_JA,
  applicationName: SITE_NAME,
  authors: [{ name: "evidai", url: "https://aievid.com" }],
  creator: "evidai",
  publisher: "evidai",
  keywords: [
    "AIエージェント",
    "AIエージェント 決済",
    "AIエージェント 財布",
    "agent-payment-mcp",
    "MCP server",
    "MCP サーバー",
    "x402",
    "x402 facilitator",
    "x402 Bazaar",
    "ERC-2612 permit",
    "ERC-3009",
    "non-custodial",
    "非カストディ",
    "USDC",
    "Base",
    "Coinbase Bazaar",
    "AWS Bedrock AgentCore",
    "AI agent payments",
    "agent commerce",
    "machine-to-machine payment",
    "Pay-per-call API",
    "freee 連携",
    "MoneyForward 連携",
    "適格請求書 自動発行",
    "インボイス制度",
    "JPY オフランプ",
    "Dify 決済",
    "LangChain",
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
    title: "LemonCake — AI エージェント向け 非カストディ USDC 決済 (x402 native, FSA 確認済)",
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
    title: "LemonCake — Non-custodial USDC payments for AI agents",
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
      applicationSubCategory: "AI Agent Payment Infrastructure",
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
        "AI エージェント向け ERC-2612 permit 署名（90 日有効・$25/日 hard cap）",
        "JPYC / USDC による M2M 決済（Polygon）",
        "freee / MoneyForward 自動仕訳",
        "源泉徴収 10.21% 自動判定",
        "適格請求書発行事業者（インボイス）国税庁 API 連携",
        "電子帳簿保存法 7 年自動保持",
        "Dify / LangChain / MCP サーバー対応",
        "KYA / KYC ティアモデル（Agent-of-Record 契約）",
        "Reputation スコアによる予算・信用管理",
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
    <html lang="ja">
      <head>
        <link rel="canonical" href={SITE_URL} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
      {GA_ID ? <GoogleAnalytics gaId={GA_ID} /> : null}
    </html>
  );
}
