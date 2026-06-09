/**
 * @lemon-cake/mcp-sdk — `lc.protect()` HTTP middleware
 *
 * Adapts the LemonCake charge flow to Express / Connect / Polka / any
 * framework that accepts `(req, res, next)` middleware. Frameworks that
 * don't speak Express directly (Hono, Fastify, Cloudflare Workers,
 * Next.js Route Handlers) can wrap this with a thin adapter.
 *
 * Example:
 *
 *   const lc = createLemonCakeSDK();
 *   app.use(lc.protect("/api/search", { cost: 0.02 }));
 *
 *   app.get("/api/search", async (req, res) => {
 *     const result = await mySearch(req.query.q);
 *     res.json(result);
 *   });
 *
 * Behavior:
 *   1. The middleware only fires when the request path matches the route.
 *      Non-matching requests fall through to the next middleware.
 *   2. Pay token is extracted from the `Authorization: Bearer ...` header
 *      OR the `X-LemonCake-Pay-Token` header OR `?payToken=...` query.
 *   3. On match, we run the same pre-flight / free-tier / rate-limit
 *      checks as `lc.charge()` for MCP. Failures return HTTP 402 with a
 *      structured error body.
 *   4. Successful pre-flight calls `next()`. The charge is confirmed after
 *      the response is fully sent (we patch `res.end()` to record on flush).
 *   5. Demo mode logs the would-be charge to stderr instead of hitting the
 *      LemonCake API. No network calls. Useful for local dev.
 */

import type { LemonCakeClient } from "./client.js";

// Note on local rate-limit / free-tier counters: we deliberately *don't* run
// them in the HTTP `protect()` path. The API server enforces both at
// preflight time; running them again locally would just add cache-coherency
// bugs. If we ever want client-side throttling for latency, it should be
// opt-in and orthogonal to the billing flow.

/* ── Framework-neutral request / response shapes ─────────────────────── */

// Minimal duck-typed Express-compatible interfaces. We don't depend on
// @types/express to keep the SDK runtime-free.
interface HttpReq {
  url?:          string;
  method?:       string;
  path?:         string;
  query?:        Record<string, unknown>;
  headers:       Record<string, string | string[] | undefined>;
  // Hono / generic adapters sometimes attach the raw request here.
  raw?:          unknown;
}

interface HttpRes {
  statusCode?:   number;
  setHeader?:    (name: string, value: string) => void;
  end:           ((chunk?: unknown) => unknown) | ((chunk?: unknown, encoding?: BufferEncoding) => unknown);
  // Express-style helpers (optional — we fall back to `end()` if absent).
  status?:       (code: number) => HttpRes;
  json?:         (body: unknown) => unknown;
}

type NextFn = (err?: unknown) => void;

/* ── Options ────────────────────────────────────────────────────────── */

/**
 * Options for {@link protect}.
 */
export interface ProtectOptions {
  /**
   * Price per call in USD. Must be > 0 unless in demo mode.
   */
  cost:     number;

  /**
   * Optional HTTP method restriction (defaults: applies to all methods).
   * Use this to bill GET separately from POST on the same path.
   */
  method?:  "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "ALL";

  /**
   * Optional tool name override for analytics / dashboard grouping.
   * Defaults to the path itself.
   */
  toolName?: string;

  /**
   * Optional idempotency key extractor. Defaults to the
   * `X-Idempotency-Key` header.
   */
  getIdempotencyKey?: (req: HttpReq) => string | undefined;
}

/* ── Internal: pay-token extraction ──────────────────────────────────── */

function extractPayToken(req: HttpReq): string | null {
  const h = req.headers ?? {};
  // 1) Authorization: Bearer …
  const auth = h.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  // 2) X-LemonCake-Pay-Token: …
  const custom = h["x-lemoncake-pay-token"] ?? h["X-LemonCake-Pay-Token"];
  if (typeof custom === "string" && custom.length > 0) {
    return custom;
  }
  // 3) ?payToken=… query param
  const q = req.query ?? {};
  const qp = q.payToken ?? q.pay_token;
  if (typeof qp === "string" && qp.length > 0) {
    return qp;
  }
  return null;
}

function reqPath(req: HttpReq): string {
  // Express provides `path`; raw Node provides `url`. Normalize.
  if (typeof req.path === "string") return req.path;
  if (typeof req.url === "string") {
    const i = req.url.indexOf("?");
    return i >= 0 ? req.url.slice(0, i) : req.url;
  }
  return "";
}

