/**
 * Layer-2 approval for destructive operations.
 *
 * Capability-detected at call time: if the client advertises elicitation, the
 * server asks for one human confirmation showing the enumerated impact;
 * otherwise it falls back to a confirmation-token gate (the destructive tool's
 * first call returns a token the caller must echo back).
 *
 * Both paths bind approval to a **hash of the sorted target ids** (a
 * confused-deputy guard): a token minted for set A cannot be replayed against a
 * different set B, and an elicitation prompt always shows the exact items.
 */

import { createHash } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/** Stable hash of a target set, order-independent. */
export function hashTargets(targets: readonly string[]): string {
  const canonical = [...targets].sort().join('\n');
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

/**
 * Build a confirmation token binding an action to a specific target set:
 * `confirm:<tool>:<itemHash>:<nonce>`. The nonce makes tokens single-use within
 * a session via the {@link TokenStore}.
 */
export function buildToken(tool: string, targets: readonly string[], nonce: string): string {
  return `confirm:${tool}:${hashTargets(targets)}:${nonce}`;
}

/** Outcome of an approval attempt. */
export type ApprovalDecision =
  | { readonly status: 'approved'; readonly source: 'elicitation' | 'token' }
  | { readonly status: 'needs-token'; readonly token: string; readonly message: string }
  | { readonly status: 'declined'; readonly reason: string };

/**
 * Tracks confirmation tokens issued this session so a token can be honored
 * exactly once and only for the set it was minted against. In-memory by design:
 * approvals never persist across restarts.
 */
export class TokenStore {
  readonly #issued = new Map<string, { tool: string; itemHash: string }>();
  #counter = 0;

  /** Mint and remember a token for `tool` + `targets`. */
  public issue(tool: string, targets: readonly string[]): string {
    this.#counter += 1;
    const nonce = `${tool}-${String(this.#counter)}`;
    const token = buildToken(tool, targets, nonce);
    this.#issued.set(token, { tool, itemHash: hashTargets(targets) });
    return token;
  }

  /**
   * Validate and consume a token. Returns true only if the token was issued by
   * this store, has not been used, and its item-hash matches `targets` for
   * `tool` (confused-deputy guard).
   */
  public consume(token: string, tool: string, targets: readonly string[]): boolean {
    const record = this.#issued.get(token);
    if (record === undefined) return false;
    if (record.tool !== tool) return false;
    if (record.itemHash !== hashTargets(targets)) return false;
    this.#issued.delete(token);
    return true;
  }
}

/** Description of the destructive operation awaiting approval. */
export interface ApprovalRequest {
  /** The MCP tool name (binds the token/elicitation). */
  readonly tool: string;
  /** A human sentence describing the impact, e.g. "Stop the array". */
  readonly summary: string;
  /** The enumerated targets the operation will affect. */
  readonly targets: readonly string[];
  /** A caller-supplied confirmation token, if this is a re-invocation. */
  readonly token?: string | undefined;
}

/** Whether the connected client advertises form elicitation. */
export function clientSupportsElicitation(server: McpServer): boolean {
  return server.server.getClientCapabilities()?.elicitation?.form != null;
}

/**
 * Resolve approval for a destructive operation.
 *
 * - Elicitation-capable client: prompt once with the enumerated impact; map the
 *   user's accept/decline to the decision.
 * - Otherwise: if a valid token is supplied, approve; if not, mint one and ask
 *   the caller to re-invoke with it.
 */
export async function resolveApproval(
  server: McpServer,
  tokens: TokenStore,
  req: ApprovalRequest,
): Promise<ApprovalDecision> {
  if (clientSupportsElicitation(server)) {
    const list = req.targets.length > 0 ? `\n\nAffected: ${req.targets.join(', ')}` : '';
    const result = await server.server.elicitInput({
      mode: 'form',
      message: `${req.summary}. This is a destructive operation and cannot be undone.${list}\n\nApprove?`,
      requestedSchema: {
        type: 'object',
        properties: {
          confirm: {
            type: 'boolean',
            description: 'Set true to approve this destructive operation.',
          },
        },
        required: ['confirm'],
      },
    });
    if (result.action === 'accept' && result.content?.['confirm'] === true) {
      return { status: 'approved', source: 'elicitation' };
    }
    return { status: 'declined', reason: 'The destructive operation was not approved.' };
  }

  // Token-gate fallback.
  if (req.token !== undefined && tokens.consume(req.token, req.tool, req.targets)) {
    return { status: 'approved', source: 'token' };
  }

  const token = tokens.issue(req.tool, req.targets);
  const list = req.targets.length > 0 ? ` Affected: ${req.targets.join(', ')}.` : '';
  return {
    status: 'needs-token',
    token,
    message: `${req.summary}. This is a destructive operation and cannot be undone.${list} To proceed, re-invoke this tool with confirm_token="${token}".`,
  };
}
