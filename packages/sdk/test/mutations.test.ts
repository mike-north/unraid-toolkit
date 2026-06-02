/**
 * Integration tests for Phase 2 control (mutation) operations.
 *
 * Each test drives the real client transport against an msw-mocked GraphQL
 * endpoint whose responses are shaped to the vendored Unraid SDL. Assertions are
 * structural and trace to specific schema fields.
 *
 * @see https://docs.unraid.net/API/
 * @see https://github.com/unraid/api
 */

import { describe, it, expect } from 'vitest';
import { server, testClient, graphql, HttpResponse } from './helpers.js';
import {
  startContainer,
  stopContainer,
  pauseContainer,
  unpauseContainer,
  updateContainer,
  updateAllContainers,
  startVm,
  stopVm,
  pauseVm,
  resumeVm,
  createNotification,
  archiveNotification,
  unarchiveNotification,
  UnraidErrorCode,
} from '../src/index.js';

const client = testClient();

const containerState = {
  id: 'c1',
  names: ['/plex'],
  image: 'plex:latest',
  state: 'RUNNING',
  status: 'Up 1 second',
};

describe('docker control', () => {
  it('starts a container and returns its resulting state', async () => {
    server.use(
      graphql.mutation('StartContainer', () =>
        HttpResponse.json({ data: { docker: { start: containerState } } }),
      ),
    );
    const result = await startContainer(client, 'c1');
    expect(result.success).toBe(true);
    // SDL: DockerMutations.start(id) -> DockerContainer (state is a ContainerState enum)
    if (result.success) expect(result.data.state).toBe('RUNNING');
  });

  it('maps a GraphQL error to API_ERROR', async () => {
    server.use(
      graphql.mutation('StopContainer', () =>
        HttpResponse.json({ errors: [{ message: 'no such container' }] }),
      ),
    );
    const result = await stopContainer(client, 'ghost');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe(UnraidErrorCode.API_ERROR);
  });

  it('updates all containers and returns the updated set', async () => {
    server.use(
      graphql.mutation('UpdateAllContainers', () =>
        HttpResponse.json({
          data: {
            docker: { updateAllContainers: [containerState, { ...containerState, id: 'c2' }] },
          },
        }),
      ),
    );
    const result = await updateAllContainers(client);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(2);
  });

  const containerCases = [
    { name: 'pauseContainer', op: pauseContainer, mutation: 'PauseContainer', field: 'pause' },
    {
      name: 'unpauseContainer',
      op: unpauseContainer,
      mutation: 'UnpauseContainer',
      field: 'unpause',
    },
    {
      name: 'updateContainer',
      op: updateContainer,
      mutation: 'UpdateContainer',
      field: 'updateContainer',
    },
  ] as const;

  for (const { name, op, mutation, field } of containerCases) {
    it(`${name} returns the resulting container state`, async () => {
      server.use(
        graphql.mutation(mutation, () =>
          HttpResponse.json({ data: { docker: { [field]: containerState } } }),
        ),
      );
      const result = await op(client, 'c1');
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.id).toBe('c1');
    });
  }
});

describe('vm control', () => {
  it('returns an action result reflecting hypervisor acceptance', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation('StartVm', ({ variables }) => {
        captured = variables;
        // SDL: VmMutations.start(id) -> Boolean!
        return HttpResponse.json({ data: { vm: { start: true } } });
      }),
    );
    const result = await startVm(client, 'vm-1');
    expect(captured).toMatchObject({ id: 'vm-1' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ id: 'vm-1', action: 'start', accepted: true });
    }
  });

  it('reports accepted=false when the hypervisor rejects', async () => {
    server.use(
      graphql.mutation('StartVm', () => HttpResponse.json({ data: { vm: { start: false } } })),
    );
    const result = await startVm(client, 'vm-1');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.accepted).toBe(false);
  });

  const vmCases = [
    { name: 'stopVm', op: stopVm, mutation: 'StopVm', field: 'stop', action: 'stop' },
    { name: 'pauseVm', op: pauseVm, mutation: 'PauseVm', field: 'pause', action: 'pause' },
    { name: 'resumeVm', op: resumeVm, mutation: 'ResumeVm', field: 'resume', action: 'resume' },
  ] as const;

  for (const { name, op, mutation, field, action } of vmCases) {
    it(`${name} forwards the id and shapes the action result`, async () => {
      server.use(
        graphql.mutation(mutation, () => HttpResponse.json({ data: { vm: { [field]: true } } })),
      );
      const result = await op(client, 'vm-1');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accepted).toBe(true);
        expect(result.data.action).toBe(action);
      }
    });
  }
});

describe('notification control', () => {
  const created = {
    id: 'n1',
    title: 'Backup done',
    subject: 'Nightly backup',
    description: 'completed',
    importance: 'INFO',
    type: 'UNREAD',
    timestamp: '2026-01-01T00:00:00Z',
    formattedTimestamp: 'Jan 1',
  };

  it('forwards the input and omits link when not provided', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation('CreateNotification', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({ data: { createNotification: created } });
      }),
    );
    const result = await createNotification(client, {
      title: 'Backup done',
      subject: 'Nightly backup',
      description: 'completed',
      importance: 'INFO',
    });
    // SDL: NotificationData { title!, subject!, description!, importance!, link }
    expect(captured).toEqual({
      input: {
        title: 'Backup done',
        subject: 'Nightly backup',
        description: 'completed',
        importance: 'INFO',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.id).toBe('n1');
  });

  it('includes link when provided', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.mutation('CreateNotification', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({ data: { createNotification: created } });
      }),
    );
    await createNotification(client, {
      title: 't',
      subject: 's',
      description: 'd',
      importance: 'WARNING',
      link: 'https://example.test',
    });
    expect(captured).toMatchObject({
      input: { link: 'https://example.test', importance: 'WARNING' },
    });
  });

  it('archives a notification', async () => {
    server.use(
      graphql.mutation('ArchiveNotification', () =>
        HttpResponse.json({ data: { archiveNotification: { ...created, type: 'ARCHIVE' } } }),
      ),
    );
    const result = await archiveNotification(client, 'n1');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('ARCHIVE');
  });

  it('unarchives a notification via the unreadNotification field', async () => {
    server.use(
      graphql.mutation('UnarchiveNotification', () =>
        HttpResponse.json({ data: { unreadNotification: { ...created, type: 'UNREAD' } } }),
      ),
    );
    const result = await unarchiveNotification(client, 'n1');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('UNREAD');
  });
});
