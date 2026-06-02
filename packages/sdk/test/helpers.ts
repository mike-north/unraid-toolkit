/**
 * Shared test fixtures: an msw GraphQL mock server and a client pointed at it.
 *
 * Integration tests drive the *real* {@link UnraidClient} transport (graphql-request
 * over fetch) against responses intercepted by msw, so they exercise auth headers,
 * error mapping, and result shaping exactly as production would.
 *
 * @see https://docs.unraid.net/API/
 * @see https://mswjs.io/docs/
 */

import { setupServer } from 'msw/node';
import { graphql, HttpResponse } from 'msw';
import { createClient, type UnraidClient } from '../src/index.js';

/** Endpoint the test client posts to; msw intercepts regardless of host. */
export const TEST_ENDPOINT = 'https://tower.test/graphql';

/** The shared mock server. Lifecycle is managed in `test/setup.ts`. */
export const server = setupServer();

/** Build a client pointed at {@link TEST_ENDPOINT}. */
export function testClient(): UnraidClient {
  return createClient({
    url: TEST_ENDPOINT,
    apiKey: 'test-key',
    tlsSkipVerify: false,
    timeoutMs: 5000,
  });
}

export { graphql, HttpResponse };
