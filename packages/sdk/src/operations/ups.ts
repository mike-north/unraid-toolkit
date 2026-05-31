/**
 * UPS (uninterruptible power supply) operations.
 *
 * `getUpsStatus` lists the connected UPS devices with battery and power
 * telemetry. The result is windowed with {@link paginateList} (most systems have
 * a single UPS, but multiple are supported).
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
import type { GetUpsStatusQuery } from '../unraid/generated.js';

/** A UPS device with battery and power telemetry. */
export type UpsDevice = GetUpsStatusQuery['upsDevices'][number];

const UPS_STATUS_QUERY = gql`
  query GetUpsStatus {
    upsDevices {
      id
      name
      model
      status
      battery {
        chargeLevel
        estimatedRuntime
        health
      }
      power {
        inputVoltage
        outputVoltage
        loadPercentage
        nominalPower
        currentPower
      }
    }
  }
`;

/** Retrieve connected UPS devices and their telemetry, windowed by `limit`/`offset`. */
export async function getUpsStatus(
  client: UnraidClient,
  pagination: PaginationParams = {},
): Promise<UnraidResult<PaginatedList<UpsDevice>>> {
  const invalid = validatePagination(pagination);
  if (invalid) return failure(invalid);

  try {
    const data = await client.request<GetUpsStatusQuery>(UPS_STATUS_QUERY);
    return success(paginateList(data.upsDevices, pagination));
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
