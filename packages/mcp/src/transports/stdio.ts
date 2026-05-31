/**
 * stdio transport runner — for local MCP clients that spawn the server as a
 * child process. All logging goes to stderr so stdout stays a clean JSON-RPC
 * stream.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../log.js';

/** Connect the given server to a stdio transport. */
export async function startStdio(server: McpServer, logger: Logger): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server listening on stdio');
}
