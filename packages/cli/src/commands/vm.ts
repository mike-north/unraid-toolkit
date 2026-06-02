/**
 * Virtual machine command group for the Unraid CLI.
 */

import type { Command } from 'commander';
import { listVms, startVm, stopVm, pauseVm, resumeVm } from '@unraid-cli/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag } from './run.js';

/** VM lifecycle subcommands: `vm <action> <id>`. */
const VM_ACTIONS = [
  { name: 'start', desc: 'Start a virtual machine.', op: startVm },
  { name: 'stop', desc: 'Gracefully stop a virtual machine.', op: stopVm },
  { name: 'pause', desc: 'Pause a running virtual machine.', op: pauseVm },
  { name: 'resume', desc: 'Resume a paused virtual machine.', op: resumeVm },
] as const;

/** Register the `vm list` command. */
export function registerVmCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  const vm = program.command('vm').description('Virtual machine operations');

  vm.command('list')
    .description('List virtual machines and their run state.')
    .option('--limit <n>', 'Maximum number of VMs to return', parseIntFlag)
    .option('--offset <n>', 'Number of VMs to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{ limit?: number; offset?: number }>();
      await runAction(getGlobals(this), (client) =>
        listVms(client, { limit: opts.limit, offset: opts.offset }),
      );
    });

  for (const { name, desc, op } of VM_ACTIONS) {
    vm.command(name)
      .description(desc)
      .argument('<id>', 'The VM id')
      .action(async function (this: Command, id: string) {
        await runAction(getGlobals(this), (client) => op(client, id));
      });
  }
}
