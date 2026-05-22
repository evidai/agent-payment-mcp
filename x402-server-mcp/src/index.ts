/**
 * @lemon-cake/x402-server
 *
 * HTTP 402 Payment Required middleware for any Node.js HTTP framework.
 * Drop in front of any route → unpaid requests get a 402 + accepts;
 * paid requests (X-PAYMENT header) are verified through LemonCake's
 * facilitator and forwarded.
 *
 * Usage (Express):
 *   import express from "express";
 *   import { x402Middleware } from "@lemon-cake/x402-server";
 *
 *   const app = express();
 *   app.use("/api/search", x402Middleware({
 *     serviceId: "your-lemoncake-serviceId",
 *     pricePerCallUsd: 0.001,
 *     description: "Web search API",
 *   }));
 *   app.get("/api/search", (req, res) => res.json({ results: [...] }));
 *
 * Usage (Hono):
 *   import { Hono } from "hono";
 *   import { x402Hono } from "@lemon-cake/x402-server";
 *
 *   const app = new Hono();
 *   app.use("/api/search", x402Hono({ serviceId: "...", pricePerCallUsd: 0.001 }));
 *   app.get("/api/search", (c) => c.json({ results: [...] }));
 *
 * Required env:
 *   none. Defaults work out of the box. Override LEMON_CAKE_FACILITATOR
 *   to point at a custom facilitator URL.
 */

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
   * Override facilitator URL (default = LemonCake production).
   */
  facilitatorUrl?: string;
  /**
   * Override the resource URL announced in the 402 body. Default = the
   * incoming request's protocol + host + path.
   */
  resourceUrl?: string;
}

const DEFAULT_FACILITATOR = "https://skillful-blessing-production.up.railway.app";

interface AcceptsResponse {
  x402Version: number;
  accepts:     Array<Record<string, unknown>>;
}

async function fetchAccepts(opts: X402Options, resourceUrl: string): Promise<AcceptsResponse | null> {
  const url = (opts.facilitatorUrl ?? process.env.LEMON_CAKE_FACILITATOR ?? DEFAULT_FACILITATOR) + "/api/x402/accepts";
  try {
    const r = await fetch(url, {
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

interface VerifyResponse {
  ok:     boolean;
  txHash?: string;
  reason?: string;
}

async function verifyPayment(
  opts:         X402Options,
  paymentHeader:string,
  accepts:      Record<string, unknown>,
): Promise<VerifyResponse> {
  const url = (opts.facilitatorUrl ?? process.env.LEMON_CAKE_FACILITATOR ?? DEFAULT_FACILITATOR) + "/api/x402/verify";
  try {
    const r = await fetch(url, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentHeader,
        accepts,
        serviceId: opts.serviceId,
      }),
    });
    return await r.json() as VerifyResponse;
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "facilitator_unreachable" };
  }
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
      const accepts = await fetchAccepts(opts, resourceUrl);
      res.statusCode = 402;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("X-Payment-Required", "1");
      res.end(JSON.stringify(accepts ?? {
        x402Version: 1,
        accepts: [],
        error:   "facilitator_unreachable",
      }));
      return;
    }

    const accepts = await fetchAccepts(opts, resourceUrl);
    const verify  = await verifyPayment(opts, String(paymentHeader), accepts?.accepts?.[0] ?? {});

    if (!verify.ok) {
      res.statusCode = 402;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: verify.reason ?? "payment_verify_failed" }));
      return;
    }

    if (verify.txHash) {
      res.setHeader("X-Payment-Tx-Hash", verify.txHash);
    }
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
      const accepts = await fetchAccepts(opts, resourceUrl);
      return c.json(accepts ?? { x402Version: 1, accepts: [], error: "facilitator_unreachable" }, 402, {
        "X-Payment-Required": "1",
      });
    }

    const accepts = await fetchAccepts(opts, resourceUrl);
    const verify  = await verifyPayment(opts, paymentHeader, accepts?.accepts?.[0] ?? {});

    if (!verify.ok) {
      return c.json({ error: verify.reason ?? "payment_verify_failed" }, 402);
    }

    if (verify.txHash) c.header("X-Payment-Tx-Hash", verify.txHash);
    await next();
    return;
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
