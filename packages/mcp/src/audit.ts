/**
 * Audit log for mutations (Layer-1 backstop).
 *
 * Every attempted control operation is recorded as a single JSON line: what was
 * attempted, the enumerated targets, how it was approved, and the outcome. When
 * `MCP_AUDIT_LOG` is unset the entries are emitted to the stderr logger instead
 * of a file, so an audit trail always exists.
 *
 * The writer is intentionally simple (append a line per event). Timestamps are
 * injected by the caller so the module stays testable and deterministic.
 */

import { appendFile } from 'node:fs/promises';
import type { Logger } from './log.js';

/** How a mutation was approved. */
export type ApprovalSource = 'elicitation' | 'token' | 'none';

/** The outcome of an attempted mutation. */
export type AuditOutcome = 'allowed' | 'refused' | 'succeeded' | 'failed';

/** A single audit record. */
export interface AuditEntry {
  /** ISO timestamp of the event. */
  readonly timestamp: string;
  /** The MCP tool name that was invoked. */
  readonly tool: string;
  /** The enumerated targets the operation would affect. */
  readonly targets: readonly string[];
  /** How the operation was approved (or `none`). */
  readonly approval: ApprovalSource;
  /** The outcome. */
  readonly outcome: AuditOutcome;
  /** Optional human-readable detail (e.g. a refusal reason or error message). */
  readonly detail?: string;
}

/** Writes audit entries to a file (if configured) or the logger otherwise. */
export interface AuditLog {
  record(entry: AuditEntry): Promise<void>;
}

/**
 * Create an {@link AuditLog}. When `path` is provided, entries are appended as
 * JSON lines to that file; otherwise they are written via `logger.info`.
 */
export function createAuditLog(path: string | undefined, logger: Logger): AuditLog {
  return {
    async record(entry: AuditEntry): Promise<void> {
      const line = JSON.stringify(entry);
      if (path === undefined) {
        logger.info('audit', { ...entry });
        return;
      }
      try {
        await appendFile(path, `${line}\n`, 'utf8');
      } catch (error) {
        // Never let an audit-write failure mask the operation; surface it on stderr.
        logger.error('audit write failed', {
          path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}
