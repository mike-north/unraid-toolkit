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
export { UnraidErrorCode, type UnraidError, createError, toUnraidError } from './errors.js';
export { DEFAULT_REQUEST_TIMEOUT_MS, CHARACTER_LIMIT } from './constants.js';
export {
  type PaginationParams,
  type PaginatedList,
  paginateList,
  validatePagination,
} from './pagination.js';
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
  type DockerContainerSummary,
  type DockerContainerDetail,
  type ContainerLogs,
  type ContainerLogLine,
  type ContainerLogsParams,
  type ContainerUpdateStatus,
} from './operations/docker.js';

// VMs
export { listVms, type VmSummary } from './operations/vm.js';

// Shares
export { listShares, type ShareSummary } from './operations/shares.js';

// Notifications
export {
  listNotifications,
  getNotificationOverview,
  type NotificationItem,
  type NotificationOverview,
  type ListNotificationsParams,
} from './operations/notifications.js';

// UPS
export { getUpsStatus, type UpsDevice } from './operations/ups.js';
