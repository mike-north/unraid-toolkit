/**
 * Connection configuration for reaching an Unraid GraphQL endpoint.
 *
 * This is the SDK's only configuration concern: where the API is and how to
 * authenticate. Server/runtime concerns (transports, ports, read-only mode,
 * output format) belong to the wrappers, not here.
 */

import { z } from 'zod';
import { DEFAULT_REQUEST_TIMEOUT_MS } from './constants.js';

/** Fully resolved connection settings used to build an {@link ./client.UnraidClient}. */
export interface ConnectionConfig {
  /** Full GraphQL endpoint URL, e.g. `https://tower.local/graphql`. */
  readonly url: string;
  /** Unraid API key, sent as the `x-api-key` header. */
  readonly apiKey: string;
  /** Skip TLS verification (for Unraid's self-signed local cert). */
  readonly tlsSkipVerify: boolean;
  /** Per-request timeout in milliseconds. */
  readonly timeoutMs: number;
}

/** Partial connection settings supplied by a caller (e.g. CLI flags). */
export interface ConnectionOverrides {
  readonly url?: string | undefined;
  readonly apiKey?: string | undefined;
  readonly tlsSkipVerify?: boolean | undefined;
  readonly timeoutMs?: number | undefined;
}

const urlString = z
  .string({ error: 'Unraid API URL is required (e.g. https://tower.local/graphql)' })
  .min(1, 'Unraid API URL is required (e.g. https://tower.local/graphql)')
  .refine(
    (u) => {
      try {
        new URL(u);
        return true;
      } catch {
        return false;
      }
    },
    { error: 'Unraid API URL must be a valid URL' },
  );

const connectionSchema = z.object({
  url: urlString,
  apiKey: z.string({ error: 'Unraid API key is required' }).min(1, 'Unraid API key is required'),
  tlsSkipVerify: z.boolean().default(false),
  timeoutMs: z.number().int().positive().default(DEFAULT_REQUEST_TIMEOUT_MS),
});

/** Parse a boolean from an environment string, or `undefined` if absent. */
function boolFromEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === '') return undefined;
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

/**
 * Resolve a {@link ConnectionConfig} by layering explicit `overrides` over
 * environment variables (`UNRAID_API_URL`, `UNRAID_API_KEY`,
 * `UNRAID_TLS_SKIP_VERIFY`), then validating and applying defaults.
 *
 * @throws Error with a readable, multi-line summary if validation fails.
 */
export function resolveConnectionConfig(
  overrides: ConnectionOverrides = {},
  env: NodeJS.ProcessEnv = process.env,
): ConnectionConfig {
  const candidate = {
    url: overrides.url ?? env['UNRAID_API_URL'],
    apiKey: overrides.apiKey ?? env['UNRAID_API_KEY'],
    tlsSkipVerify: overrides.tlsSkipVerify ?? boolFromEnv(env['UNRAID_TLS_SKIP_VERIFY']),
    timeoutMs: overrides.timeoutMs,
  };

  const result = connectionSchema.safeParse(candidate);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid Unraid connection configuration:\n${issues}`);
  }
  return result.data;
}
