/**
 * Shared MCP tool annotations.
 *
 * Every Phase 1 tool is a read-only observation: it never mutates server state,
 * is safe to retry, and reaches an external system (the Unraid API).
 */

/** Annotations for a read-only, idempotent tool that calls the Unraid API. */
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

/**
 * Annotations for a Phase 2 "safe" control tool — a state-changing write that is
 * reversible and low-risk (start/stop/pause/update). Not read-only, not
 * idempotent, and (per MCP semantics) not flagged destructive — destructive,
 * gated operations are Phase 3 and carry `destructiveHint: true`.
 */
export const SAFE_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;
