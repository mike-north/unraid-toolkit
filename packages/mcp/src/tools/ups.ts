/**
 * UPS tools. Thin adapter over the SDK UPS operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getUpsStatus } from '@unraid-toolkit/sdk';
import { formatResult } from '../format.js';
import { READ_ONLY_ANNOTATIONS } from './annotations.js';
import { PAGINATION_INPUT } from './pagination.js';
import type { ServerContext } from '../server.js';

/** Register UPS tools on the given server. */
export function registerUpsTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_ups_status',
    {
      title: 'Get Unraid UPS Status',
      description: `List connected UPS devices with battery telemetry (charge %, estimated runtime, health) and power telemetry (input/output voltage, load %, current/nominal watts). Use limit/offset if multiple UPS units are attached.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) => formatResult(await getUpsStatus(ctx.client, { limit, offset })),
  );
}
