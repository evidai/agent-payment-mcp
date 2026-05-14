/**
 * @lemoncake/mcp-sdk — charge() wrapper implementation
 *
 * Wraps an MCP tool handler with:
 * 1. Pay Token extraction (_meta.payToken → LEMONCAKE_PAY_TOKEN env → defaultPayToken)
 * 2. Rate limit check (in-memory, per token per tool)
 * 3. Free tier check (in-memory, per token per tool)
 * 4. Preflight check with LemonCake API
 * 5. Tool execution
 * 6. Charge confirmation (or cancellation on failure)
 *
 * In Demo Mode, steps 2–4 and 6 are skipped; a log line is emitted instead.
 */

import type {
  ChargeOptions,
  ToolHandler,
  WrappedToolHandler,
  MCPToolContext,
  MCPToolResult,
} from "./types.js";
import { LemonCakeClient } from "./client.js";
import { consumeFreeCall, freeCallsRemaining } from "./freeTier.js";
import { checkRateLimit } from "./rateLimit.js";
import { runInDemoMode, normalizeHandlerResult } from "./demo.js";
import {
  paymentRequiredResponse,
  toolErrorResponse,
  normalizeError,
} from "./errors.js";

// ─── Pay Token extraction ────────────────────────────────────────────────────

/**
 * Resolve the Pay Token from (in order):
 *   1. MCP request _meta.payToken
 *   2. LEMONCAKE_PAY_TOKEN env var
 *   3. SDK-level defaultPayToken config
 */
export function resolvePayToken(
  extra?: MCPToolContext,
  defaultPayToken?: string
): string | null {
  const fromMeta = extra?._meta?.payToken;
  if (fromMeta && typeof fromMeta === "string") return fromMeta;

  const fromEnv =
    typeof process !== "undefined"
      ? process.env.LEMONCAKE_PAY_TOKEN
      : undefined;
  if (fromEnv) return fromEnv;

  return defaultPayToken ?? null;
}

/**
 * Extract a stable token identifier from a JWT without verifying it.
 * We read the jti claim from the payload section (base64url-decoded).
 * Falls back to a hash of the full token string if parsing fails.
 */
export function extractTokenId(jwt: string): string {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return hashString(jwt);
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as { jti?: string };
    return payload.jti ?? hashString(jwt);
  } catch {
    return hashString(jwt);
  }
}

function hashString(s: string): string {
  // Simple djb2 hash for in-memory keying — not cryptographic
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) ^ s.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

// ─── Main wrapper factory ────────────────────────────────────────────────────

export function buildChargeWrapper(
  client: LemonCakeClient | null,
  isDemo: boolean,
  serviceId: string | undefined,
  defaultPayToken: string | undefined
) {
  return function chargeWrapper(
    options: ChargeOptions,
    resolvedToolName: string
  ) {
    const toolName = options.toolName ?? resolvedToolName;
    const freeCalls = options.freeCalls ?? 0;
    const rateLimit = options.rateLimit ?? 0;
    const x402 = options.x402Headers !== false;

    return function wrappedHandler(
      handler: ToolHandler
    ): WrappedToolHandler {
      return async (
        params: unknown,
        extra?: MCPToolContext
      ): Promise<MCPToolResult> => {
        // ── Demo Mode: skip all payment logic ──────────────────────────────
        if (isDemo) {
          return runInDemoMode(toolName, options, handler, params, extra);
        }

        // ── Resolve Pay Token ───────────────────────────────────────────────
        const payToken = resolvePayToken(extra, defaultPayToken);
        if (!payToken) {
          return paymentRequiredResponse(
            "INVALID_TOKEN",
            "No Pay Token found. Provide one via MCP _meta.payToken or LEMONCAKE_PAY_TOKEN env var.",
            {
              howToFix: "Set LEMONCAKE_PAY_TOKEN in your environment, or pass _meta.payToken in the MCP request.",
              x402: x402 ? { header: "X-Payment-Required: lemoncake-pay-token" } : undefined,
            }
          );
        }

        const tokenId = extractTokenId(payToken);

        // ── Rate limit check ────────────────────────────────────────────────
        if (rateLimit > 0 && !checkRateLimit(tokenId, toolName, rateLimit)) {
          return paymentRequiredResponse(
            "RATE_LIMITED",
            `Rate limit exceeded for "${toolName}": max ${rateLimit} calls/minute per token.`,
            { retryAfterMs: 60_000 }
          );
        }

        // ── Free tier check ──────────────────────────────────────────────────
        if (consumeFreeCall(tokenId, toolName, freeCalls)) {
          const remaining = freeCallsRemaining(tokenId, toolName, freeCalls);
          console.log(
            `[LemonCake SDK] FREE CALL | tool=${toolName} | remaining=${remaining}`
          );
          try {
            const result = await handler(params, extra);
            return normalizeHandlerResult(result);
          } catch (err) {
            return normalizeError(err);
          }
        }

        // ── Preflight: check balance and reserve chargeId ───────────────────
        if (!client) {
          return toolErrorResponse(
            "LemonCake client not initialized. This is a bug in the SDK."
          );
        }

        let chargeId: string;
        try {
          const preflight = await client.preflight({
            payToken,
            amount: options.price,
            toolName,
            sellerId: serviceId,
          });

          if (!preflight.allowed) {
            const reason = preflight.reason ?? "Insufficient balance or token limit exceeded.";
            return paymentRequiredResponse("INSUFFICIENT_FUNDS", reason, {
              remainingUsdc: preflight.remainingUsdc,
              requiredUsdc: options.price.toFixed(6),
              x402: x402
                ? {
                    header: "X-Payment-Required: lemoncake-pay-token",
                    amount: options.price.toFixed(6),
                    asset: "USDC",
                  }
                : undefined,
            });
          }
          chargeId = preflight.chargeId;
        } catch (err) {
          // Preflight failure — don't run the tool
          return normalizeError(err);
        }

        // ── Execute tool handler ─────────────────────────────────────────────
        let toolResult: MCPToolResult;
        let success = false;
        try {
          const raw = await handler(params, extra);
          toolResult = normalizeHandlerResult(raw);
          success = !toolResult.isError;
        } catch (err) {
          toolResult = normalizeError(err);
          success = false;
        }

        // ── Confirm/cancel charge ────────────────────────────────────────────
        try {
          const chargeResult = await client.charge({
            chargeId,
            toolName,
            amount: options.price,
            sellerId: serviceId,
            success,
          });

          // Append receipt info to the first text content if x402 mode is on
          if (x402 && success && chargeResult) {
            const receipt = {
              chargeId: chargeResult.chargeId,
              amountUsdc: chargeResult.charged,
              newBalance: chargeResult.newBalance,
            };
            console.log(
              `[LemonCake SDK] CHARGED | tool=${toolName} | amount=$${chargeResult.charged} USDC | chargeId=${chargeResult.chargeId}`
            );
            // Attach receipt as a second content block (non-intrusive)
            toolResult = {
              ...toolResult,
              content: [
                ...toolResult.content,
                {
                  type: "text",
                  text: `\n[LemonCake] Charged $${chargeResult.charged} USDC (chargeId: ${receipt.chargeId})`,
                },
              ],
            };
          }
        } catch (chargeErr) {
          // Charge confirmation failed — log but don't override the tool result
          console.error(
            `[LemonCake SDK] Charge confirmation failed for chargeId=${chargeId}:`,
            chargeErr
          );
        }

        return toolResult;
      };
    };
  };
}
