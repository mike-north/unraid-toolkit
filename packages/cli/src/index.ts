#!/usr/bin/env node
/**
 * Entry point for the `unraid` binary.
 *
 * When executed as the main module (i.e. `node dist/index.js` or via the `bin`
 * entry), the Commander program is parsed against `process.argv`. When imported
 * as a library, only {@link createCli} is re-exported so callers can build and
 * test the program without side effects.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCli } from './cli.js';

export { createCli } from './cli.js';

const entryPath = process.argv[1];
// Resolve to an absolute path first so the comparison holds when the script is
// launched via a relative path (e.g. `node packages/cli/dist/index.js`).
if (entryPath !== undefined && import.meta.url === pathToFileURL(resolve(entryPath)).href) {
  createCli().parse();
}
