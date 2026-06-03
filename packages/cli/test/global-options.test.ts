/**
 * Tests for global-option resolution, especially the TLS-skip precedence bug:
 * an absent `--insecure` flag must NOT shadow `UNRAID_TLS_SKIP_VERIFY`.
 *
 * Regression: previously `--insecure` defaulted to a concrete `false`, which the
 * SDK's `overrides.tlsSkipVerify ?? boolFromEnv(env)` layering treated as an
 * explicit override — so `UNRAID_TLS_SKIP_VERIFY=true` was ignored and requests
 * to a self-signed Unraid endpoint failed with CONNECTION_FAILED.
 *
 * @see https://docs.unraid.net/API/
 */

import { describe, it, expect } from 'vitest';
import { resolveConnectionConfig } from '@unraid-cli/sdk';
import { resolveGlobalOptions } from '../src/cli.js';

const ENDPOINT = { UNRAID_API_URL: 'https://tower.local/graphql', UNRAID_API_KEY: 'k' };

describe('resolveGlobalOptions', () => {
  it('leaves insecure undefined when --insecure is absent', () => {
    expect(resolveGlobalOptions({}).insecure).toBeUndefined();
  });

  it('sets insecure true when --insecure is present', () => {
    expect(resolveGlobalOptions({ insecure: true }).insecure).toBe(true);
  });

  it('defaults json true and flips to false with --human', () => {
    expect(resolveGlobalOptions({}).json).toBe(true);
    expect(resolveGlobalOptions({ human: true }).json).toBe(false);
  });
});

describe('TLS-skip precedence (regression)', () => {
  it('honors UNRAID_TLS_SKIP_VERIFY when --insecure is absent', () => {
    const globals = resolveGlobalOptions({});
    const cfg = resolveConnectionConfig(
      { url: globals.url, apiKey: globals.apiKey, tlsSkipVerify: globals.insecure },
      { ...ENDPOINT, UNRAID_TLS_SKIP_VERIFY: 'true' },
    );
    expect(cfg.tlsSkipVerify).toBe(true);
  });

  it('still allows --insecure to force TLS-skip on', () => {
    const globals = resolveGlobalOptions({ insecure: true });
    const cfg = resolveConnectionConfig(
      { url: globals.url, apiKey: globals.apiKey, tlsSkipVerify: globals.insecure },
      ENDPOINT,
    );
    expect(cfg.tlsSkipVerify).toBe(true);
  });

  it('defaults to TLS verification on when neither flag nor env is set', () => {
    const globals = resolveGlobalOptions({});
    const cfg = resolveConnectionConfig(
      { url: globals.url, apiKey: globals.apiKey, tlsSkipVerify: globals.insecure },
      ENDPOINT,
    );
    expect(cfg.tlsSkipVerify).toBe(false);
  });
});
