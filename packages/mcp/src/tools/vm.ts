/**
 * Virtual machine tools. Thin adapters over the SDK VM operations — a read-only
 * list plus the Phase 2 safe lifecycle controls (start/stop/pause/resume), each
 * gated by the read-only policy floor.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  listVms,
  startVm,
  stopVm,
  pauseVm,
  resumeVm,
  forceStopVm,
  rebootVm,
  resetVm,
  type UnraidClient,
  type UnraidResult,
  type VmActionResult,
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

type VmOp = (client: UnraidClient, id: string) => Promise<UnraidResult<VmActionResult>>;

/** The Phase 2 VM lifecycle actions, each a `(client, id)` SDK operation. */
const VM_ACTIONS = [
  { tool: 'unraid_vm_start', title: 'Start Unraid VM', verb: 'Start', op: startVm },
  { tool: 'unraid_vm_stop', title: 'Stop Unraid VM', verb: 'Gracefully stop', op: stopVm },
  { tool: 'unraid_vm_pause', title: 'Pause Unraid VM', verb: 'Pause', op: pauseVm },
  { tool: 'unraid_vm_resume', title: 'Resume Unraid VM', verb: 'Resume', op: resumeVm },
] as const satisfies readonly { tool: string; title: string; verb: string; op: VmOp }[];

/** The Phase 3 destructive VM actions (ungraceful — risk guest data loss). */
const VM_DESTRUCTIVE_ACTIONS = [
  {
    tool: 'unraid_vm_force_stop',
    title: 'Force-Stop Unraid VM',
    verb: 'Force-stop',
    op: forceStopVm,
  },
  { tool: 'unraid_vm_reboot', title: 'Reboot Unraid VM', verb: 'Reboot', op: rebootVm },
  { tool: 'unraid_vm_reset', title: 'Reset Unraid VM', verb: 'Hard-reset', op: resetVm },
] as const satisfies readonly { tool: string; title: string; verb: string; op: VmOp }[];

/** Register VM tools on the given server. */
export function registerVmTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_list_vms',
    {
      title: 'List Unraid Virtual Machines',
      description: `List the virtual machines (libvirt domains) known to Unraid with their id, name, and current run state (RUNNING/SHUTOFF/PAUSED/...). Use limit/offset to page.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) => formatResult(await listVms(ctx.client, { limit, offset })),
  );

  for (const { tool, title, verb, op } of VM_ACTIONS) {
    server.registerTool(
      tool,
      {
        title,
        description: `${verb} the virtual machine with the given id. Returns whether the hypervisor accepted the request.`,
        inputSchema: { id: z.string().describe('The VM id (PrefixedID)') },
        annotations: SAFE_WRITE_ANNOTATIONS,
      },
      async ({ id }) => readOnlyBlock(ctx) ?? formatResult(await op(ctx.client, id)),
    );
  }

  // --- Phase 3: destructive VM control ---
  for (const { tool, title, verb, op } of VM_DESTRUCTIVE_ACTIONS) {
    server.registerTool(
      tool,
      {
        title,
        description: `${verb} the virtual machine with the given id (ungraceful — may cause data loss in the guest). Destructive — requires human approval.`,
        inputSchema: { id: z.string().describe('The VM id (PrefixedID)'), ...CONFIRM_TOKEN_INPUT },
        annotations: DESTRUCTIVE_ANNOTATIONS,
      },
      async ({ id, confirm_token }) =>
        runDestructive(server, ctx, {
          tool,
          summary: `${verb} VM ${id}`,
          targets: [id],
          token: confirm_token,
          run: () => op(ctx.client, id),
        }),
    );
  }
}
