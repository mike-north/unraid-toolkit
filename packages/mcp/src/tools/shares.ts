/**
 * User-share tools. Thin adapter over the SDK share operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listShares } from '@unraid-toolkit/sdk';
import { formatResult } from '../format.js';
import { READ_ONLY_ANNOTATIONS } from './annotations.js';
import { PAGINATION_INPUT } from './pagination.js';
import type { ServerContext } from '../server.js';

/** Register user-share tools on the given server. */
export function registerShareTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_list_shares',
    {
      title: 'List Unraid User Shares',
      description: `List Unraid user shares with capacity (free/used/total, in KB), included/excluded disks, cache setting, allocation policy, and comment. Use limit/offset to page.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) => formatResult(await listShares(ctx.client, { limit, offset })),
  );
}
