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
import type {
  GetArrayStatusQuery,
  GetParityHistoryQuery,
  SetArrayStateMutation,
  AddDiskToArrayMutation,
  RemoveDiskFromArrayMutation,
  MountArrayDiskMutation,
  UnmountArrayDiskMutation,
  StartParityCheckMutation,
  PauseParityCheckMutation,
  ResumeParityCheckMutation,
  CancelParityCheckMutation,
} from '../unraid/generated.js';

/** Current array state, capacity, parity status, and member disks. */
export type ArrayStatus = GetArrayStatusQuery['array'];

/** A single historical parity check. */
export type ParityHistoryEntry = GetParityHistoryQuery['parityHistory'][number];

/** The array (state + capacity) as returned by `setArrayState`. */
export type ArrayMutationResult = SetArrayStateMutation['array']['setState'];

/** The array (state only) as returned by add/remove-disk mutations. */
export type ArrayDiskChangeResult = AddDiskToArrayMutation['array']['addDiskToArray'];

/** An array disk as returned by a mount/unmount mutation. */
export type ArrayDiskMutationResult = MountArrayDiskMutation['array']['mountArrayDisk'];

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

// --- Phase 3: destructive array & parity control ------------------------------

/** Compact array selection returned by array-mutating operations. */
const SET_ARRAY_STATE_MUTATION = gql`
  mutation SetArrayState($input: ArrayStateInput!) {
    array {
      setState(input: $input) {
        state
        capacity {
          kilobytes {
            free
            used
            total
          }
        }
      }
    }
  }
`;

/**
 * Start or stop the array. `desired` is `START` or `STOP`.
 *
 * Destructive: stopping the array takes all shares and Docker/VM services
 * offline. Wrappers gate this behind explicit human approval.
 */
export async function setArrayState(
  client: UnraidClient,
  desired: 'START' | 'STOP',
): Promise<UnraidResult<ArrayMutationResult>> {
  try {
    const data = await client.request<SetArrayStateMutation>(SET_ARRAY_STATE_MUTATION, {
      input: { desiredState: desired },
    });
    return success(data.array.setState);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const ADD_DISK_TO_ARRAY_MUTATION = gql`
  mutation AddDiskToArray($input: ArrayDiskInput!) {
    array {
      addDiskToArray(input: $input) {
        state
      }
    }
  }
`;

/** Add a disk to the array at an optional slot. Destructive; approval-gated. */
export async function addDiskToArray(
  client: UnraidClient,
  diskId: string,
  slot?: number,
): Promise<UnraidResult<ArrayDiskChangeResult>> {
  try {
    const data = await client.request<AddDiskToArrayMutation>(ADD_DISK_TO_ARRAY_MUTATION, {
      input: slot === undefined ? { id: diskId } : { id: diskId, slot },
    });
    return success(data.array.addDiskToArray);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const REMOVE_DISK_FROM_ARRAY_MUTATION = gql`
  mutation RemoveDiskFromArray($input: ArrayDiskInput!) {
    array {
      removeDiskFromArray(input: $input) {
        state
      }
    }
  }
`;

/**
 * Remove a disk from the array. The array must be stopped first or the API
 * errors. Destructive; approval-gated.
 */
export async function removeDiskFromArray(
  client: UnraidClient,
  diskId: string,
  slot?: number,
): Promise<UnraidResult<ArrayDiskChangeResult>> {
  try {
    const data = await client.request<RemoveDiskFromArrayMutation>(
      REMOVE_DISK_FROM_ARRAY_MUTATION,
      {
        input: slot === undefined ? { id: diskId } : { id: diskId, slot },
      },
    );
    return success(data.array.removeDiskFromArray);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const MOUNT_ARRAY_DISK_MUTATION = gql`
  mutation MountArrayDisk($id: PrefixedID!) {
    array {
      mountArrayDisk(id: $id) {
        id
        name
        status
      }
    }
  }
`;

/** Mount a single array disk. Destructive; approval-gated. */
export async function mountArrayDisk(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<ArrayDiskMutationResult>> {
  try {
    const data = await client.request<MountArrayDiskMutation>(MOUNT_ARRAY_DISK_MUTATION, { id });
    return success(data.array.mountArrayDisk);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const UNMOUNT_ARRAY_DISK_MUTATION = gql`
  mutation UnmountArrayDisk($id: PrefixedID!) {
    array {
      unmountArrayDisk(id: $id) {
        id
        name
        status
      }
    }
  }
`;

/** Unmount a single array disk. Destructive; approval-gated. */
export async function unmountArrayDisk(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<ArrayDiskMutationResult>> {
  try {
    const data = await client.request<UnmountArrayDiskMutation>(UNMOUNT_ARRAY_DISK_MUTATION, {
      id,
    });
    return success(data.array.unmountArrayDisk);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

/** A parity-check lifecycle action. */
export type ParityAction = 'start' | 'pause' | 'resume' | 'cancel';

/** Result of a parity-check control mutation. */
export interface ParityActionResult {
  /** The action performed. */
  readonly action: ParityAction;
  /** For `start`, whether the check writes corrections to parity. */
  readonly correcting?: boolean;
  /**
   * Whether the server accepted the request. The parity mutations return an
   * opaque JSON payload with no documented shape, so this is `true` whenever the
   * request completed without error (it does not surface the raw payload).
   */
  readonly acknowledged: boolean;
}

const START_PARITY_CHECK_MUTATION = gql`
  mutation StartParityCheck($correct: Boolean!) {
    parityCheck {
      start(correct: $correct)
    }
  }
`;

/**
 * Start a parity check. `correct: true` writes corrections to parity (a
 * correcting check); `false` runs a read-only check. Destructive; approval-gated.
 */
export async function startParityCheck(
  client: UnraidClient,
  correct: boolean,
): Promise<UnraidResult<ParityActionResult>> {
  try {
    await client.request<StartParityCheckMutation>(START_PARITY_CHECK_MUTATION, { correct });
    return success({ action: 'start', correcting: correct, acknowledged: true });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const PAUSE_PARITY_CHECK_MUTATION = gql`
  mutation PauseParityCheck {
    parityCheck {
      pause
    }
  }
`;

/** Pause a running parity check. Approval-gated. */
export async function pauseParityCheck(
  client: UnraidClient,
): Promise<UnraidResult<ParityActionResult>> {
  try {
    await client.request<PauseParityCheckMutation>(PAUSE_PARITY_CHECK_MUTATION);
    return success({ action: 'pause', acknowledged: true });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const RESUME_PARITY_CHECK_MUTATION = gql`
  mutation ResumeParityCheck {
    parityCheck {
      resume
    }
  }
`;

/** Resume a paused parity check. Approval-gated. */
export async function resumeParityCheck(
  client: UnraidClient,
): Promise<UnraidResult<ParityActionResult>> {
  try {
    await client.request<ResumeParityCheckMutation>(RESUME_PARITY_CHECK_MUTATION);
    return success({ action: 'resume', acknowledged: true });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const CANCEL_PARITY_CHECK_MUTATION = gql`
  mutation CancelParityCheck {
    parityCheck {
      cancel
    }
  }
`;

/** Cancel a running parity check. Destructive; approval-gated. */
export async function cancelParityCheck(
  client: UnraidClient,
): Promise<UnraidResult<ParityActionResult>> {
  try {
    await client.request<CancelParityCheckMutation>(CANCEL_PARITY_CHECK_MUTATION);
    return success({ action: 'cancel', acknowledged: true });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
