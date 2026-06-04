/**
 * User-share command group for the Unraid CLI.
 */

import type { Command } from 'commander';
import { listShares } from '@unraid-toolkit/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag } from './run.js';

/** Register the `shares list` command. */
export function registerShareCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  const shares = program.command('shares').description('User share operations');

  shares
    .command('list')
    .description('List user shares with capacity and allocation settings.')
    .option('--limit <n>', 'Maximum number of shares to return', parseIntFlag)
    .option('--offset <n>', 'Number of shares to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{ limit?: number; offset?: number }>();
      await runAction(getGlobals(this), (client) =>
        listShares(client, { limit: opts.limit, offset: opts.offset }),
      );
    });
}
