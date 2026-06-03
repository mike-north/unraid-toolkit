/**
 * Structural coverage of the CLI command surface: asserts every command group
 * and subcommand is registered with the expected arguments and options, and that
 * destructive subcommands carry a `--yes` confirmation flag while reversible ones
 * do not. Guards against a dropped/renamed command or a missing gate flag.
 *
 * @see https://docs.unraid.net/API/
 */

import { describe, it, expect, beforeAll } from 'vitest';
import type { Command } from 'commander';
import { createCli } from '../src/cli.js';

let program: Command;
beforeAll(() => {
  program = createCli();
});

/** Find a top-level command group by name. */
function group(name: string): Command {
  const c = program.commands.find((g) => g.name() === name);
  if (!c) throw new Error(`command group "${name}" not registered`);
  return c;
}

/** Find a subcommand within a group. */
function sub(groupName: string, subName: string): Command {
  const s = group(groupName).commands.find((c) => c.name() === subName);
  if (!s) throw new Error(`"${groupName} ${subName}" not registered`);
  return s;
}

function longFlags(cmd: Command): string[] {
  return cmd.options.map((o) => o.long ?? '').filter(Boolean);
}
function argNames(cmd: Command): string[] {
  // Commander stores positional args on registeredArguments.
  return (cmd.registeredArguments ?? []).map((a) => a.name());
}

describe('top-level command groups', () => {
  it('registers every expected group plus the health leaf', () => {
    const names = program.commands.map((c) => c.name()).sort();
    expect(names).toEqual(
      [
        'array',
        'disks',
        'docker',
        'health',
        'notifications',
        'parity',
        'shares',
        'system',
        'ups',
        'vm',
      ].sort(),
    );
  });
});

describe('read command surface', () => {
  it.each([
    ['system', 'info', []],
    ['system', 'metrics', []],
    ['array', 'status', []],
    ['array', 'parity-history', ['--limit', '--offset']],
    ['disks', 'list', ['--limit', '--offset']],
    ['docker', 'containers', ['--limit', '--offset']],
    ['docker', 'container', []],
    ['docker', 'logs', ['--tail', '--since']],
    ['docker', 'update-status', ['--limit', '--offset']],
    ['vm', 'list', ['--limit', '--offset']],
    ['shares', 'list', ['--limit', '--offset']],
    ['notifications', 'list', ['--type', '--importance', '--limit', '--offset']],
    ['notifications', 'overview', []],
    ['ups', 'status', ['--limit', '--offset']],
  ] as const)('%s %s exists with expected options', (g, s, opts) => {
    const cmd = sub(g, s);
    for (const o of opts) expect(longFlags(cmd)).toContain(o);
    // Read commands must NOT carry a destructive --yes gate.
    expect(longFlags(cmd)).not.toContain('--yes');
  });

  it('docker container / logs take an <id> argument', () => {
    expect(argNames(sub('docker', 'container'))).toContain('id');
    expect(argNames(sub('docker', 'logs'))).toContain('id');
  });
});

describe('safe-write command surface', () => {
  it.each([
    ['docker', 'start'],
    ['docker', 'stop'],
    ['docker', 'pause'],
    ['docker', 'unpause'],
    ['docker', 'update'],
    ['docker', 'update-all'],
    ['vm', 'start'],
    ['vm', 'stop'],
    ['vm', 'pause'],
    ['vm', 'resume'],
    ['parity', 'pause'],
    ['parity', 'resume'],
    ['notifications', 'create'],
    ['notifications', 'archive'],
    ['notifications', 'unarchive'],
  ] as const)('%s %s is registered without a --yes gate', (g, s) => {
    expect(longFlags(sub(g, s))).not.toContain('--yes');
  });

  it('notifications archive/unarchive take an <id> argument', () => {
    expect(argNames(sub('notifications', 'archive'))).toContain('id');
    expect(argNames(sub('notifications', 'unarchive'))).toContain('id');
  });

  it('docker lifecycle subcommands take an <id> argument', () => {
    for (const s of ['start', 'stop', 'pause', 'unpause', 'update']) {
      expect(argNames(sub('docker', s))).toContain('id');
    }
  });

  it('notifications create requires title/subject/description/importance', () => {
    const create = sub('notifications', 'create');
    const required = create.options.filter((o) => o.required || o.mandatory).map((o) => o.long);
    for (const o of ['--title', '--subject', '--description', '--importance']) {
      expect(required).toContain(o);
    }
  });
});

describe('destructive command surface — every one gated by --yes', () => {
  it.each([
    ['array', 'start'],
    ['array', 'stop'],
    ['array', 'add-disk'],
    ['array', 'remove-disk'],
    ['array', 'mount-disk'],
    ['array', 'unmount-disk'],
    ['parity', 'start'],
    ['parity', 'cancel'],
    ['docker', 'remove'],
    ['vm', 'force-stop'],
    ['vm', 'reboot'],
    ['vm', 'reset'],
  ] as const)('%s %s carries --yes', (g, s) => {
    expect(longFlags(sub(g, s))).toContain('--yes');
  });

  it('docker remove offers --with-image and takes <id>', () => {
    const rm = sub('docker', 'remove');
    expect(longFlags(rm)).toContain('--with-image');
    expect(argNames(rm)).toContain('id');
  });
});
