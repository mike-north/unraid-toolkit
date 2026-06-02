/**
 * Layer-1 policy floor for control tools (client- and model-independent).
 *
 * The first guard is `MCP_READ_ONLY`: when enabled, every mutating tool
 * short-circuits before touching the SDK and returns a structured error in the
 * same envelope shape as a normal failure. This cannot be bypassed by the LLM
 * or a permissive client.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ServerContext } from '../server.js';

/**
 * If the server is in read-only mode, return a refusal `CallToolResult`;
 * otherwise return `null` so the caller proceeds with the mutation.
 *
 * Usage: `return readOnlyBlock(ctx) ?? formatResult(await op(...));`
 */
export function readOnlyBlock(ctx: ServerContext): CallToolResult | null {
  if (!ctx.config.readOnly) return null;

  const envelope = {
    success: false,
    data: null,
    error: {
      code: 'READ_ONLY',
      message:
        'Server is in read-only mode (MCP_READ_ONLY); control operations are disabled. Unset MCP_READ_ONLY to enable writes.',
    },
  };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(envelope, null, 2) }],
    isError: true,
  };
}
