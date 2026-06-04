/**
 * Shared command-action plumbing for the CLI.
 *
 * Every subcommand resolves connection config from global options, builds a
 * client, runs one SDK operation, and renders the resulting envelope. This
 * helper centralizes that glue so command modules stay declarative — it holds
 * no domain logic of its own.
 */

import { InvalidArgumentError } from 'commander';
import {
  resolveConnectionConfig,
  createClient,
  type UnraidClient,
  type UnraidResult,
} from '@unraid-toolkit/sdk';
import type { GlobalOptions } from '../cli.js';
import { output } from '../output.js';

/**
 * Resolve config, build a client, run `op`, and render the result.
 *
 * Sets `process.exitCode = 1` when config resolution fails or the operation
 * returns a failure envelope.
 */
export async function runAction<T>(
  globals: GlobalOptions,
  op: (client: UnraidClient) => Promise<UnraidResult<T>>,
): Promise<void> {
  let config;
  try {
    config = resolveConnectionConfig({
      url: globals.url,
      apiKey: globals.apiKey,
      tlsSkipVerify: globals.insecure,
    });
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
    return;
  }

  const client = createClient(config);
  const result = await op(client);
  output(result, globals.json);
  if (!result.success) {
    process.exitCode = 1;
  }
}

/**
 * Commander option parser for integer flags (`--limit`, `--offset`).
 *
 * Rejects non-integer input at the CLI boundary (input *shape*) with a clear
 * Commander error. Semantic validation (e.g. positivity) remains the SDK's
 * responsibility, which returns a structured `VALIDATION_ERROR` envelope.
 */
export function parseIntFlag(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new InvalidArgumentError('must be an integer.');
  }
  return parsed;
}

/**
 * Confirmation gate for destructive CLI commands (the CLI's human-in-the-loop
 * equivalent of the MCP approval layer). Returns `true` when the caller passed
 * `--yes`; otherwise prints the impact and how to confirm, sets a failure exit
 * code, and returns `false` so the command aborts without calling the SDK.
 */
export function confirmDestructive(impact: string, yes: boolean | undefined): boolean {
  if (yes === true) return true;
  console.error(
    `Refusing destructive operation without confirmation: ${impact}\n` +
      `This cannot be undone. Re-run with --yes to proceed.`,
  );
  process.exitCode = 1;
  return false;
}
