/**
 * Thin GraphQL client wrapper for the Unraid API.
 *
 * Centralizes endpoint URL, API-key authentication, request timeout, and the
 * optional TLS-skip behavior needed for Unraid's self-signed local certs. All
 * tools talk to Unraid through this client so auth and error handling live in
 * exactly one place.
 *
 * @see https://docs.unraid.net/API/how-to-use-the-api/
 */

import { GraphQLClient } from 'graphql-request';
import { Agent } from 'undici';
import { DEFAULT_REQUEST_TIMEOUT_MS } from '../constants.js';
import type { AppConfig } from '../config.js';

/** Options for constructing an {@link UnraidClient}. */
export interface UnraidClientOptions {
  /** Full GraphQL endpoint URL, e.g. `https://tower.local/graphql`. */
  url: string;
  /** Unraid API key, sent as the `x-api-key` header. */
  apiKey: string;
  /** Skip TLS certificate verification (for self-signed local certs). */
  tlsSkipVerify?: boolean;
  /** Per-request timeout in milliseconds. */
  timeoutMs?: number;
}

/** Discriminated result of a {@link UnraidClient.health} probe. */
export type HealthResult =
  | { reachable: true; endpoint: string }
  | { reachable: false; endpoint: string; reason: string };

/**
 * Error thrown when an Unraid GraphQL request fails, carrying a message that is
 * safe and useful to surface to an agent.
 */
export class UnraidApiError extends Error {
  public override readonly name = 'UnraidApiError';
  public readonly status: number | undefined;

  public constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

/**
 * Wraps a {@link GraphQLClient} configured for an Unraid endpoint.
 */
export class UnraidClient {
  readonly #client: GraphQLClient;
  readonly #endpoint: string;

  public constructor(options: UnraidClientOptions) {
    this.#endpoint = options.url;
    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

    // Scope TLS-skip to this client only via a dedicated dispatcher, rather
    // than flipping the process-global NODE_TLS_REJECT_UNAUTHORIZED.
    const dispatcher = options.tlsSkipVerify
      ? new Agent({ connect: { rejectUnauthorized: false } })
      : undefined;

    this.#client = new GraphQLClient(options.url, {
      headers: { 'x-api-key': options.apiKey },
      signal: AbortSignal.timeout(timeoutMs),
      ...(dispatcher ? { fetch: makeDispatchingFetch(dispatcher) } : {}),
    });
  }

  /** The configured GraphQL endpoint URL. */
  public get endpoint(): string {
    return this.#endpoint;
  }

  /**
   * Execute a GraphQL operation, normalizing failures into {@link UnraidApiError}.
   *
   * @typeParam T - Expected shape of `data`.
   * @param document - GraphQL query/mutation string.
   * @param variables - Operation variables.
   */
  public async request<T>(document: string, variables?: Record<string, unknown>): Promise<T> {
    try {
      return await this.#client.request<T>(document, variables);
    } catch (error) {
      throw normalizeError(error);
    }
  }

  /**
   * Cheap connectivity + auth probe using the always-valid `{ __typename }`
   * query. Confirms the endpoint is reachable and the API key is accepted
   * without depending on any Unraid-specific schema fields.
   */
  public async health(): Promise<HealthResult> {
    try {
      await this.#client.request<{ __typename: string }>('query Health { __typename }');
      return { reachable: true, endpoint: this.#endpoint };
    } catch (error) {
      const normalized = normalizeError(error);
      return { reachable: false, endpoint: this.#endpoint, reason: normalized.message };
    }
  }
}

/** Build a `fetch` that routes requests through a specific undici dispatcher. */
function makeDispatchingFetch(dispatcher: Agent): typeof fetch {
  return (input, init) =>
    fetch(input, { ...init, dispatcher } as RequestInit & { dispatcher: Agent });
}

/** Convert an unknown thrown value into a {@link UnraidApiError}. */
function normalizeError(error: unknown): UnraidApiError {
  if (error instanceof UnraidApiError) return error;

  // graphql-request throws a ClientError with a `response.status` field.
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { status?: number; errors?: { message: string }[] } })
      .response;
    const status = response?.status;
    const gqlMessage = response?.errors?.map((e) => e.message).join('; ');
    if (status === 401 || status === 403) {
      return new UnraidApiError(
        `Authentication failed (HTTP ${String(status)}). Check UNRAID_API_KEY and its scopes.`,
        status,
      );
    }
    if (gqlMessage) return new UnraidApiError(`Unraid API error: ${gqlMessage}`, status);
    if (status)
      return new UnraidApiError(`Unraid API request failed (HTTP ${String(status)}).`, status);
  }

  const message = error instanceof Error ? error.message : String(error);
  return new UnraidApiError(`Could not reach the Unraid API: ${message}`);
}

/** Construct an {@link UnraidClient} from validated {@link AppConfig}. */
export function createUnraidClient(config: AppConfig): UnraidClient {
  return new UnraidClient({
    url: config.unraidApiUrl,
    apiKey: config.unraidApiKey,
    tlsSkipVerify: config.tlsSkipVerify,
  });
}
