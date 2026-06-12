import type { MetadataRoute } from "next";
import { SITE_BASE } from "./lib/site";

// AEO/AIO 方針: AI 検索エンジンのクロール・引用を明示的に許可。
// 旧 public/robots.txt を置き換え — SITE_BASE から生成するので
// ドメイン移転時に sitemap.ts と一緒に追従する。
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "GoogleOther",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  "DuckAssistBot",
  "YouBot",
  "MistralAI-User",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/", "/auth/"],
      },
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: `${SITE_BASE}/sitemap.xml`,
  };
}
