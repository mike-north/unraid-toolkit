/**
 * The seam between the SDK and MCP: adapt the SDK's `UnraidResult<T>` envelope
 * into the MCP `CallToolResult` shape. This is the only place that conversion
 * happens — tools never build `CallToolResult` by hand.
 *
 * The full `{ success, data, error }` envelope is preserved in the text content
 * (the same shape the CLI emits in JSON mode, so clients handle results
 * uniformly), and failures additionally set the protocol-native `isError` flag.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { UnraidResult } from '@unraid-toolkit/sdk';

/** Convert an SDK result envelope into an MCP tool result. */
export function formatResult<T>(result: UnraidResult<T>): CallToolResult {
  const content = [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }];
  return result.success ? { content } : { content, isError: true };
}
