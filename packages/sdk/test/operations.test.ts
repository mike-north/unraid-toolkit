/**
 * Integration tests for SDK read operations.
 *
 * Each test drives the real client transport against an msw-mocked GraphQL
 * endpoint whose responses are shaped to the vendored Unraid SDL. Assertions are
 * structural and trace to specific schema fields — never to captured program
 * output.
 *
 * @see https://docs.unraid.net/API/
 * @see https://github.com/unraid/api
 */

import { describe, it, expect } from 'vitest';
import { server, testClient, graphql, HttpResponse } from './helpers.js';
import {
  getHealth,
  getSystemInfo,
  getSystemMetrics,
  getArrayStatus,
  getParityHistory,
  listDisks,
  listContainers,
  getContainer,
  getContainerLogs,
  getUpdateStatuses,
  listVms,
  listShares,
  listNotifications,
  getNotificationOverview,
  getUpsStatus,
  UnraidErrorCode,
} from '../src/index.js';

const client = testClient();

describe('getHealth', () => {
  it('reports the endpoint on a successful probe', async () => {
    server.use(graphql.query('Health', () => HttpResponse.json({ data: { __typename: 'Query' } })));
    const result = await getHealth(client);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.endpoint).toContain('/graphql');
  });

  it('maps HTTP 401 to UNAUTHORIZED', async () => {
    server.use(
      graphql.query('Health', () =>
        HttpResponse.json({ errors: [{ message: 'no key' }] }, { status: 401 }),
      ),
    );
    const result = await getHealth(client);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe(UnraidErrorCode.UNAUTHORIZED);
  });

  it('maps GraphQL errors to API_ERROR', async () => {
    server.use(graphql.query('Health', () => HttpResponse.json({ errors: [{ message: 'boom' }] })));
    const result = await getHealth(client);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe(UnraidErrorCode.API_ERROR);
      expect(result.error.message).toContain('boom');
    }
  });

  it('maps a network failure to CONNECTION_FAILED', async () => {
    server.use(graphql.query('Health', () => HttpResponse.error()));
    const result = await getHealth(client);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe(UnraidErrorCode.CONNECTION_FAILED);
  });
});

describe('getSystemInfo', () => {
  it('returns OS, CPU, and version data', async () => {
    server.use(
      graphql.query('GetSystemInfo', () =>
        HttpResponse.json({
          data: {
            info: {
              time: '2026-01-01T00:00:00.000Z',
              os: {
                platform: 'linux',
                distro: 'Unraid',
                release: '7.2.0',
                kernel: '6.12',
                arch: 'x64',
                hostname: 'tower',
                codename: null,
                uptime: '1d',
                uefi: true,
              },
              cpu: {
                manufacturer: 'Intel',
                brand: 'i7',
                vendor: 'GenuineIntel',
                family: '6',
                model: '158',
                cores: 12,
                threads: 12,
                processors: 1,
                socket: 'LGA1151',
                speed: 3.2,
                speedmax: 4.6,
              },
              memory: {
                layout: [
                  {
                    size: 17179869184,
                    bank: 'BANK 0',
                    type: 'DDR4',
                    clockSpeed: 2666,
                    manufacturer: 'Corsair',
                    partNum: 'CMK',
                  },
                ],
              },
              baseboard: {
                manufacturer: 'ASUS',
                model: 'Z370',
                version: '1.0',
                serial: 'x',
                memMax: 68719476736,
                memSlots: 4,
              },
              system: {
                manufacturer: 'ASUS',
                model: 'x',
                version: '1',
                serial: 'x',
                uuid: 'u',
                sku: 's',
                virtual: false,
              },
              versions: {
                core: { unraid: '7.2.0', api: '4.0.0', kernel: '6.12' },
                packages: { docker: '27', node: '22', npm: '10', php: '8', nginx: '1.27' },
              },
            },
          },
        }),
      ),
    );
    const result = await getSystemInfo(client);
    expect(result.success).toBe(true);
    if (result.success) {
      // SDL: Info.os.distro / Info.versions.core.unraid
      expect(result.data.os.distro).toBe('Unraid');
      expect(result.data.versions.core.unraid).toBe('7.2.0');
      expect(result.data.cpu.cores).toBe(12);
    }
  });
});