function matchesPath(routePattern: string | RegExp, actual: string): boolean {
  if (typeof routePattern === "string") {
    // Exact match OR prefix match if pattern ends with /*.
    if (routePattern.endsWith("/*")) {
      const prefix = routePattern.slice(0, -2);
      return actual === prefix || actual.startsWith(prefix + "/");
    }
    return actual === routePattern;
  }
  return routePattern.test(actual);
}

function sendError(res: HttpRes, status: number, body: Record<string, unknown>): void {
  // Prefer Express-style res.status().json() if available, else fall through
  // to setHeader + end with a JSON-encoded payload.
  const status_ = res.status;
  const json_   = res.json;
  if (typeof status_ === "function" && typeof json_ === "function") {
    json_.call(status_.call(res, status), body);
    return;
  }
  res.statusCode = status;
  if (typeof res.setHeader === "function") {
    res.setHeader("Content-Type", "application/json");
  }
  (res.end as (chunk?: unknown) => unknown)(JSON.stringify(body));
}

/* ── The factory ─────────────────────────────────────────────────────── */

/**
 * Build a `protect(path, opts)` middleware factory bound to a
 * {@link LemonCakeClient}. Called once per SDK instance and reused for
 * every protected route.
 *
 * @internal — exposed via {@link createLemonCakeSDK}'s `protect` method.
 */
export function buildProtect(
  client:        LemonCakeClient,
  isDemo:        boolean,
  serviceId:     string | undefined,
  defaultPayTok: string | undefined,
) {
  return function protect(
    routePattern: string | RegExp,
    options:      ProtectOptions,
  ) {
    const { cost, method = "ALL", toolName: toolNameOpt, getIdempotencyKey } = options;
    const toolName = toolNameOpt ?? (typeof routePattern === "string" ? routePattern : routePattern.source);

    return async function lemonCakeMiddleware(
      req:  HttpReq,
      res:  HttpRes,
      next: NextFn,
    ): Promise<void> {
      // (1) Path / method filter — non-matching falls through.
      if (!matchesPath(routePattern, reqPath(req))) return next();
      if (method !== "ALL" && (req.method ?? "GET").toUpperCase() !== method) return next();

      // (2) Demo mode short-circuit. No network, no token needed.
      if (isDemo) {
        // Use console.error so we work in browsers / edge runtimes too.
        // (process.stderr exists in Node but not in Workers / Deno.)
        console.error(
          `[lemoncake] demo charge $${cost.toFixed(3)} for ${toolName} ` +
            `(set LEMONCAKE_SELLER_KEY to go live)`,
        );
        return next();
      }

      // (3) Resolve pay token. Without it we can't charge — reject 402.
      const payToken =
        extractPayToken(req)
        ?? defaultPayTok
        ?? (typeof process !== "undefined" ? process.env.LEMONCAKE_PAY_TOKEN : undefined)
        ?? null;
      if (!payToken) {
        return sendError(res, 402, {
          error: "payment_required",
          message:
            "Missing LemonCake pay token. " +
            "Send Authorization: Bearer <token>, or X-LemonCake-Pay-Token, or ?payToken=…",
        });
      }

      // (4) Pre-flight with the LemonCake API. The API enforces rate-limit,
      //     free-tier consumption, spend cap, etc. — we don't duplicate those
      //     checks client-side to avoid cache-coherency bugs.
      const idempotencyKey =
        (globalThis as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.() ??
        `idem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      let chargeId: string | null = null;
      try {
        const preflight = await client.preflight({
          payToken,
          toolName,
          idempotencyKey,
        });

        if (!preflight.allowed) {
          return sendError(res, 402, {
            error:    "payment_required",
            message:  preflight.reason ?? "Budget exhausted, token expired/revoked, or rate-limited",
          });
        }
        chargeId = preflight.chargeId;
      } catch (err) {
        return sendError(res, 502, {
          error:    "preflight_failed",
          message:  err instanceof Error ? err.message : String(err),
        });
      }

      // (7) Patch `res.end` so we can confirm the charge once the response
      //     ships. We don't await here — fire-and-forget keeps the response
      //     latency clean.
      if (chargeId) {
        const heldChargeId = chargeId;
        const originalEnd  = res.end.bind(res) as (chunk?: unknown, encoding?: BufferEncoding) => unknown;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (res as any).end = function (chunk?: unknown, encoding?: BufferEncoding) {
          // Confirm on 2xx/3xx, cancel on 4xx/5xx.
          const sc = res.statusCode ?? 200;
          void client
            .charge({
              chargeId: heldChargeId,
              success:  sc >= 200 && sc < 400,
            })
            .catch(() => { /* fire-and-forget — never block the response */ });
          return originalEnd(chunk, encoding);
        };
      }

      // (8) Hand off to the next middleware / handler.
      return next();
    };
  };
}
