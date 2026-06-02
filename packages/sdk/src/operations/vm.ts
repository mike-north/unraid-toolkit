/**
 * Virtual machine operations.
 *
 * `listVms` enumerates the libvirt domains known to Unraid with their current
 * run state (read). The `*Vm` control operations are Phase 2 "safe" lifecycle
 * writes — start/stop/pause/resume — each returning whether the request was
 * accepted by the hypervisor.
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
  ListVmsQuery,
  StartVmMutation,
  StopVmMutation,
  PauseVmMutation,
  ResumeVmMutation,
  ForceStopVmMutation,
  RebootVmMutation,
  ResetVmMutation,
} from '../unraid/generated.js';

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

/** Every VM lifecycle action, safe (Phase 2) and destructive (Phase 3). */
export type VmAction = 'start' | 'stop' | 'pause' | 'resume' | 'forceStop' | 'reboot' | 'reset';

/** A virtual-machine lifecycle action and whether the hypervisor accepted it. */
export interface VmActionResult {
  /** The VM id the action targeted. */
  readonly id: string;
  /** The lifecycle action requested. */
  readonly action: VmAction;
  /** Whether the hypervisor accepted the request. */
  readonly accepted: boolean;
}

/** Run a VM lifecycle mutation and wrap it in the result envelope. */
async function execVmAction(
  id: string,
  action: VmAction,
  run: () => Promise<boolean>,
): Promise<UnraidResult<VmActionResult>> {
  try {
    const accepted = await run();
    return success({ id, action, accepted });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const START_VM_MUTATION = gql`
  mutation StartVm($id: PrefixedID!) {
    vm {
      start(id: $id)
    }
  }
`;

/** Start a virtual machine. */
export async function startVm(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<VmActionResult>> {
  return execVmAction(id, 'start', async () => {
    const data = await client.request<StartVmMutation>(START_VM_MUTATION, { id });
    return data.vm.start;
  });
}

const STOP_VM_MUTATION = gql`
  mutation StopVm($id: PrefixedID!) {
    vm {
      stop(id: $id)
    }
  }
`;

/** Gracefully stop a virtual machine. */
export async function stopVm(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<VmActionResult>> {
  return execVmAction(id, 'stop', async () => {
    const data = await client.request<StopVmMutation>(STOP_VM_MUTATION, { id });
    return data.vm.stop;
  });
}

const PAUSE_VM_MUTATION = gql`
  mutation PauseVm($id: PrefixedID!) {
    vm {
      pause(id: $id)
    }
  }
`;

/** Pause a running virtual machine. */
export async function pauseVm(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<VmActionResult>> {
  return execVmAction(id, 'pause', async () => {
    const data = await client.request<PauseVmMutation>(PAUSE_VM_MUTATION, { id });
    return data.vm.pause;
  });
}

const RESUME_VM_MUTATION = gql`
  mutation ResumeVm($id: PrefixedID!) {
    vm {
      resume(id: $id)
    }
  }
`;

/** Resume a paused virtual machine. */
export async function resumeVm(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<VmActionResult>> {
  return execVmAction(id, 'resume', async () => {
    const data = await client.request<ResumeVmMutation>(RESUME_VM_MUTATION, { id });
    return data.vm.resume;
  });
}

// --- Phase 3: destructive VM control ------------------------------------------

const FORCE_STOP_VM_MUTATION = gql`
  mutation ForceStopVm($id: PrefixedID!) {
    vm {
      forceStop(id: $id)
    }
  }
`;

/**
 * Force-stop a virtual machine (ungraceful power-off). Destructive — risks data
 * loss in the guest. Approval-gated.
 */
export async function forceStopVm(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<VmActionResult>> {
  return execVmAction(id, 'forceStop', async () => {
    const data = await client.request<ForceStopVmMutation>(FORCE_STOP_VM_MUTATION, { id });
    return data.vm.forceStop;
  });
}

const REBOOT_VM_MUTATION = gql`
  mutation RebootVm($id: PrefixedID!) {
    vm {
      reboot(id: $id)
    }
  }
`;

/** Reboot a virtual machine. Destructive; approval-gated. */
export async function rebootVm(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<VmActionResult>> {
  return execVmAction(id, 'reboot', async () => {
    const data = await client.request<RebootVmMutation>(REBOOT_VM_MUTATION, { id });
    return data.vm.reboot;
  });
}

const RESET_VM_MUTATION = gql`
  mutation ResetVm($id: PrefixedID!) {
    vm {
      reset(id: $id)
    }
  }
`;

/**
 * Reset a virtual machine (hard reset, equivalent to the reset button).
 * Destructive — risks data loss in the guest. Approval-gated.
 */
export async function resetVm(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<VmActionResult>> {
  return execVmAction(id, 'reset', async () => {
    const data = await client.request<ResetVmMutation>(RESET_VM_MUTATION, { id });
    return data.vm.reset;
  });
}
