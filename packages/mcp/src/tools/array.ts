/**
 * Array & parity tools. Read adapters plus the Phase 3 destructive controls
 * (array state/disk membership, mount/unmount, parity-check lifecycle), each
 * routed through the Layer-1 floor + Layer-2 approval via {@link runDestructive}.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  getArrayStatus,
  getParityHistory,
  setArrayState,
  addDiskToArray,
  removeDiskFromArray,
  mountArrayDisk,
  unmountArrayDisk,
  startParityCheck,
  pauseParityCheck,
  resumeParityCheck,
  cancelParityCheck,
} from '@unraid-cli/sdk';
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

/** Register array/parity tools on the given server. */
export function registerArrayTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_array_status',
    {
      title: 'Get Unraid Array Status',
      description: `Get the storage array's current state (STARTED/STOPPED/...), total/used/free capacity, parity-check status, and every member disk (parity, data, cache, boot) with size, filesystem usage, temperature, and health color.`,
      inputSchema: {},
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => formatResult(await getArrayStatus(ctx.client)),
  );

  server.registerTool(
    'unraid_parity_history',
    {
      title: 'Get Unraid Parity-Check History',
      description: `List past parity checks (date, duration, speed, error count, status). Newest entries first as returned by the server. Use limit/offset to page through a long history.`,
      inputSchema: { ...PAGINATION_INPUT },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ limit, offset }) =>
      formatResult(await getParityHistory(ctx.client, { limit, offset })),
  );

  // --- Phase 3: destructive array control ---

  server.registerTool(
    'unraid_array_set_state',
    {
      title: 'Start/Stop Unraid Array',
      description: `Start or stop the storage array. Stopping the array takes all shares and Docker/VM services offline. Destructive — requires human approval.`,
      inputSchema: {
        desiredState: z.enum(['START', 'STOP']).describe('Target array state'),
        ...CONFIRM_TOKEN_INPUT,
      },
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ desiredState, confirm_token }) =>
      runDestructive(server, ctx, {
        tool: 'unraid_array_set_state',
        summary: `${desiredState === 'STOP' ? 'Stop' : 'Start'} the array`,
        targets: ['array'],
        token: confirm_token,
        run: () => setArrayState(ctx.client, desiredState),
      }),
  );

  server.registerTool(
    'unraid_array_add_disk',
    {
      title: 'Add Disk to Unraid Array',
      description: `Add a disk to the array at an optional slot. Destructive — requires human approval.`,
      inputSchema: {
        id: z.string().describe('The disk id (PrefixedID)'),
        slot: z.number().int().optional().describe('Target array slot'),
        ...CONFIRM_TOKEN_INPUT,
      },
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ id, slot, confirm_token }) =>
      runDestructive(server, ctx, {
        tool: 'unraid_array_add_disk',
        summary: `Add disk ${id} to the array`,
        targets: [id],
        token: confirm_token,
        run: () => addDiskToArray(ctx.client, id, slot),
      }),
  );

  server.registerTool(
    'unraid_array_remove_disk',
    {
      title: 'Remove Disk from Unraid Array',
      description: `Remove a disk from the array. The array must be stopped first. Destructive — requires human approval.`,
      inputSchema: {
        id: z.string().describe('The disk id (PrefixedID)'),
        slot: z.number().int().optional().describe('The disk slot'),
        ...CONFIRM_TOKEN_INPUT,
      },
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ id, slot, confirm_token }) =>
      runDestructive(server, ctx, {
        tool: 'unraid_array_remove_disk',
        summary: `Remove disk ${id} from the array`,
        targets: [id],
        token: confirm_token,
        run: () => removeDiskFromArray(ctx.client, id, slot),
      }),
  );

  server.registerTool(
    'unraid_array_mount_disk',
    {
      title: 'Mount Unraid Array Disk',
      description: `Mount a single array disk. Destructive — requires human approval.`,
      inputSchema: { id: z.string().describe('The disk id (PrefixedID)'), ...CONFIRM_TOKEN_INPUT },
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ id, confirm_token }) =>
      runDestructive(server, ctx, {
        tool: 'unraid_array_mount_disk',
        summary: `Mount array disk ${id}`,
        targets: [id],
        token: confirm_token,
        run: () => mountArrayDisk(ctx.client, id),
      }),
  );

  server.registerTool(
    'unraid_array_unmount_disk',
    {
      title: 'Unmount Unraid Array Disk',
      description: `Unmount a single array disk. Destructive — requires human approval.`,
      inputSchema: { id: z.string().describe('The disk id (PrefixedID)'), ...CONFIRM_TOKEN_INPUT },
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ id, confirm_token }) =>
      runDestructive(server, ctx, {
        tool: 'unraid_array_unmount_disk',
        summary: `Unmount array disk ${id}`,
        targets: [id],
        token: confirm_token,
        run: () => unmountArrayDisk(ctx.client, id),
      }),
  );

  // --- Phase 3: destructive parity control ---

  server.registerTool(
    'unraid_parity_start',
    {
      title: 'Start Unraid Parity Check',
      description: `Start a parity check. With correct=true it writes corrections to parity (a correcting check); correct=false runs a read-only check. Destructive (a correcting check writes to parity) and gated: requires human approval (elicitation or a confirmation token).`,
      inputSchema: {
        correct: z
          .boolean()
          .describe('Write corrections to parity (true) or read-only check (false)'),
        ...CONFIRM_TOKEN_INPUT,
      },
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ correct, confirm_token }) =>
      runDestructive(server, ctx, {
        tool: 'unraid_parity_start',
        summary: `Start a ${correct ? 'correcting' : 'read-only'} parity check`,
        targets: ['parity'],
        token: confirm_token,
        run: () => startParityCheck(ctx.client, correct),
      }),
  );

  server.registerTool(
    'unraid_parity_cancel',
    {
      title: 'Cancel Unraid Parity Check',
      description: `Cancel a running parity check (discards its progress). Destructive and gated: requires human approval (elicitation or a confirmation token).`,
      inputSchema: { ...CONFIRM_TOKEN_INPUT },
      annotations: DESTRUCTIVE_ANNOTATIONS,
    },
    async ({ confirm_token }) =>
      runDestructive(server, ctx, {
        tool: 'unraid_parity_cancel',
        summary: 'Cancel the running parity check',
        targets: ['parity'],
        token: confirm_token,
        run: () => cancelParityCheck(ctx.client),
      }),
  );

  // Pause/resume are reversible, low-risk lifecycle toggles — safe writes, not
  // gated. They still honor the read-only policy floor.
  server.registerTool(
    'unraid_parity_pause',
    {
      title: 'Pause Unraid Parity Check',
      description: `Pause a running parity check. Reversible — resume it with unraid_parity_resume.`,
      inputSchema: {},
      annotations: SAFE_WRITE_ANNOTATIONS,
    },
    async () => readOnlyBlock(ctx) ?? formatResult(await pauseParityCheck(ctx.client)),
  );

  server.registerTool(
    'unraid_parity_resume',
    {
      title: 'Resume Unraid Parity Check',
      description: `Resume a paused parity check.`,
      inputSchema: {},
      annotations: SAFE_WRITE_ANNOTATIONS,
    },
    async () => readOnlyBlock(ctx) ?? formatResult(await resumeParityCheck(ctx.client)),
  );
}
