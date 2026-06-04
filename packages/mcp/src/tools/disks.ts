/**
 * Disk tools. Thin adapter over the SDK disk operations.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { listDisks } from '@unraid-toolkit/sdk';
import { formatResult } from '../format.js';
import { READ_ONLY_ANNOTATIONS } from './annotations.js';
import { PAGINATION_INPUT } from './pagination.js';
import type { ServerContext } from '../server.js';

/** Register disk tools on the given server. */
export function registerDiskTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_list_disks',
    {
      title: 'List Unraid Physical Disks',
      description: `List the physical disks attached to the server: device path, model/vendor, size (bytes), interface (SATA/SAS/NVMe/USB), SMART status, temperature, and spin state. Use limit/offset to page.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) => formatResult(await listDisks(ctx.client, { limit, offset })),
  );
}
