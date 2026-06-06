import { defineRepoConfig } from '@ai-plugin-marketplace/core';

/**
 * Embedded-marketplace layout. This repo's primary product is the software
 * under `packages/*`; the agent plugins live alongside it under
 * `agent-plugins/` so plugin sources never collide with the build tree.
 */
export default defineRepoConfig({
  pluginsRoot: 'agent-plugins',
  distDir: 'agent-plugins/dist',
});