describe('getSystemMetrics', () => {
  it('returns CPU and memory utilization', async () => {
    server.use(
      graphql.query('GetSystemMetrics', () =>
        HttpResponse.json({
          data: {
            metrics: {
              cpu: {
                percentTotal: 12.5,
                cpus: [{ percentTotal: 10, percentUser: 5, percentSystem: 3, percentIdle: 90 }],
              },
              memory: {
                total: 100,
                used: 40,
                free: 60,
                available: 60,
                active: 30,
                buffcache: 10,
                percentTotal: 40,
                swapTotal: 0,
                swapUsed: 0,
                swapFree: 0,
                percentSwapTotal: 0,
              },
            },
          },
        }),
      ),
    );
    const result = await getSystemMetrics(client);
    expect(result.success).toBe(true);
    // SDL: Metrics.cpu.percentTotal (CpuUtilization), Metrics.memory.percentTotal
    if (result.success) {
      expect(result.data.cpu?.percentTotal).toBe(12.5);
      expect(result.data.memory?.percentTotal).toBe(40);
    }
  });
});

describe('getArrayStatus', () => {
  it('returns array state and capacity', async () => {
    server.use(
      graphql.query('GetArrayStatus', () =>
        HttpResponse.json({
          data: {
            array: {
              state: 'STARTED',
              capacity: {
                kilobytes: { free: '100', used: '50', total: '150' },
                disks: { free: '1', used: '2', total: '3' },
              },
              parityCheckStatus: {
                status: 'COMPLETED',
                progress: 100,
                speed: '120',
                errors: 0,
                date: null,
                duration: 3600,
                correcting: false,
                paused: false,
                running: false,
              },
              parities: [],
              disks: [
                {
                  id: 'd1',
                  idx: 1,
                  name: 'disk1',
                  device: '/dev/sdb',
                  size: 1000,
                  status: 'DISK_OK',
                  temp: 35,
                  rotational: true,
                  fsType: 'xfs',
                  fsSize: 1000,
                  fsFree: 500,
                  fsUsed: 500,
                  type: 'DATA',
                  warning: 70,
                  critical: 90,
                  color: null,
                  isSpinning: true,
                  numReads: 1,
                  numWrites: 2,
                  numErrors: 0,
                },
              ],
              caches: [],
              boot: null,
            },
          },
        }),
      ),
    );
    const result = await getArrayStatus(client);
    expect(result.success).toBe(true);
    if (result.success) {
      // SDL: UnraidArray.state (ArrayState enum)
      expect(result.data.state).toBe('STARTED');
      expect(result.data.disks).toHaveLength(1);
      expect(result.data.disks[0]?.type).toBe('DATA');
    }
  });
});

