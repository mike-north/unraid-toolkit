/**
 * Physical disk operations.
 *
 * `listDisks` enumerates the physical disks attached to the server, including
 * temperature and SMART status where the API exposes them. The result is
 * windowed with {@link paginateList}.
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
import type { ListDisksQuery } from '../unraid/generated.js';

/** A physical disk attached to the server. */
export type PhysicalDisk = ListDisksQuery['disks'][number];

const LIST_DISKS_QUERY = gql`
  query ListDisks {
    disks {
      id
      device
      type
      name
      vendor
      size
      temperature
      smartStatus
      interfaceType
      isSpinning
      firmwareRevision
      serialNum
      bytesPerSector
      partitions {
        name
        fsType
        size
      }
    }
  }
`;

/** Retrieve the physical disks attached to the server, windowed by `limit`/`offset`. */
export async function listDisks(
  client: UnraidClient,
  pagination: PaginationParams = {},
): Promise<UnraidResult<PaginatedList<PhysicalDisk>>> {
  const invalid = validatePagination(pagination);
  if (invalid) return failure(invalid);

  try {
    const data = await client.request<ListDisksQuery>(LIST_DISKS_QUERY);
    return success(paginateList(data.disks, pagination));
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
