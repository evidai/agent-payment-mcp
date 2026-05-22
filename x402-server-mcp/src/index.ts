/**
 * @lemon-cake/x402-server (v0.2)
 *
 * HTTP 402 Payment Required middleware with hybrid facilitator routing.
 *
 *   facilitator: "lemoncake"  → verify/settle via LemonCake. Unlocks
 *                                freee/MF auto-journal, qualified invoices,
 *                                JPY off-ramp via Pro / Business plans.
 *   facilitator: "coinbase"   → verify/settle via Coinbase CDP. Gets your
 *                                endpoint indexed in the x402 Bazaar (and
 *                                therefore AWS Bedrock AgentCore) once one
 *                                settlement completes. No LemonCake metering.
 *   facilitator: "both"       → settle through CDP for Bazaar reach AND
 *                                post-record to LemonCake for metering /
 *                                invoicing / off-ramp. Pay-once-show-twice.
 *
 * Usage (Express):
 *   import express from "express";
 *   import { x402Middleware } from "@lemon-cake/x402-server";
 *
 *   const app = express();
 *   app.use("/api/search", x402Middleware({
 *     serviceId:       "your-lemoncake-providerV2-id",
 *     pricePerCallUsd: 0.001,
 *     facilitator:     "both",
 *     bazaar: {
 *       name:        "Web Search API",
 *       description: "Real-time Google search results",
 *       category:    "search",
 *       tags:        ["search", "web"],
 *     },
 *   }));
 */

export type X402FacilitatorMode = "lemoncake" | "coinbase" | "both";

export interface X402BazaarMetadata {
  /** Display name shown to AI agents in the Bazaar listing */
  name?:        string;
  /** 1–2 line description shown in search results */
  description?: string;
  /** Top-level category (search / data / finance / …) */
  category?:    string;
  /** Tags for facet search */
  tags?:        string[];
}

export interface X402Options {
  /**
   * LemonCake provider service ID (from /sellers signup).
   * Used as the metering key on the facilitator side.
   */
  serviceId: string;
  /**
   * Price per call in USD. The facilitator caps actual charges at the
   * provider's subscription plan overage, so this is upper-bound.
   * Default: 0.001 (x402 baseline).
   */
  pricePerCallUsd?: number;
  /**
   * Human-readable description shown to the AI agent in the 402 body.
   */
  description?: string;
  /**
   * Which facilitator to use for verify/settle.
   *   "lemoncake" (default) — full LemonCake feature set
   *   "coinbase"            — pure x402 Bazaar reach
   *   "both"                — settle through CDP, record to LemonCake
   */
  facilitator?: X402FacilitatorMode;
  /**
   * Override LemonCake facilitator URL (default = LemonCake production).
   */
  lemoncakeFacilitatorUrl?: string;
  /**
   * Override Coinbase CDP facilitator URL.
   */
  coinbaseFacilitatorUrl?: string;
  /**
   * Override the resource URL announced in the 402 body. Default = the
   * incoming request's protocol + host + path.
   */
  resourceUrl?: string;
  /**
   * Bazaar discovery metadata. Only used when facilitator includes
   * Coinbase ("coinbase" or "both"). Sent as `extensions.discoverable`
   * so the CDP facilitator catalogs the endpoint.
   */
  bazaar?: X402BazaarMetadata;
}

const DEFAULT_LEMONCAKE = "https://skillful-blessing-production.up.railway.app";
const DEFAULT_COINBASE  = "https://api.cdp.coinbase.com/platform/v2/x402";

function lemoncakeUrl(opts: X402Options): string {
  return opts.lemoncakeFacilitatorUrl
    ?? process.env.LEMON_CAKE_FACILITATOR
    ?? DEFAULT_LEMONCAKE;
}

function coinbaseUrl(opts: X402Options): string {
  return opts.coinbaseFacilitatorUrl
    ?? process.env.COINBASE_X402_FACILITATOR
    ?? DEFAULT_COINBASE;
}

interface AcceptsResponse {
  x402Version: number;
  accepts:     Array<Record<string, unknown>>;
}

// ─── 402 accepts ─────────────────────────────────────────────

async function fetchLemoncakeAccepts(opts: X402Options, resourceUrl: string): Promise<AcceptsResponse | null> {
  try {
    const r = await fetch(lemoncakeUrl(opts) + "/api/x402/accepts", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        serviceId:   opts.serviceId,
        resourceUrl,
        description: opts.description,
      }),
    });
    if (!r.ok) return null;
    return await r.json() as AcceptsResponse;
  } catch { return null; }
}

