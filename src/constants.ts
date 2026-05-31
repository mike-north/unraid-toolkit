/**
 * Shared constants for the Unraid MCP server.
 */

/** Server name, following the `{service}-mcp-server` convention. */
export const SERVER_NAME = 'unraid-mcp-server';

/**
 * Maximum size (in characters) of a tool's textual response before it is
 * truncated, to avoid overwhelming the model's context window.
 */
export const CHARACTER_LIMIT = 25_000;

/** Default port for the Streamable HTTP transport. */
export const DEFAULT_HTTP_PORT = 3000;

/** Default blast-radius cap: max items a single destructive op may affect. */
export const DEFAULT_MAX_BATCH = 10;

/** Default timeout (ms) for GraphQL requests to the Unraid API. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
