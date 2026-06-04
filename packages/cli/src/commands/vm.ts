/**
 * Virtual machine command group for the Unraid CLI.
 */

import type { Command } from 'commander';
import {
  listVms,
  startVm,
  stopVm,
  pauseVm,
  resumeVm,
  forceStopVm,
  rebootVm,
  resetVm,
} from '@unraid-toolkit/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag, confirmDestructive } from './run.js';

/** Safe VM lifecycle subcommands: `vm <action> <id>`. */
const VM_ACTIONS = [
  { name: 'start', desc: 'Start a virtual machine.', op: startVm },
  { name: 'stop', desc: 'Gracefully stop a virtual machine.', op: stopVm },
  { name: 'pause', desc: 'Pause a running virtual machine.', op: pauseVm },
  { name: 'resume', desc: 'Resume a paused virtual machine.', op: resumeVm },
] as const;

/** Destructive VM subcommands (ungraceful; each requires --yes). */
const VM_DESTRUCTIVE_ACTIONS = [
  {
    name: 'force-stop',
    desc: 'Force-stop a virtual machine (ungraceful). (destructive)',
    op: forceStopVm,
  },
  { name: 'reboot', desc: 'Reboot a virtual machine. (destructive)', op: rebootVm },
  { name: 'reset', desc: 'Hard-reset a virtual machine. (destructive)', op: resetVm },
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

  // --- Phase 3: destructive VM control (each requires --yes) ---
  for (const { name, desc, op } of VM_DESTRUCTIVE_ACTIONS) {
    vm.command(name)
      .description(desc)
      .argument('<id>', 'The VM id')
      .option('--yes', 'Confirm this destructive operation')
      .action(async function (this: Command, id: string) {
        const { yes } = this.opts<{ yes?: boolean }>();
        if (!confirmDestructive(`${name} VM ${id}`, yes)) return;
        await runAction(getGlobals(this), (client) => op(client, id));
      });
  }
}
