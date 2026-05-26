import Link from "next/link";
import type { Metadata } from "next";

// SEO sibling to /docs/migrate-from-coinbase. Crossmint's pricing is
// $0.05/MAW + per-tx, structurally different from LemonCake's $0.005/tx
// + $50/mo Pro. Migration math depends entirely on the buyer's tx/MAW
// distribution — we lay it out honestly so they self-select.

export const metadata: Metadata = {
  title: "Migrate from Crossmint — LemonCake Docs",
  description: "Switching from Crossmint agent wallets to LemonCake facilitator. Cost calculator, non-custodial migration path, MPP interop, Stripe coexistence.",
  alternates: { canonical: "https://lemoncake.xyz/docs/migrate-from-crossmint" },
  openGraph: {
    title: "Migrating from Crossmint → LemonCake",
    description: "Per-MAW vs per-tx pricing. Honest calculator. Free 1k tx/mo, gas sponsored.",
    url: "https://lemoncake.xyz/docs/migrate-from-crossmint",
    type: "article",
  },
};

export default function MigrateCrossmintPage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">Migrate from Crossmint</h1>
        <p className="text-sm text-gray-500 !mt-0">
          Per-MAW vs per-tx pricing. Different stacks at the wallet layer. Honest cost calculator inline.
        </p>

        <hr className="my-8 border-gray-200" />

        {/* ── Honest model diff ── */}
        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">First, the model difference</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Crossmint and LemonCake solve overlapping problems differently:
        </p>

        <div className="not-prose my-5 overflow-x-auto">
          <table className="w-full text-[12px] border border-gray-200 rounded-xl">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Layer</th>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Crossmint</th>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">LemonCake</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {[
                ["Buyer wallet", "Crossmint-issued + virtual Visa card", "Buyer's own Privy / EOA wallet (non-custodial)"],
                ["Charge rail", "Card-or-stablecoin (Crossmint routes)", "USDC on Base via x402 / MPP"],
                ["Pricing", "$0.05 / MAW + per-tx fee", "$50/mo + $0.005/tx (Pro); free 1k tx/mo"],
                ["Custody", "Crossmint holds wallet keys", "Buyer holds keys (FSA confirmed non-custodial)"],
                ["MPP-compat", "Card-rail native; MPP roadmap unclear", "Native — accepts MPP-signed payments"],
                ["JP onramp", "Card issuance not JP-active", "JPY → USDC on Base via internal route"],
              ].map(([layer, cm, lc]) => (
                <tr key={layer} className="border-t border-gray-100">
                  <td className="py-2 px-3 font-semibold">{layer}</td>
                  <td className="py-2 px-3">{cm}</td>
                  <td className="py-2 px-3">{lc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed">
          The structural difference is custody. Crossmint <strong>holds</strong> the agent&apos;s wallet — convenient, but you depend on Crossmint never being subpoenaed, deplatformed, or going under. LemonCake is non-custodial by design — the agent&apos;s key lives in the buyer&apos;s Privy embedded wallet or their own EOA.
        </p>

        {/* ── Cost calculator ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Cost calculator</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Run the math on your real numbers. Crossmint = (MAW × $0.05) + (tx × ~$0.025 effective per-tx average).
          LemonCake = $50 floor + (tx × $0.005). Examples:
        </p>

        <div className="not-prose my-5 overflow-x-auto">
          <table className="w-full text-[12px] border border-gray-200 rounded-xl">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Your scale</th>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Crossmint est/mo</th>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">LemonCake est/mo</th>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Winner</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {[
                ["100 agents, 500 tx",   "$5 + $12.50 = $17.50",     "Free tier (under 1k tx)",     "LemonCake"],
                ["100 agents, 5k tx",    "$5 + $125 = $130",         "$50 + $25 = $75",             "LemonCake"],
                ["1,000 agents, 5k tx", "$50 + $125 = $175",        "$50 + $25 = $75",             "LemonCake"],
                ["1,000 agents, 50k tx", "$50 + $1,250 = $1,300",   "$50 + $250 = $300",           "LemonCake"],
                ["10,000 agents, 100 tx avg", "$500 + $25,000 = $25,500", "$50 + $5,000 = $5,050", "LemonCake"],
                ["10,000 agents, card-mostly", "$500 + Visa interchange", "n/a (no card rail)",    "Crossmint"],
              ].map(([scale, cm, lc, win]) => (
                <tr key={scale} className="border-t border-gray-100">
                  <td className="py-2 px-3">{scale}</td>
                  <td className="py-2 px-3 text-gray-500">{cm}</td>
                  <td className="py-2 px-3 text-gray-500">{lc}</td>
                  <td className={`py-2 px-3 font-semibold ${win === "LemonCake" ? "text-emerald-600" : "text-blue-600"}`}>{win}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          Crossmint per-tx fee modeled as a $0.025 average; actuals vary by network and amount. Run their public calculator at{" "}
          <a href="https://www.crossmint.com/pricing" className="underline hover:text-amber-700">crossmint.com/pricing</a> with your real distribution.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-4">
          <strong>The honest pattern:</strong> Crossmint wins when you genuinely need virtual Visa card issuance (e.g., your agents are paying card-only merchants like Amazon Marketplace). LemonCake wins everywhere on-chain.
        </p>

        {/* ── Migration path ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Migration path</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          The wallet-layer difference means migration is more than a URL swap — buyers move from a Crossmint-held key to their own non-custodial wallet. Here&apos;s the playbook:
        </p>

        <ol className="text-sm text-gray-700 leading-relaxed list-decimal pl-5 space-y-2">
          <li>
            <strong className="text-gray-900">Day 0:</strong> add LemonCake as a parallel option in your buyer onboarding. New buyers get Privy embedded wallet + ERC-2612 permit; existing Crossmint buyers keep working.
          </li>
          <li>
            <strong className="text-gray-900">Day 1-14:</strong> ship the migration UX — &quot;Move to non-custodial wallet&quot;. Crossmint exposes wallet export; the user signs in to Privy with the same email, and your backend re-issues an ERC-2612 permit against the new EOA.
          </li>
          <li>
            <strong className="text-gray-900">Day 15-30:</strong> let buyers self-migrate. Don&apos;t force — Crossmint card buyers stay on Crossmint, USDC-native buyers move to LemonCake.
          </li>
          <li>
            <strong className="text-gray-900">Day 30+:</strong> route by use case in production — card payments go through Crossmint (you still need them if you use Crossmint Cards), agent USDC payments go through LemonCake.
          </li>
        </ol>

        <p className="text-sm text-gray-700 leading-relaxed mt-4">
          You can absolutely run both forever. Crossmint for card rails, LemonCake for x402/MPP/USDC. The two don&apos;t conflict at the protocol layer.
        </p>

        {/* ── Code diff ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Code diff (the LemonCake side)</h2>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`// before — Crossmint
import { Crossmint } from "@crossmint/server-sdk";
const xm = new Crossmint({ apiKey: process.env.CROSSMINT_KEY });
await xm.wallets.create({ ownerEmail: buyer.email });

// after — LemonCake (non-custodial)
import { paymentMiddleware } from "@lemon-cake/x402-server";
app.use(paymentMiddleware({
  facilitator: "https://lemoncake.xyz/api/x402",
  network:     "base",
  receiver:    process.env.RECEIVER_WALLET,
  mpp:         true,
}));
// Buyer signs ERC-2612 permit in their own Privy wallet:
//   https://lemoncake.xyz/start/v2`}</pre>

        {/* ── Help ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Help with the migration</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          The buyer-side migration is the part that bites — every Crossmint customer is on Crossmint&apos;s custodied wallet, and you can&apos;t silently move keys for them. Our{" "}
          <Link href="/consulting" className="text-amber-700 underline-offset-2 hover:underline font-semibold">$5,000 / 2-week integration sprint</Link>
          {" "}includes:
        </p>
        <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1.5">
          <li>The migration UX (export → re-import → permit)</li>
          <li>The dual-routing backend (card → Crossmint, USDC → LemonCake)</li>
          <li>Customer email templates for the cutover</li>
          <li>30 days post-launch fixes</li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          Email{" "}
          <a href="mailto:contact@aievid.com" className="text-amber-700 underline-offset-2 hover:underline">contact@aievid.com</a>{" "}
          for a written scope inside 24h.
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-400">
          Updated 2026-05-26. Crossmint pricing pulled from{" "}
          <a href="https://www.crossmint.com/pricing" className="underline hover:text-amber-700">crossmint.com/pricing</a>. We update this monthly.
        </p>
      </article>
    </main>
  );
}
