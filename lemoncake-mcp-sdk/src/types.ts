/**
 * @lemoncake/mcp-sdk — Full TypeScript type definitions
 */

// ─── SDK Config ──────────────────────────────────────────────────────────────

export interface LemonCakeSDKConfig {
  /**
   * Seller key for authenticating with the LemonCake API.
   * If omitted, the SDK uses LEMONCAKE_SELLER_KEY from env.
   * If neither is set, the SDK enters Demo Mode (no real charges).
   */
  sellerKey?: string;

  /**
   * LemonCake API base URL. Defaults to https://api.lemoncake.xyz
   */
  apiUrl?: string;

  /**
   * Service ID registered on the LemonCake marketplace.
   * Required for earnings tracking and server-side validation.
   */
  serviceId?: string;

  /**
   * Default pay token source. The SDK checks (in order):
   *   1. MCP _meta.payToken
   *   2. LEMONCAKE_PAY_TOKEN env var
   *   3. This value
   */
  defaultPayToken?: string;
}

// ─── charge() options ────────────────────────────────────────────────────────

export interface ChargeOptions {
  /**
   * Price per call in USDC. Range: 0.001–1.00.
   * Examples: 0.01 ($0.01/call), 0.05 ($0.05/call)
   */
  price: number;

  /**
   * Number of free calls allowed before billing starts (per-token, in-memory).
   * Defaults to 0.
   */
  freeCalls?: number;

  /**
   * Optional tool name override (used in charge metadata). Defaults to the
   * name passed to server.tool().
   */
  toolName?: string;

  /**
   * Maximum calls per minute per pay token (rate limiting).
   * Enforced in-memory; not persisted across restarts.
   */
  rateLimit?: number;

  /**
   * x402-compatible header mode. When true, responses include
   * X-Payment-Required and X-Payment-Receipt headers.
   * Defaults to true.
   */
  x402Headers?: boolean;
}

// ─── middleware() options ────────────────────────────────────────────────────

export interface MiddlewareConfig {
  /**
   * Default price for all tools not individually configured.
   * Can be overridden per-tool via perTool map.
   */
  defaultPrice: number;

  /**
   * Per-tool price overrides. Key is tool name.
   */
  perTool?: Record<string, number>;

  /**
   * Global free calls before billing (applies to every tool).
   */
  freeCalls?: number;

  /**
   * Maximum calls per minute per pay token (global).
   */
  rateLimit?: number;
}

// ─── API response types ───────────────────────────────────────────────────────

export interface PreflightResponse {
  allowed: boolean;
  remainingUsdc: string;
  chargeId: string;
  reason?: string;
}

export interface ChargeResponse {
  chargeId: string;
  charged: string;
  newBalance: string;
  status: "completed" | "demo" | "free";
}

export interface EarningsResponse {
  totalEarned: string;
  todayEarned: string;
  callCount: number;
  serviceId?: string;
}

// ─── Internal state types ─────────────────────────────────────────────────────

export interface FreeTierEntry {
  used: number;
  limit: number;
}

export interface RateLimitEntry {
  count: number;
  windowStart: number;
}

// ─── MCP tool handler context ─────────────────────────────────────────────────

export interface MCPToolContext {
  /**
   * The MCP _meta object from the incoming request, may contain payToken.
   */
  _meta?: {
    payToken?: string;
    [key: string]: unknown;
  };
}

// ─── Charge result (returned by the SDK wrapper) ──────────────────────────────

export type ChargeResult =
  | { status: "charged"; chargeId: string; amountUsdc: string }
  | { status: "free"; callsRemaining: number }
  | { status: "demo" }
  | { status: "error"; code: PaymentErrorCode; message: string };

export type PaymentErrorCode =
  | "INSUFFICIENT_FUNDS"
  | "TOKEN_EXPIRED"
  | "TOKEN_REVOKED"
  | "TOKEN_LIMIT_EXCEEDED"
  | "RATE_LIMITED"
  | "INVALID_TOKEN"
  | "API_ERROR"
  | "SELLER_KEY_MISSING";

// ─── MCP response shape ───────────────────────────────────────────────────────

export interface MCPTextContent {
  type: "text";
  text: string;
}

export interface MCPToolResult {
  content: MCPTextContent[];
  isError?: boolean;
}

// ─── SDK instance shape ───────────────────────────────────────────────────────

export interface LemonCakeSDK {
  /**
   * Returns a tool handler wrapper that checks payment before running the tool.
   * Usage: server.tool("tool_name", lc.charge({ price: 0.05 }), handler)
   */
  charge(options: ChargeOptions): ToolMiddlewareFn;

  /**
   * Returns a middleware function to apply to all tools.
   * Usage: server.use(lc.middleware({ defaultPrice: 0.01 }))
   */
  middleware(config: MiddlewareConfig): GlobalMiddlewareFn;

  /**
   * Fetch cumulative earnings for the configured seller.
   */
  getEarnings(): Promise<EarningsResponse>;

  /**
   * Returns true if the SDK is in Demo Mode (no real charges).
   */
  readonly isDemo: boolean;

  /**
   * The resolved API URL being used.
   */
  readonly apiUrl: string;
}

/**
 * Function returned by lc.charge() — wraps an MCP tool handler.
 * Compatible with @modelcontextprotocol/sdk v1.10+ tool registration.
 */
export type ToolMiddlewareFn = (
  handler: ToolHandler,
  context?: MCPToolContext
) => WrappedToolHandler;

/**
 * The original user-supplied handler for an MCP tool.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolHandler = (params: any, extra?: any) => Promise<MCPToolResult | any>;

/**
 * The wrapped handler returned by lc.charge() / lc.middleware().
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WrappedToolHandler = (params: any, extra?: any) => Promise<MCPToolResult>;

/**
 * Middleware function returned by lc.middleware().
 * Applied globally to intercept all tool calls.
 */
export type GlobalMiddlewareFn = {
  /**
   * Intercepts a tool call and applies payment logic.
   */
  intercept(
    toolName: string,
    handler: ToolHandler,
    params: unknown,
    extra?: MCPToolContext
  ): Promise<MCPToolResult>;
};
