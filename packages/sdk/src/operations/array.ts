/**
 * Array & parity operations.
 *
 * `getArrayStatus` reports the array state, capacity, parity-check status, and
 * per-slot disks (parity/data/cache/boot). `getParityHistory` returns past
 * parity checks, windowed with {@link paginateList}.
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
import type { GetArrayStatusQuery, GetParityHistoryQuery } from '../unraid/generated.js';

/** Current array state, capacity, parity status, and member disks. */
export type ArrayStatus = GetArrayStatusQuery['array'];

/** A single historical parity check. */
export type ParityHistoryEntry = GetParityHistoryQuery['parityHistory'][number];

const ARRAY_STATUS_QUERY = gql`
  query GetArrayStatus {
    array {
      state
      capacity {
        kilobytes {
          free
          used
          total
        }
        disks {
          free
          used
          total
        }
      }
      parityCheckStatus {
        status
        progress
        speed
        errors
        date
        duration
        correcting
        paused
        running
      }
      parities {
        id
        idx
        name
        device
        size
        status
        temp
        type
        fsType
        color
        isSpinning
      }
      disks {
        id
        idx
        name
        device
        size
        status
        temp
        rotational
        fsType
        fsSize
        fsFree
        fsUsed
        type
        warning
        critical
        color
        isSpinning
        numReads
        numWrites
        numErrors
      }
      caches {
        id
        idx
        name
        device
        size
        status
        temp
        fsType
        fsSize
        fsFree
        fsUsed
        type
        color
        isSpinning
      }
      boot {
        id
        name
        device
        size
        type
      }
    }
  }
`;

/** Retrieve the current array status (state, capacity, parity, disks). */
export async function getArrayStatus(client: UnraidClient): Promise<UnraidResult<ArrayStatus>> {
  try {
    const data = await client.request<GetArrayStatusQuery>(ARRAY_STATUS_QUERY);
    return success(data.array);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const PARITY_HISTORY_QUERY = gql`
  query GetParityHistory {
    parityHistory {
      date
      duration
      speed
      status
      errors
      progress
      correcting
      paused
      running
    }
  }
`;

/** Retrieve the parity-check history, windowed by `limit`/`offset`. */
export async function getParityHistory(
  client: UnraidClient,
  pagination: PaginationParams = {},
): Promise<UnraidResult<PaginatedList<ParityHistoryEntry>>> {
  const invalid = validatePagination(pagination);
  if (invalid) return failure(invalid);

  try {
    const data = await client.request<GetParityHistoryQuery>(PARITY_HISTORY_QUERY);
    return success(paginateList(data.parityHistory, pagination));
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
