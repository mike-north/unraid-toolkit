/**
 * Assembles the Unraid {@link McpServer} and registers every tool group.
 * Transports connect to the server this builds.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UnraidClient } from '@unraid-cli/sdk';
import type { McpConfig } from './config.js';
import type { Logger } from './log.js';
import { registerAllTools } from './tools/index.js';

/** Shared dependencies passed to every tool group. */
export interface ServerContext {
  client: UnraidClient;
  config: McpConfig;
  logger: Logger;
}

export const SERVER_NAME = 'unraid-mcp';
export const SERVER_VERSION = '0.1.0';

/** Build and configure the MCP server with all tool groups registered. */
export function buildServer(ctx: ServerContext): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerAllTools(server, ctx);
  return server;
}
