/**
 * @lemoncake/mcp-sdk — Demo Mode logic
 *
 * When LEMONCAKE_SELLER_KEY is not set, the SDK enters Demo Mode:
 * - No real API calls are made
 * - Charges are logged to console only
 * - All tool calls proceed normally
 */

import type { ChargeOptions, MCPToolResult, ToolHandler, MCPToolContext } from "./types.js";

export const DEMO_NOTICE =
  "[LemonCake SDK] DEMO MODE — LEMONCAKE_SELLER_KEY not set. " +
  "Charges are logged only. Set the key to enable real billing.";

/**
 * Execute a tool handler in demo mode.
 * Logs what would have been charged and passes through to the real handler.
 */
export async function runInDemoMode(
  toolName: string,
  options: ChargeOptions,
  handler: ToolHandler,
  params: unknown,
  extra?: MCPToolContext
): Promise<MCPToolResult> {
  const price = options.price.toFixed(6);
  console.log(
    `[LemonCake SDK] DEMO CHARGE | tool=${toolName} | price=$${price} USDC | ` +
      `payToken=<not checked in demo>`
  );

  // Run the actual handler — demo mode is transparent to the tool
  const result = await handler(params, extra);
  const mcpResult = normalizeHandlerResult(result);

  // Prepend demo notice to the first text content
  return prependDemoNotice(mcpResult, toolName, price);
}

/**
 * Ensure the handler result is a valid MCPToolResult shape.
 */
export function normalizeHandlerResult(result: unknown): MCPToolResult {
  if (
    result !== null &&
    typeof result === "object" &&
    "content" in result &&
    Array.isArray((result as { content: unknown }).content)
  ) {
    return result as MCPToolResult;
  }
  // If handler returned a plain value, wrap it
  return {
    content: [
      {
        type: "text",
        text:
          typeof result === "string"
            ? result
            : JSON.stringify(result, null, 2),
      },
    ],
  };
}

function prependDemoNotice(
  result: MCPToolResult,
  toolName: string,
  price: string
): MCPToolResult {
  const notice = `[DEMO] Would have charged $${price} USDC for tool "${toolName}". Set LEMONCAKE_SELLER_KEY to enable real billing.\n\n`;
  const [first, ...rest] = result.content;
  return {
    ...result,
    content: [
      {
        type: "text",
        text: first ? notice + first.text : notice,
      },
      ...rest,
    ],
  };
}
