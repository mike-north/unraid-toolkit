/**
 * CLI factory for the Unraid CLI — builds the root Commander program.
 *
 * This module wires global options (URL, API key, output format) and delegates
 * subcommand registration to the commands/ layer. It contains no business logic;
 * all SDK interaction happens in command action handlers.
 */

import { Command } from 'commander';
import { registerSystemCommands } from './commands/system.js';

/**
 * Fully resolved global options derived from Commander flags.
 * Passed by value into every command action via {@link getGlobals}.
 */
export interface GlobalOptions {
  url?: string | undefined;
  apiKey?: string | undefined;
  insecure: boolean;
  json: boolean;
}

/**
 * Raw option bag returned by `commander`'s `.optsWithGlobals()`.
 * All fields are optional because Commander omits absent flags entirely.
 */
interface RawGlobalOpts {
  url?: string | undefined;
  apiKey?: string | undefined;
  insecure?: boolean | undefined;
  human?: boolean | undefined;
}

/**
 * Build and configure the root Commander program for the `unraid` CLI.
 *
 * @returns The configured Commander {@link Command} instance, ready for `.parse()`.
 */
export function createCli(): Command {
  const program = new Command();

  program
    .name('unraid')
    .description('Unraid CLI — observe and control an Unraid server via its GraphQL API')
    .version('0.1.0')
    .option('--url <url>', 'Unraid GraphQL endpoint (env: UNRAID_API_URL)')
    .option('--api-key <key>', 'Unraid API key (env: UNRAID_API_KEY)')
    .option('--insecure', 'Skip TLS verification for self-signed certs', false)
    .option('--json', 'Output JSON', true)
    .option('--human', 'Output human-readable text');

  /**
   * Extract resolved {@link GlobalOptions} from the command instance available
   * inside an action handler. Reads root-program opts via a closure over `program`.
   */
  function getGlobals(_cmd: Command): GlobalOptions {
    const raw = program.opts<RawGlobalOpts>();
    return {
      url: raw.url,
      apiKey: raw.apiKey,
      insecure: raw.insecure === true,
      json: raw.human !== true,
    };
  }

  registerSystemCommands(program, getGlobals);

  return program;
}
