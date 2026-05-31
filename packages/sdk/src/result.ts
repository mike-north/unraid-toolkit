/**
 * The result envelope returned by every SDK operation.
 *
 * Operations never throw for expected failures — they return a discriminated
 * `{ success, data, error }` envelope. Wrappers (CLI, MCP) adapt this single
 * shape once instead of handling exceptions per call.
 */

import type { UnraidError } from './errors.js';

export type UnraidResult<T> =
  | { readonly success: true; readonly data: T; readonly error: null }
  | { readonly success: false; readonly data: null; readonly error: UnraidError };

/** Build a successful {@link UnraidResult}. */
export function success<T>(data: T): UnraidResult<T> {
  return { success: true, data, error: null };
}

/** Build a failed {@link UnraidResult}. */
export function failure<T = never>(error: UnraidError): UnraidResult<T> {
  return { success: false, data: null, error };
}
