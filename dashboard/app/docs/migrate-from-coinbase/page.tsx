import Link from "next/link";
import type { Metadata } from "next";

// SEO-shaped migration guide. The page is designed to rank for queries like
// "coinbase x402 facilitator alternative" / "migrate from coinbase x402 to
// base USDC" — terms that Coinbase x402 adopters search after hitting the
// $0.001/tx fee cliff and looking for either a cheaper or geo-broader option.
//
// Content is honest: Coinbase is the cheapest per-tx; we win on free tier
// (gas sponsored), MPP interop, JP onramp, and KYA bundle. Position is
// "use both, route by use case" not "rip out Coinbase."

export const metadata: Metadata = {
  title: "Migrate from Coinbase x402 — LemonCake Docs",
  description: "Switching x402 facilitator from Coinbase CDP to LemonCake. Drop-in middleware change, MPP-compatible, gas-sponsored free tier, native JP onramp. Concrete diff + cutover script.",
  alternates: { canonical: "https://lemoncake.xyz/docs/migrate-from-coinbase" },
  openGraph: {
    title: "Migrating from Coinbase x402 → LemonCake",
    description: "Same spec, drop-in middleware. Free 1k tx/mo gas sponsored. JP onramp included.",
    url: "https://lemoncake.xyz/docs/migrate-from-coinbase",
    type: "article",
  },
};

