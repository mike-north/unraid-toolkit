/**
 * Structured error model for the Unraid SDK.
 *
 * The SDK never leaks transport-specific exceptions to callers: operations
 * catch failures and convert them into a plain {@link UnraidError} (carried by
 * the failure branch of {@link ./result.UnraidResult}). Wrappers render this
 * uniformly without knowing about GraphQL or HTTP.
 */

import { ClientError } from 'graphql-request';

/** Semantic error categories returned by SDK operations. */
export const UnraidErrorCode = {
  /** API key missing, invalid, or lacking the required scope (HTTP 401/403). */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** The endpoint could not be reached (network, DNS, TLS, timeout). */
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  /** The API responded with a GraphQL or HTTP error. */
  API_ERROR: 'API_ERROR',
  /** Caller-supplied input failed validation before any request was made. */
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  /** An unexpected, uncategorized failure. */
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type UnraidErrorCode = (typeof UnraidErrorCode)[keyof typeof UnraidErrorCode];

/** A plain, serializable error describing why an operation failed. */
export interface UnraidError {
  readonly code: UnraidErrorCode;
  readonly message: string;
  readonly details?: string;
}

/** Construct an {@link UnraidError}, omitting `details` when not provided. */
export function createError(code: UnraidErrorCode, message: string, details?: string): UnraidError {
  return details === undefined ? { code, message } : { code, message, details };
}

/**
 * Convert an unknown thrown value into a structured {@link UnraidError} with an
 * agent-actionable message.
 */
export function toUnraidError(error: unknown): UnraidError {
  if (error instanceof ClientError) {
    const status = error.response.status;
    const gqlMessage = error.response.errors?.map((e) => e.message).join('; ');
    if (status === 401 || status === 403) {
      return createError(
        UnraidErrorCode.UNAUTHORIZED,
        `Authentication failed (HTTP ${String(status)}). Check the API key and its scopes.`,
        gqlMessage,
      );
    }
    if (gqlMessage !== undefined && gqlMessage.length > 0) {
      return createError(UnraidErrorCode.API_ERROR, gqlMessage, `HTTP ${String(status)}`);
    }
    return createError(
      UnraidErrorCode.API_ERROR,
      `Unraid API request failed (HTTP ${String(status)}).`,
    );
  }
  if (error instanceof Error) {
    return createError(
      UnraidErrorCode.CONNECTION_FAILED,
      `Could not reach the Unraid API: ${error.message}`,
    );
  }
  return createError(UnraidErrorCode.UNKNOWN_ERROR, String(error));
}
