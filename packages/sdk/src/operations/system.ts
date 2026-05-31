/**
 * System / connection operations.
 *
 * Covers the lightweight connection-health probe plus the richer read-only
 * `getSystemInfo` (static identity: OS, CPU, memory layout, board, versions) and
 * `getSystemMetrics` (live CPU/memory utilization) operations.
 *
 * @see https://docs.unraid.net/API/
 */

import { gql } from 'graphql-request';
import type { UnraidClient } from '../client.js';
import { toUnraidError } from '../errors.js';
import { type UnraidResult, success, failure } from '../result.js';
import type { HealthInfo } from '../types.js';
import type { GetSystemInfoQuery, GetSystemMetricsQuery } from '../unraid/generated.js';

/** Static system information (OS, CPU, memory layout, board, versions). */
export type SystemInfo = GetSystemInfoQuery['info'];

/** Live system utilization metrics (CPU and memory). */
export type SystemMetrics = GetSystemMetricsQuery['metrics'];

/**
 * Probe the Unraid API for reachability and authentication.
 *
 * Uses the always-valid `{ __typename }` query — it confirms the endpoint
 * responds and the API key is accepted without depending on any
 * Unraid-specific schema fields. A failed probe returns a failure envelope
 * whose error explains why (auth, network, etc.).
 */
export async function getHealth(client: UnraidClient): Promise<UnraidResult<HealthInfo>> {
  try {
    await client.request<{ __typename: string }>('query Health { __typename }');
    return success({ endpoint: client.endpoint });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const SYSTEM_INFO_QUERY = gql`
  query GetSystemInfo {
    info {
      time
      os {
        platform
        distro
        release
        codename
        kernel
        arch
        hostname
        uptime
        uefi
      }
      cpu {
        manufacturer
        brand
        vendor
        family
        model
        cores
        threads
        processors
        socket
        speed
        speedmax
      }
      memory {
        layout {
          size
          bank
          type
          clockSpeed
          manufacturer
          partNum
        }
      }
      baseboard {
        manufacturer
        model
        version
        serial
        memMax
        memSlots
      }
      system {
        manufacturer
        model
        version
        serial
        uuid
        sku
        virtual
      }
      versions {
        core {
          unraid
          api
          kernel
        }
        packages {
          docker
          node
          npm
          php
          nginx
        }
      }
    }
  }
`;

/** Retrieve static system information for the connected Unraid server. */
export async function getSystemInfo(client: UnraidClient): Promise<UnraidResult<SystemInfo>> {
  try {
    const data = await client.request<GetSystemInfoQuery>(SYSTEM_INFO_QUERY);
    return success(data.info);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const SYSTEM_METRICS_QUERY = gql`
  query GetSystemMetrics {
    metrics {
      cpu {
        percentTotal
        cpus {
          percentTotal
          percentUser
          percentSystem
          percentIdle
        }
      }
      memory {
        total
        used
        free
        available
        active
        buffcache
        percentTotal
        swapTotal
        swapUsed
        swapFree
        percentSwapTotal
      }
    }
  }
`;

/** Retrieve live CPU and memory utilization metrics. */
export async function getSystemMetrics(client: UnraidClient): Promise<UnraidResult<SystemMetrics>> {
  try {
    const data = await client.request<GetSystemMetricsQuery>(SYSTEM_METRICS_QUERY);
    return success(data.metrics);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
