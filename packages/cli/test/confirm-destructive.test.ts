/**
 * Behavioral coverage of the CLI destructive-confirmation gate.
 *
 * @see https://docs.unraid.net/API/
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { confirmDestructive } from '../src/commands/run.js';

afterEach(() => {
  process.exitCode = undefined;
});

describe('confirmDestructive', () => {
  it('proceeds when --yes is passed', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(confirmDestructive('stop the array', true)).toBe(true);
    expect(err).not.toHaveBeenCalled();
    expect(process.exitCode).not.toBe(1);
  });

  it('refuses and sets a failure exit code without --yes', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(confirmDestructive('stop the array', undefined)).toBe(false);
    expect(process.exitCode).toBe(1);
    // The refusal must name the impact and how to proceed.
    const msg = err.mock.calls.map((c) => String(c[0])).join('\n');
    expect(msg).toContain('stop the array');
    expect(msg).toContain('--yes');
  });

  it('treats yes=false the same as absent (refuses)', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(confirmDestructive('remove container x', false)).toBe(false);
    expect(process.exitCode).toBe(1);
  });
});
