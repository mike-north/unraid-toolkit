#!/usr/bin/env node
/**
 * Entry point for the `unraid-cli` binary.
 *
 * When executed as the main module (i.e. `node dist/index.js` or via the `bin`
 * entry), the Commander program is parsed against `process.argv`. When imported
 * as a library, only {@link createCli} is re-exported so callers can build and
 * test the program without side effects.
 */

import { pathToFileURL } from 'node:url';
import { createCli } from './cli.js';

export { createCli } from './cli.js';

const entry1 = process.argv[1];
if (entry1 !== undefined && import.meta.url === pathToFileURL(entry1).href) {
  createCli().parse();
}
