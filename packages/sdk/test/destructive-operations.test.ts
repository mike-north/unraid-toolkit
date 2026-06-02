/**
 * Integration tests for Phase 3 destructive (mutation) operations.
 *
 * Each drives the real client transport against an msw-mocked GraphQL endpoint
 * shaped to the vendored Unraid SDL. Assertions trace to specific schema fields.
 *
 * @see https://docs.unraid.net/API/
 * @see https://github.com/unraid/api
 */

import { describe, it, expect } from 'vitest';
import { server, testClient, graphql, HttpResponse } from './helpers.js';
import {
  setArrayState,
  addDiskToArray,
  removeDiskFromArray,
  mountArrayDisk,
  unmountArrayDisk,
  startParityCheck,
  pauseParityCheck,
  resumeParityCheck,
  cancelParityCheck,
  removeContainer,
  forceStopVm,
  rebootVm,
  resetVm,
  UnraidErrorCode,
} from '../src/index.js';

const client = testClient();

describe('array state control', () => {
  it('forwards desiredState and returns the array state', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation('SetArrayState', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({
          data: {
            array: {
              setState: {
                state: 'STOPPED',
                capacity: { kilobytes: { free: '1', used: '2', total: '3' } },
              },
            },
          },
        });
      }),
    );
    const result = await setArrayState(client, 'STOP');
    // SDL: ArrayMutations.setState(input: ArrayStateInput{ desiredState })
    expect(captured).toEqual({ input: { desiredState: 'STOP' } });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.state).toBe('STOPPED');
  });

  it('maps a GraphQL error to API_ERROR', async () => {
    server.use(
      graphql.mutation('SetArrayState', () =>
        HttpResponse.json({ errors: [{ message: 'array busy' }] }),
      ),
    );
    const result = await setArrayState(client, 'START');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe(UnraidErrorCode.API_ERROR);
  });
});

describe('array disk membership', () => {
  it('adds a disk with an explicit slot', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation('AddDiskToArray', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({ data: { array: { addDiskToArray: { state: 'STARTED' } } } });
      }),
    );
    const result = await addDiskToArray(client, 'disk-1', 2);
    expect(captured).toEqual({ input: { id: 'disk-1', slot: 2 } });
    expect(result.success).toBe(true);
  });

  it('omits slot when not provided', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation('RemoveDiskFromArray', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({
          data: { array: { removeDiskFromArray: { state: 'STOPPED' } } },
        });
      }),
    );
    await removeDiskFromArray(client, 'disk-1');
    expect(captured).toEqual({ input: { id: 'disk-1' } });
  });

  it('mounts and unmounts a disk', async () => {
    server.use(
      graphql.mutation('MountArrayDisk', () =>
        HttpResponse.json({
          data: { array: { mountArrayDisk: { id: 'd1', name: 'disk1', status: 'DISK_OK' } } },
        }),
      ),
      graphql.mutation('UnmountArrayDisk', () =>
        HttpResponse.json({
          data: { array: { unmountArrayDisk: { id: 'd1', name: 'disk1', status: 'DISK_OK' } } },
        }),
      ),
    );
    expect((await mountArrayDisk(client, 'd1')).success).toBe(true);
    expect((await unmountArrayDisk(client, 'd1')).success).toBe(true);
  });
});

describe('parity-check control', () => {
  it('forwards correct=true and shapes a start result', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation('StartParityCheck', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({ data: { parityCheck: { start: {} } } });
      }),
    );
    const result = await startParityCheck(client, true);
    // SDL: ParityCheckMutations.start(correct: Boolean!)
    expect(captured).toEqual({ correct: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe('start');
      expect(result.data.correcting).toBe(true);
    }
  });

  it('pauses, resumes, and cancels', async () => {
    server.use(
      graphql.mutation('PauseParityCheck', () =>
        HttpResponse.json({ data: { parityCheck: { pause: {} } } }),
      ),
      graphql.mutation('ResumeParityCheck', () =>
        HttpResponse.json({ data: { parityCheck: { resume: {} } } }),
      ),
      graphql.mutation('CancelParityCheck', () =>
        HttpResponse.json({ data: { parityCheck: { cancel: {} } } }),
      ),
    );
    expect((await pauseParityCheck(client)).success).toBe(true);
    expect((await resumeParityCheck(client)).success).toBe(true);
    const cancelled = await cancelParityCheck(client);
    expect(cancelled.success).toBe(true);
    if (cancelled.success) expect(cancelled.data.action).toBe('cancel');
  });
});

describe('container removal', () => {
  it('forwards id + withImage and reports removal', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation('RemoveContainer', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({ data: { docker: { removeContainer: true } } });
      }),
    );
    const result = await removeContainer(client, 'c1', true);
    // SDL: DockerMutations.removeContainer(id, withImage)
    expect(captured).toEqual({ id: 'c1', withImage: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: 'c1', withImage: true, removed: true });
    }
  });

  it('defaults withImage to false', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation('RemoveContainer', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({ data: { docker: { removeContainer: true } } });
      }),
    );
    await removeContainer(client, 'c1');
    expect(captured).toEqual({ id: 'c1', withImage: false });
  });
});

describe('destructive VM control', () => {
  it.each([
    ['forceStop', forceStopVm, 'ForceStopVm', 'forceStop'],
    ['reboot', rebootVm, 'RebootVm', 'reboot'],
    ['reset', resetVm, 'ResetVm', 'reset'],
  ] as const)('%s shapes the action result', async (action, op, mutation, field) => {
    server.use(
      graphql.mutation(mutation, () => HttpResponse.json({ data: { vm: { [field]: true } } })),
    );
    const result = await op(client, 'vm-1');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.action).toBe(action);
      expect(result.data.accepted).toBe(true);
    }
  });
});
