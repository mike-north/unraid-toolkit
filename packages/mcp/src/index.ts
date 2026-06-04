#!/usr/bin/env node
/**
 * `@unraid-toolkit/mcp` — MCP server for the Unraid GraphQL API.
 *
 * Running this file as a binary starts the server. Importing it as a library
 * exposes {@link buildServer} and config helpers without side effects.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient, resolveConnectionConfig, type ConnectionConfig } from '@unraid-toolkit/sdk';
import { loadMcpConfig, type McpConfig } from './config.js';
import { createLogger } from './log.js';
import { createAuditLog } from './audit.js';
import { TokenStore } from './approval.js';
import { buildServer, type ServerContext } from './server.js';
import { startStdio } from './transports/stdio.js';
import { startHttp } from './transports/http.js';

export { buildServer, type ServerContext, SERVER_NAME, SERVER_VERSION } from './server.js';
export { loadMcpConfig, type McpConfig } from './config.js';

function loadConfigOrExit(): { runtime: McpConfig; connection: ConnectionConfig } {
  try {
    return { runtime: loadMcpConfig(), connection: resolveConnectionConfig() };
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}

/** Boot the server with the configured transport(s). */
export async function main(): Promise<void> {
  const { runtime, connection } = loadConfigOrExit();

  const logger = createLogger(runtime.logLevel);
  const client = createClient(connection);
  const audit = createAuditLog(runtime.auditLogPath, logger);
  const ctx: ServerContext = { client, config: runtime, logger, audit, tokens: new TokenStore() };

  logger.info('Starting Unraid MCP server', {
    transport: runtime.transport,
    endpoint: client.endpoint,
    readOnly: runtime.readOnly,
  });

  const shutdownHandlers: (() => Promise<void>)[] = [];

  if (runtime.transport === 'http' || runtime.transport === 'both') {
    const closeHttp = await startHttp(() => buildServer(ctx), runtime, logger);
    shutdownHandlers.push(closeHttp);
  }

  if (runtime.transport === 'stdio' || runtime.transport === 'both') {
    await startStdio(buildServer(ctx), logger);
  }

  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down`);
    void Promise.allSettled(shutdownHandlers.map((h) => h())).finally(() => {
      process.exit(0);
    });
  };
  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
}

const entryPath = process.argv[1];
// Resolve to an absolute path first so the comparison holds when the script is
// launched via a relative path (e.g. `node packages/mcp/dist/index.js`).
const isMainModule =
  entryPath !== undefined && import.meta.url === pathToFileURL(resolve(entryPath)).href;
if (isMainModule) {
  main().catch((error: unknown) => {
    process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