describe('getParityHistory', () => {
  it('paginates the history list', async () => {
    server.use(
      graphql.query('GetParityHistory', () =>
        HttpResponse.json({
          data: {
            parityHistory: [
              {
                date: '2026-01-03',
                duration: 1,
                speed: '1',
                status: 'COMPLETED',
                errors: 0,
                progress: 100,
                correcting: false,
                paused: false,
                running: false,
              },
              {
                date: '2026-01-02',
                duration: 1,
                speed: '1',
                status: 'COMPLETED',
                errors: 0,
                progress: 100,
                correcting: false,
                paused: false,
                running: false,
              },
              {
                date: '2026-01-01',
                duration: 1,
                speed: '1',
                status: 'COMPLETED',
                errors: 0,
                progress: 100,
                correcting: false,
                paused: false,
                running: false,
              },
            ],
          },
        }),
      ),
    );
    const result = await getParityHistory(client, { limit: 2 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(3);
      expect(result.data.returned).toBe(2);
      expect(result.data.items[0]?.date).toBe('2026-01-03');
    }
  });

  it('rejects an invalid limit before calling the API', async () => {
    // No handler registered: if the op called the API, msw would error on the
    // unhandled request. A clean VALIDATION_ERROR proves it short-circuited.
    const result = await getParityHistory(client, { limit: -1 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe(UnraidErrorCode.VALIDATION_ERROR);
  });
});

describe('listDisks', () => {
  it('returns the physical disks', async () => {
    server.use(
      graphql.query('ListDisks', () =>
        HttpResponse.json({
          data: {
            disks: [
              {
                id: 'p1',
                device: '/dev/sda',
                type: 'SSD',
                name: 'Samsung',
                vendor: 'Samsung',
                size: 1000,
                temperature: 30,
                smartStatus: 'OK',
                interfaceType: 'SATA',
                isSpinning: false,
                firmwareRevision: 'r1',
                serialNum: 'sn1',
                partitions: [{ name: 'sda1', fsType: 'XFS', size: 999 }],
              },
            ],
          },
        }),
      ),
    );
    const result = await listDisks(client);
    expect(result.success).toBe(true);
    if (result.success) {
      // SDL: Disk.smartStatus (DiskSmartStatus), Disk.interfaceType (DiskInterfaceType)
      expect(result.data.items[0]?.smartStatus).toBe('OK');
      expect(result.data.items[0]?.interfaceType).toBe('SATA');
    }
  });
});

describe('docker read operations', () => {
  const container = {
    id: 'c1',
    names: ['/plex'],
    image: 'plex:latest',
    imageId: 'sha256:abc',
    command: '/init',
    created: 1700000000,
    state: 'RUNNING',
    status: 'Up 2 days',
    autoStart: true,
    autoStartOrder: 0,
    autoStartWait: 5,
    sizeRootFs: 100,
    sizeRw: 10,
    sizeLog: 1,
    isUpdateAvailable: false,
    isRebuildReady: false,
    isOrphaned: false,
    templatePath: '/boot/plex.xml',
    webUiUrl: 'http://x',
    iconUrl: 'http://icon',
    projectUrl: null,
    registryUrl: null,
    supportUrl: null,
    shell: 'bash',
    lanIpPorts: ['1.2.3.4:32400'],
    tailscaleEnabled: false,
    hostConfig: { networkMode: 'bridge' },
    ports: [{ ip: '0.0.0.0', privatePort: 32400, publicPort: 32400, type: 'TCP' }],
  };

  it('lists containers with pagination metadata', async () => {
    server.use(
      graphql.query('ListContainers', () =>
        HttpResponse.json({
          data: { docker: { containers: [container, { ...container, id: 'c2' }] } },
        }),
      ),
    );
    const result = await listContainers(client, { limit: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.total).toBe(2);
      expect(result.data.returned).toBe(1);
      expect(result.data.items[0]?.state).toBe('RUNNING');
    }
  });

  it('returns a single container by id', async () => {
    server.use(
      graphql.query('GetContainer', () => HttpResponse.json({ data: { docker: { container } } })),
    );
    const result = await getContainer(client, 'c1');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.hostConfig?.networkMode).toBe('bridge');
  });

  it('maps a missing container to NOT_FOUND', async () => {
    server.use(
      graphql.query('GetContainer', () =>
        HttpResponse.json({ data: { docker: { container: null } } }),
      ),
    );
    const result = await getContainer(client, 'ghost');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe(UnraidErrorCode.NOT_FOUND);
  });

  it('passes id/tail/since variables and shapes the logs result', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.query('GetContainerLogs', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({
          data: {
            docker: {
              logs: {
                containerId: 'c1',
                cursor: '2026-01-01T00:00:00Z',
                lines: [{ timestamp: '2026-01-01T00:00:00Z', message: 'hello' }],
              },
            },
          },
        });
      }),
    );
    const result = await getContainerLogs(client, { id: 'c1', tail: 5 });
    expect(captured).toMatchObject({ id: 'c1', tail: 5, since: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lines).toHaveLength(1);
      expect(result.data.total).toBe(1);
      expect(result.data.truncated).toBe(false);
    }
  });

  it('rejects a non-positive tail', async () => {
    const result = await getContainerLogs(client, { id: 'c1', tail: 0 });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe(UnraidErrorCode.VALIDATION_ERROR);
  });

  it('lists container update statuses', async () => {
    server.use(
      graphql.query('GetContainerUpdateStatuses', () =>
        HttpResponse.json({
          data: {
            docker: {
              containerUpdateStatuses: [{ name: 'plex', updateStatus: 'UPDATE_AVAILABLE' }],
            },
          },
        }),
      ),
    );
    const result = await getUpdateStatuses(client);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items[0]?.updateStatus).toBe('UPDATE_AVAILABLE');
  });
});

