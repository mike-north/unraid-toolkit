/**
 * Tests for connection-config resolution.
 *
 * @see https://docs.unraid.net/API/how-to-use-the-api/
 */

import { describe, it, expect } from 'vitest';
import { resolveConnectionConfig } from '../src/config.js';
import { DEFAULT_REQUEST_TIMEOUT_MS } from '../src/constants.js';

const EMPTY_ENV: NodeJS.ProcessEnv = {};

describe('resolveConnectionConfig', () => {
  it('resolves from explicit overrides and applies defaults', () => {
    const cfg = resolveConnectionConfig(
      { url: 'https://tower.local/graphql', apiKey: 'k' },
      EMPTY_ENV,
    );
    expect(cfg.url).toBe('https://tower.local/graphql');
    expect(cfg.apiKey).toBe('k');
    expect(cfg.tlsSkipVerify).toBe(false);
    expect(cfg.timeoutMs).toBe(DEFAULT_REQUEST_TIMEOUT_MS);
  });

  it('reads from environment variables', () => {
    const cfg = resolveConnectionConfig(
      {},
      {
        UNRAID_API_URL: 'https://t/graphql',
        UNRAID_API_KEY: 'envkey',
        UNRAID_TLS_SKIP_VERIFY: 'true',
      },
    );
    expect(cfg.apiKey).toBe('envkey');
    expect(cfg.tlsSkipVerify).toBe(true);
  });

  it('lets explicit overrides take precedence over env', () => {
    const cfg = resolveConnectionConfig(
      { apiKey: 'flag' },
      { UNRAID_API_URL: 'https://t/graphql', UNRAID_API_KEY: 'env' },
    );
    expect(cfg.apiKey).toBe('flag');
  });

  it('throws when the URL is missing', () => {
    expect(() => resolveConnectionConfig({ apiKey: 'k' }, EMPTY_ENV)).toThrow(/URL is required/);
  });

  it('throws when the API key is missing', () => {
    expect(() => resolveConnectionConfig({ url: 'https://t/graphql' }, EMPTY_ENV)).toThrow(
      /key is required/,
    );
  });

  it('rejects an invalid URL', () => {
    expect(() => resolveConnectionConfig({ url: 'not a url', apiKey: 'k' }, EMPTY_ENV)).toThrow(
      /valid URL/,
    );
  });

  it('parses falsey TLS env values', () => {
    const cfg = resolveConnectionConfig(
      {},
      {
        UNRAID_API_URL: 'https://t/graphql',
        UNRAID_API_KEY: 'k',
        UNRAID_TLS_SKIP_VERIFY: 'false',
      },
    );
    expect(cfg.tlsSkipVerify).toBe(false);
  });
});
