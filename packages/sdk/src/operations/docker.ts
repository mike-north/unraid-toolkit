/**
 * Docker operations.
 *
 * Read-only views over the Unraid Docker manager: list containers, fetch a
 * single container, stream recent log lines, and report per-container update
 * status. Container lists and log lines are size-capped via {@link paginateList}.
 *
 * @see https://docs.unraid.net/API/
 */

import { gql } from 'graphql-request';
import type { UnraidClient } from '../client.js';
import { UnraidErrorCode, createError, toUnraidError } from '../errors.js';
import { type UnraidResult, success, failure } from '../result.js';
import { CHARACTER_LIMIT } from '../constants.js';
import {
  type PaginationParams,
  type PaginatedList,
  paginateList,
  validatePagination,
} from '../pagination.js';
import type {
  ListContainersQuery,
  GetContainerQuery,
  GetContainerQueryVariables,
  GetContainerLogsQuery,
  GetContainerLogsQueryVariables,
  GetContainerUpdateStatusesQuery,
  StartContainerMutation,
  StopContainerMutation,
  PauseContainerMutation,
  UnpauseContainerMutation,
  UpdateContainerMutation,
  UpdateAllContainersMutation,
} from '../unraid/generated.js';

/** A container as returned by the list view. */
export type DockerContainerSummary = ListContainersQuery['docker']['containers'][number];

/** A single container's detailed view. */
export type DockerContainerDetail = NonNullable<GetContainerQuery['docker']['container']>;

/** One line of container log output. */
export type ContainerLogLine = GetContainerLogsQuery['docker']['logs']['lines'][number];

/** Per-container update availability. */
export type ContainerUpdateStatus =
  GetContainerUpdateStatusesQuery['docker']['containerUpdateStatuses'][number];

/** Recent container log lines, size-capped to {@link CHARACTER_LIMIT}. */
export interface ContainerLogs {
  /** The container the lines belong to. */
  readonly containerId: string;
  /** Cursor to resume streaming (pass back via `since`), if provided. */
  readonly cursor: string | null;
  /** The returned log lines (oldest first), possibly trimmed. */
  readonly lines: readonly ContainerLogLine[];
  /** Number of lines returned by the server before size-capping. */
  readonly total: number;
  /** True when lines were dropped to stay within the size budget. */
  readonly truncated: boolean;
}

/** Options for {@link getContainerLogs}. */
export interface ContainerLogsParams {
  /** The container id to read logs from. */
  readonly id: string;
  /** Return only the last N lines. */
  readonly tail?: number | undefined;
  /** Only return lines after this ISO timestamp / cursor. */
  readonly since?: string | undefined;
}

const LIST_CONTAINERS_QUERY = gql`
  query ListContainers {
    docker {
      containers {
        id
        names
        image
        state
        status
        created
        autoStart
        autoStartOrder
        isUpdateAvailable
        isRebuildReady
        isOrphaned
        templatePath
        webUiUrl
        iconUrl
        ports {
          ip
          privatePort
          publicPort
          type
        }
      }
    }
  }
`;

