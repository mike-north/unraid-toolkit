/**
 * Tests for the Layer-1 read-only policy floor.
 *
 * @see https://docs.unraid.net/API/
 */

import { describe, it, expect } from 'vitest';
import { readOnlyBlock } from '../src/tools/policy.js';
import type { ServerContext } from '../src/server.js';

/** Build a minimal ServerContext carrying only the readOnly flag the guard reads. */
function ctx(readOnly: boolean): ServerContext {
  return { config: { readOnly } } as unknown as ServerContext;
}

describe('readOnlyBlock', () => {
  it('returns null when writes are enabled (proceed)', () => {
    expect(readOnlyBlock(ctx(false))).toBeNull();
  });

  it('returns an isError refusal envelope when read-only', () => {
    const blocked = readOnlyBlock(ctx(true));
    expect(blocked).not.toBeNull();
    expect(blocked?.isError).toBe(true);

    const text = blocked?.content[0];
    expect(text?.type).toBe('text');
    const envelope = JSON.parse(text && 'text' in text ? text.text : '{}') as {
      success: boolean;
      error: { code: string };
    };
    expect(envelope.success).toBe(false);
    expect(envelope.error.code).toBe('READ_ONLY');
  });
});
