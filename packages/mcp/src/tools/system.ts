/**
 * System / connection tools. Each handler is a thin adapter: call the SDK
 * operation, then convert its envelope with {@link formatResult}.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getHealth, getSystemInfo, getSystemMetrics } from '@unraid-toolkit/sdk';
import { formatResult } from '../format.js';
import { READ_ONLY_ANNOTATIONS } from './annotations.js';
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
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => formatResult(await getHealth(ctx.client)),
  );

  server.registerTool(
    'unraid_system_info',
    {
      title: 'Get Unraid System Info',
      description: `Get static system information for the server: OS (distro, release, kernel, hostname, uptime), CPU (model, cores, threads), physical memory layout, motherboard, and software versions (Unraid, API, Docker, etc.).

This is identity/inventory data, not live load. For current CPU/memory utilization use unraid_system_metrics.`,
      inputSchema: {},
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => formatResult(await getSystemInfo(ctx.client)),
  );

  server.registerTool(
    'unraid_system_metrics',
    {
      title: 'Get Unraid System Metrics',
      description: `Get live system utilization: overall and per-core CPU load (percent), and memory usage (total/used/free/available and swap, in bytes plus percentages).

This is a point-in-time snapshot. For static hardware/OS details use unraid_system_info.`,
      inputSchema: {},
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => formatResult(await getSystemMetrics(ctx.client)),
  );
}
