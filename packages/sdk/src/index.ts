/**
 * `@unraid-cli/sdk` — the core SDK for the Unraid GraphQL API.
 *
 * Owns the transport, authentication, validation, domain models, structured
 * errors, and the result envelope. The CLI and MCP wrappers are thin adapters
 * over this surface and must not duplicate its logic.
 */

export { UnraidClient, createClient } from './client.js';
export {
  resolveConnectionConfig,
  type ConnectionConfig,
  type ConnectionOverrides,
} from './config.js';
export { type UnraidResult, success, failure } from './result.js';
export { UnraidErrorCode, type UnraidError } from './errors.js';
export { DEFAULT_REQUEST_TIMEOUT_MS } from './constants.js';
export { type PaginationParams, type PaginatedList } from './pagination.js';
export type { HealthInfo } from './types.js';

// System
export {
  getHealth,
  getSystemInfo,
  getSystemMetrics,
  type SystemInfo,
  type SystemMetrics,
} from './operations/system.js';

// Array & parity
export {
  getArrayStatus,
  getParityHistory,
  type ArrayStatus,
  type ParityHistoryEntry,
} from './operations/array.js';

// Disks
export { listDisks, type PhysicalDisk } from './operations/disks.js';

// Docker
export {
  listContainers,
  getContainer,
  getContainerLogs,
  getUpdateStatuses,
  startContainer,
  stopContainer,
  pauseContainer,
  unpauseContainer,
  updateContainer,
  updateAllContainers,
  type DockerContainerSummary,
  type DockerContainerDetail,
  type ContainerLogs,
  type ContainerLogLine,
  type ContainerLogsParams,
  type ContainerUpdateStatus,
  type DockerContainerState,
} from './operations/docker.js';

// VMs
export {
  listVms,
  startVm,
  stopVm,
  pauseVm,
  resumeVm,
  type VmSummary,
  type VmActionResult,
} from './operations/vm.js';

// Shares
export { listShares, type ShareSummary } from './operations/shares.js';

// Notifications
export {
  listNotifications,
  getNotificationOverview,
  createNotification,
  archiveNotification,
  unarchiveNotification,
  type NotificationItem,
  type NotificationOverview,
  type ListNotificationsParams,
  type NotificationDetail,
  type NewNotification,
} from './operations/notifications.js';

// UPS
export { getUpsStatus, type UpsDevice } from './operations/ups.js';