/** List Docker containers, windowed by `limit`/`offset` and size-capped. */
export async function listContainers(
  client: UnraidClient,
  pagination: PaginationParams = {},
): Promise<UnraidResult<PaginatedList<DockerContainerSummary>>> {
  const invalid = validatePagination(pagination);
  if (invalid) return failure(invalid);

  try {
    const data = await client.request<ListContainersQuery>(LIST_CONTAINERS_QUERY);
    return success(paginateList(data.docker.containers, pagination));
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const GET_CONTAINER_QUERY = gql`
  query GetContainer($id: PrefixedID!) {
    docker {
      container(id: $id) {
        id
        names
        image
        imageId
        command
        created
        state
        status
        autoStart
        autoStartOrder
        autoStartWait
        sizeRootFs
        sizeRw
        sizeLog
        isUpdateAvailable
        isRebuildReady
        isOrphaned
        templatePath
        webUiUrl
        iconUrl
        projectUrl
        registryUrl
        supportUrl
        shell
        lanIpPorts
        tailscaleEnabled
        hostConfig {
          networkMode
        }
        ports {
          ip
          privatePort
          publicPort
          type
        }
      }
    }
  }
`;

/** Fetch a single Docker container by id. Fails with `NOT_FOUND` if absent. */
export async function getContainer(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<DockerContainerDetail>> {
  try {
    const variables: GetContainerQueryVariables = { id };
    const data = await client.request<GetContainerQuery>(GET_CONTAINER_QUERY, variables);
    const container = data.docker.container;
    if (container === null) {
      return failure(
        createError(UnraidErrorCode.NOT_FOUND, `No Docker container found with id "${id}".`),
      );
    }
    return success(container);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const CONTAINER_LOGS_QUERY = gql`
  query GetContainerLogs($id: PrefixedID!, $since: DateTime, $tail: Int) {
    docker {
      logs(id: $id, since: $since, tail: $tail) {
        containerId
        cursor
        lines {
          timestamp
          message
        }
      }
    }
  }
`;

/** Fetch recent log lines for a container, size-capped to {@link CHARACTER_LIMIT}. */
export async function getContainerLogs(
  client: UnraidClient,
  params: ContainerLogsParams,
): Promise<UnraidResult<ContainerLogs>> {
  if (params.tail !== undefined && (!Number.isInteger(params.tail) || params.tail <= 0)) {
    return failure(
      createError(UnraidErrorCode.VALIDATION_ERROR, 'tail must be a positive integer'),
    );
  }

  try {
    // Top-level operation variables are required-but-nullable under this codegen
    // config, so pass explicit nulls rather than omitting them.
    const variables: GetContainerLogsQueryVariables = {
      id: params.id,
      tail: params.tail ?? null,
      since: params.since ?? null,
    };
    const data = await client.request<GetContainerLogsQuery>(CONTAINER_LOGS_QUERY, variables);
    const { logs } = data.docker;
    const capped = paginateList(logs.lines, {}, CHARACTER_LIMIT);
    return success({
      containerId: logs.containerId,
      cursor: logs.cursor,
      lines: capped.items,
      total: logs.lines.length,
      truncated: capped.truncated,
    });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const CONTAINER_UPDATE_STATUSES_QUERY = gql`
  query GetContainerUpdateStatuses {
    docker {
      containerUpdateStatuses {
        name
        updateStatus
      }
    }
  }
`;

/** Report per-container update availability, windowed by `limit`/`offset`. */
export async function getUpdateStatuses(
  client: UnraidClient,
  pagination: PaginationParams = {},
): Promise<UnraidResult<PaginatedList<ContainerUpdateStatus>>> {
  const invalid = validatePagination(pagination);
  if (invalid) return failure(invalid);

  try {
    const data = await client.request<GetContainerUpdateStatusesQuery>(
      CONTAINER_UPDATE_STATUSES_QUERY,
    );
    return success(paginateList(data.docker.containerUpdateStatuses, pagination));
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

// --- Phase 2: safe container lifecycle control ---------------------------------

/** A container's post-action identity and state. */
export type DockerContainerState = StartContainerMutation['docker']['start'];

/** Run a single-container control mutation and wrap it in the result envelope. */
async function execContainerAction(
  run: () => Promise<DockerContainerState>,
): Promise<UnraidResult<DockerContainerState>> {
  try {
    return success(await run());
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const START_CONTAINER_MUTATION = gql`
  mutation StartContainer($id: PrefixedID!) {
    docker {
      start(id: $id) {
        id
        names
        image
        state
        status
      }
    }
  }
`;

/** Start a stopped container. */
export async function startContainer(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<DockerContainerState>> {
  return execContainerAction(async () => {
    const data = await client.request<StartContainerMutation>(START_CONTAINER_MUTATION, { id });
    return data.docker.start;
  });
}

const STOP_CONTAINER_MUTATION = gql`
  mutation StopContainer($id: PrefixedID!) {
    docker {
      stop(id: $id) {
        id
        names
        image
        state
        status
      }
    }
  }
`;

/** Stop a running container. */
export async function stopContainer(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<DockerContainerState>> {
  return execContainerAction(async () => {
    const data = await client.request<StopContainerMutation>(STOP_CONTAINER_MUTATION, { id });
    return data.docker.stop;
  });
}

const PAUSE_CONTAINER_MUTATION = gql`
  mutation PauseContainer($id: PrefixedID!) {
    docker {
      pause(id: $id) {
        id
        names
        image
        state
        status
      }
    }
  }
`;

/** Pause (suspend) a running container. */
export async function pauseContainer(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<DockerContainerState>> {
  return execContainerAction(async () => {
    const data = await client.request<PauseContainerMutation>(PAUSE_CONTAINER_MUTATION, { id });
    return data.docker.pause;
  });
}

const UNPAUSE_CONTAINER_MUTATION = gql`
  mutation UnpauseContainer($id: PrefixedID!) {
    docker {
      unpause(id: $id) {
        id
        names
        image
        state
        status
      }
    }
  }
`;

/** Unpause (resume) a paused container. */
export async function unpauseContainer(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<DockerContainerState>> {
  return execContainerAction(async () => {
    const data = await client.request<UnpauseContainerMutation>(UNPAUSE_CONTAINER_MUTATION, { id });
    return data.docker.unpause;
  });
}

const UPDATE_CONTAINER_MUTATION = gql`
  mutation UpdateContainer($id: PrefixedID!) {
    docker {
      updateContainer(id: $id) {
        id
        names
        image
        state
        status
      }
    }
  }
`;

/** Pull the latest image for a single container and recreate it. */
export async function updateContainer(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<DockerContainerState>> {
  return execContainerAction(async () => {
    const data = await client.request<UpdateContainerMutation>(UPDATE_CONTAINER_MUTATION, { id });
    return data.docker.updateContainer;
  });
}

const UPDATE_ALL_CONTAINERS_MUTATION = gql`
  mutation UpdateAllContainers {
    docker {
      updateAllContainers {
        id
        names
        image
        state
        status
      }
    }
  }
`;

/** Update every container that has an available image update. */
export async function updateAllContainers(
  client: UnraidClient,
): Promise<UnraidResult<readonly DockerContainerState[]>> {
  try {
    const data = await client.request<UpdateAllContainersMutation>(UPDATE_ALL_CONTAINERS_MUTATION);
    return success(data.docker.updateAllContainers);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
