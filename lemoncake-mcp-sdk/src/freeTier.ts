/**
 * @lemoncake/mcp-sdk — Free tier counter (in-memory)
 *
 * Tracks per-token, per-tool free call usage.
 * Resets on process restart (intentional — free tier is best-effort).
 *
 * Key format: `${tokenId}:${toolName}`
 */

import type { FreeTierEntry } from "./types.js";

const store = new Map<string, FreeTierEntry>();

/**
 * Check whether a call should be free.
 * If freeCalls > 0 and the token has calls remaining, consume one and return true.
 * Returns false if freeCalls is 0 or the free quota is exhausted.
 */
export function consumeFreeCall(
  tokenId: string,
  toolName: string,
  freeCalls: number
): boolean {
  if (freeCalls <= 0) return false;

  const key = `${tokenId}:${toolName}`;
  const entry = store.get(key) ?? { used: 0, limit: freeCalls };

  if (entry.used < entry.limit) {
    store.set(key, { ...entry, used: entry.used + 1 });
    return true;
  }
  return false;
}

/**
 * Return how many free calls remain for a given token+tool.
 */
export function freeCallsRemaining(
  tokenId: string,
  toolName: string,
  freeCalls: number
): number {
  if (freeCalls <= 0) return 0;
  const key = `${tokenId}:${toolName}`;
  const entry = store.get(key);
  if (!entry) return freeCalls;
  return Math.max(0, entry.limit - entry.used);
}

/**
 * Reset the free tier counter for a given token+tool.
 * Useful in tests.
 */
export function resetFreeCounter(tokenId: string, toolName: string): void {
  store.delete(`${tokenId}:${toolName}`);
}

/**
 * Clear all free tier state. Useful in tests.
 */
export function clearAllFreeCounters(): void {
  store.clear();
}
