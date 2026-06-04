/**
 * Disk command group for the Unraid CLI.
 */

import type { Command } from 'commander';
import { listDisks } from '@unraid-toolkit/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag } from './run.js';

/** Register the `disks list` command. */
export function registerDiskCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  const disks = program.command('disks').description('Physical disk operations');

  disks
    .command('list')
    .description('List physical disks (model, size, SMART status, temperature).')
    .option('--limit <n>', 'Maximum number of disks to return', parseIntFlag)
    .option('--offset <n>', 'Number of disks to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{ limit?: number; offset?: number }>();
      await runAction(getGlobals(this), (client) =>
        listDisks(client, { limit: opts.limit, offset: opts.offset }),
      );
    });
}
