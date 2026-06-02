/**
 * Tests for Layer-2 approval: the confused-deputy hash guard, the token store,
 * and capability-routed approval (elicitation vs token gate).
 *
 * @see https://docs.unraid.net/API/
 */

import { describe, it, expect, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { hashTargets, buildToken, TokenStore, resolveApproval } from '../src/approval.js';

describe('hashTargets', () => {
  it('is order-independent', () => {
    expect(hashTargets(['a', 'b', 'c'])).toBe(hashTargets(['c', 'a', 'b']));
  });

  it('differs for different sets', () => {
    expect(hashTargets(['a', 'b'])).not.toBe(hashTargets(['a', 'c']));
  });
});

describe('buildToken', () => {
  it('encodes tool, item-hash, and nonce', () => {
    const token = buildToken('unraid_array_set_state', ['array'], 'n1');
    expect(token).toBe(`confirm:unraid_array_set_state:${hashTargets(['array'])}:n1`);
  });
});

describe('TokenStore', () => {
  it('issues a token that then validates for the same tool + targets', () => {
    const store = new TokenStore();
    const token = store.issue('toolA', ['x', 'y']);
    expect(store.consume(token, 'toolA', ['y', 'x'])).toBe(true); // order-independent
  });

  it('rejects a token replayed against a different target set (confused deputy)', () => {
    const store = new TokenStore();
    const token = store.issue('toolA', ['setA']);
    expect(store.consume(token, 'toolA', ['setB'])).toBe(false);
  });

  it('rejects a token used for a different tool', () => {
    const store = new TokenStore();
    const token = store.issue('toolA', ['x']);
    expect(store.consume(token, 'toolB', ['x'])).toBe(false);
  });

  it('consumes a token exactly once', () => {
    const store = new TokenStore();
    const token = store.issue('toolA', ['x']);
    expect(store.consume(token, 'toolA', ['x'])).toBe(true);
    expect(store.consume(token, 'toolA', ['x'])).toBe(false);
  });

  it('rejects an unknown/forged token', () => {
    const store = new TokenStore();
    expect(store.consume('confirm:toolA:deadbeef:forged', 'toolA', ['x'])).toBe(false);
  });
});

/** Build a fake McpServer with controllable client capabilities + elicitInput. */
function fakeServer(opts: {
  elicitation: boolean;
  elicitResult?: { action: string; content?: Record<string, unknown> };
}): { server: McpServer; elicitInput: ReturnType<typeof vi.fn> } {
  const elicitInput = vi.fn().mockResolvedValue(opts.elicitResult ?? { action: 'decline' });
  const server = {
    server: {
      getClientCapabilities: () => (opts.elicitation ? { elicitation: { form: {} } } : {}),
      elicitInput,
    },
  } as unknown as McpServer;
  return { server, elicitInput };
}

describe('resolveApproval — elicitation path', () => {
  it('approves when the user accepts with confirm=true', async () => {
    const { server, elicitInput } = fakeServer({
      elicitation: true,
      elicitResult: { action: 'accept', content: { confirm: true } },
    });
    const decision = await resolveApproval(server, new TokenStore(), {
      tool: 'unraid_array_set_state',
      summary: 'Stop the array',
      targets: ['array'],
    });
    expect(decision.status).toBe('approved');
    if (decision.status === 'approved') expect(decision.source).toBe('elicitation');
    // The prompt must enumerate the impact.
    expect(elicitInput).toHaveBeenCalledOnce();
  });

  it('declines when the user rejects', async () => {
    const { server } = fakeServer({ elicitation: true, elicitResult: { action: 'decline' } });
    const decision = await resolveApproval(server, new TokenStore(), {
      tool: 't',
      summary: 's',
      targets: ['x'],
    });
    expect(decision.status).toBe('declined');
  });

  it('declines when accepted but confirm is not true', async () => {
    const { server } = fakeServer({
      elicitation: true,
      elicitResult: { action: 'accept', content: { confirm: false } },
    });
    const decision = await resolveApproval(server, new TokenStore(), {
      tool: 't',
      summary: 's',
      targets: ['x'],
    });
    expect(decision.status).toBe('declined');
  });
});

describe('resolveApproval — token-gate fallback', () => {
  it('issues a token on first call (no elicitation, no token)', async () => {
    const { server, elicitInput } = fakeServer({ elicitation: false });
    const decision = await resolveApproval(server, new TokenStore(), {
      tool: 'unraid_docker_remove',
      summary: 'Remove container c1',
      targets: ['c1'],
    });
    expect(decision.status).toBe('needs-token');
    if (decision.status === 'needs-token') {
      expect(decision.token).toContain('confirm:unraid_docker_remove:');
      expect(decision.message).toContain('c1');
    }
    expect(elicitInput).not.toHaveBeenCalled();
  });

  it('approves on re-invocation with the issued token', async () => {
    const { server } = fakeServer({ elicitation: false });
    const tokens = new TokenStore();
    const first = await resolveApproval(server, tokens, {
      tool: 'unraid_docker_remove',
      summary: 'Remove container c1',
      targets: ['c1'],
    });
    if (first.status !== 'needs-token') throw new Error('expected a token to be issued');
    const second = await resolveApproval(server, tokens, {
      tool: 'unraid_docker_remove',
      summary: 'Remove container c1',
      targets: ['c1'],
      token: first.token,
    });
    expect(second.status).toBe('approved');
    if (second.status === 'approved') expect(second.source).toBe('token');
  });

  it('does not approve a token minted for a different target set', async () => {
    const { server } = fakeServer({ elicitation: false });
    const tokens = new TokenStore();
    const first = await resolveApproval(server, tokens, {
      tool: 'unraid_docker_remove',
      summary: 'Remove c1',
      targets: ['c1'],
    });
    if (first.status !== 'needs-token') throw new Error('expected token');
    // Replay the token against a different container — must re-issue, not approve.
    const second = await resolveApproval(server, tokens, {
      tool: 'unraid_docker_remove',
      summary: 'Remove c2',
      targets: ['c2'],
      token: first.token,
    });
    expect(second.status).toBe('needs-token');
  });
});
