/**
 * Layer-1 policy floor for control tools (client- and model-independent).
 *
 * These guards run before any SDK call and cannot be bypassed by the LLM or a
 * permissive client:
 *  - `MCP_READ_ONLY` disables every mutation.
 *  - the deny-list refuses named/patterned targets (e.g. protect `*-appdata`).
 *  - the blast-radius cap refuses batches larger than `MCP_MAX_BATCH`.
 *  - an audit log records every attempted mutation and its outcome.
 *
 * Each guard returns a refusal `CallToolResult` (so the caller can `?? proceed`)
 * or `null` to allow the operation.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { ServerContext } from '../server.js';

/** Build a failure envelope `CallToolResult` mirroring the SDK error shape. */
function refusal(code: string, message: string): CallToolResult {
  const envelope = { success: false, data: null, error: { code, message } };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(envelope, null, 2) }],
    isError: true,
  };
}

/**
 * If the server is in read-only mode, return a refusal `CallToolResult`;
 * otherwise return `null` so the caller proceeds with the mutation.
 *
 * Usage: `return readOnlyBlock(ctx) ?? formatResult(await op(...));`
 */
export function readOnlyBlock(ctx: ServerContext): CallToolResult | null {
  if (!ctx.config.readOnly) return null;
  return refusal(
    'READ_ONLY',
    'Server is in read-only mode (MCP_READ_ONLY); control operations are disabled. Unset MCP_READ_ONLY to enable writes.',
  );
}

/**
 * Convert a deny-list entry to a matcher. An entry is a literal string, or a
 * glob using `*` (matched case-insensitively against the whole target).
 */
function denyMatches(pattern: string, target: string): boolean {
  // Escape regex metacharacters except `*`, then turn `*` into `.*`.
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${escaped}$`, 'i').test(target);
}

/**
 * Refuse if any of `targets` matches the configured deny-list
 * (`MCP_DENY_TOOLS`, reused here as protected resource patterns). Returns `null`
 * when all targets are allowed.
 */
export function denyListBlock(
  ctx: ServerContext,
  targets: readonly string[],
): CallToolResult | null {
  const patterns = ctx.config.denyTools;
  if (patterns.length === 0) return null;

  const blocked = targets.filter((t) => patterns.some((p) => denyMatches(p, t)));
  if (blocked.length === 0) return null;

  return refusal(
    'DENIED',
    `Target(s) ${blocked.map((t) => `"${t}"`).join(', ')} are protected by the deny-list (MCP_DENY_TOOLS) and cannot be modified.`,
  );
}

/**
 * Refuse if a destructive batch affects more than `MCP_MAX_BATCH` items,
 * regardless of approval. Returns `null` when within the cap.
 */
export function blastRadiusBlock(ctx: ServerContext, count: number): CallToolResult | null {
  if (count <= ctx.config.maxBatch) return null;
  return refusal(
    'BLAST_RADIUS_EXCEEDED',
    `This operation affects ${String(count)} items, exceeding the blast-radius cap of ${String(ctx.config.maxBatch)} (MCP_MAX_BATCH). Reduce the batch or raise the cap deliberately.`,
  );
}

/**
 * Run all Layer-1 guards for a destructive operation in order: read-only, then
 * deny-list, then blast-radius. Returns the first refusal, or `null` to proceed.
 */
export function layer1Block(ctx: ServerContext, targets: readonly string[]): CallToolResult | null {
  return readOnlyBlock(ctx) ?? denyListBlock(ctx, targets) ?? blastRadiusBlock(ctx, targets.length);
}
