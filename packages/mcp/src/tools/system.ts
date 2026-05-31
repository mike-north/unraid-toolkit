/**
 * System / connection tools. Each handler is a thin adapter: call the SDK
 * operation, then convert its envelope with {@link formatResult}.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHealth } from '@unraid-cli/sdk';
import { formatResult } from '../format.js';
import type { ServerContext } from '../server.js';

/** Register system/connection tools on the given server. */
export function registerSystemTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_connection_health',
    {
      title: 'Check Unraid API Connection',
      description: `Verify that the Unraid GraphQL API is reachable and the configured API key is accepted.

Performs a lightweight probe — it does not read array, Docker, or system data. Use it first to confirm connectivity and authentication, or to diagnose why other tools are failing.

Returns a JSON envelope: on success, the reachable endpoint; on failure, a structured error (auth, network, ...).`,
      inputSchema: {},
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => formatResult(await getHealth(ctx.client)),
  );
}
