/**
 * Domain model types for the Unraid SDK.
 *
 * Hand-written to mirror the Unraid GraphQL schema. As read/control operations
 * are added, their result types live here (or in per-domain modules).
 */

/** Result of a successful connection-health probe. */
export interface HealthInfo {
  /** The GraphQL endpoint that responded and accepted the API key. */
  readonly endpoint: string;
}
