/**
 * Unit tests for error conversion (non-transport branches).
 *
 * ClientError (HTTP/GraphQL) branches are covered by the integration tests in
 * `operations.test.ts`, which drive real graphql-request errors via msw.
 *
 * @see https://docs.unraid.net/API/
 */

import { describe, it, expect } from 'vitest';
import { toUnraidError, createError, UnraidErrorCode } from '../src/errors.js';

describe('toUnraidError', () => {
  it('maps a generic Error to CONNECTION_FAILED', () => {
    const error = toUnraidError(new Error('socket hang up'));
    expect(error.code).toBe(UnraidErrorCode.CONNECTION_FAILED);
    expect(error.message).toContain('socket hang up');
  });

  it('maps a non-Error throwable to UNKNOWN_ERROR', () => {
    const error = toUnraidError('something odd');
    expect(error.code).toBe(UnraidErrorCode.UNKNOWN_ERROR);
    expect(error.message).toBe('something odd');
  });
});

describe('createError', () => {
  it('omits details when not provided', () => {
    const error = createError(UnraidErrorCode.NOT_FOUND, 'missing');
    expect(error).toEqual({ code: 'NOT_FOUND', message: 'missing' });
    expect('details' in error).toBe(false);
  });

  it('includes details when provided', () => {
    const error = createError(UnraidErrorCode.API_ERROR, 'boom', 'HTTP 500');
    expect(error.details).toBe('HTTP 500');
  });
});
