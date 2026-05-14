/**
 * @lemon-cake/mcp-sdk
 *
 * "Stripe for MCP servers" — add pay-per-call USDC billing to any MCP tool
 * in three lines of code.
 *
 * @example
 * ```typescript
 * import { createLemonCakeSDK } from "@lemon-cake/mcp-sdk";
 *
 * const lc = createLemonCakeSDK({ sellerKey: process.env.LEMONCAKE_SELLER_KEY });
 *
 * server.tool("search_patents", lc.charge({ price: 0.05 }), async (params) => {
 *   return await searchPatents(params.query);
 * });
 * ```
 */

import { LemonCakeClient, DEFAULT_API_URL } from "./client.js";
import { buildChargeWrapper } from "./withPayment.js";
import { buildMiddleware } from "./middleware.js";
import type {
  LemonCakeSDKConfig,
  LemonCakeSDK,
  ChargeOptions,
  MiddlewareConfig,
  ToolHandler,
  WrappedToolHandler,
  MCPToolContext,
  EarningsResponse,
} from "./types.js";

export { LemonCakePaymentError, LemonCakeAPIError, LemonCakeRateLimitError } from "./errors.js";
export type {
  LemonCakeSDKConfig,
  LemonCakeSDK,
  ChargeOptions,
  MiddlewareConfig,
  EarningsResponse,
  PreflightResponse,
  ChargeResponse,
  MCPToolContext,
  MCPToolResult,
  ToolHandler,
  WrappedToolHandler,
  GlobalMiddlewareFn,
  PaymentErrorCode,
} from "./types.js";

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a LemonCake SDK instance.
 *
 * If `sellerKey` is not provided and `LEMONCAKE_SELLER_KEY` env var is not set,
 * the SDK enters Demo Mode: charges are logged to console but no API calls are made.
 */
export function createLemonCakeSDK(config: LemonCakeSDKConfig = {}): LemonCakeSDK {
  const sellerKey =
    config.sellerKey ??
    (typeof process !== "undefined" ? process.env.LEMONCAKE_SELLER_KEY : undefined);

  const apiUrl = config.apiUrl ?? DEFAULT_API_URL;
  const isDemo = !sellerKey;
  const serviceId = config.serviceId;
  const defaultPayToken = config.defaultPayToken;

  if (isDemo) {
    console.warn(
      "[LemonCake SDK] DEMO MODE — LEMONCAKE_SELLER_KEY not set. " +
        "All tool calls will proceed without real charges. " +
        "Set LEMONCAKE_SELLER_KEY to enable billing."
    );
  }

  const client = isDemo ? null : new LemonCakeClient(apiUrl, sellerKey!);
  const chargeWrapper = buildChargeWrapper(client, isDemo, serviceId, defaultPayToken);

  const sdk: LemonCakeSDK = {
    get isDemo() {
      return isDemo;
    },

    get apiUrl() {
      return apiUrl;
    },

    /**
     * Wrap a single tool with per-call USDC billing.
     *
     * Returns a function compatible with the @modelcontextprotocol/sdk tool
     * registration API:
     *
     * ```typescript
     * server.tool(
     *   "my_tool",
     *   inputSchema,
     *   lc.charge({ price: 0.05 })(async (params) => { ... })
     * );
     * ```
     *
     * Or, for servers that support middleware-style registration:
     * ```typescript
     * server.tool("my_tool", lc.charge({ price: 0.05 }), handler);
     * ```
     */
    charge(options: ChargeOptions) {
      const resolvedToolName = options.toolName ?? "unknown_tool";
      const wrapFn = chargeWrapper(options, resolvedToolName);

      // Return a function that either:
      //   A) acts as a handler wrapper: lc.charge(opts)(handler) → wrappedHandler
      //   B) acts as a middleware factory for SDK-style registration
      // We return a callable that wraps the handler when invoked directly.
      const chargeMiddleware = (handler: ToolHandler): WrappedToolHandler => {
        return wrapFn(handler);
      };

      // Also attach a call() method for inline usage
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (chargeMiddleware as any).__lemoncakeOptions = options;

      return chargeMiddleware as (handler: ToolHandler) => WrappedToolHandler;
    },

    /**
     * Build a global middleware interceptor for all tools.
     *
     * ```typescript
     * const mw = lc.middleware({ defaultPrice: 0.01, perTool: { premium: 0.10 } });
     *
     * server.tool("my_tool", (params, extra) =>
     *   mw.intercept("my_tool", originalHandler, params, extra)
     * );
     * ```
     */
    middleware(config: MiddlewareConfig) {
      return buildMiddleware(client, isDemo, serviceId, defaultPayToken, config);
    },

    /**
     * Fetch cumulative earnings for the configured seller.
     * Throws in Demo Mode (no seller key to authenticate).
     */
    async getEarnings(): Promise<EarningsResponse> {
      if (isDemo || !client) {
        return {
          totalEarned: "0.000000",
          todayEarned: "0.000000",
          callCount: 0,
          serviceId: undefined,
        };
      }
      return client.getEarnings(serviceId);
    },
  };

  return sdk;
}

// ─── Convenience re-export of free tier and rate limit utils ─────────────────
export { resetFreeCounter, clearAllFreeCounters } from "./freeTier.js";
export { clearAllRateLimits } from "./rateLimit.js";
