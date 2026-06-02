/**
 * Notification tools. Thin adapters over the SDK notification operations.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  listNotifications,
  getNotificationOverview,
  createNotification,
  archiveNotification,
  unarchiveNotification,
} from '@unraid-cli/sdk';
import { formatResult } from '../format.js';
import { READ_ONLY_ANNOTATIONS, SAFE_WRITE_ANNOTATIONS } from './annotations.js';
import { PAGINATION_INPUT } from './pagination.js';
import { readOnlyBlock } from './policy.js';
import type { ServerContext } from '../server.js';

/** Register notification tools on the given server. */
export function registerNotificationTools(server: McpServer, ctx: ServerContext): void {
  server.registerTool(
    'unraid_list_notifications',
    {
      title: 'List Unraid Notifications',
      description: `List notifications filtered by queue ('UNREAD' default, or 'ARCHIVE') and optional severity ('INFO'/'WARNING'/'ALERT'). Use limit/offset to page. For aggregate counts use unraid_notifications_overview.`,
      inputSchema: {
        type: z
          .enum(['UNREAD', 'ARCHIVE'])
          .optional()
          .describe('Which queue to read (default UNREAD)'),
        importance: z
          .enum(['INFO', 'WARNING', 'ALERT'])
          .optional()
          .describe('Filter to a single severity'),
        ...PAGINATION_INPUT,
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ type, importance, limit, offset }) =>
      formatResult(await listNotifications(ctx.client, { type, importance, limit, offset })),
  );

  server.registerTool(
    'unraid_notifications_overview',
    {
      title: 'Get Unraid Notifications Overview',
      description: `Get unread and archived notification counts broken down by severity (info/warning/alert/total). A fast way to check whether the server needs attention.`,
      inputSchema: {},
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => formatResult(await getNotificationOverview(ctx.client)),
  );

  server.registerTool(
    'unraid_create_notification',
    {
      title: 'Create Unraid Notification',
      description: `Create a notification on the server. Requires title, subject, description, and importance (INFO/WARNING/ALERT); link is optional.`,
      inputSchema: {
        title: z.string().describe('Short event title'),
        subject: z.string().describe('Notification subject line'),
        description: z.string().describe('Body text'),
        importance: z.enum(['INFO', 'WARNING', 'ALERT']).describe('Severity'),
        link: z.string().optional().describe('Optional link to more detail'),
      },
      annotations: SAFE_WRITE_ANNOTATIONS,
    },
    async ({ title, subject, description, importance, link }) =>
      readOnlyBlock(ctx) ??
      formatResult(
        await createNotification(ctx.client, { title, subject, description, importance, link }),
      ),
  );

  server.registerTool(
    'unraid_archive_notification',
    {
      title: 'Archive Unraid Notification',
      description: `Archive a single notification by id (moves it out of the unread queue).`,
      inputSchema: { id: z.string().describe('The notification id (PrefixedID)') },
      annotations: SAFE_WRITE_ANNOTATIONS,
    },
    async ({ id }) => readOnlyBlock(ctx) ?? formatResult(await archiveNotification(ctx.client, id)),
  );

  server.registerTool(
    'unraid_unarchive_notification',
    {
      title: 'Unarchive Unraid Notification',
      description: `Unarchive a single notification by id — marks it unread, moving it back to the unread queue.`,
      inputSchema: { id: z.string().describe('The notification id (PrefixedID)') },
      annotations: SAFE_WRITE_ANNOTATIONS,
    },
    async ({ id }) =>
      readOnlyBlock(ctx) ?? formatResult(await unarchiveNotification(ctx.client, id)),
  );
}
