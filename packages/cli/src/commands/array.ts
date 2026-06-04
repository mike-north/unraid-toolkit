/**
 * Array & parity command group for the Unraid CLI.
 */

import type { Command } from 'commander';
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
} from '@unraid-toolkit/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag, confirmDestructive } from './run.js';

/** Register `array status` and `array parity-history` commands. */
export function registerArrayCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  const array = program.command('array').description('Array and parity operations');

  array
    .command('status')
    .description('Show array state, capacity, parity status, and member disks.')
    .action(async function (this: Command) {
      await runAction(getGlobals(this), (client) => getArrayStatus(client));
    });

  array
    .command('parity-history')
    .description('List past parity checks.')
    .option('--limit <n>', 'Maximum number of entries to return', parseIntFlag)
    .option('--offset <n>', 'Number of entries to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{ limit?: number; offset?: number }>();
      await runAction(getGlobals(this), (client) =>
        getParityHistory(client, { limit: opts.limit, offset: opts.offset }),
      );
    });

  // --- Phase 3: destructive array control (each requires --yes) ---

  array
    .command('start')
    .description('Start the array. (destructive)')
    .option('--yes', 'Confirm this destructive operation')
    .action(async function (this: Command) {
      const { yes } = this.opts<{ yes?: boolean }>();
      if (!confirmDestructive('start the array', yes)) return;
      await runAction(getGlobals(this), (client) => setArrayState(client, 'START'));
    });

  array
    .command('stop')
    .description('Stop the array (takes shares and Docker/VMs offline). (destructive)')
    .option('--yes', 'Confirm this destructive operation')
    .action(async function (this: Command) {
      const { yes } = this.opts<{ yes?: boolean }>();
      if (!confirmDestructive('stop the array', yes)) return;
      await runAction(getGlobals(this), (client) => setArrayState(client, 'STOP'));
    });

  array
    .command('add-disk')
    .description('Add a disk to the array. (destructive)')
    .argument('<id>', 'The disk id')
    .option('--slot <n>', 'Target array slot', parseIntFlag)
    .option('--yes', 'Confirm this destructive operation')
    .action(async function (this: Command, id: string) {
      const opts = this.opts<{ slot?: number; yes?: boolean }>();
      if (!confirmDestructive(`add disk ${id} to the array`, opts.yes)) return;
      await runAction(getGlobals(this), (client) => addDiskToArray(client, id, opts.slot));
    });

  array
    .command('remove-disk')
    .description('Remove a disk from the array (array must be stopped). (destructive)')
    .argument('<id>', 'The disk id')
    .option('--slot <n>', 'The disk slot', parseIntFlag)
    .option('--yes', 'Confirm this destructive operation')
    .action(async function (this: Command, id: string) {
      const opts = this.opts<{ slot?: number; yes?: boolean }>();
      if (!confirmDestructive(`remove disk ${id} from the array`, opts.yes)) return;
      await runAction(getGlobals(this), (client) => removeDiskFromArray(client, id, opts.slot));
    });

  array
    .command('mount-disk')
    .description('Mount an array disk. (destructive)')
    .argument('<id>', 'The disk id')
    .option('--yes', 'Confirm this destructive operation')
    .action(async function (this: Command, id: string) {
      const { yes } = this.opts<{ yes?: boolean }>();
      if (!confirmDestructive(`mount disk ${id}`, yes)) return;
      await runAction(getGlobals(this), (client) => mountArrayDisk(client, id));
    });

  array
    .command('unmount-disk')
    .description('Unmount an array disk. (destructive)')
    .argument('<id>', 'The disk id')
    .option('--yes', 'Confirm this destructive operation')
    .action(async function (this: Command, id: string) {
      const { yes } = this.opts<{ yes?: boolean }>();
      if (!confirmDestructive(`unmount disk ${id}`, yes)) return;
      await runAction(getGlobals(this), (client) => unmountArrayDisk(client, id));
    });

  // Parity-check lifecycle.
  const parity = program.command('parity').description('Parity-check control');

  parity
    .command('start')
    .description('Start a parity check. (destructive)')
    .option('--correct', 'Write corrections to parity (correcting check)')
    .option('--yes', 'Confirm this destructive operation')
    .action(async function (this: Command) {
      const opts = this.opts<{ correct?: boolean; yes?: boolean }>();
      const correcting = opts.correct === true;
      if (
        !confirmDestructive(
          `start a ${correcting ? 'correcting' : 'read-only'} parity check`,
          opts.yes,
        )
      )
        return;
      await runAction(getGlobals(this), (client) => startParityCheck(client, correcting));
    });

  // Pause/resume are reversible toggles — no confirmation gate.
  parity
    .command('pause')
    .description('Pause a running parity check.')
    .action(async function (this: Command) {
      await runAction(getGlobals(this), (client) => pauseParityCheck(client));
    });

  parity
    .command('resume')
    .description('Resume a paused parity check.')
    .action(async function (this: Command) {
      await runAction(getGlobals(this), (client) => resumeParityCheck(client));
    });

  parity
    .command('cancel')
    .description('Cancel a running parity check. (destructive)')
    .option('--yes', 'Confirm this destructive operation')
    .action(async function (this: Command) {
      const { yes } = this.opts<{ yes?: boolean }>();
      if (!confirmDestructive('cancel the parity check', yes)) return;
      await runAction(getGlobals(this), (client) => cancelParityCheck(client));
    });
}