describe('listVms', () => {
  it('returns VMs with run state', async () => {
    server.use(
      graphql.query('ListVms', () =>
        HttpResponse.json({
          data: { vms: { domains: [{ id: 'v1', name: 'Windows', state: 'RUNNING' }] } },
        }),
      ),
    );
    const result = await listVms(client);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items[0]?.state).toBe('RUNNING');
  });

  it('treats a null domains list as empty', async () => {
    server.use(
      graphql.query('ListVms', () => HttpResponse.json({ data: { vms: { domains: null } } })),
    );
    const result = await listVms(client);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toEqual([]);
      expect(result.data.total).toBe(0);
    }
  });
});

describe('listShares', () => {
  it('returns user shares', async () => {
    server.use(
      graphql.query('ListShares', () =>
        HttpResponse.json({
          data: {
            shares: [
              {
                id: 's1',
                name: 'appdata',
                comment: null,
                free: 100,
                used: 50,
                size: 150,
                include: [],
                exclude: [],
                cache: true,
                nameOrig: 'appdata',
                allocator: 'highwater',
                splitLevel: '1',
                floor: '0',
                cow: 'auto',
                color: 'green',
                luksStatus: null,
              },
            ],
          },
        }),
      ),
    );
    const result = await listShares(client);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.items[0]?.name).toBe('appdata');
  });
});

describe('notifications', () => {
  it('defaults the filter to UNREAD with offset 0 / limit 50', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.query('ListNotifications', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({ data: { notifications: { list: [] } } });
      }),
    );
    await listNotifications(client);
    // SDL: NotificationFilter { type: NotificationType!, offset: Int!, limit: Int! }
    expect(captured).toMatchObject({ filter: { type: 'UNREAD', offset: 0, limit: 50 } });
  });

  it('forwards explicit type, importance, and paging', async () => {
    let captured: Record<string, unknown> | undefined;
    server.use(
      graphql.query('ListNotifications', ({ variables }) => {
        captured = variables;
        return HttpResponse.json({
          data: {
            notifications: {
              list: [
                {
                  id: 'n1',
                  title: 'Disk hot',
                  subject: 's',
                  description: 'd',
                  importance: 'WARNING',
                  link: null,
                  type: 'UNREAD',
                  timestamp: '2026-01-01',
                  formattedTimestamp: 'Jan 1',
                },
              ],
            },
          },
        });
      }),
    );
    const result = await listNotifications(client, {
      type: 'ARCHIVE',
      importance: 'WARNING',
      limit: 10,
      offset: 5,
    });
    expect(captured).toMatchObject({
      filter: { type: 'ARCHIVE', importance: 'WARNING', offset: 5, limit: 10 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0]?.importance).toBe('WARNING');
      expect(result.data.limit).toBe(10);
      expect(result.data.offset).toBe(5);
    }
  });

  it('returns the overview counts', async () => {
    server.use(
      graphql.query('GetNotificationOverview', () =>
        HttpResponse.json({
          data: {
            notifications: {
              overview: {
                unread: { info: 1, warning: 2, alert: 0, total: 3 },
                archive: { info: 0, warning: 0, alert: 0, total: 0 },
              },
            },
          },
        }),
      ),
    );
    const result = await getNotificationOverview(client);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.unread.total).toBe(3);
  });
});

describe('getUpsStatus', () => {
  it('returns UPS battery and power telemetry', async () => {
    server.use(
      graphql.query('GetUpsStatus', () =>
        HttpResponse.json({
          data: {
            upsDevices: [
              {
                id: 'ups1',
                name: 'APC',
                model: 'Back-UPS',
                status: 'Online',
                battery: { chargeLevel: 100, estimatedRuntime: 3600, health: 'Good' },
                power: {
                  inputVoltage: 120,
                  outputVoltage: 120,
                  loadPercentage: 25,
                  nominalPower: 1000,
                  currentPower: 250,
                },
              },
            ],
          },
        }),
      ),
    );
    const result = await getUpsStatus(client);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0]?.battery.chargeLevel).toBe(100);
      expect(result.data.items[0]?.power.loadPercentage).toBe(25);
    }
  });
});
