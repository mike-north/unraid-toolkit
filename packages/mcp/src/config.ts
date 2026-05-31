/**
 * Runtime configuration for the MCP server — the wrapper-level concerns that
 * are NOT the SDK's job: which transport to expose, network/auth settings, and
 * the safety floor for (future) control tools.
 *
 * The Unraid *connection* (URL/key/TLS) is resolved separately via the SDK's
 * `resolveConnectionConfig`.
 */

import { z } from 'zod';
import { LOG_LEVELS } from './log.js';

const DEFAULT_HTTP_PORT = 3000;
const DEFAULT_MAX_BATCH = 10;

const TRANSPORTS = ['stdio', 'http', 'both'] as const;

const TRUTHY = new Set(['true', '1', 'yes', 'on']);
const FALSY = new Set(['false', '0', 'no', 'off', '']);

function boolFromEnv(def: boolean): z.ZodType<boolean> {
  return z.preprocess((value) => {
    if (value === undefined) return def;
    if (typeof value !== 'string') return value;
    const normalized = value.trim().toLowerCase();
    if (normalized === '') return def;
    if (TRUTHY.has(normalized)) return true;
    if (FALSY.has(normalized)) return false;
    return value;
  }, z.boolean());
}

function intFromEnv(def: number, min: number, max: number): z.ZodType<number> {
  return z.preprocess((value) => {
    if (value === undefined || value === '') return def;
    const n = Number(value);
    return Number.isInteger(n) ? n : value;
  }, z.number().int().min(min).max(max));
}

const optionalEnvString = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

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

const mcpConfigSchema = z.object({
  transport: z.enum(TRANSPORTS).default('stdio'),
  httpPort: intFromEnv(DEFAULT_HTTP_PORT, 1, 65535),
  httpAuthToken: optionalEnvString,
  readOnly: boolFromEnv(false),
  maxBatch: intFromEnv(DEFAULT_MAX_BATCH, 1, 10_000),
  denyTools: csvList,
  logLevel: z.enum(LOG_LEVELS).default('info'),
  auditLogPath: optionalEnvString,
});

/** Fully validated MCP server runtime configuration. */
export type McpConfig = z.infer<typeof mcpConfigSchema>;

function readEnv(env: NodeJS.ProcessEnv): Record<string, string | undefined> {
  return {
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
 * Validate and normalize MCP runtime configuration from the environment.
 *
 * @throws Error with a readable, multi-line summary if validation fails.
 */
export function loadMcpConfig(env: NodeJS.ProcessEnv = process.env): McpConfig {
  const result = mcpConfigSchema.safeParse(readEnv(env));
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid Unraid MCP configuration:\n${issues}`);
  }
  return result.data;
}
