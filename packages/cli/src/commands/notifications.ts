/**
 * Notification command group for the Unraid CLI.
 */

import { Option, type Command } from 'commander';
import {
  listNotifications,
  getNotificationOverview,
  createNotification,
  archiveNotification,
  unarchiveNotification,
  type ListNotificationsParams,
  type NewNotification,
} from '@unraid-cli/sdk';
import type { GlobalOptions } from '../cli.js';
import { runAction, parseIntFlag } from './run.js';

/** Register `notifications list` and `notifications overview` commands. */
export function registerNotificationCommands(
  program: Command,
  getGlobals: (cmd: Command) => GlobalOptions,
): void {
  const notifications = program.command('notifications').description('Notification operations');

  notifications
    .command('list')
    .description('List notifications by queue and severity.')
    .option('--type <type>', 'Queue to read: UNREAD (default) or ARCHIVE')
    .option('--importance <level>', 'Filter to a severity: INFO, WARNING, or ALERT')
    .option('--limit <n>', 'Maximum number of notifications to return', parseIntFlag)
    .option('--offset <n>', 'Number of notifications to skip', parseIntFlag)
    .action(async function (this: Command) {
      const opts = this.opts<{
        type?: ListNotificationsParams['type'];
        importance?: ListNotificationsParams['importance'];
        limit?: number;
        offset?: number;
      }>();
      await runAction(getGlobals(this), (client) =>
        listNotifications(client, {
          type: opts.type,
          importance: opts.importance,
          limit: opts.limit,
          offset: opts.offset,
        }),
      );
    });

  notifications
    .command('overview')
    .description('Show unread/archived notification counts by severity.')
    .action(async function (this: Command) {
      await runAction(getGlobals(this), (client) => getNotificationOverview(client));
    });

  notifications
    .command('create')
    .description('Create a notification.')
    .requiredOption('--title <title>', 'Short event title')
    .requiredOption('--subject <subject>', 'Notification subject line')
    .requiredOption('--description <text>', 'Body text')
    .addOption(
      new Option('--importance <level>', 'Severity')
        .choices(['INFO', 'WARNING', 'ALERT'])
        .makeOptionMandatory(),
    )
    .option('--link <url>', 'Optional link to more detail')
    .action(async function (this: Command) {
      const opts = this.opts<{
        title: string;
        subject: string;
        description: string;
        importance: NewNotification['importance'];
        link?: string;
      }>();
      await runAction(getGlobals(this), (client) =>
        createNotification(client, {
          title: opts.title,
          subject: opts.subject,
          description: opts.description,
          importance: opts.importance,
          link: opts.link,
        }),
      );
    });

  notifications
    .command('archive')
    .description('Archive a notification by id.')
    .argument('<id>', 'The notification id')
    .action(async function (this: Command, id: string) {
      await runAction(getGlobals(this), (client) => archiveNotification(client, id));
    });

  notifications
    .command('unarchive')
    .description('Unarchive (mark unread) a notification by id.')
    .argument('<id>', 'The notification id')
    .action(async function (this: Command, id: string) {
      await runAction(getGlobals(this), (client) => unarchiveNotification(client, id));
    });
}
