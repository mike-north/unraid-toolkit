/**
 * System / connection operations.
 *
 * Phase 1 (observability) starts with a connection-health probe. Richer
 * `getSystemInfo` / `getSystemMetrics` operations are added once the GraphQL
 * schema is vendored and codegen is wired.
 */

import type { UnraidClient } from '../client.js';
import { toUnraidError } from '../errors.js';
import { type UnraidResult, success, failure } from '../result.js';
import type { HealthInfo } from '../types.js';

/**
 * Probe the Unraid API for reachability and authentication.
 *
 * Uses the always-valid `{ __typename }` query — it confirms the endpoint
 * responds and the API key is accepted without depending on any
 * Unraid-specific schema fields. A failed probe returns a failure envelope
 * whose error explains why (auth, network, etc.).
 */
export async function getHealth(client: UnraidClient): Promise<UnraidResult<HealthInfo>> {
  try {
    await client.request<{ __typename: string }>('query Health { __typename }');
    return success({ endpoint: client.endpoint });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
