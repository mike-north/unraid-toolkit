/**
 * CLI factory for the Unraid CLI — builds the root Commander program.
 *
 * This module wires global options (URL, API key, output format) and delegates
 * subcommand registration to the commands/ layer. It contains no business logic;
 * all SDK interaction happens in command action handlers.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { registerSystemCommands } from './commands/system.js';
import { registerArrayCommands } from './commands/array.js';
import { registerDiskCommands } from './commands/disks.js';
import { registerDockerCommands } from './commands/docker.js';
import { registerVmCommands } from './commands/vm.js';
import { registerShareCommands } from './commands/shares.js';
import { registerNotificationCommands } from './commands/notifications.js';
import { registerUpsCommands } from './commands/ups.js';

/**
 * Fully resolved global options derived from Commander flags.
 * Passed by value into every command action via {@link getGlobals}.
 */
export interface GlobalOptions {
  url?: string | undefined;
  apiKey?: string | undefined;
  /**
   * Skip TLS verification. `true` when `--insecure` is passed, otherwise
   * `undefined` so the SDK falls through to `UNRAID_TLS_SKIP_VERIFY`. Never a
   * concrete `false`, which would shadow the env var.
   */
  insecure?: boolean | undefined;
  json: boolean;
}

/**
 * Raw option bag read from the root program via `program.opts()`.
 * All fields are optional because Commander omits absent flags entirely.
 */
export interface RawGlobalOpts {
  url?: string | undefined;
  apiKey?: string | undefined;
  insecure?: boolean | undefined;
  human?: boolean | undefined;
}

/**
 * Map Commander's raw option bag to resolved {@link GlobalOptions}.
 *
 * `insecure` becomes `true` only when `--insecure` is present, otherwise
 * `undefined` — never a concrete `false` — so the SDK's connection resolver can
 * fall through to `UNRAID_TLS_SKIP_VERIFY` instead of being shadowed.
 */
export function resolveGlobalOptions(raw: RawGlobalOpts): GlobalOptions {
  return {
    url: raw.url,
    apiKey: raw.apiKey,
    insecure: raw.insecure === true ? true : undefined,
    json: raw.human !== true,
  };
}

/**
 * Read this package's version from its own `package.json` at runtime so the CLI
 * always reports the actually-installed version. Never hardcode a literal — it
 * silently drifts from the published release. The compiled module lives at
 * `dist/cli.js`, so `package.json` is one directory up (the same depth holds for
 * `src/cli.ts` under vitest).
 */
function readPackageVersion(): string {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const parsed: unknown = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'version' in parsed &&
      typeof parsed.version === 'string'
    ) {
      return parsed.version;
    }
    return '0.0.0';
  } catch {
    return '0.0.0';
  }
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
    .version(readPackageVersion())
    .option('--url <url>', 'Unraid GraphQL endpoint (env: UNRAID_API_URL)')
    .option('--api-key <key>', 'Unraid API key (env: UNRAID_API_KEY)')
    .option(
      '--insecure',
      'Skip TLS verification for self-signed certs (env: UNRAID_TLS_SKIP_VERIFY)',
    )
    .option('--json', 'Output JSON', true)
    .option('--human', 'Output human-readable text');

  /**
   * Extract resolved {@link GlobalOptions} from the command instance available
   * inside an action handler. Reads root-program opts via a closure over `program`.
   */
  function getGlobals(_cmd: Command): GlobalOptions {
    return resolveGlobalOptions(program.opts<RawGlobalOpts>());
  }

  registerSystemCommands(program, getGlobals);
  registerArrayCommands(program, getGlobals);
  registerDiskCommands(program, getGlobals);
  registerDockerCommands(program, getGlobals);
  registerVmCommands(program, getGlobals);
  registerShareCommands(program, getGlobals);
  registerNotificationCommands(program, getGlobals);
  registerUpsCommands(program, getGlobals);

  return program;
}
