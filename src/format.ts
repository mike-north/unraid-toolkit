/**
 * Shared helpers for dual-format (markdown / JSON) tool responses.
 */

import { z } from 'zod';
import { CHARACTER_LIMIT } from './constants.js';

export const RESPONSE_FORMATS = ['markdown', 'json'] as const;
export type ResponseFormat = (typeof RESPONSE_FORMATS)[number];

/** Reusable Zod field for a tool's `response_format` parameter. */
export const responseFormatSchema = z
  .enum(RESPONSE_FORMATS)
  .default('markdown')
  .describe("Output format: 'markdown' for human-readable or 'json' for machine-readable");

/**
 * A normalized MCP tool result with both text and structured content.
 *
 * The `[key: string]: unknown` index signature keeps this assignable to the
 * SDK's `CallToolResult` (which has the same open shape).
 */
export interface ToolResult {
  [key: string]: unknown;
  content: { type: 'text'; text: string }[];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
}

/**
 * Build a {@link ToolResult} from a structured payload and a markdown rendering,
 * choosing the text body based on `format` and enforcing {@link CHARACTER_LIMIT}.
 */
export function toolResult(
  format: ResponseFormat,
  structured: Record<string, unknown>,
  markdown: string,
): ToolResult {
  let text = format === 'json' ? JSON.stringify(structured, null, 2) : markdown;
  if (text.length > CHARACTER_LIMIT) {
    text =
      text.slice(0, CHARACTER_LIMIT) +
      `\n\n[truncated at ${String(CHARACTER_LIMIT)} characters — request 'json' format or narrow the query for full data]`;
  }
  return { content: [{ type: 'text', text }], structuredContent: structured };
}

/** Build an error {@link ToolResult} with an actionable message. */
export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    structuredContent: { error: message },
    isError: true,
  };
}
