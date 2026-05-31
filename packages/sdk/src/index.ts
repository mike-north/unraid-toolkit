/**
 * `@unraid-cli/sdk` — the core SDK for the Unraid GraphQL API.
 *
 * Owns the transport, authentication, validation, domain models, structured
 * errors, and the result envelope. The CLI and MCP wrappers are thin adapters
 * over this surface and must not duplicate its logic.
 */

export { UnraidClient, createClient } from './client.js';
export {
  resolveConnectionConfig,
  type ConnectionConfig,
  type ConnectionOverrides,
} from './config.js';
export { type UnraidResult, success, failure } from './result.js';
export { UnraidErrorCode, type UnraidError, createError, toUnraidError } from './errors.js';
export { DEFAULT_REQUEST_TIMEOUT_MS } from './constants.js';
export type { HealthInfo } from './types.js';

export { getHealth } from './operations/system.js';
