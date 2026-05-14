/**
 * @lemoncake/mcp-sdk — LemonCake API client
 *
 * Wraps the three SDK endpoints:
 *   POST /api/sdk/preflight  → check balance, reserve chargeId
 *   POST /api/sdk/charge     → confirm or cancel charge
 *   GET  /api/sdk/earnings   → seller earnings
 */

import type {
  PreflightResponse,
  ChargeResponse,
  EarningsResponse,
} from "./types.js";
import { LemonCakeAPIError } from "./errors.js";

const DEFAULT_API_URL = "https://api.lemoncake.xyz";
const SDK_VERSION = "0.1.0";
const USER_AGENT = `@lemoncake/mcp-sdk/${SDK_VERSION} (node/${typeof process !== "undefined" ? process.versions.node : "unknown"})`;

export class LemonCakeClient {
  private readonly apiUrl: string;
  private readonly sellerKey: string;

  constructor(apiUrl: string, sellerKey: string) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.sellerKey = sellerKey;
  }

  // ─── preflight ─────────────────────────────────────────────────────────────

  /**
   * Check whether a charge is allowed before executing the tool.
   * Returns a chargeId to use in the subsequent charge() call.
   */
  async preflight(params: {
    payToken: string;
    amount: number;
    toolName: string;
    sellerId?: string;
  }): Promise<PreflightResponse> {
    const res = await this.post("/api/sdk/preflight", {
      payToken: params.payToken,
      amount: params.amount.toFixed(6),
      toolName: params.toolName,
      sellerId: params.sellerId,
    });
    return res as PreflightResponse;
  }

  // ─── charge ────────────────────────────────────────────────────────────────

  /**
   * Confirm (success=true) or cancel (success=false) a previously preflight'd charge.
   */
  async charge(params: {
    chargeId: string;
    toolName: string;
    amount: number;
    sellerId?: string;
    success: boolean;
  }): Promise<ChargeResponse> {
    const res = await this.post("/api/sdk/charge", {
      chargeId: params.chargeId,
      toolName: params.toolName,
      amount: params.amount.toFixed(6),
      sellerId: params.sellerId,
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
