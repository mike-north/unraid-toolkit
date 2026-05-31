/**
 * User-share operations.
 *
 * `listShares` enumerates the Unraid user shares with capacity, inclusion rules,
 * and allocation settings. The result is windowed with {@link paginateList}.
 *
 * @see https://docs.unraid.net/API/
 */

import { gql } from 'graphql-request';
import type { UnraidClient } from '../client.js';
import { toUnraidError } from '../errors.js';
import { type UnraidResult, success, failure } from '../result.js';
import {
  type PaginationParams,
  type PaginatedList,
  paginateList,
  validatePagination,
} from '../pagination.js';
import type { ListSharesQuery } from '../unraid/generated.js';

/** An Unraid user share. */
export type ShareSummary = ListSharesQuery['shares'][number];

const LIST_SHARES_QUERY = gql`
  query ListShares {
    shares {
      id
      name
      comment
      free
      used
      size
      include
      exclude
      cache
      nameOrig
      allocator
      splitLevel
      floor
      cow
      color
      luksStatus
    }
  }
`;

/** List user shares, windowed by `limit`/`offset`. */
export async function listShares(
  client: UnraidClient,
  pagination: PaginationParams = {},
): Promise<UnraidResult<PaginatedList<ShareSummary>>> {
  const invalid = validatePagination(pagination);
  if (invalid) return failure(invalid);

  try {
    const data = await client.request<ListSharesQuery>(LIST_SHARES_QUERY);
    return success(paginateList(data.shares, pagination));
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