export default function MigratePage() {
  return (
    <main className="min-h-screen bg-white">
      <article className="mx-auto max-w-2xl px-5 py-12 sm:py-16 prose prose-sm">
        <Link href="/docs" className="text-xs text-amber-700 no-underline">← Docs</Link>

        <h1 className="!mt-4 !mb-2 text-3xl font-bold text-gray-900">Migrate from Coinbase x402</h1>
        <p className="text-sm text-gray-500 !mt-0">
          Drop-in middleware change. ~30 min of dev work. Production-safe rollback path included.
        </p>

        <hr className="my-8 border-gray-200" />

        {/* ── Should you migrate? ── */}
        <h2 className="text-xl font-bold mt-8 mb-3 text-gray-900">Honest take: should you actually migrate?</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          Coinbase&apos;s x402 facilitator is cheap and reliable. We&apos;re not telling you to rip it out. Here&apos;s the truth table:
        </p>

        <div className="not-prose my-5 overflow-x-auto">
          <table className="w-full text-[12px] border border-gray-200 rounded-xl">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Your situation</th>
                <th className="text-left py-2 px-3 text-gray-600 font-semibold">Use</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {[
                ["You ship &gt; 10k tx / month, US-only, low ops overhead OK", "Stay on Coinbase ($0.001/tx wins on volume)"],
                ["You&apos;re still proving the agent commerce flow, &lt; 1k tx/month", "LemonCake (free tier, gas sponsored)"],
                ["Any of your buyers are in Japan", "LemonCake (Stripe / Coinbase onramps don&apos;t serve JP)"],
                ["You want Stripe MPP + x402 in the same facilitator", "LemonCake (MPP-compat by default)"],
                ["You want KYA verified-agent identity baked in", "LemonCake (Pro tier includes it)"],
                ["You don&apos;t want to manage gas on your service wallet", "LemonCake (we sponsor up to 1k tx/mo)"],
              ].map(([when, what]) => (
                <tr key={when as string} className="border-t border-gray-100">
                  <td className="py-2 px-3" dangerouslySetInnerHTML={{ __html: when as string }} />
                  <td className="py-2 px-3 font-semibold" dangerouslySetInnerHTML={{ __html: what as string }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 leading-relaxed">
          Most teams end up running both: Coinbase for high-volume US tx, LemonCake for JP buyers + MPP-signed agents. That&apos;s fine — facilitators are commodity at the spec level.
        </p>

        {/* ── Code diff ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">The actual code change</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          x402 is one spec; only the facilitator URL and (optionally) the API key differ. Here&apos;s the typical diff in a Node/Express handler:
        </p>

        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`import { paymentMiddleware } from "@coinbase/x402";
+ import { paymentMiddleware } from "@lemon-cake/x402-server";

  app.use(paymentMiddleware({
-   facilitator: "https://api.cdp.coinbase.com/v2/x402",
+   facilitator: "https://lemoncake.xyz/api/x402",
    network:     "base",
    receiver:    process.env.RECEIVER_WALLET,
-   apiKey:      process.env.CDP_API_KEY,
+   apiKey:      process.env.LEMON_CAKE_API_KEY,    // free tier: no key required
+   mpp:         true,                              // accept Stripe MPP-signed payments
  }));`}</pre>

        <p className="text-sm text-gray-700 leading-relaxed mt-4">
          That&apos;s it. The receiver wallet is unchanged, the network is unchanged, the per-call price you set is unchanged. Buyers&apos; permits don&apos;t need to be re-signed — the spender address on existing Coinbase permits already targets the buyer&apos;s wallet, not Coinbase&apos;s facilitator.
        </p>

        {/* ── Cutover plan ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Production cutover (gradual)</h2>
        <ol className="text-sm text-gray-700 leading-relaxed list-decimal pl-5 space-y-2">
          <li>
            <strong className="text-gray-900">Day 0:</strong> drop a feature flag into your handler that routes 1% of traffic to LemonCake facilitator. Compare settle latency + error rate side-by-side in your logs.
          </li>
          <li>
            <strong className="text-gray-900">Day 1-3:</strong> bump to 10%, monitor edge cases (refunds, replay attempts). Most surprises show up at this ratio.
          </li>
          <li>
            <strong className="text-gray-900">Day 4-7:</strong> bump to 50%. Validate the free-tier counter on{" "}
            <Link href="/admin" className="text-amber-700 underline-offset-2 hover:underline">your dashboard</Link>{" "}
            is tracking the right number of settled tx.
          </li>
          <li>
            <strong className="text-gray-900">Day 8:</strong> flip to 100%. Leave the Coinbase code path in the feature flag for one more week as the rollback escape hatch.
          </li>
          <li>
            <strong className="text-gray-900">Day 15:</strong> delete the Coinbase code path. You&apos;re done.
          </li>
        </ol>

        {/* ── Rollback ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Rollback script</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          If anything goes sideways, flip one env var. The facilitator URL is the only routing point.
        </p>
        <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 text-xs overflow-x-auto leading-relaxed">{`# rollback to Coinbase in < 1 minute
$ heroku config:set X402_FACILITATOR=https://api.cdp.coinbase.com/v2/x402
$ heroku restart`}</pre>

        {/* ── Free tier ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">Why the free tier is real (not bait)</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          We sponsor gas on Base for the first 1,000 settled tx / month per project. Above that, $0.005/tx pay-as-you-go. We can afford this because (a) we batch settle on Base where gas is &lt;$0.0001/tx, and (b) the conversion rate from free → Pro for projects that genuinely use 1k tx is high enough to subsidize the burn.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          If your project hits the 1k cap, we email you at 80% and 100%. No surprise rate limiting, no service interruption — overage routes to the $0.005/tx bucket automatically.
        </p>

        {/* ── MPP interop ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">What &quot;MPP-compatible&quot; actually means</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          After Stripe Sessions 2026, the Machine Payments Protocol (MPP) became the de-facto agent-payment signing spec for the Stripe / Tempo / Privy stack. Coinbase&apos;s facilitator does not accept MPP-signed payments today — it&apos;s x402-spec-only.
        </p>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          LemonCake&apos;s facilitator accepts <em>both</em>:
        </p>
        <ul className="text-sm text-gray-700 leading-relaxed list-disc pl-5 space-y-1.5">
          <li>x402 HTTP 402 + ERC-2612 permit (Coinbase-style)</li>
          <li>Stripe MPP-signed payment intents settling on Base/USDC</li>
        </ul>
        <p className="text-sm text-gray-700 leading-relaxed mt-3">
          For you: one facilitator URL handles both flavors. For buyers: their existing Privy / Stripe MPP signature continues to work, no re-sign needed.
        </p>

        {/* ── Help ── */}
        <h2 className="text-xl font-bold mt-10 mb-3 text-gray-900">If you want us to do this for you</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          The migration sprint is{" "}
          <Link href="/consulting" className="text-amber-700 underline-offset-2 hover:underline font-semibold">$5,000 flat, 2 weeks</Link>
          {" "}— includes the PR into your repo, the cutover plan, the rollback script, and 30 days of post-launch fixes. Email{" "}
          <a href="mailto:contact@aievid.com" className="text-amber-700 underline-offset-2 hover:underline">contact@aievid.com</a>{" "}
          and we&apos;ll send a written scope inside 24h.
        </p>

        <hr className="my-10 border-gray-200" />
        <p className="text-xs text-gray-400">
          Updated 2026-05-26. Pricing on Coinbase x402 facilitator pulled from{" "}
          <a href="https://docs.cdp.coinbase.com/x402/welcome" className="underline hover:text-amber-700">docs.cdp.coinbase.com/x402</a>. We update this monthly.
        </p>
      </article>
    </main>
  );
}
