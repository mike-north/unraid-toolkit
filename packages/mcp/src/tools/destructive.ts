/**
 * Orchestrates a destructive (Phase 3) MCP tool call through both safety layers
 * and the audit log, so individual tools stay declarative.
 *
 * Flow per call:
 *  1. Layer 1 (policy floor): read-only, deny-list, blast-radius — refuse hard.
 *  2. Layer 2 (approval): elicitation when supported, else a token gate bound to
 *     the enumerated target set (confused-deputy guard).
 *  3. On approval, run the SDK op and format its envelope.
 *  4. Every branch writes an audit entry.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { UnraidResult } from '@unraid-toolkit/sdk';
import { formatResult } from '../format.js';
import { layer1Block } from './policy.js';
import { resolveApproval } from '../approval.js';
import type { ServerContext } from '../server.js';

/** Spec for a single destructive operation invocation. */
export interface DestructiveCall<T> {
  /** The MCP tool name (binds audit + approval token). */
  readonly tool: string;
  /** Human sentence describing the impact, e.g. "Stop the array". */
  readonly summary: string;
  /** Enumerated targets the op affects (ids/names); drives caps, deny, hashing. */
  readonly targets: readonly string[];
  /** Caller-supplied confirmation token from a prior call, if any. */
  readonly token?: string | undefined;
  /** The SDK operation to run once approved. */
  readonly run: () => Promise<UnraidResult<T>>;
}

/** Build a structured refusal `CallToolResult` (SDK envelope shape). */
function refusal(code: string, message: string): CallToolResult {
  const envelope = { success: false, data: null, error: { code, message } };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(envelope, null, 2) }],
    isError: true,
  };
}

/**
 * Run a destructive operation through Layer 1 → Layer 2 → execute, auditing
 * each outcome. Tools call this instead of touching the SDK directly.
 */
export async function runDestructive<T>(
  server: McpServer,
  ctx: ServerContext,
  call: DestructiveCall<T>,
): Promise<CallToolResult> {
  const stamp = (): string => new Date().toISOString();

  // Layer 1 — policy floor.
  const blocked = layer1Block(ctx, call.targets);
  if (blocked) {
    const detail = blocked.content[0];
    await ctx.audit.record({
      timestamp: stamp(),
      tool: call.tool,
      targets: call.targets,
      approval: 'none',
      outcome: 'refused',
      detail: detail && 'text' in detail ? detail.text : 'policy refusal',
    });
    return blocked;
  }

  // Layer 2 — approval.
  const decision = await resolveApproval(server, ctx.tokens, {
    tool: call.tool,
    summary: call.summary,
    targets: call.targets,
    token: call.token,
  });

  if (decision.status === 'declined') {
    await ctx.audit.record({
      timestamp: stamp(),
      tool: call.tool,
      targets: call.targets,
      approval: 'elicitation',
      outcome: 'refused',
      detail: decision.reason,
    });
    return refusal('APPROVAL_DECLINED', decision.reason);
  }

  if (decision.status === 'needs-token') {
    await ctx.audit.record({
      timestamp: stamp(),
      tool: call.tool,
      targets: call.targets,
      approval: 'token',
      outcome: 'refused',
      detail: 'confirmation token issued; awaiting re-invocation',
    });
    return refusal('CONFIRMATION_REQUIRED', decision.message);
  }

  // Approved — execute.
  const result = await call.run();
  await ctx.audit.record({
    timestamp: stamp(),
    tool: call.tool,
    targets: call.targets,
    approval: decision.source,
    outcome: result.success ? 'succeeded' : 'failed',
    ...(result.success ? {} : { detail: result.error.message }),
  });
  return formatResult(result);
}
