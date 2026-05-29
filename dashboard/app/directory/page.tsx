/**
 * /directory — the LemonCake Directory.
 *
 * Lists ONLY endpoints with an approved directory submission. Deliberately
 * simple: name, category, price, short description, a "View API page" link.
 * No search / reviews / ranking. Admin approval = flip
 * lc_directory_submissions.status to 'approved' (source of truth here).
 */

import Link from "next/link";
import type { Metadata } from "next";
import {
  backendEnvReady,
  ensureGrowthSchema,
  sql,
  type EndpointRow,
} from "@/lib/lc-backend";
import { fmtPrice, publicPagePath, CATEGORIES } from "@/lib/lc-growth";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1";

export const metadata: Metadata = {
  title: "LemonCake Directory — paid-access APIs you can call today",
  description:
    "A directory of paid-access APIs built with LemonCake. Each one is callable with a Pay Token, metered per request.",
  alternates: { canonical: "https://www.lemoncake.xyz/directory" },
};

type Listing = EndpointRow & { d_category: string; d_description: string | null };

async function approvedListings(): Promise<Listing[]> {
  if (!backendEnvReady()) return [];
  try {
    await ensureGrowthSchema();
    return await sql()<Listing[]>`
      select e.*, d.category as d_category, d.description as d_description
      from lc_directory_submissions d
      join lc_endpoints e on e.id = d.endpoint_id
      where d.status = 'approved'
        and coalesce(e.public_page_enabled, true) = true
      order by d.reviewed_at desc nulls last, d.submitted_at desc
    `;
  } catch {
    return [];
  }
}

export default async function DirectoryPage() {
  const listings = await approvedListings();

  // Group by category for a tidy layout.
  const byCategory = new Map<string, Listing[]>();
  for (const l of listings) {
    const cat = l.d_category || l.category || "Other";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(l);
  }
  const orderedCats = [...CATEGORIES].filter((c) => byCategory.has(c));
  // Any categories not in the canonical list (shouldn't happen) go last.
  for (const c of byCategory.keys()) if (!orderedCats.includes(c as (typeof CATEGORIES)[number])) orderedCats.push(c as (typeof CATEGORIES)[number]);

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
            <Link href="/docs" className="text-[13px] text-[#1a0f00]/60 hover:text-[#1a0f00] transition-colors">Docs</Link>
            <Link href="/app" className="text-[13px] font-semibold px-4 py-1.5 bg-[#1a0f00] text-[#fffd43] rounded-lg hover:bg-[#1a0f00]/85 transition-colors">
              Start for free
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Header ── */}
      <header className="max-w-5xl mx-auto px-6 pt-14 pb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">LemonCake Directory</h1>
        <p className="text-[14px] md:text-[15px] text-[#1a0f00]/60 max-w-xl mx-auto leading-relaxed">
          Paid-access APIs built with LemonCake. Each one is callable today with a Pay Token, metered per request.
        </p>
      </header>

      {/* ── Listings ── */}
      <main className="max-w-5xl mx-auto px-6 pb-20">
        {listings.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[#1a0f00]/15 bg-white py-20 text-center">
            <p className="text-[15px] font-bold text-[#1a0f00]/70 mb-1">No listings yet</p>
            <p className="text-[13px] text-[#1a0f00]/45 max-w-sm mx-auto">
              Approved APIs will appear here. Built one? Submit it from your dashboard after creating an endpoint.
            </p>
            <Link href="/app" className="inline-flex items-center gap-2 mt-6 px-6 py-2.5 bg-[#1a0f00] text-[#fffd43] font-bold rounded-xl hover:bg-[#1a0f00]/85 transition-colors text-[13px]">
              Create an API
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {orderedCats.map((cat) => (
              <section key={cat}>
                <h2 className="text-[12px] font-bold text-[#1a0f00]/45 uppercase tracking-widest mb-3">{cat}</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {byCategory.get(cat)!.map((l) => {
                    const title = l.public_title || l.name;
                    const desc = (l.d_description || l.public_description || "").trim();
                    const href = publicPagePath(l.public_slug || l.short_id);
                    const paused = l.status !== "live";
                    return (
                      <Link
                        key={l.id}
                        href={href}
                        className="group rounded-2xl bg-white border border-[#1a0f00]/10 p-5 hover:border-[#1a0f00]/25 transition-colors flex flex-col"
                      >
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <p className="text-[15px] font-black leading-snug group-hover:underline">{title}</p>
                          <span className="shrink-0 px-2 py-0.5 rounded-full bg-[#fffd43] text-[#1a0f00] text-[11px] font-bold">
                            {fmtPrice(l.price_per_call)}
                          </span>
                        </div>
                        {desc && <p className="text-[12.5px] text-[#1a0f00]/60 leading-relaxed mb-3 line-clamp-3">{desc}</p>}
                        <div className="mt-auto flex items-center justify-between text-[11px] text-[#1a0f00]/45">
                          <span>Powered by LemonCake</span>
                          {paused ? <span className="text-[#1a0f00]/40">Paused</span> : <span className="text-[#16A34A] font-semibold">Live</span>}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-[#1a0f00]/8 py-10 bg-[#fafaf7]">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-[#1a0f00]/45">© 2026 evidai · LemonCake</p>
          <div className="flex items-center gap-5 text-[11px] text-[#1a0f00]/45">
            <Link href="/pricing" className="hover:text-[#1a0f00] transition-colors">Pricing</Link>
            <Link href="/docs" className="hover:text-[#1a0f00] transition-colors">Docs</Link>
            <a href="mailto:contact@aievid.com" className="hover:text-[#1a0f00] transition-colors">contact@aievid.com</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
