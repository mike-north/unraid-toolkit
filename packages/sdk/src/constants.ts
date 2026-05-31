/** Default per-request timeout (ms) for GraphQL calls to the Unraid API. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/**
 * Soft cap (in characters of serialized JSON) on the size of a single list
 * payload returned by an SDK operation. Operations that return potentially
 * large lists trim items beyond this budget and flag the result as truncated,
 * so wrappers (notably MCP, which has tight token budgets) never emit an
 * unbounded blob. Callers page past the cap with `limit`/`offset`.
 */
export const CHARACTER_LIMIT = 25_000;
