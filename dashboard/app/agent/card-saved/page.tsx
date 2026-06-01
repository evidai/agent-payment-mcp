"use client";

/**
 * /agent/card-saved — return page after the hosted Stripe card-save.
 * Finalizes via /api/lc/agent/card-result (session_id + key in the URL), then
 * the agent can top up off-session.
 */
import { useEffect, useState } from "react";

export default function CardSavedPage() {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const sessionId = p.get("session_id");
    const key = p.get("key");
    if (!sessionId || !key) { setState("error"); setMsg("Missing parameters."); return; }
    fetch(`/api/lc/agent/card-result?session_id=${encodeURIComponent(sessionId)}&key=${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.cardSaved) setState("ok");
        else { setState("error"); setMsg(j.error || "Could not confirm the card."); }
      })
      .catch(() => { setState("error"); setMsg("network_error"); });
  }, []);

  return (
    <main className="min-h-screen bg-[#fafaf7] text-[#1a0f00] font-sans antialiased px-6 py-16">
      <div className="max-w-[440px] mx-auto text-center">
        {state === "loading" && <p className="text-[14px] text-[#1a0f00]/55">Confirming your card…</p>}

        {state === "ok" && (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#16A34A] text-white text-[22px] font-black mb-4">✓</div>
            <h1 className="text-[22px] font-black mb-2">Card saved</h1>
            <p className="text-[13px] text-[#1a0f00]/60 leading-relaxed mb-6">
              Your agent can now top up its prepaid balance off-session, within your spend caps. LemonCake never holds your funds.
            </p>
            <a href="/agent/fund" className="inline-block px-4 py-2 bg-[#1a0f00] text-white font-semibold text-[13px] rounded-lg hover:bg-[#1a0f00]/90">Back to wallet</a>
          </>
        )}

        {state === "error" && (
          <>
            <h1 className="text-[20px] font-black mb-2 text-[#B91C1C]">Couldn&apos;t confirm the card</h1>
            <p className="text-[12.5px] text-[#1a0f00]/60 mb-2">{msg}</p>
            <a href="/agent/fund" className="text-[13px] text-[#1a0f00] underline">Try again</a>
          </>
        )}
      </div>
    </main>
  );
}
