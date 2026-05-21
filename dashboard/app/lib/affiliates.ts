/**
 * Affiliate / referral configuration for the API providers the LemonCake
 * marketplace recommends.
 *
 * Why this exists:
 *   While LemonCake's primary revenue path matures, the dashboard already
 *   points buyers at premium HTTP APIs (Serper, Hunter.io, Apollo, etc).
 *   Most of those vendors run referral programs that pay back 10–30% of
 *   the first month or a recurring slice. Funnelling our existing /services
 *   and README traffic through those affiliate URLs converts that traffic
 *   into passive revenue while we wait for the on-platform charge volume
 *   to ramp up.
 *
 *   Each entry is a single source of truth: the marketplace UI, the npm
 *   READMEs, and the blog posts all read from here so swapping a referral
 *   code is a one-line change.
 *
 *   Until a referral code is obtained the link falls back to the vendor's
 *   plain marketing URL — never breaks the UI, just doesn't earn yet.
 *
 *   `disclosure` mirrors what we put under each link / on /services so we
 *   stay on the right side of FTC and Japanese 景品表示法.
 */

export interface AffiliateLink {
  /** Vendor slug — used as a stable key and tracked GA4 event param. */
  id: string;
  /** Display name. */
  name: string;
  /** One-line of what this API does. */
  blurb: string;
  /** Full referral / signup URL. UTM is appended at render time. */
  url: string;
  /** Short rate hint — keeps users informed before they click. */
  payoutHint: string;
  /** Whether the referral code is wired up yet. False = plain URL. */
  active: boolean;
}

export const AFFILIATES: AffiliateLink[] = [
  {
    id: "serper",
    name: "Serper (Google Search API)",
    blurb: "$0.30 / 1K queries. AI agents の最定番検索 API。",
    url: "https://serper.dev/?ref=lemoncake",
    payoutHint: "クレカ登録で 2,500 query 無料、月額 $50〜",
    active: false,
  },
  {
    id: "hunter",
    name: "Hunter.io",
    blurb: "メールアドレス検索・ドメイン解析。営業 AI に必須。",
    url: "https://hunter.io/?via=lemoncake",
    payoutHint: "月 25 検索無料、Starter $49/mo",
    active: false,
  },
  {
    id: "apollo",
    name: "Apollo.io",
    blurb: "B2B 連絡先 + 企業データ 2.7億件。AI 営業の母艦。",
    url: "https://www.apollo.io/?utm_source=lemoncake",
    payoutHint: "無料プランあり、Basic $49/mo",
    active: false,
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    blurb: "AI 向け Web スクレイピング。動的サイト対応。",
    url: "https://firecrawl.dev/?ref=lemoncake",
    payoutHint: "月 500 ページ無料、$19/mo〜",
    active: false,
  },
  {
    id: "scrapingbee",
    name: "ScrapingBee",
    blurb: "JS レンダリング込み Web スクレイピング API。",
    url: "https://www.scrapingbee.com/?ref=lemoncake",
    payoutHint: "$49/mo〜",
    active: false,
  },
  {
    id: "openai",
    name: "OpenAI",
    blurb: "GPT-4o / o1 / Codex。Anthropic 以外の選択肢として。",
    url: "https://platform.openai.com",
    payoutHint: "従量課金",
    active: false,
  },
];

export const AFFILIATE_DISCLOSURE_JA =
  "※ 一部のリンクは紹介リンクです。お客様が登録された場合、LemonCake に紹介料が支払われることがあります（料金がお客様に上乗せされることはありません）。";

export const AFFILIATE_DISCLOSURE_EN =
  "Note: Some links above are referral links. We may receive a commission if you sign up (at no extra cost to you).";

/**
 * Append a UTM-style tracking suffix to an affiliate URL. Keeps the
 * already-present `?ref=lemoncake` parameter intact while adding GA4
 * `utm_*` params so we can join the click back to a page in analytics.
 */
export function withAffiliateUtm(
  link: AffiliateLink,
  source: "services" | "readme" | "blog" | "hire" | "v2",
): string {
  try {
    const u = new URL(link.url);
    u.searchParams.set("utm_source", "lemoncake");
    u.searchParams.set("utm_medium", source);
    u.searchParams.set("utm_campaign", "affiliate-" + link.id);
    return u.toString();
  } catch {
    return link.url;
  }
}
