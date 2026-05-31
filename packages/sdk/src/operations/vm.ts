/**
 * Virtual machine operations.
 *
 * `listVms` enumerates the libvirt domains known to Unraid with their current
 * run state. The result is windowed with {@link paginateList}.
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
import type { ListVmsQuery } from '../unraid/generated.js';

/** A virtual machine (libvirt domain) and its current state. */
export type VmSummary = NonNullable<ListVmsQuery['vms']['domains']>[number];

const LIST_VMS_QUERY = gql`
  query ListVms {
    vms {
      domains {
        id
        name
        state
      }
    }
  }
`;

/** List virtual machines, windowed by `limit`/`offset`. */
export async function listVms(
  client: UnraidClient,
  pagination: PaginationParams = {},
): Promise<UnraidResult<PaginatedList<VmSummary>>> {
  const invalid = validatePagination(pagination);
  if (invalid) return failure(invalid);

  try {
    const data = await client.request<ListVmsQuery>(LIST_VMS_QUERY);
    return success(paginateList(data.vms.domains ?? [], pagination));
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
