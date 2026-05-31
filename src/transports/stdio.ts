/**
 * stdio transport runner — for local MCP clients that spawn the server as a
 * child process (e.g. Claude Desktop, CLI dev). All logging goes to stderr so
 * the stdout JSON-RPC stream stays clean.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger } from '../log.js';

/**
 * Connect the given server to a stdio transport.
 */
export async function startStdio(server: McpServer, logger: Logger): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP server listening on stdio');
}
