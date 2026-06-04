/**
 * System command group for the Unraid CLI.
 *
 * Registers the top-level `health` probe plus the `system` subcommands
 * (`info`, `metrics`). Contains no business logic — it delegates to
 * `@unraid-toolkit/sdk` and renders results via the shared {@link runAction} helper.
 */

import type { Command } from 'commander';
import { getHealth, getSystemInfo, getSystemMetrics } from '@unraid-toolkit/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction } from './run.js';

/**
 * Register system-related commands onto `program`:
 * - `health` — connection and auth probe (top-level).
 * - `system info` — static OS/CPU/memory/version information.
 * - `system metrics` — live CPU/memory utilization.
 */
export function registerSystemCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  program
    .command('health')
    .description('Check that the Unraid API is reachable and the API key is accepted.')
    .action(async function (this: Command) {
      await runAction(getGlobals(this), (client) => getHealth(client));
    });

  const system = program.command('system').description('System information and metrics');

  system
    .command('info')
    .description('Show static system information (OS, CPU, memory, versions).')
    .action(async function (this: Command) {
      await runAction(getGlobals(this), (client) => getSystemInfo(client));
    });

  system
    .command('metrics')
    .description('Show live CPU and memory utilization.')
    .action(async function (this: Command) {
      await runAction(getGlobals(this), (client) => getSystemMetrics(client));
    });
}
