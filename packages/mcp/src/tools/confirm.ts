/**
 * Shared MCP input fragment for the confirmation-token gate.
 *
 * Destructive tools accept an optional `confirm_token`. On a client without
 * elicitation, the first call returns a token; the caller re-invokes with it to
 * proceed. Elicitation-capable clients ignore this field (approval happens
 * interactively).
 */

import { z } from 'zod';

/** Adds the optional `confirm_token` field to a destructive tool's input. */
export const CONFIRM_TOKEN_INPUT = {
  confirm_token: z
    .string()
    .optional()
    .describe(
      'Confirmation token from a prior call (token-gate fallback for clients without elicitation). Omit on the first call; re-invoke with the returned token to approve.',
    ),
};
