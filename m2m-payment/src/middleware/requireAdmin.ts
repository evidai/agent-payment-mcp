/**
 * Shared admin auth middleware.
 *
 * Validates the X-Admin-Key header (or ?adminKey= query param) against
 * the ADMIN_API_KEY environment variable using a timing-safe comparison.
 *
 * Behaviour:
 *  - If ADMIN_API_KEY is unset → 503 on every admin route (fails closed).
 *    In development this is a one-line hint; in production the process
 *    refuses to authenticate any request.
 *  - If the supplied key is missing or wrong → 401.
 *  - Uses `crypto.timingSafeEqual` to defeat timing-attack key recovery.
 *
 * Pulled out of admin.ts so killswitch.ts, agents.ts and any future
 * admin route share the exact same auth path. Previously killswitch.ts
 * had NO auth at all (CVE-class issue: anyone could halt all transfers).
 */

import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "crypto";

const ADMIN_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_KEY && process.env.NODE_ENV === "production") {
  // Fail loudly at startup if running in production without an admin key.
  // (We still allow the import in tests / dev so unrelated routes can mount.)
  // eslint-disable-next-line no-console
  console.error(
    "[FATAL] ADMIN_API_KEY is not set in production. Admin routes will reject every request."
  );
}

function safeCompare(a: string, b: string): boolean {
  // Timing-safe compare requires equal-length buffers. Pad b to length of a
  // if mismatched so we still run the same number of byte comparisons.
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) {
    // Make lengths equal so timingSafeEqual doesn't throw, but result will still be false.
    const padded = Buffer.alloc(aBuf.length);
    bBuf.copy(padded, 0, 0, Math.min(aBuf.length, bBuf.length));
    timingSafeEqual(aBuf, padded);
    return false;
  }
  return timingSafeEqual(aBuf, bBuf);
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!ADMIN_KEY) {
    res.status(503).json({
      error: "Admin auth not configured. Set ADMIN_API_KEY env var.",
    });
    return;
  }

  const raw = req.headers["x-admin-key"] ?? req.query.adminKey;
  const supplied = Array.isArray(raw) ? raw[0] : raw;

  if (typeof supplied !== "string" || !supplied) {
    res
      .status(401)
      .json({ error: "Unauthorized. X-Admin-Key header required." });
    return;
  }

  if (!safeCompare(ADMIN_KEY, supplied)) {
    res.status(401).json({ error: "Unauthorized. Invalid admin key." });
    return;
  }

  next();
}
