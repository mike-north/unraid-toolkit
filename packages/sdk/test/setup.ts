/**
 * Vitest setup: start the msw mock server for the suite and reset handlers
 * between tests. Unhandled requests fail loudly so a missing mock is obvious.
 */

import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './helpers.js';

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
