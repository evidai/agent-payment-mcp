/**
 * /api/[slug] — public API page for a seller's paid-access endpoint.
 *
 * Resolvable by public_slug (preferred) or short_id. This is the SELLER's
 * page — LemonCake is credited only with a small "Paid access powered by
 * LemonCake" line. Developer-first, no crypto/web3 framing.
 *
 * NOTE: this dynamic [slug] segment coexists with the static /api/lc/* route
 * handlers because App Router resolves static segments before dynamic ones.
 */

import Link from "next/link";
import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  backendEnvReady,
  ensureGrowthSchema,
  sql,
  type EndpointRow,
} from "@/lib/lc-backend";
import {
  fmtPrice,
  gatewayUrl,
  badgeUrl,
  curlExample,
  readmeBadgeMarkdown,
  xPostText,
  docsSnippet,
  mcpListingText,
} from "@/lib/lc-growth";
import PublicApiClient from "./PublicApiClient";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

type Ctx = { params: Promise<{ slug: string }> };

// Wrapped in React cache() so generateMetadata + the page share a single
// DB lookup per request instead of querying twice.
const resolveEndpoint = cache(async (slug: string): Promise<EndpointRow | null> => {
  if (!backendEnvReady()) return null;
  await ensureGrowthSchema();
  // public_slug takes priority over short_id.
  const byPublic = await sql()<EndpointRow[]>`
    select * from lc_endpoints where public_slug = ${slug} limit 1
  `;
  if (byPublic.length > 0) return byPublic[0];
  const byShort = await sql()<EndpointRow[]>`
    select * from lc_endpoints where short_id = ${slug} limit 1
  `;
  return byShort[0] ?? null;
});

export async function generateMetadata({ params }: Ctx): Promise<Metadata> {
  const { slug } = await params;
  const ep = await resolveEndpoint(slug).catch(() => null);
  if (!ep || ep.public_page_enabled === false) {
    return { title: "API not found — LemonCake" };
  }
  const title = ep.public_title || ep.name;
  const desc =
    ep.public_description ||
    `${title} — paid-access API. ${fmtPrice(ep.price_per_call)} per call, authorized with a Pay Token.`;
  return {
    title: `${title} — paid-access API`,
    description: desc,
    alternates: { canonical: `https://www.lemoncake.xyz/api/${ep.public_slug || ep.short_id}` },
    openGraph: { title, description: desc, type: "website" },
  };
}

const IconArrow = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

export default async function PublicApiPage({ params }: Ctx) {
  const { slug } = await params;
  const ep = await resolveEndpoint(slug);
  if (!ep || ep.public_page_enabled === false) notFound();

  const shortId = ep.short_id;
  const publicSlug = ep.public_slug || shortId;
  const title = ep.public_title || ep.name;
  const description = ep.public_description?.trim() || "";
  const price = ep.price_per_call;
  const paused = ep.status !== "live";

  // Live usage — total call count + recent ledger rows. We deliberately
  // center the call ledger, not revenue (settlement is optional here).
  let totalCalls = 0;
  let recent: { upstream_status: number | null; upstream_ms: number | null; at: Date }[] = [];
  try {
    const totals = await sql()<{ calls: string }[]>`
      select count(*)::text as calls from lc_test_runs where endpoint_id = ${ep.id}
    `;
    totalCalls = Number(totals[0]?.calls ?? 0);
    recent = await sql()<typeof recent>`
      select upstream_status, upstream_ms, at
      from lc_test_runs where endpoint_id = ${ep.id}
      order by at desc limit 8
    `;
  } catch {
    /* usage is best-effort */
  }

  const snippets = {
    curl: curlExample({ shortId }),
    readme: readmeBadgeMarkdown({ apiId: shortId, slug: publicSlug }),
    xpost: xPostText({ name: title, price, slug: publicSlug }),
    docs: docsSnippet({ name: title, description, shortId, price, slug: publicSlug }),
    mcp: mcpListingText({ name: title, description, shortId, price, slug: publicSlug }),
  };

  const gw = gatewayUrl(shortId);
  const badge = badgeUrl(shortId);

  return (
    <div className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-20 bg-[#fafaf7]/95 backdrop-blur-md border-b border-[#1a0f00]/8">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="w-7 h-7 rounded-lg object-cover" />
            <span className="font-bold text-[15px]">LemonCake</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/directory" className="text-[13px] text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">Directory</Link>
            <Link href="/app" className="text-[13px] font-semibold px-4 py-1.5 bg-[#1a0f00] text-[#fffd43] rounded-lg hover:bg-[#1a0f00]/85 transition-colors">
              Start for free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <header className="max-w-5xl mx-auto px-6 pt-12 pb-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {ep.category && (
            <span className="px-2.5 py-1 rounded-full bg-white border border-[#1a0f00]/12 text-[11px] font-semibold text-[#1a0f00]/70">
              {ep.category}
            </span>
          )}
          {paused ? (
            <span className="px-2.5 py-1 rounded-full bg-[#9ca3af]/20 text-[#1a0f00]/60 text-[11px] font-bold">Paused</span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F0FDF4] border border-[#16A34A]/20 text-[#16A34A] text-[11px] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> Live
            </span>
          )}
          {ep.directory_status === "pending" && (
            <span className="px-2.5 py-1 rounded-full bg-[#fffbe6] border border-[#1a0f00]/12 text-[11px] font-semibold text-[#1a0f00]/55">
              Directory: pending review
            </span>
          )}
          {ep.directory_status === "approved" && (
            <span className="px-2.5 py-1 rounded-full bg-[#fffd43] text-[#1a0f00] text-[11px] font-bold">In Directory</span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight mb-2">{title}</h1>
        {description && (
          <p className="text-[14px] md:text-[15px] text-[#1a0f00]/60 max-w-2xl leading-relaxed">{description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-4 text-[13px] text-[#1a0f00]/55">
          <span className="text-[20px] font-black text-[#1a0f00]">{fmtPrice(price)}<span className="text-[13px] font-medium text-[#1a0f00]/45"> / call</span></span>
          <span>Pay Token required</span>
          {ep.seller_display_name && <span>by <b className="text-[#1a0f00]/75">{ep.seller_display_name}</b></span>}
        </div>
      </header>

      {/* ── Body grid (interactive bits live in the client child) ── */}
      <main className="max-w-5xl mx-auto px-6 pb-16">
        <PublicApiClient
          endpointId={ep.id}
          slug={publicSlug}
          shortId={shortId}
          gatewayUrl={gw}
          badgeUrl={badge}
          rateLimit={ep.rate_limit}
          snippets={snippets}
          usage={{
            totalCalls,
            recent: recent.map((r) => ({
              status: r.upstream_status,
              ms: r.upstream_ms,
              at: new Date(r.at).toISOString(),
            })),
          }}
        />
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1a0f00]/8 py-10 bg-[#fafaf7]">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-[#1a0f00]/45">© 2026 evidai · LemonCake</p>
          <div className="flex items-center gap-5 text-[11px] text-[#1a0f00]/45">
            <Link href="/directory" className="hover:text-[#1a0f00] transition-colors">Directory</Link>
            <Link href="/pricing" className="hover:text-[#1a0f00] transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-[#1a0f00] transition-colors">Docs</Link>
            <a href="mailto:contact@aievid.com" className="hover:text-[#1a0f00] transition-colors">contact@aievid.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
