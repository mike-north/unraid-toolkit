/**
 * Docker tools. Thin adapters over the SDK Docker operations.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  listContainers,
  getContainer,
  getContainerLogs,
  getUpdateStatuses,
  startContainer,
  stopContainer,
  pauseContainer,
  unpauseContainer,
  updateContainer,
  updateAllContainers,
  removeContainer,
  type UnraidClient,
  type UnraidResult,
  type DockerContainerState,
} from '@unraid-toolkit/sdk';
import { formatResult } from '../format.js';
import {
  READ_ONLY_ANNOTATIONS,
  SAFE_WRITE_ANNOTATIONS,
  DESTRUCTIVE_ANNOTATIONS,
} from './annotations.js';
import { PAGINATION_INPUT } from './pagination.js';
import { CONFIRM_TOKEN_INPUT } from './confirm.js';
import { readOnlyBlock } from './policy.js';
import { runDestructive } from './destructive.js';
import type { ServerContext } from '../server.js';

/** Phase 2 single-container lifecycle controls, each a `(client, id)` op. */
const CONTAINER_ACTIONS = [
  {
    tool: 'unraid_docker_start',
    title: 'Start Unraid Container',
    verb: 'Start',
    op: startContainer,
  },
  { tool: 'unraid_docker_stop', title: 'Stop Unraid Container', verb: 'Stop', op: stopContainer },
  {
    tool: 'unraid_docker_pause',
    title: 'Pause Unraid Container',
    verb: 'Pause (suspend)',
    op: pauseContainer,
  },
  {
    tool: 'unraid_docker_unpause',
    title: 'Unpause Unraid Container',
    verb: 'Unpause (resume)',
    op: unpauseContainer,
  },
  {
    tool: 'unraid_docker_update',
    title: 'Update Unraid Container',
    verb: 'Pull the latest image for and recreate',
    op: updateContainer,
  },
] as const satisfies readonly {
  tool: string;
  title: string;
  verb: string;
  op: (client: UnraidClient, id: string) => Promise<UnraidResult<DockerContainerState>>;
}[];

/** Register Docker tools on the given server. */
export function registerDockerTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_list_containers',
    {
      title: 'List Unraid Docker Containers',
      description: `List Docker containers with name, image, state (running/exited/paused), status text, autostart settings, update availability, and published ports. Use limit/offset to page.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) => formatResult(await listContainers(ctx.client, { limit, offset })),
  );

  server.registerTool(
    'unraid_get_container',
    {
      title: 'Get Unraid Docker Container',
      description: `Get detailed information about a single Docker container by id, including image, command, sizes, network mode, ports, autostart, template path, and WebUI/support URLs. Fails with NOT_FOUND if no container has that id.`,
      inputSchema: { id: z.string().describe('The container id (PrefixedID)') },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ id }) => formatResult(await getContainer(ctx.client, id)),
  );

  server.registerTool(
    'unraid_container_logs',
    {
      title: 'Get Unraid Docker Container Logs',
      description: `Fetch recent log lines for a container. Use 'tail' to limit to the last N lines and 'since' (ISO timestamp or cursor) to resume. Output is size-capped; 'truncated' indicates older lines were dropped to fit.`,
      inputSchema: {
        id: z.string().describe('The container id (PrefixedID)'),
        tail: z.number().int().optional().describe('Return only the last N lines'),
        since: z
          .string()
          .optional()
          .describe('Only return lines after this ISO timestamp / cursor'),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ id, tail, since }) =>
      formatResult(await getContainerLogs(ctx.client, { id, tail, since })),
  );

  server.registerTool(
    'unraid_container_update_statuses',
    {
      title: 'Get Unraid Container Update Statuses',
      description: `Report per-container update availability (UP_TO_DATE / UPDATE_AVAILABLE / REBUILD_READY / UNKNOWN). Use limit/offset to page.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) =>
      formatResult(await getUpdateStatuses(ctx.client, { limit, offset })),
  );

  for (const { tool, title, verb, op } of CONTAINER_ACTIONS) {
    server.registerTool(
      tool,
      {
        title,
        description: `${verb} the Docker container with the given id. Returns the container's resulting state.`,
        inputSchema: { id: z.string().describe('The container id (PrefixedID)') },
        annotations: SAFE_WRITE_ANNOTATIONS,
      },
      async ({ id }) => readOnlyBlock(ctx) ?? formatResult(await op(ctx.client, id)),
    );
  }

  server.registerTool(
    'unraid_docker_update_all',
    {
      title: 'Update All Unraid Containers',
      description: `Update every Docker container that has an available image update. Returns the resulting state of each updated container.`,
      inputSchema: {},
      annotations: SAFE_WRITE_ANNOTATIONS,
    },
    async () => readOnlyBlock(ctx) ?? formatResult(await updateAllContainers(ctx.client)),
  );

  // --- Phase 3: destructive container control ---
  server.registerTool(
    'unraid_docker_remove',
    {
      title: 'Remove Unraid Container',
      description: `Remove a Docker container, optionally deleting its backing image (withImage). Irreversible and destructive — requires human approval.`,
      inputSchema: {
        id: z.string().describe('The container id (PrefixedID)'),
        withImage: z.boolean().optional().describe('Also remove the backing image (default false)'),
        ...CONFIRM_TOKEN_INPUT,
      },
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ id, withImage, confirm_token }) =>
      runDestructive(server, ctx, {
        tool: 'unraid_docker_remove',
        summary: `Remove container ${id}${withImage === true ? ' and its image' : ''}`,
        targets: [id],
        token: confirm_token,
        run: () => removeContainer(ctx.client, id, withImage ?? false),
      }),
  );
}
