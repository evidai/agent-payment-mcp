import Link from "next/link";
import type { Metadata } from "next";

// The most important migration page strategically — Stripe MPP is the
// default the global market is gravitating toward post-Sessions 2026.
// We DON'T compete with MPP; we settle MPP-signed payments on Base/USDC.
// This page is positioned to capture searches like "Stripe MPP alternative",
// "Stripe MPP non-custodial", "Stripe MPP on Base" with the honest answer:
// don't migrate FROM Stripe MPP — run LemonCake ALONGSIDE it as the
// Base/USDC settlement layer + JP onramp.

export const metadata: Metadata = {
  title: "Stripe MPP + LemonCake — LemonCake Docs",
  description: "Don't migrate from Stripe Machine Payments Protocol — run LemonCake alongside it on Base/USDC. JP onramp included. MPP-signed payments settle natively.",
  alternates: { canonical: "https://lemoncake.xyz/docs/migrate-from-stripe-mpp" },
  openGraph: {
    title: "Stripe MPP + LemonCake (don't migrate, coexist)",
    description: "MPP-signed payments settle natively on LemonCake facilitator. JP onramp included.",
    url: "https://lemoncake.xyz/docs/migrate-from-stripe-mpp",
    type: "article",
  },
};

export default function MigrateStripeMppPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">Stripe MPP + LemonCake (don&apos;t migrate, coexist)</h1>
        <p className="text-sm text-gray-500 !mt-0">
          The honest take: keep Stripe MPP for global card + USDC. Add LemonCake for Base/USDC + JP onramp. They run side by side.
        </p>

        <hr className="my-8 border-gray-200" />

        {/* ── The honest setup ── */}
        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Why this guide is different</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Most &quot;migrate from X to Y&quot; guides try to convince you to rip out the incumbent. We&apos;re not going to do that here. Stripe Machine Payments Protocol shipped at Sessions 2026 with Bridge custody, Privy CLI integration, and Issuing-card backing in 30+ countries. That&apos;s a serious stack.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          Where LemonCake fits: we accept <em>MPP-signed payments</em> and settle them on Base/USDC via our facilitator. Stripe MPP is the signing standard; we&apos;re one of several Base/USDC facilitators that can settle the resulting transaction. This is the same pattern as accepting Stripe-tokenized cards through any acquirer.
        </p>

        {/* ── When to add LemonCake to a Stripe MPP stack ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Why add LemonCake alongside MPP?</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Three concrete cases where Stripe MPP alone leaves you short:
        </p>

        <ol className="text-sm text-gray-700 leading-relaxed list-decimal pl-5 space-y-3 mt-4">
          <li>
            <strong className="text-gray-900">JP buyers.</strong> Stripe Crypto Onramp is not available in Japan (as of May 2026). You can accept Stripe MPP-signed payments from a JP buyer, but the buyer has no onramp to fund the wallet that signs the MPP intent. LemonCake&apos;s native JPY → USDC → Base flow gives you a JP-funded buyer that then signs Stripe MPP. Same protocol, different onramp.
          </li>
          <li>
            <strong className="text-gray-900">Per-tx volume cost.</strong> Stripe&apos;s MPP take rate follows Stripe pricing (currently estimated ~$0.10/tx all-in at typical volumes). LemonCake&apos;s facilitator is $0.005/tx after the first 1k/mo free. For high-frequency micro-payments, the same MPP-signed transaction settled through LemonCake is materially cheaper. You don&apos;t lose Stripe — Stripe just doesn&apos;t see that tx.
          </li>
          <li>
            <strong className="text-gray-900">KYA / non-custodial requirement.</strong> Stripe MPP works with Bridge custody by default. If you have a buyer who explicitly cannot tolerate custody (regulated fund, EU GDPR-conscious org, FSA-cleared JP fund), LemonCake&apos;s ERC-2612 permit + buyer-controlled wallet + bundled KYA identity gives a non-custodial path with no Stripe involvement.
          </li>
        </ol>

        {/* ── Architecture diagram ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Coexistence architecture</h2>

        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed font-mono">{`        ┌──────────────────────────────────────────────────────┐
        │              your API / agent platform               │
        └──────────────────────┬───────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            │                                     │
       MPP-signed by                       MPP-signed by
       Stripe Privy wallet                LemonCake / Privy wallet
            │                                     │
            ▼                                     ▼
    ┌───────────────┐                  ┌───────────────────────┐
    │  Stripe MPP   │                  │  LemonCake facilitator│
    │  facilitator  │                  │  (Base / USDC)        │
    │  (Bridge      │                  │                       │
    │  custody)     │                  │  Free 1k tx/mo        │
    │  Take-rate    │                  │  $0.005/tx after      │
    └───────────────┘                  │  JP onramp included   │
                                       └───────────────────────┘`}</pre>

        <p className="text-sm text-gray-700 leading-relaxed mt-4">
          Your code routes based on what the buyer&apos;s wallet hands you. Same MPP signature standard, two facilitators. Buyers pick by geo / cost preference.
        </p>

        {/* ── Code diff ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Code diff (add LemonCake as a fallback facilitator)</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`import { mppMiddleware } from "@stripe/mpp-server";
+ import { paymentMiddleware as lemonCake } from "@lemon-cake/x402-server";

  app.use(mppMiddleware({
    facilitator: "https://api.stripe.com/v1/mpp",
    apiKey:      process.env.STRIPE_API_KEY,
+   fallbackFacilitator: lemonCake({
+     facilitator: "https://lemoncake.xyz/api/x402",
+     network:     "base",
+     mpp:         true,
+   }),
+   route: (intent) => {
+     // route by buyer geo or cost preference
+     if (intent.buyerCountry === "JP")             return "lemoncake";
+     if (intent.metadata.preferred === "base-usdc") return "lemoncake";
+     return "stripe";
+   },
  }));`}</pre>

        <p className="text-sm text-gray-700 leading-relaxed mt-4">
          Your buyers don&apos;t care which facilitator settles their MPP-signed payment — the spec is the spec. You route based on cost, geo, custody preference, or whatever else matters to your stack.
        </p>

        {/* ── FAQ ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">FAQ</h2>
        <div className="space-y-4">
          {[
            {
              q: "If I add LemonCake, does Stripe see those transactions?",
              a: "No. Routing is at your edge. Stripe sees only the MPP intents you forward to Stripe. The Base/USDC settlements done via LemonCake show up in your LemonCake dashboard, not Stripe&apos;s.",
            },
            {
              q: "Does my Stripe MPP integration need to change?",
              a: "Only if you want LemonCake routing. The Stripe MPP path stays identical; you&apos;re adding a conditional fallback, not replacing anything.",
            },
            {
              q: "Will Stripe mind?",
              a: "Stripe MPP is an open spec, not exclusively a Stripe-settled protocol. Multiple facilitators is the design assumption. (Same way Stripe accepts cards from any acquirer.)",
            },
            {
              q: "What if I just want LemonCake, no Stripe?",
              a: "Drop the Stripe code path and use LemonCake&apos;s middleware directly. You still accept MPP-signed payments — Stripe is just no longer in your stack.",
            },
            {
              q: "Is there a migration sprint for this?",
              a: "Yes — same $5,000 / 2-week scope. We add LemonCake as a fallback facilitator, set up the routing logic, and ship the geo/cost-based router. See /consulting.",
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <p className="text-sm font-bold text-gray-900 !mb-1">{q}</p>
              <p className="text-sm text-gray-600 leading-relaxed !mt-0" dangerouslySetInnerHTML={{ __html: a }} />
            </div>
          ))}
        </div>

        {/* ── Help ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Want us to do it?</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          <Link href="/consulting" className="text-amber-700 underline-offset-2 hover:underline font-semibold">$5,000, 2 weeks, fixed</Link>
          {" "}— we ship the dual-facilitator routing into your repo, set up the geo router, and validate the cutover with a 1% traffic mirror before flipping. Email{" "}
          <a href="mailto:contact@aievid.com" className="text-amber-700 underline-offset-2 hover:underline">contact@aievid.com</a>.
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-400">
          Updated 2026-05-26. Stripe MPP details pulled from Stripe Sessions 2026 recap. Pricing estimates are non-authoritative — confirm with Stripe sales.
        </p>
      </article>
    </main>
  );
}
