/**
 * Regression: SERVER_VERSION — sent in the MCP initialize handshake — must come
 * from package.json at runtime, not a hardcoded literal.
 *
 * A hand-typed `SERVER_VERSION = '0.1.0'` shipped stale on the 0.2.0 release, so
 * the server advertised 0.1.0 regardless of the installed version. Asserting
 * against package.json (not a literal) proves correctness and prevents
 * re-hardcoding.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { SERVER_VERSION } from '../src/server.js';

function packageJsonVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const parsed = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')) as {
    version: string;
  };
  return parsed.version;
}

describe('SERVER_VERSION', () => {
  it('matches the package.json version, not a hardcoded literal', () => {
    expect(SERVER_VERSION).toBe(packageJsonVersion());
  });

  it('is a non-empty semver-looking string', () => {
    expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
