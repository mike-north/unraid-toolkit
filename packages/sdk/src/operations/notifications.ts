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

/** List notifications by type/importance, paged and size-capped. */
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
