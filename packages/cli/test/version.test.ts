/**
 * Regression: the CLI must report the package's real version, read from
 * package.json at runtime — never a hardcoded literal.
 *
 * A hand-typed `.version('0.1.0')` shipped stale on the 0.2.0 release, so
 * `unraid --version` reported 0.1.0 regardless of what was actually installed,
 * making it impossible to tell which build a user was running. Asserting against
 * package.json (not a literal) proves correctness and prevents re-hardcoding.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { createCli } from '../src/cli.js';

function packageJsonVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const parsed = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    version: string;
  };
  return parsed.version;
}

describe('CLI version', () => {
  it('reports the version from package.json, not a hardcoded literal', () => {
    expect(createCli().version()).toBe(packageJsonVersion());
  });

  it('reports a non-empty semver-looking version', () => {
    expect(createCli().version()).toMatch(/^\d+\.\d+\.\d+/);
  });
});
