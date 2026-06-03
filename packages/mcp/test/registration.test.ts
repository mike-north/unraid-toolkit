/**
 * Tool-registration coverage: asserts that `registerAllTools` wires up the full
 * expected tool surface with correct annotations. This guards the wrapper wiring
 * — a mis-named tool, a missing registration, or a read-only tool accidentally
 * flagged destructive (or vice-versa) would fail here.
 *
 * Uses a recording fake in place of McpServer to capture every registerTool call
 * without booting a transport.
 *
 * @see https://docs.unraid.net/API/
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from '../src/tools/index.js';
import type { ServerContext } from '../src/server.js';

interface Registered {
  name: string;
  annotations: { readOnlyHint?: boolean; destructiveHint?: boolean } | undefined;
  inputKeys: string[];
}

/** Capture every registerTool(name, config) call made by registerAllTools. */
function recordRegistrations(): { server: McpServer; tools: Map<string, Registered> } {
  const tools = new Map<string, Registered>();
  const server = {
    registerTool(name: string, config: Record<string, unknown>) {
      tools.set(name, {
        name,
        annotations: config['annotations'] as Registered['annotations'],
        inputKeys: Object.keys((config['inputSchema'] as Record<string, unknown>) ?? {}),
      });
      return {} as unknown;
    },
  } as unknown as McpServer;
  return { server, tools };
}

const ctx = { config: { readOnly: false, maxBatch: 10, denyTools: [] } } as ServerContext;

let tools: Map<string, Registered>;
beforeAll(() => {
  const rec = recordRegistrations();
  registerAllTools(rec.server, ctx);
  tools = rec.tools;
});

// The full expected tool surface, grouped by safety class.
const READ_ONLY_TOOLS = [
  'unraid_connection_health',
  'unraid_system_info',
  'unraid_system_metrics',
  'unraid_array_status',
  'unraid_parity_history',
  'unraid_list_disks',
  'unraid_list_containers',
  'unraid_get_container',
  'unraid_container_logs',
  'unraid_container_update_statuses',
  'unraid_list_vms',
  'unraid_list_shares',
  'unraid_list_notifications',
  'unraid_notifications_overview',
  'unraid_ups_status',
];

const SAFE_WRITE_TOOLS = [
  'unraid_docker_start',
  'unraid_docker_stop',
  'unraid_docker_pause',
  'unraid_docker_unpause',
  'unraid_docker_update',
  'unraid_docker_update_all',
  'unraid_vm_start',
  'unraid_vm_stop',
  'unraid_vm_pause',
  'unraid_vm_resume',
  'unraid_create_notification',
  'unraid_archive_notification',
  'unraid_unarchive_notification',
  'unraid_parity_pause',
  'unraid_parity_resume',
];

const DESTRUCTIVE_TOOLS = [
  'unraid_array_set_state',
  'unraid_array_add_disk',
  'unraid_array_remove_disk',
  'unraid_array_mount_disk',
  'unraid_array_unmount_disk',
  'unraid_parity_start',
  'unraid_parity_cancel',
  'unraid_docker_remove',
  'unraid_vm_force_stop',
  'unraid_vm_reboot',
  'unraid_vm_reset',
];

describe('registerAllTools', () => {
  it('registers exactly the expected tool set with no extras or duplicates', () => {
    const expected = [...READ_ONLY_TOOLS, ...SAFE_WRITE_TOOLS, ...DESTRUCTIVE_TOOLS].sort();
    expect([...tools.keys()].sort()).toEqual(expected);
  });

  it('registers every tool exactly once (no name collisions)', () => {
    // Map de-dupes, so compare its size to the count of expected unique names.
    const expectedCount =
      READ_ONLY_TOOLS.length + SAFE_WRITE_TOOLS.length + DESTRUCTIVE_TOOLS.length;
    expect(tools.size).toBe(expectedCount);
  });

  it.each(READ_ONLY_TOOLS)('%s is annotated read-only and non-destructive', (name) => {
    const t = tools.get(name);
    expect(t, `${name} not registered`).toBeDefined();
    expect(t?.annotations?.readOnlyHint).toBe(true);
    expect(t?.annotations?.destructiveHint).toBe(false);
  });

  it.each(SAFE_WRITE_TOOLS)('%s is a non-read-only, non-destructive write', (name) => {
    const t = tools.get(name);
    expect(t, `${name} not registered`).toBeDefined();
    expect(t?.annotations?.readOnlyHint).toBe(false);
    expect(t?.annotations?.destructiveHint).toBe(false);
  });

  it.each(DESTRUCTIVE_TOOLS)('%s is annotated destructive', (name) => {
    const t = tools.get(name);
    expect(t, `${name} not registered`).toBeDefined();
    expect(t?.annotations?.readOnlyHint).toBe(false);
    expect(t?.annotations?.destructiveHint).toBe(true);
  });

  it('exposes confirm_token input on every destructive tool', () => {
    for (const name of DESTRUCTIVE_TOOLS) {
      expect(tools.get(name)?.inputKeys, `${name} missing confirm_token`).toContain(
        'confirm_token',
      );
    }
  });

  it('does not expose confirm_token on safe-write tools', () => {
    for (const name of SAFE_WRITE_TOOLS) {
      expect(tools.get(name)?.inputKeys ?? []).not.toContain('confirm_token');
    }
  });
});
