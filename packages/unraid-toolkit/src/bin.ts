#!/usr/bin/env node
/**
 * The `unraid` binary — a thin shim that runs the CLI defined in
 * `@unraid-toolkit/cli`.
 */

import { createCli } from '@unraid-toolkit/cli';

createCli().parse();
