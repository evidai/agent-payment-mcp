"use client";

/**
 * /buy/[shortId]/success — buyer lands here after Stripe Checkout.
 *
 * Reads ?session_id from the URL, calls /api/lc/stripe/checkout-result which
 * idempotently mints the prepaid Pay Token, and displays the JWT + a ready
 * curl command. Polls a few times to absorb any payment-processing lag.
 */

import { useEffect, useState, type ReactNode } from "react";

type Result = {
  paid: boolean;
  status?: string;
  jwt?: string;
  token?: { id: string; budget: string; maxCalls: number; expiresAt: string };
  endpoint?: { shortId: string; name: string };
  gatewayUrl?: string;
  error?: string;
};

function Card({ children }: { children: ReactNode }) {
  return <div className="bg-white rounded-2xl border border-black/10 p-7 shadow-sm">{children}</div>;
}

function Spinner() {
  return <div className="inline-block w-6 h-6 border-2 border-black/15 border-t-[#1a0f00] rounded-full animate-spin" />;
}

export default function SuccessPage() {
  const [state, setState] = useState<"loading" | "ok" | "pending" | "error">("loading");
  const [data, setData] = useState<Result | null>(null);
  const [errMsg, setErrMsg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const parts = window.location.pathname.split("/").filter(Boolean); // ["buy", "<shortId>", "success"]
    const shortId = parts[1];
    if (!sessionId || !shortId) {
      setState("error");
      setErrMsg("リンクが不完全です。");
      return;
    }

    let tries = 0;
    let stopped = false;
    async function poll() {
      tries++;
      try {
        const r = await fetch(
          `/api/lc/stripe/checkout-result?session_id=${encodeURIComponent(sessionId!)}&shortId=${encodeURIComponent(shortId)}`,
        );
        const j: Result = await r.json();
        if (!r.ok) {
          setState("error");
          setErrMsg(j.error || "確認に失敗しました。");
          return;
        }
        if (j.paid) {
          setData(j);
          setState("ok");
          return;
        }
        if (tries < 5 && !stopped) {
          setTimeout(poll, 1500);
          return;
        }
        setState("pending");
      } catch {
        if (tries < 5 && !stopped) {
          setTimeout(poll, 1500);
          return;
        }
        setState("error");
        setErrMsg("ネットワークエラー。");
      }
    }
    poll();
    return () => {
      stopped = true;
    };
  }, []);

  const [linkCopied, setLinkCopied] = useState(false);
  function copyRecoveryLink() {
    navigator.clipboard?.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  function copyJwt() {
    if (data?.jwt) {
      navigator.clipboard?.writeText(data.jwt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <main className="min-h-screen bg-[#faf7f0] text-[#1a0f00] flex items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg">
        {state === "loading" && (
          <Card>
            <Spinner />
            <p className="text-sm text-black/55 mt-3">支払いを確認しています…</p>
          </Card>
        )}

        {state === "pending" && (
          <Card>
            <div className="text-2xl mb-2">⏳</div>
            <h1 className="text-lg font-bold mb-1.5">処理中です</h1>
            <p className="text-[13.5px] text-black/60 leading-relaxed">
              支払いはまだ確定していません。数秒後にこのページを再読み込みしてください。
            </p>
          </Card>
        )}

        {state === "error" && (
          <Card>
            <div className="text-2xl mb-2">⚠️</div>
            <h1 className="text-lg font-bold mb-1.5">確認できませんでした</h1>
            <p className="text-[13.5px] text-black/60 leading-relaxed">{errMsg}</p>
          </Card>
        )}

        {state === "ok" && data?.jwt && (
          <Card>
            <div className="text-2xl mb-2">🎉</div>
            <p className="text-[11px] font-bold tracking-widest text-black/40 uppercase mb-1">支払い完了</p>
            <h1 className="text-xl font-bold leading-tight mb-1">{data.endpoint?.name}</h1>
            <p className="text-[13px] text-black/55 mb-5">
              ${Number(data.token?.budget).toFixed(2)} 分のクレジット（最大{" "}
              {data.token?.maxCalls.toLocaleString()} 回）が発行されました。
            </p>

            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 mb-4 text-[12px] leading-relaxed text-amber-800">
              <span className="font-bold">これがあなたの API キーです。</span>{" "}
              安全な場所に保存してください。このページの URL を開き直せば、いつでも同じトークンを再表示できます。
              <button
                onClick={copyRecoveryLink}
                className="mt-1.5 block rounded-md border border-amber-300 bg-white/70 px-2 py-1 text-[11px] font-bold text-amber-900 hover:bg-white"
              >
                {linkCopied ? "復元リンクをコピーしました ✓" : "復元リンクをコピー"}
              </button>
            </div>

            <label className="block mb-1 text-[12px] font-semibold text-black/55">Pay Token (JWT)</label>
            <div className="relative mb-4">
              <pre className="text-[11px] leading-snug bg-[#1a0f00] text-emerald-200 rounded-xl p-3 pr-16 overflow-x-auto whitespace-pre-wrap break-all">
                {data.jwt}
              </pre>
              <button
                onClick={copyJwt}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-white/15 text-white text-[11px] font-bold hover:bg-white/25"
              >
                {copied ? "コピー済" : "コピー"}
              </button>
            </div>

            <label className="block mb-1 text-[12px] font-semibold text-black/55">使い方</label>
            <pre className="text-[11px] leading-snug bg-black/[0.04] border border-black/10 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap break-all text-black/75">
              {`curl -X POST ${data.gatewayUrl} \\
  -H "Authorization: Bearer <PAY_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{}'`}
            </pre>

            <p className="mt-4 text-[11px] text-black/40 leading-relaxed">
              Token ID: {data.token?.id} ・ 有効期限:{" "}
              {data.token?.expiresAt ? new Date(data.token.expiresAt).toLocaleDateString() : "—"}
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}
