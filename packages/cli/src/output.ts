/**
 * Output formatting for the Unraid CLI — a thin wrapper over `console.log`/`console.error`.
 *
 * This module owns the single decision point between JSON and human-readable output.
 * It contains no business logic; it only adapts an {@link UnraidResult} envelope into
 * text. All domain knowledge stays in `@unraid-toolkit/sdk`.
 */

import type { UnraidResult } from '@unraid-toolkit/sdk';

/**
 * Write a {@link UnraidResult} to stdout (success) or stderr (failure).
 *
 * - **JSON mode** (`json: true`): always writes the full envelope to stdout via
 *   `console.log`, regardless of success or failure. The caller is responsible
 *   for setting `process.exitCode` on failure.
 * - **Human mode** (`json: false`): on success, pretty-prints `result.data` to
 *   stdout; on failure, writes `Error: <message>` (and `Details: <details>` if
 *   present) to stderr.
 *
 * @param result - The SDK result envelope to render.
 * @param json - When `true`, emit JSON; when `false`, emit human-readable text.
 */
export function output<T>(result: UnraidResult<T>, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    console.log(JSON.stringify(result.data, null, 2));
  } else {
    console.error(`Error: ${result.error.message}`);
    if (result.error.details !== undefined) {
      console.error(`Details: ${result.error.details}`);
    }
  }
}
