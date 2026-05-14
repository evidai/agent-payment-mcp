/**
 * @lemoncake/mcp-sdk — Error types
 */

import type { PaymentErrorCode, MCPToolResult } from "./types.js";

export class LemonCakePaymentError extends Error {
  readonly code: PaymentErrorCode;
  readonly httpStatus: number;

  constructor(code: PaymentErrorCode, message: string, httpStatus = 402) {
    super(message);
    this.name = "LemonCakePaymentError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export class LemonCakeRateLimitError extends LemonCakePaymentError {
  constructor(toolName: string, limitPerMinute: number) {
    super(
      "RATE_LIMITED",
      `Rate limit exceeded for tool "${toolName}": max ${limitPerMinute} calls/minute per token`,
      429
    );
    this.name = "LemonCakeRateLimitError";
  }
}

export class LemonCakeAPIError extends LemonCakePaymentError {
  readonly statusCode: number;
  readonly body: unknown;

  constructor(statusCode: number, body: unknown) {
    const msg =
      typeof body === "object" && body !== null && "error" in body
        ? String((body as { error: unknown }).error)
        : `API responded with ${statusCode}`;
    super("API_ERROR", msg, statusCode);
    this.name = "LemonCakeAPIError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

// ─── MCP error response helpers ──────────────────────────────────────────────

/**
 * Build a payment-required MCP error response (402 equivalent).
 * Returns isError: true so MCP clients surface it as a tool error.
 */
export function paymentRequiredResponse(
  code: PaymentErrorCode,
  message: string,
  extra?: Record<string, unknown>
): MCPToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            error: message,
            code,
            lemoncake: true,
            ...(extra ?? {}),
          },
          null,
          2
        ),
      },
    ],
    isError: true,
  };
}

/**
 * Build a generic tool error response.
 */
export function toolErrorResponse(message: string): MCPToolResult {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

/**
 * Normalize any thrown value into a MCPToolResult with isError: true.
 * Never re-throws — safe to use in catch blocks.
 */
export function normalizeError(err: unknown): MCPToolResult {
  if (err instanceof LemonCakePaymentError) {
    return paymentRequiredResponse(err.code, err.message, {
      httpStatus: err.httpStatus,
    });
  }
  const message = err instanceof Error ? err.message : String(err);
  return toolErrorResponse(message);
}
