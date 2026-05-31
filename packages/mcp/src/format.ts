/**
 * The seam between the SDK and MCP: adapt the SDK's `UnraidResult<T>` envelope
 * into the MCP `CallToolResult` shape. This is the only place that conversion
 * happens — tools never build `CallToolResult` by hand.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { UnraidResult } from '@unraid-cli/sdk';

/** Convert an SDK result envelope into an MCP tool result. */
export function formatResult<T>(result: UnraidResult<T>): CallToolResult {
  if (!result.success) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(result.error, null, 2) }],
      isError: true,
    };
  }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result.data, null, 2) }],
  };
}
