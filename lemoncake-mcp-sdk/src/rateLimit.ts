/**
 * @lemoncake/mcp-sdk — In-memory rate limiter
 *
 * Sliding window: counts calls per token per tool within the current minute.
 * Resets on process restart.
 *
 * Key format: `${tokenId}:${toolName}`
 */

import type { RateLimitEntry } from "./types.js";

const WINDOW_MS = 60_000; // 1 minute

const store = new Map<string, RateLimitEntry>();

/**
 * Check whether the call is within the rate limit.
 * Returns true if allowed (and increments the counter), false if rate-limited.
 */
export function checkRateLimit(
  tokenId: string,
  toolName: string,
  limitPerMinute: number
): boolean {
  if (limitPerMinute <= 0) return true; // no limit

  const now = Date.now();
  const key = `${tokenId}:${toolName}`;
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // Start a new window
    store.set(key, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= limitPerMinute) {
    return false; // rate limited
  }

  store.set(key, { ...entry, count: entry.count + 1 });
  return true;
}

/**
 * How many calls remain in the current window for a token+tool.
 */
export function rateLimitRemaining(
  tokenId: string,
  toolName: string,
  limitPerMinute: number
): number {
  if (limitPerMinute <= 0) return Infinity;

  const now = Date.now();
  const key = `${tokenId}:${toolName}`;
  const entry = store.get(key);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    return limitPerMinute;
  }
  return Math.max(0, limitPerMinute - entry.count);
}

/**
 * Clear all rate limit state. Useful in tests.
 */
export function clearAllRateLimits(): void {
  store.clear();
}
