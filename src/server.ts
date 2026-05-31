/**
 * Assembles the Unraid {@link McpServer}: wires shared context and registers
 * every tool group. Transports ({@link ./transports/stdio} and
 * {@link ./transports/http}) connect to the server this builds.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SERVER_NAME } from './constants.js';
import type { AppConfig } from './config.js';
import type { Logger } from './log.js';
import type { UnraidClient } from './unraid/client.js';
import { registerSystemTools } from './tools/system.js';

/** Shared dependencies passed to every tool group. */
export interface ServerContext {
  config: AppConfig;
  client: UnraidClient;
  logger: Logger;
}

/** The server version, surfaced to MCP clients during initialization. */
export const SERVER_VERSION = '0.1.0';

/**
 * Build and configure the MCP server with all tool groups registered.
 */
export function buildServer(ctx: ServerContext): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  registerSystemTools(server, ctx);

  return server;
}
