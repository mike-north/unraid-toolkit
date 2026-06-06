/**
 * Assembles the Unraid {@link McpServer} and registers every tool group.
 * Transports connect to the server this builds.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UnraidClient } from '@unraid-toolkit/sdk';
import type { McpConfig } from './config.js';
import type { Logger } from './log.js';
import type { AuditLog } from './audit.js';
import { TokenStore } from './approval.js';
import { registerAllTools } from './tools/index.js';

/** Shared dependencies passed to every tool group. */
export interface ServerContext {
  client: UnraidClient;
  config: McpConfig;
  logger: Logger;
  /** Layer-1 audit sink for mutations. */
  audit: AuditLog;
  /** Layer-2 confirmation-token store (token-gate fallback). */
  tokens: TokenStore;
}

export const SERVER_NAME = 'unraid-mcp';

/**
 * Read this package's version from its own `package.json` at runtime so the MCP
 * handshake always reports the actually-installed version. Never hardcode a
 * literal — it silently drifts from the published release. The compiled module
 * lives at `dist/server.js`, so `package.json` is one directory up (the same
 * depth holds for `src/server.ts` under vitest).
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

export const SERVER_VERSION = readPackageVersion();

/** Build and configure the MCP server with all tool groups registered. */
export function buildServer(ctx: ServerContext): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerAllTools(server, ctx);
  return server;
}
