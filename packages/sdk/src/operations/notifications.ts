/**
 * Notification operations.
 *
 * `listNotifications` returns notifications filtered by type (unread/archive)
 * and optional importance, paged server-side via the `NotificationFilter`
 * (offset/limit) and size-capped client-side. `getNotificationOverview` returns
 * the cached unread/archive counts by severity.
 *
 * @see https://docs.unraid.net/API/
 */

import { gql } from 'graphql-request';
import type { UnraidClient } from '../client.js';
import { toUnraidError } from '../errors.js';
import { type UnraidResult, success, failure } from '../result.js';
import { CHARACTER_LIMIT } from '../constants.js';
import {
  type PaginationParams,
  type PaginatedList,
  paginateList,
  validatePagination,
} from '../pagination.js';
import type {
  ListNotificationsQuery,
  ListNotificationsQueryVariables,
  GetNotificationOverviewQuery,
  NotificationType,
  NotificationImportance,
  CreateNotificationMutation,
  CreateNotificationMutationVariables,
  ArchiveNotificationMutation,
  UnarchiveNotificationMutation,
} from '../unraid/generated.js';

/** A single notification. */
export type NotificationItem = ListNotificationsQuery['notifications']['list'][number];

/** Unread/archive notification counts by severity. */
export type NotificationOverview = GetNotificationOverviewQuery['notifications']['overview'];

/** Default page size when a caller does not specify `limit`. */
const DEFAULT_NOTIFICATION_LIMIT = 50;

/** Options for {@link listNotifications}. */
export interface ListNotificationsParams extends PaginationParams {
  /** Which queue to read: `UNREAD` (default) or `ARCHIVE`. */
  readonly type?: NotificationType | undefined;
  /** Filter to a single severity (`INFO`/`WARNING`/`ALERT`). */
  readonly importance?: NotificationImportance | undefined;
}

const LIST_NOTIFICATIONS_QUERY = gql`
  query ListNotifications($filter: NotificationFilter!) {
    notifications {
      list(filter: $filter) {
        id
        title
        subject
        description
        importance
        link
        type
        timestamp
        formattedTimestamp
      }
    }
  }
`;

/**
 * List notifications by type/importance, paged and size-capped.
 *
 * Note: the underlying query is paged server-side via `NotificationFilter`, so
 * the returned `PaginatedList.total` reflects the size of the returned page
 * (after the server applied `offset`/`limit`), not the grand total in the queue.
 * Use {@link getNotificationOverview} for queue-wide counts by severity.
 */
export async function listNotifications(
  client: UnraidClient,
  params: ListNotificationsParams = {},
): Promise<UnraidResult<PaginatedList<NotificationItem>>> {
  const invalid = validatePagination(params);
  if (invalid) return failure(invalid);

  const offset = params.offset ?? 0;
  const limit = params.limit ?? DEFAULT_NOTIFICATION_LIMIT;

  try {
    const variables: ListNotificationsQueryVariables = {
      filter: {
        type: params.type ?? 'UNREAD',
        offset,
        limit,
        ...(params.importance !== undefined ? { importance: params.importance } : {}),
      },
    };
    const data = await client.request<ListNotificationsQuery>(LIST_NOTIFICATIONS_QUERY, variables);
    const list = data.notifications.list;
    const capped = paginateList(list, {}, CHARACTER_LIMIT);
    return success({
      items: capped.items,
      total: list.length,
      returned: capped.returned,
      limit,
      offset,
      truncated: capped.truncated,
    });
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const NOTIFICATION_OVERVIEW_QUERY = gql`
  query GetNotificationOverview {
    notifications {
      overview {
        unread {
          info
          warning
          alert
          total
        }
        archive {
          info
          warning
          alert
          total
        }
      }
    }
  }
`;

/** Retrieve unread/archive notification counts by severity. */
export async function getNotificationOverview(
  client: UnraidClient,
): Promise<UnraidResult<NotificationOverview>> {
  try {
    const data = await client.request<GetNotificationOverviewQuery>(NOTIFICATION_OVERVIEW_QUERY);
    return success(data.notifications.overview);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

// --- Phase 2: notification control --------------------------------------------

/** A notification returned by a create/archive/unarchive mutation. */
export type NotificationDetail = CreateNotificationMutation['createNotification'];

/** Fields for a notification to create. */
export interface NewNotification {
  /** Short event title. */
  readonly title: string;
  /** Notification subject line. */
  readonly subject: string;
  /** Body text. */
  readonly description: string;
  /** Severity (`INFO`/`WARNING`/`ALERT`). */
  readonly importance: NotificationImportance;
  /** Optional link to more detail. */
  readonly link?: string | undefined;
}

const CREATE_NOTIFICATION_MUTATION = gql`
  mutation CreateNotification($input: NotificationData!) {
    createNotification(input: $input) {
      id
      title
      subject
      description
      importance
      link
      type
      timestamp
      formattedTimestamp
    }
  }
`;

/** Create a new notification. */
export async function createNotification(
  client: UnraidClient,
  input: NewNotification,
): Promise<UnraidResult<NotificationDetail>> {
  try {
    const variables: CreateNotificationMutationVariables = {
      input: {
        title: input.title,
        subject: input.subject,
        description: input.description,
        importance: input.importance,
        ...(input.link !== undefined ? { link: input.link } : {}),
      },
    };
    const data = await client.request<CreateNotificationMutation>(
      CREATE_NOTIFICATION_MUTATION,
      variables,
    );
    return success(data.createNotification);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const ARCHIVE_NOTIFICATION_MUTATION = gql`
  mutation ArchiveNotification($id: PrefixedID!) {
    archiveNotification(id: $id) {
      id
      title
      subject
      description
      importance
      link
      type
      timestamp
      formattedTimestamp
    }
  }
`;

/** Archive a single notification (moves it out of the unread queue). */
export async function archiveNotification(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<NotificationDetail>> {
  try {
    const data = await client.request<ArchiveNotificationMutation>(ARCHIVE_NOTIFICATION_MUTATION, {
      id,
    });
    return success(data.archiveNotification);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}

const UNARCHIVE_NOTIFICATION_MUTATION = gql`
  mutation UnarchiveNotification($id: PrefixedID!) {
    unreadNotification(id: $id) {
      id
      title
      subject
      description
      importance
      link
      type
      timestamp
      formattedTimestamp
    }
  }
`;

/**
 * Unarchive a single notification — i.e. mark it unread, moving it back to the
 * unread queue (the schema field is `unreadNotification`).
 */
export async function unarchiveNotification(
  client: UnraidClient,
  id: string,
): Promise<UnraidResult<NotificationDetail>> {
  try {
    const data = await client.request<UnarchiveNotificationMutation>(
      UNARCHIVE_NOTIFICATION_MUTATION,
      { id },
    );
    return success(data.unreadNotification);
  } catch (error) {
    return failure(toUnraidError(error));
  }
}
