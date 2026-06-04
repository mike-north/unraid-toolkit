/**
 * UPS command group for the Unraid CLI.
 */

import type { Command } from 'commander';
import { getUpsStatus } from '@unraid-toolkit/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag } from './run.js';

/** Register the `ups status` command. */
export function registerUpsCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  const ups = program.command('ups').description('UPS (power) operations');

  ups
    .command('status')
    .description('Show connected UPS devices with battery and power telemetry.')
    .option('--limit <n>', 'Maximum number of UPS devices to return', parseIntFlag)
    .option('--offset <n>', 'Number of UPS devices to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{ limit?: number; offset?: number }>();
      await runAction(getGlobals(this), (client) =>
        getUpsStatus(client, { limit: opts.limit, offset: opts.offset }),
      );
    });
}
