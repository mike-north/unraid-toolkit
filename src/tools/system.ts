/**
 * System / connection tools for the Unraid MCP server.
 *
 * Phase 1 (observability) starts here with a connection-health probe. Richer
 * `system_info` / `system_metrics` tools are added once the GraphQL schema is
 * vendored and codegen is wired (see plan).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { responseFormatSchema, toolResult, type ToolResult } from '../format.js';
import type { ServerContext } from '../server.js';

const healthInputShape = {
  response_format: responseFormatSchema,
} as const;

const healthOutputShape = {
  reachable: z.boolean(),
  endpoint: z.string(),
  reason: z.string().optional(),
} as const;

/**
 * Register system/connection tools on the given server.
 */
export function registerSystemTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_connection_health',
    {
      title: 'Check Unraid API Connection',
      description: `Verify that the Unraid GraphQL API is reachable and the configured API key is accepted.

This performs a lightweight \`{ __typename }\` probe against the endpoint — it does not read array, Docker, or system data. Use it first to confirm connectivity and authentication before calling other tools, or to diagnose why other tools are failing.

Args:
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  {
    "reachable": boolean,   // true if the endpoint responded and the key was accepted
    "endpoint": string,     // the configured GraphQL URL
    "reason"?: string       // failure detail when reachable is false (auth error, network error, ...)
  }`,
      inputSchema: healthInputShape,
      outputSchema: healthOutputShape,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ response_format }): Promise<ToolResult> => {
      const result = await ctx.client.health();
      if (result.reachable) {
        return toolResult(
          response_format,
          { reachable: true, endpoint: result.endpoint },
          `✅ Unraid API reachable at ${result.endpoint} (API key accepted).`,
        );
      }
      return toolResult(
        response_format,
        { reachable: false, endpoint: result.endpoint, reason: result.reason },
        `❌ Unraid API not reachable at ${result.endpoint}.\nReason: ${result.reason}`,
      );
    },
  );
}