/**
 * Build an accepts entry pointed at Coinbase CDP. We don't call the CDP
 * facilitator here — we just shape the manifest with metadata Coinbase's
 * Bazaar will pick up after the first settle.
 */
function buildCoinbaseAccepts(opts: X402Options, resourceUrl: string): AcceptsResponse {
  const microUsdc = Math.round((opts.pricePerCallUsd ?? 0.001) * 1_000_000);
  return {
    x402Version: 1,
    accepts: [{
      scheme:            "exact",
      network:           "base",   // Coinbase x402 SDK 標準（CDP が eip155:8453 に正規化）
      maxAmountRequired: String(microUsdc),
      resource:          resourceUrl,
      description:       opts.description ?? `LemonCake-routed API call`,
      mimeType:          "application/json",
      // payTo is the facilitator that will settle — for CDP, the buyer
      // SDK resolves this automatically when CDP is the chosen facilitator.
      // We leave it empty and the buyer SDK fills it from the active
      // facilitator config. The CDP `bazaarResourceServerExtension` reads
      // `extensions.discoverable` to decide cataloging.
      maxTimeoutSeconds: 60,
      asset:             "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      extensions: {
        discoverable: true,
        ...(opts.bazaar ?? {}),
      },
      extra: {
        name:    "USD Coin",
        version: "2",
      },
    }],
  };
}

async function buildAccepts(opts: X402Options, resourceUrl: string): Promise<AcceptsResponse> {
  const mode = opts.facilitator ?? "lemoncake";
  if (mode === "coinbase") {
    return buildCoinbaseAccepts(opts, resourceUrl);
  }
  if (mode === "both") {
    // Both: LemonCake accepts first (preferred for JPY-aware buyers),
    // CDP entry second (Bazaar discovery + AgentCore reach).
    const lc = await fetchLemoncakeAccepts(opts, resourceUrl);
    const cb = buildCoinbaseAccepts(opts, resourceUrl);
    if (!lc) return cb;
    return { x402Version: 1, accepts: [...lc.accepts, ...cb.accepts] };
  }
  // lemoncake (default)
  return (await fetchLemoncakeAccepts(opts, resourceUrl))
    ?? { x402Version: 1, accepts: [], error: "facilitator_unreachable" } as AcceptsResponse;
}

// ─── verify / settle ─────────────────────────────────────────

interface VerifyResponse {
  ok:      boolean;
  txHash?: string;
  reason?: string;
  via?:    "lemoncake" | "coinbase";
}

async function verifyLemoncake(
  opts:           X402Options,
  paymentHeader:  string,
  accepts:        Record<string, unknown>,
): Promise<VerifyResponse> {
  try {
    const r = await fetch(lemoncakeUrl(opts) + "/api/x402/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentHeader,
        accepts,
        serviceId: opts.serviceId,
      }),
    });
    const data = await r.json() as VerifyResponse;
    return { ...data, via: "lemoncake" };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "lemoncake_unreachable", via: "lemoncake" };
  }
}

async function verifyCoinbase(
  opts:           X402Options,
  paymentHeader:  string,
  accepts:        Record<string, unknown>,
): Promise<VerifyResponse> {
  // CDP x402 facilitator: POST /verify then POST /settle.
  // For the middleware we collapse them into one "verify+settle" call.
  // Buyers can also verify on their own; the spec allows both flows.
  try {
    const verifyRes = await fetch(coinbaseUrl(opts) + "/verify", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentHeader, accepts }),
    });
    const verifyData = await verifyRes.json() as { isValid?: boolean; invalidReason?: string };
    if (!verifyData.isValid) {
      return { ok: false, reason: verifyData.invalidReason ?? "cdp_verify_failed", via: "coinbase" };
    }
    const settleRes = await fetch(coinbaseUrl(opts) + "/settle", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentHeader, accepts }),
    });
    const settleData = await settleRes.json() as { success?: boolean; transaction?: string; error?: string };
    if (!settleData.success) {
      return { ok: false, reason: settleData.error ?? "cdp_settle_failed", via: "coinbase" };
    }
    return { ok: true, txHash: settleData.transaction, via: "coinbase" };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "coinbase_unreachable", via: "coinbase" };
  }
}

