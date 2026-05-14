/**
 * @lemoncake/mcp-sdk — Global middleware implementation
 *
 * lc.middleware({ defaultPrice: 0.01 }) returns a GlobalMiddlewareFn
 * that can intercept all tool calls.
 *
 * Usage (with @modelcontextprotocol/sdk):
 *   const mw = lc.middleware({ defaultPrice: 0.01, perTool: { heavy_search: 0.05 } });
 *
 *   // Wrap individual handlers:
 *   server.tool("tool_name", (params, extra) =>
 *     mw.intercept("tool_name", originalHandler, params, extra)
 *   );
 */

import type {
  MiddlewareConfig,
  ToolHandler,
  MCPToolContext,
  MCPToolResult,
  GlobalMiddlewareFn,
} from "./types.js";
import { LemonCakeClient } from "./client.js";
import { buildChargeWrapper } from "./withPayment.js";

export function buildMiddleware(
  client: LemonCakeClient | null,
  isDemo: boolean,
  serviceId: string | undefined,
  defaultPayToken: string | undefined,
  config: MiddlewareConfig
): GlobalMiddlewareFn {
  const wrapper = buildChargeWrapper(client, isDemo, serviceId, defaultPayToken);

  return {
    intercept(
      toolName: string,
      handler: ToolHandler,
      params: unknown,
      extra?: MCPToolContext
    ): Promise<MCPToolResult> {
      const price =
        config.perTool?.[toolName] ?? config.defaultPrice;

      const wrappedHandler = wrapper(
        {
          price,
          freeCalls: config.freeCalls,
          rateLimit: config.rateLimit,
          toolName,
        },
        toolName
      )(handler);

      return wrappedHandler(params, extra);
    },
  };
}
