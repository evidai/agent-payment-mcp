"use client";

/**
 * /ack — human-readable live demo of LemonCake's ACK-Pay interop.
 *
 * Runs the real loop against production, in the visitor's own browser:
 *   1. fetch /.well-known/did.json            → who is LemonCake
 *   2. fetch /g/<shortId> with no credentials → 402 + signed PaymentRequest
 *   3. verify the JWT's Ed25519 signature against the DID key (WebCrypto,
 *      no SDK, no server round-trip — the point is anyone can do this)
 *   4. (optional) paste a Pay Token           → W3C PaymentReceiptCredential
 *
 * Verification happens client-side on purpose: it demonstrates that trust
 * in LemonCake receipts requires nothing but a did:web resolver.
 */

import Link from "next/link";
import { useState } from "react";

const SHORT_ID = "ght5daex";

type StepState = "idle" | "running" | "done" | "error";

type Step = {
  state: StepState;
  detail?: string;
  json?: unknown;
};

const b64uToBytes = (s: string) => {
  const pad = s.length % 4 === 2 ? "==" : s.length % 4 === 3 ? "=" : "";
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

const decodeJwtPayload = (jwt: string) =>
  JSON.parse(new TextDecoder().decode(b64uToBytes(jwt.split(".")[1])));

function Badge({ s }: { s: StepState }) {
  if (s === "done")
    return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a0f00] text-[13px] text-[#fffd43]">✓</span>;
  if (s === "running")
    return <span className="flex h-6 w-6 animate-pulse items-center justify-center rounded-full bg-[#fffd43] text-[13px]">…</span>;
  if (s === "error")
    return <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-[13px] text-white">✕</span>;
  return <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#1a0f00]/15 text-[12px] text-[#1a0f00]/30">○</span>;
}

function Card({
  n,
  title,
  sub,
  step,
  children,
}: {
  n: number;
  title: string;
  sub: string;
  step: Step;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#1a0f00]/10 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <Badge s={step.state} />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#1a0f00]/38">Step {n}</p>
          <h3 className="mt-0.5 text-[16px] font-black leading-snug">{title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-[#1a0f00]/62">{sub}</p>
          {step.detail && (
            <p className={`mt-2 text-[13px] font-semibold ${step.state === "error" ? "text-red-700" : "text-[#1a0f00]"}`}>
              {step.detail}
            </p>
          )}
          {children}
          {step.json != null && (
            <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-[#1a0f00]/8 bg-[#fbfbf4] p-3 font-mono text-[11px] leading-relaxed text-[#1a0f00]/75">
              {JSON.stringify(step.json, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AckClient() {
  const [s1, setS1] = useState<Step>({ state: "idle" });
  const [s2, setS2] = useState<Step>({ state: "idle" });
  const [s3, setS3] = useState<Step>({ state: "idle" });
  const [s4, setS4] = useState<Step>({ state: "idle" });
  const [payToken, setPayToken] = useState("");
  const [prToken, setPrToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setS1({ state: "running" });
    setS2({ state: "idle" });
    setS3({ state: "idle" });
    setS4({ state: "idle" });
    setPrToken(null);
    try {
      // 1 — identity
      const didRes = await fetch("/.well-known/did.json");
      const didDoc = await didRes.json();
      const jwk = didDoc.verificationMethod?.[0]?.publicKeyJwk;
      setS1({
        state: "done",
        detail: `${didDoc.id} — ${jwk?.crv} public key published`,
        json: didDoc,
      });

      // 2 — unauthenticated call → 402 with signed payment request
      setS2({ state: "running" });
      const gwRes = await fetch(`/g/${SHORT_ID}`);
      if (gwRes.status !== 402) throw new Error(`expected 402, got ${gwRes.status}`);
      const body = await gwRes.json();
      const ack = body.ackPay;
      if (!ack?.paymentRequestToken) throw new Error("no ackPay block in 402");
      setPrToken(ack.paymentRequestToken);
      const opt = ack.paymentRequest.paymentOptions[0];
      setS2({
        state: "done",
        detail: `HTTP 402 — asks for ${(opt.amount / 10 ** opt.decimals).toFixed(2)} ${opt.currency}, recipient ${opt.recipient}`,
        json: ack.paymentRequest,
      });

      // 3 — verify the JWT signature in THIS browser with the DID key
      setS3({ state: "running" });
      const [h, p, sig] = ack.paymentRequestToken.split(".");
      const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"]);
      const okSig = await crypto.subtle.verify(
        "Ed25519",
        key,
        b64uToBytes(sig),
        new TextEncoder().encode(`${h}.${p}`),
      );
      if (!okSig) throw new Error("signature did NOT verify");
      const payload = decodeJwtPayload(ack.paymentRequestToken);
      setS3({
        state: "done",
        detail: `Ed25519 signature valid — issuer ${payload.iss}, verified right here in your browser. No LemonCake API, no SDK, no account.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "failed";
      if (s1.state !== "done") setS1((v) => (v.state === "running" ? { state: "error", detail: msg } : v));
      setS2((v) => (v.state === "running" ? { state: "error", detail: msg } : v));
      setS3((v) => (v.state === "running" ? { state: "error", detail: msg } : v));
    } finally {
      setBusy(false);
    }
  }

  async function getReceipt() {
    if (!prToken || !payToken.trim()) return;
    setS4({ state: "running" });
    try {
      const res = await fetch("/api/lc/ack/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${payToken.trim()}` },
        body: JSON.stringify({ paymentRequestToken: prToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setS4({
        state: "done",
        detail: `W3C PaymentReceiptCredential issued by ${data.issuer}. Any third party can verify it against the same DID document.`,
        json: decodeJwtPayload(data.receipt),
      });
    } catch (e) {
      setS4({ state: "error", detail: e instanceof Error ? e.message : "failed" });
    }
  }

  return (
    <div className="min-h-screen bg-[#f6f7f0] font-sans text-[#1a0f00] antialiased">
      <nav className="sticky top-0 z-20 border-b border-[#1a0f00]/8 bg-[#f6f7f0]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="LemonCake" className="h-7 w-7 rounded-md object-cover" />
            <span className="text-[15px] font-black">LemonCake</span>
            <span className="hidden rounded-full border border-[#1a0f00]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#1a0f00]/42 sm:inline">
              ACK-Pay interop
            </span>
          </Link>
          <div className="flex items-center gap-5 text-[13px] font-semibold text-[#1a0f00]/55">
            <Link href="/demo" className="hover:text-[#1a0f00]">Playground</Link>
            <Link href="/docs" className="hover:text-[#1a0f00]">Docs</Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#1a0f00]/42">
          Agent Commerce Kit · 2025-05-04
        </p>
        <h1 className="mt-2 text-[30px] font-black leading-tight tracking-tight sm:text-[38px]">
          LemonCake speaks <span className="bg-[#fffd43] px-1.5">ACK-Pay</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[#1a0f00]/65">
          Every 402 from our production gateway carries a <b>signed payment request</b>, and every settled
          payment can mint a <b>W3C verifiable receipt</b> — both checkable by anyone against{" "}
          <code className="rounded bg-[#1a0f00]/6 px-1 font-mono text-[12px]">did:web:www.lemoncake.xyz</code>.
          The button below runs the real loop, live, in your browser.
        </p>

        <button
          onClick={run}
          disabled={busy}
          className="mt-6 rounded-lg bg-[#1a0f00] px-6 py-3 text-[14px] font-black text-[#fffd43] transition hover:opacity-85 disabled:opacity-40"
        >
          {busy ? "Running…" : "▶ Run the live loop"}
        </button>

        <div className="mt-8 space-y-4">
          <Card
            n={1}
            title="Who is LemonCake? — did:web identity"
            sub="Fetch /.well-known/did.json. This is our public identity: a W3C DID document with the Ed25519 key every signature below traces back to."
            step={s1}
          />
          <Card
            n={2}
            title="Call a paid API with no credentials → signed 402"
            sub={`GET /g/${SHORT_ID} with no token. The gateway answers HTTP 402 — and inside it, an ACK-Pay PaymentRequest signed as a JWT: what to pay, in what currency, to whom, where to get a receipt.`}
            step={s2}
          />
          <Card
            n={3}
            title="Verify the signature — in YOUR browser"
            sub="WebCrypto verifies the JWT's Ed25519 signature against the key from step 1. No LemonCake SDK, no API call, no account. That's the whole point of ACK-Pay: trust is checkable by anyone."
            step={s3}
          />
          <Card
            n={4}
            title="Settled payment → W3C verifiable receipt (optional)"
            sub="A live Pay Token proves a settled prepaid purchase. Exchange it at our receipt service for a PaymentReceiptCredential — a portable, cryptographic proof of payment any auditor or counterparty can verify."
            step={s4}
          >
            {s3.state === "done" && (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={payToken}
                  onChange={(e) => setPayToken(e.target.value)}
                  placeholder="Paste a Pay Token JWT (get one in the Playground)"
                  className="w-full rounded-lg border border-[#1a0f00]/12 bg-white px-3 py-2 font-mono text-[12px] outline-none focus:border-[#1a0f00]/35"
                />
                <button
                  onClick={getReceipt}
                  disabled={!payToken.trim() || s4.state === "running"}
                  className="shrink-0 rounded-lg border border-[#1a0f00] px-4 py-2 text-[13px] font-black transition hover:bg-[#fffd43] disabled:opacity-35"
                >
                  Get receipt
                </button>
              </div>
            )}
          </Card>
        </div>

        <div className="mt-10 rounded-lg border border-[#1a0f00]/10 bg-white p-5">
          <h2 className="text-[15px] font-black">For ACK / Catena ecosystem developers</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-[#1a0f00]/65">
            The same loop with the official <code className="rounded bg-[#1a0f00]/6 px-1 font-mono text-[12px]">agentcommercekit</code> SDK:
          </p>
          <pre className="mt-3 overflow-auto rounded-lg border border-[#1a0f00]/8 bg-[#fbfbf4] p-3 font-mono text-[11px] leading-relaxed text-[#1a0f00]/75">
{`import { getDidResolver, verifyPaymentRequestToken } from "agentcommercekit"

const res  = await fetch("https://www.lemoncake.xyz/g/${SHORT_ID}")   // → 402
const body = await res.json()

const { paymentRequest } = await verifyPaymentRequestToken(
  body.ackPay.paymentRequestToken,
  { resolver: getDidResolver() },   // resolves did:web:www.lemoncake.xyz
)`}
          </pre>
          <p className="mt-3 text-[13px] leading-relaxed text-[#1a0f00]/65">
            LemonCake is an x402-native agent payment gateway, live in production, with a no-license
            architecture validated through a formal inquiry with Japan&apos;s FSA — the JP-compliant
            execution layer for agent payments.{" "}
            <Link href="/contact" className="font-bold underline decoration-[#fffd43] decoration-2 underline-offset-2 hover:opacity-70">
              Talk to us
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
