/**
 * Typed GraphQL client for the Unraid API — the single transport boundary.
 *
 * Centralizes endpoint URL, API-key authentication, per-request timeout, and
 * the optional TLS-skip needed for Unraid's self-signed local certs. SDK
 * operations call {@link UnraidClient.request} and convert any thrown error
 * into a structured {@link ./errors.UnraidError}.
 *
 * @see https://docs.unraid.net/API/how-to-use-the-api/
 */

import { GraphQLClient } from 'graphql-request';
import { Agent } from 'undici';
import type { ConnectionConfig } from './config.js';

/** Wraps a {@link GraphQLClient} configured for an Unraid endpoint. */
export class UnraidClient {
  readonly #client: GraphQLClient;
  readonly #endpoint: string;

  public constructor(config: ConnectionConfig) {
    this.#endpoint = config.url;

    // Scope TLS-skip to this client via a dedicated dispatcher rather than the
    // process-global NODE_TLS_REJECT_UNAUTHORIZED.
    const dispatcher = config.tlsSkipVerify
      ? new Agent({ connect: { rejectUnauthorized: false } })
      : undefined;

    this.#client = new GraphQLClient(config.url, {
      headers: { 'x-api-key': config.apiKey },
      // Apply the timeout per request (see makeFetch) so a single client can
      // serve many requests over its lifetime.
      fetch: makeFetch(config.timeoutMs, dispatcher),
    });
  }

  /** The configured GraphQL endpoint URL. */
  public get endpoint(): string {
    return this.#endpoint;
  }

  /**
   * Execute a GraphQL operation. Throws the underlying transport error on
   * failure (operations convert it via {@link ./errors.toUnraidError}).
   */
  public async request<T>(document: string, variables?: Record<string, unknown>): Promise<T> {
    return this.#client.request<T>(document, variables);
  }
}

/** Construct an {@link UnraidClient} from resolved {@link ConnectionConfig}. */
export function createClient(config: ConnectionConfig): UnraidClient {
  return new UnraidClient(config);
}

/**
 * Build a `fetch` that applies a per-request timeout signal (and an optional
 * undici dispatcher for TLS-skip).
 */
function makeFetch(timeoutMs: number, dispatcher: Agent | undefined): typeof fetch {
  return (input, init) => {
    const requestInit = {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      ...(dispatcher ? { dispatcher } : {}),
    } as RequestInit & { dispatcher?: Agent };
    return fetch(input, requestInit);
  };
}
