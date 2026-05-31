/**
 * System command group for the Unraid CLI.
 *
 * Registers all system-level subcommands (currently `health`) onto a Commander
 * parent command. This module contains no business logic — it delegates entirely
 * to `@unraid-cli/sdk` and renders results via the shared output module.
 */

import type { Command } from 'commander';
import { resolveConnectionConfig, createClient, getHealth } from '@unraid-cli/sdk';
import type { GlobalOptions } from '../cli.js';
import { output } from '../output.js';

/**
 * Register system-related subcommands onto `program`.
 *
 * Currently registers:
 * - `health` — connection and auth probe.
 *
 * @param program - The root Commander `Command` to attach subcommands to.
 * @param getGlobals - Callback that extracts resolved global options from the
 *   command instance available inside an action handler.
 */
export function registerSystemCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  program
    .command('health')
    .description('Check that the Unraid API is reachable and the API key is accepted.')
    .action(async function (this: Command) {
      const globals = getGlobals(this);

      let config;
      try {
        config = resolveConnectionConfig({
          url: globals.url,
          apiKey: globals.apiKey,
          tlsSkipVerify: globals.insecure,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
        return;
      }

      const client = createClient(config);
      const result = await getHealth(client);

      output(result, globals.json);

      if (!result.success) {
        process.exitCode = 1;
      }
    });
}
