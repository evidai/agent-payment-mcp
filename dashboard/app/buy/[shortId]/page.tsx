/**
 * /buy/[shortId] — public buyer-facing prepaid-credit purchase page.
 *
 * Server component: loads the endpoint + its seller's payout readiness
 * straight from the DB (force-dynamic, runs per request), gates on
 * paused / free / seller-not-onboarded, then hands a live endpoint to the
 * client <BuyForm /> which kicks off Stripe Checkout.
 */

import type { ReactNode } from "react";
import { backendEnvReady, sql } from "@/lib/lc-backend";
import BuyForm from "./BuyForm";

export const dynamic = "force-dynamic";
export const preferredRegion = "hnd1"; // colocate with Supabase (hnd1) to cut transpacific DB RTT on this DB-backed page

type Props = { params: Promise<{ shortId: string }> };

type Row = {
  short_id: string;
  name: string;
  price_per_call: string;
  status: string;
  stripe_charges_enabled: boolean;
};

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#faf7f0] text-[#1a0f00] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-md">
        {children}
        {/* growth loop: every /buy visitor (form OR notice) is a developer —
            the page that takes money also sells the ability to take money. */}
        <p className="mt-6 text-center text-[11px] text-black/40">
          あなたの API もこのページ 1 枚で販売できます —{" "}
          <a href="/app" className="font-bold text-black/60 underline underline-offset-2 hover:text-black">
            LemonCake で5分・初回3,000コール無料 →
          </a>
        </p>
      </div>
    </main>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <Shell>
      <div className="bg-white rounded-2xl border border-black/10 p-7 shadow-sm">
        <div className="text-2xl mb-2">🍋</div>
        <h1 className="text-lg font-bold mb-1.5">{title}</h1>
        <p className="text-[13.5px] leading-relaxed text-black/60">{body}</p>
      </div>
    </Shell>
  );
}

export default async function BuyPage({ params }: Props) {
  const { shortId } = await params;

  if (!backendEnvReady()) {
    return <Notice title="一時的に利用できません" body="決済バックエンドが設定されていません。時間をおいて再度お試しください。" />;
  }

  const rows = await sql()<Row[]>`
    select e.short_id, e.name, e.price_per_call, e.status, o.stripe_charges_enabled
    from lc_endpoints e
    join lc_owners o on o.id = e.owner_id
    where e.short_id = ${shortId}
    limit 1
  `;
  if (rows.length === 0) {
    return <Notice title="API が見つかりません" body="このリンクは無効か、API が削除された可能性があります。" />;
  }
  const ep = rows[0];

  if (ep.status !== "live") {
    return <Notice title="現在停止中" body={`「${ep.name}」は一時的に停止しています。提供者にお問い合わせください。`} />;
  }
  if (Number(ep.price_per_call) <= 0) {
    return <Notice title="無料の API です" body={`「${ep.name}」は無料で利用できます。前払いは不要です。`} />;
  }
  if (!ep.stripe_charges_enabled) {
    return <Notice title="支払い準備中" body={`「${ep.name}」の提供者がまだ支払いの受け付けを有効にしていません。`} />;
  }

  return (
    <Shell>
      <BuyForm shortId={ep.short_id} name={ep.name} pricePerCall={ep.price_per_call} />
    </Shell>
  );
}