/**
 * Decode an X-PAYMENT header for extracting buyer/amount when we need to
 * record a payment to LemonCake after a Coinbase settle. Best-effort —
 * if the header is malformed we skip the record (settlement still stands).
 */
function tryDecodePayment(b64: string): { from?: string; value?: string } | null {
  try {
    const raw = Buffer.from(b64, "base64").toString("utf-8");
    const parsed = JSON.parse(raw) as { payload?: { authorization?: { from?: string; value?: string } } };
    return parsed.payload?.authorization ?? null;
  } catch { return null; }
}

async function recordToLemoncake(
  opts:          X402Options,
  paymentHeader: string,
  txHash:        string,
): Promise<void> {
  const auth = tryDecodePayment(paymentHeader);
  if (!auth?.from || !auth?.value) return;
  const amountUsdc = (Number(auth.value) / 1_000_000).toString();
  try {
    await fetch(lemoncakeUrl(opts) + "/api/x402/record", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceId:    opts.serviceId,
        txHash,
        ownerAddress: auth.from,
        amountUsdc,
        facilitator:  "coinbase",
      }),
    });
  } catch { /* fire-and-forget */ }
}

async function verifyPayment(
  opts:          X402Options,
  paymentHeader: string,
  accepts:       Record<string, unknown>,
): Promise<VerifyResponse> {
  const mode = opts.facilitator ?? "lemoncake";

  if (mode === "lemoncake") {
    return verifyLemoncake(opts, paymentHeader, accepts);
  }
  if (mode === "coinbase") {
    return verifyCoinbase(opts, paymentHeader, accepts);
  }
  // both: settle via CDP for Bazaar reach, then record to LemonCake for
  // metering/invoicing. If CDP fails, fall back to LemonCake direct.
  const cb = await verifyCoinbase(opts, paymentHeader, accepts);
  if (cb.ok && cb.txHash) {
    void recordToLemoncake(opts, paymentHeader, cb.txHash);
    return cb;
  }
  const lc = await verifyLemoncake(opts, paymentHeader, accepts);
  return lc;
}

// ─── Express-style middleware ─────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Express / connect 互換 middleware。req.url から resource URL を組み立てる。
 */
export function x402Middleware(opts: X402Options) {
  return async (req: any, res: any, next: any) => {
    const proto = req.headers["x-forwarded-proto"] ?? "https";
    const host  = req.headers["host"] ?? "localhost";
    const resourceUrl = opts.resourceUrl ?? `${proto}://${host}${req.url}`;

    const paymentHeader = req.headers["x-payment"] ?? req.headers["X-PAYMENT"];

    if (!paymentHeader) {
      const accepts = await buildAccepts(opts, resourceUrl);
      res.statusCode = 402;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("X-Payment-Required", "1");
      res.end(JSON.stringify(accepts));
      return;
    }

    const accepts = await buildAccepts(opts, resourceUrl);
    const verify  = await verifyPayment(opts, String(paymentHeader), accepts.accepts?.[0] ?? {});

    if (!verify.ok) {
      res.statusCode = 402;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: verify.reason ?? "payment_verify_failed" }));
      return;
    }

    if (verify.txHash) res.setHeader("X-Payment-Tx-Hash", verify.txHash);
    if (verify.via)    res.setHeader("X-Payment-Facilitator", verify.via);
    next();
  };
}

// ─── Hono middleware ──────────────────────────────────────────

/**
 * Hono 互換 middleware。
 */
export function x402Hono(opts: X402Options) {
  return async (c: any, next: any) => {
    const url = new URL(c.req.url);
    const resourceUrl = opts.resourceUrl ?? `${url.protocol}//${url.host}${url.pathname}`;

    const paymentHeader = c.req.header("x-payment") ?? c.req.header("X-PAYMENT");

    if (!paymentHeader) {
      const accepts = await buildAccepts(opts, resourceUrl);
      return c.json(accepts, 402, { "X-Payment-Required": "1" });
    }

    const accepts = await buildAccepts(opts, resourceUrl);
    const verify  = await verifyPayment(opts, paymentHeader, accepts.accepts?.[0] ?? {});

    if (!verify.ok) {
      return c.json({ error: verify.reason ?? "payment_verify_failed" }, 402);
    }

    if (verify.txHash) c.header("X-Payment-Tx-Hash", verify.txHash);
    if (verify.via)    c.header("X-Payment-Facilitator", verify.via);
    await next();
    return;
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
