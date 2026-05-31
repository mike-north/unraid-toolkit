#!/usr/bin/env node
/**
 * The `unraid` binary — a thin shim that runs the CLI defined in
 * `@unraid-cli/cli`.
 */

import { createCli } from '@unraid-cli/cli';

createCli().parse();
