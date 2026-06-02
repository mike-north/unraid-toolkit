/**
 * Tests for the Layer-1 policy floor: read-only, deny-list, and blast-radius.
 *
 * @see https://docs.unraid.net/API/
 */

import { describe, it, expect } from 'vitest';
import {
  readOnlyBlock,
  denyListBlock,
  blastRadiusBlock,
  layer1Block,
} from '../src/tools/policy.js';
import type { ServerContext } from '../src/server.js';

/** Build a ServerContext carrying only the config fields the guards read. */
function ctx(config: Partial<ServerContext['config']>): ServerContext {
  return { config: { readOnly: false, maxBatch: 10, denyTools: [], ...config } } as ServerContext;
}

/** Parse the error code out of a refusal CallToolResult. */
function code(result: ReturnType<typeof readOnlyBlock>): string | undefined {
  if (result === null) return undefined;
  const text = result.content[0];
  if (!text || !('text' in text)) return undefined;
  return (JSON.parse(text.text) as { error: { code: string } }).error.code;
}

describe('readOnlyBlock', () => {
  it('allows when writes are enabled', () => {
    expect(readOnlyBlock(ctx({ readOnly: false }))).toBeNull();
  });

  it('refuses with READ_ONLY when enabled', () => {
    const blocked = readOnlyBlock(ctx({ readOnly: true }));
    expect(blocked?.isError).toBe(true);
    expect(code(blocked)).toBe('READ_ONLY');
  });
});

describe('denyListBlock', () => {
  it('allows targets that match no pattern', () => {
    expect(denyListBlock(ctx({ denyTools: ['*-appdata'] }), ['plex'])).toBeNull();
  });

  it('refuses an exact-name match', () => {
    const blocked = denyListBlock(ctx({ denyTools: ['critical-db'] }), ['critical-db']);
    expect(code(blocked)).toBe('DENIED');
  });

  it('refuses a glob match case-insensitively', () => {
    const blocked = denyListBlock(ctx({ denyTools: ['*-appdata'] }), ['Nextcloud-AppData']);
    expect(code(blocked)).toBe('DENIED');
  });

  it('refuses if any target in a set is protected', () => {
    const blocked = denyListBlock(ctx({ denyTools: ['array'] }), ['ok1', 'array', 'ok2']);
    expect(code(blocked)).toBe('DENIED');
  });

  it('allows when the deny-list is empty', () => {
    expect(denyListBlock(ctx({ denyTools: [] }), ['anything'])).toBeNull();
  });

  it('does not treat a deny pattern as a substring match', () => {
    // 'db' must not match 'mariadb' — patterns anchor to the whole target.
    expect(denyListBlock(ctx({ denyTools: ['db'] }), ['mariadb'])).toBeNull();
  });
});

describe('blastRadiusBlock', () => {
  it('allows a batch within the cap', () => {
    expect(blastRadiusBlock(ctx({ maxBatch: 3 }), 3)).toBeNull();
  });

  it('refuses a batch over the cap', () => {
    const blocked = blastRadiusBlock(ctx({ maxBatch: 3 }), 4);
    expect(code(blocked)).toBe('BLAST_RADIUS_EXCEEDED');
  });
});

describe('layer1Block ordering', () => {
  it('read-only takes precedence over deny-list and cap', () => {
    const blocked = layer1Block(ctx({ readOnly: true, denyTools: ['x'], maxBatch: 1 }), [
      'x',
      'y',
      'z',
    ]);
    expect(code(blocked)).toBe('READ_ONLY');
  });

  it('deny-list takes precedence over the cap', () => {
    const blocked = layer1Block(ctx({ denyTools: ['x'], maxBatch: 1 }), ['x', 'y']);
    expect(code(blocked)).toBe('DENIED');
  });

  it('allows when all guards pass', () => {
    expect(layer1Block(ctx({ maxBatch: 10 }), ['ok'])).toBeNull();
  });
});
