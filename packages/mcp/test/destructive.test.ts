/**
 * Tests for the destructive-operation orchestrator: it must enforce Layer 1
 * before Layer 2, require approval before running the SDK op, and write an audit
 * entry on every branch.
 *
 * @see https://docs.unraid.net/API/
 */

import { describe, it, expect, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { success, failure, UnraidErrorCode, type UnraidResult } from '@unraid-toolkit/sdk';
import { runDestructive } from '../src/tools/destructive.js';
import { TokenStore } from '../src/approval.js';
import type { AuditEntry, AuditLog } from '../src/audit.js';
import type { ServerContext } from '../src/server.js';

/** Collect audit entries for assertions. */
function recordingAudit(): { audit: AuditLog; entries: AuditEntry[] } {
  const entries: AuditEntry[] = [];
  return {
    entries,
    audit: {
      record: async (e) => {
        entries.push(e);
        return Promise.resolve();
      },
    },
  };
}

function makeCtx(config: Partial<ServerContext['config']>, audit: AuditLog): ServerContext {
  return {
    config: { readOnly: false, maxBatch: 10, denyTools: [], ...config },
    tokens: new TokenStore(),
    audit,
  } as ServerContext;
}

/** Server with elicitation on, returning a fixed accept/decline. */
function elicitingServer(approve: boolean): McpServer {
  return {
    server: {
      getClientCapabilities: () => ({ elicitation: { form: {} } }),
      elicitInput: vi
        .fn()
        .mockResolvedValue(
          approve ? { action: 'accept', content: { confirm: true } } : { action: 'decline' },
        ),
    },
  } as unknown as McpServer;
}

function parse(result: { content: { type: string; text?: string }[] }): {
  success: boolean;
  error?: { code: string };
} {
  const text = result.content[0];
  return JSON.parse(text && 'text' in text && text.text ? text.text : '{}') as {
    success: boolean;
    error?: { code: string };
  };
}

describe('runDestructive — Layer 1', () => {
  it('refuses in read-only mode and never runs the op', async () => {
    const { audit, entries } = recordingAudit();
    const ctx = makeCtx({ readOnly: true }, audit);
    const run = vi.fn<() => Promise<UnraidResult<string>>>();
    const result = await runDestructive(elicitingServer(true), ctx, {
      tool: 'unraid_docker_remove',
      summary: 'Remove c1',
      targets: ['c1'],
      run,
    });
    expect(parse(result).error?.code).toBe('READ_ONLY');
    expect(run).not.toHaveBeenCalled();
    expect(entries.at(-1)).toMatchObject({ outcome: 'refused', approval: 'none' });
  });

  it('refuses a deny-listed target before approval', async () => {
    const { audit } = recordingAudit();
    const ctx = makeCtx({ denyTools: ['c1'] }, audit);
    const run = vi.fn<() => Promise<UnraidResult<string>>>();
    const result = await runDestructive(elicitingServer(true), ctx, {
      tool: 'unraid_docker_remove',
      summary: 'Remove c1',
      targets: ['c1'],
      run,
    });
    expect(parse(result).error?.code).toBe('DENIED');
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses an oversized batch even with approval', async () => {
    const { audit } = recordingAudit();
    const ctx = makeCtx({ maxBatch: 2 }, audit);
    const run = vi.fn<() => Promise<UnraidResult<string>>>();
    const result = await runDestructive(elicitingServer(true), ctx, {
      tool: 'unraid_docker_remove',
      summary: 'Remove 3 containers',
      targets: ['a', 'b', 'c'],
      run,
    });
    expect(parse(result).error?.code).toBe('BLAST_RADIUS_EXCEEDED');
    expect(run).not.toHaveBeenCalled();
  });
});

describe('runDestructive — Layer 2 + execution', () => {
  it('runs the op and audits success when approved via elicitation', async () => {
    const { audit, entries } = recordingAudit();
    const ctx = makeCtx({}, audit);
    const run = vi.fn(async () => success('ok'));
    const result = await runDestructive(elicitingServer(true), ctx, {
      tool: 'unraid_docker_remove',
      summary: 'Remove c1',
      targets: ['c1'],
      run,
    });
    expect(run).toHaveBeenCalledOnce();
    expect(parse(result).success).toBe(true);
    expect(entries.at(-1)).toMatchObject({ outcome: 'succeeded', approval: 'elicitation' });
  });

  it('aborts and audits a refusal when elicitation is declined', async () => {
    const { audit, entries } = recordingAudit();
    const ctx = makeCtx({}, audit);
    const run = vi.fn<() => Promise<UnraidResult<string>>>();
    const result = await runDestructive(elicitingServer(false), ctx, {
      tool: 'unraid_docker_remove',
      summary: 'Remove c1',
      targets: ['c1'],
      run,
    });
    expect(parse(result).error?.code).toBe('APPROVAL_DECLINED');
    expect(run).not.toHaveBeenCalled();
    expect(entries.at(-1)).toMatchObject({ outcome: 'refused' });
  });

  it('audits a failed outcome when the SDK op fails after approval', async () => {
    const { audit, entries } = recordingAudit();
    const ctx = makeCtx({}, audit);
    const run = vi.fn(async () =>
      failure<string>({ code: UnraidErrorCode.API_ERROR, message: 'boom' }),
    );
    const result = await runDestructive(elicitingServer(true), ctx, {
      tool: 'unraid_docker_remove',
      summary: 'Remove c1',
      targets: ['c1'],
      run,
    });
    expect(parse(result).success).toBe(false);
    expect(entries.at(-1)).toMatchObject({ outcome: 'failed', detail: 'boom' });
  });
});
