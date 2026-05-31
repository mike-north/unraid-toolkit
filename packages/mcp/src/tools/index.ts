/**
 * Tool registration dispatcher. Each domain has its own `register*Tools`
 * function; this wires them all onto the server.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ServerContext } from '../server.js';
import { registerSystemTools } from './system.js';

/** Register every tool group on the given server. */
export function registerAllTools(server: McpServer, ctx: ServerContext): void {
  registerSystemTools(server, ctx);
}
