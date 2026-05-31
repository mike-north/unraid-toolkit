/**
 * Environment-driven configuration for the Unraid MCP server.
 *
 * All configuration is supplied via environment variables (the natural fit for
 * a containerized Unraid "App"). {@link loadConfig} validates and normalizes
 * them into a typed {@link AppConfig}, throwing a single readable error that
 * lists every problem at once.
 */

import { z } from 'zod';
import { DEFAULT_HTTP_PORT, DEFAULT_MAX_BATCH } from './constants.js';
import { LOG_LEVELS } from './log.js';

/** Which MCP transport(s) the server should expose. */
export const TRANSPORTS = ['stdio', 'http', 'both'] as const;
export type TransportMode = (typeof TRANSPORTS)[number];

const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY = new Set(['false', '0', 'no', 'off', '']);

/** A boolean parsed from an environment string, falling back to `def`. */
function boolFromEnv(def: boolean): z.ZodType<boolean> {
  return z.preprocess((value) => {
    if (value === undefined) return def;
    if (typeof value !== 'string') return value; // let z.boolean() emit a clear error
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return def;
    if (TRUTHY.has(normalized)) return true;
    if (FALSY.has(normalized)) return false;
    return value;
  }, z.boolean());
}

/** An integer parsed from an environment string, falling back to `def`. */
function intFromEnv(def: number, min: number, max: number): z.ZodType<number> {
  return z.preprocess((value) => {
    if (value === undefined || value === '') return def;
    const n = Number(value);
    return Number.isInteger(n) ? n : value;
  }, z.number().int().min(min).max(max));
}

/** An optional, non-empty string ('' is treated as absent). */
const optionalEnvString = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

/** A comma-separated list parsed into a de-duplicated string array. */
const csvList = z.preprocess((value) => {
  if (typeof value !== 'string' || value === '') return [];
  return [
    ...new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
    ),
  ];
}, z.array(z.string()));

const urlString = z
  .string()
  .min(1, 'UNRAID_API_URL is required (e.g. https://tower.local/graphql)')
  .refine(
    (u) => {
      try {
        new URL(u);
        return true;
      } catch {
        return false;
      }
    },
    { message: 'UNRAID_API_URL must be a valid URL' },
  );

const configSchema = z.object({
  unraidApiUrl: urlString,
  unraidApiKey: z.string().min(1, 'UNRAID_API_KEY is required'),
  tlsSkipVerify: boolFromEnv(false),
  transport: z.enum(TRANSPORTS).default('stdio'),
  httpPort: intFromEnv(DEFAULT_HTTP_PORT, 1, 65535),
  httpAuthToken: optionalEnvString,
  readOnly: boolFromEnv(false),
  maxBatch: intFromEnv(DEFAULT_MAX_BATCH, 1, 10_000),
  denyTools: csvList,
  logLevel: z.enum(LOG_LEVELS).default('info'),
  auditLogPath: optionalEnvString,
});

/** Fully validated, normalized server configuration. */
export type AppConfig = z.infer<typeof configSchema>;

/** Maps logical config keys to their environment variable names. */
function readEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return {
    unraidApiUrl: env['UNRAID_API_URL'],
    unraidApiKey: env['UNRAID_API_KEY'],
    tlsSkipVerify: env['UNRAID_TLS_SKIP_VERIFY'],
    transport: env['MCP_TRANSPORT'],
    httpPort: env['MCP_HTTP_PORT'],
    httpAuthToken: env['MCP_AUTH_TOKEN'],
    readOnly: env['MCP_READ_ONLY'],
    maxBatch: env['MCP_MAX_BATCH'],
    denyTools: env['MCP_DENY_TOOLS'],
    logLevel: env['LOG_LEVEL'],
    auditLogPath: env['MCP_AUDIT_LOG'],
  };
}

/**
 * Validate and normalize configuration from the given environment.
 *
 * @param env - Source environment (defaults to `process.env`).
 * @returns The validated {@link AppConfig}.
 * @throws Error with a readable, multi-line summary if validation fails.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = configSchema.safeParse(readEnv(env));
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid Unraid MCP configuration:\n${issues}`);
  }
  return result.data;
}
