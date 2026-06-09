/**
 * @lemon-cake/mcp-sdk — LemonCake API client
 *
 * Wraps the seller-side fiat billing endpoints:
 *   POST /api/sdk/preflight  → validate the buyer Pay Token + reserve a charge
 *   POST /api/sdk/charge     → confirm (record earnings) or cancel (refund)
 *   GET  /api/sdk/earnings   → seller earnings (coming soon)
 *
 * Buyers prepay by card; this SDK decrements the prepaid Pay Token per call.
 * No crypto, no per-call card charge. The endpoint's price (set in /app) is
 * authoritative — the SDK never asserts an amount, so it can't drift from it.
 */

import type {
  PreflightResponse,
  ChargeResponse,
  EarningsResponse,
} from "./types.js";
import { LemonCakeAPIError } from "./errors.js";

const DEFAULT_API_URL = "https://www.lemoncake.xyz";
const SDK_VERSION = "1.0.0";
const USER_AGENT = `@lemon-cake/mcp-sdk/${SDK_VERSION} (node/${typeof process !== "undefined" ? process.versions.node : "unknown"})`;

export class LemonCakeClient {
  private readonly apiUrl: string;
  private readonly sellerKey: string;

  constructor(apiUrl: string, sellerKey: string) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.sellerKey = sellerKey;
  }

  // ─── preflight ─────────────────────────────────────────────────────────────

  /**
   * Validate the buyer Pay Token for this seller's resource and RESERVE the
   * charge. Returns a chargeId to confirm/cancel after the tool runs.
   *
   * The amount is NOT sent — the gateway charges the endpoint's configured
   * price (server-authoritative). `idempotencyKey` makes a retried preflight
   * return the same reservation instead of double-reserving.
   */
  async preflight(params: {
    payToken: string;
    toolName: string;
    idempotencyKey: string;
  }): Promise<PreflightResponse> {
    const res = await this.post("/api/sdk/preflight", {
      payToken: params.payToken,
      toolName: params.toolName,
      idempotencyKey: params.idempotencyKey,
    });
    return res as PreflightResponse;
  }

  // ─── charge ────────────────────────────────────────────────────────────────

  /**
   * Confirm (success=true → record earnings) or cancel (success=false →
   * refund the reservation) a previously preflight'd charge. Idempotent.
   */
  async charge(params: {
    chargeId: string;
    success: boolean;
  }): Promise<ChargeResponse> {
    const res = await this.post("/api/sdk/charge", {
      chargeId: params.chargeId,
      success: params.success,
    });
    return res as ChargeResponse;
  }

  // ─── earnings ──────────────────────────────────────────────────────────────

  /**
   * Fetch cumulative earnings for the authenticated seller.
   */
  async getEarnings(serviceId?: string): Promise<EarningsResponse> {
    const qs = serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : "";
    const res = await this.get(`/api/sdk/earnings${qs}`);
    return res as EarningsResponse;
  }

  // ─── HTTP helpers ──────────────────────────────────────────────────────────

  private async post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.sellerKey}`,
        "User-Agent": USER_AGENT,
        "X-LemonCake-Client": USER_AGENT,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    if (!res.ok) throw new LemonCakeAPIError(res.status, data);
    return data;
  }

  private async get(path: string): Promise<unknown> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.sellerKey}`,
        "User-Agent": USER_AGENT,
        "X-LemonCake-Client": USER_AGENT,
      },
    });
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    if (!res.ok) throw new LemonCakeAPIError(res.status, data);
    return data;
  }
}

export { DEFAULT_API_URL };
