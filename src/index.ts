#!/usr/bin/env node
/**
 * Entry point for the Unraid MCP server.
 *
 * Loads configuration from the environment, constructs shared context, and
 * starts the configured transport(s): stdio, Streamable HTTP, or both.
 */

import { loadConfig } from './config.js';
import { createLogger } from './log.js';
import { createUnraidClient } from './unraid/client.js';
import { buildServer, type ServerContext } from './server.js';
import { startStdio } from './transports/stdio.js';
import { startHttp } from './transports/http.js';

async function main(): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  const logger = createLogger(config.logLevel);
  const client = createUnraidClient(config);
  const ctx: ServerContext = { config, client, logger };

  logger.info('Starting Unraid MCP server', {
    transport: config.transport,
    endpoint: config.unraidApiUrl,
    readOnly: config.readOnly,
  });

  const shutdownHandlers: (() => Promise<void>)[] = [];

  if (config.transport === 'http' || config.transport === 'both') {
    const closeHttp = await startHttp(() => buildServer(ctx), config, logger);
    shutdownHandlers.push(closeHttp);
  }

  if (config.transport === 'stdio' || config.transport === 'both') {
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

main().catch((error: unknown) => {
  process.stderr.write(`Fatal: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
