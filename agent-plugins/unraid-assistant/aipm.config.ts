import { defineConfig } from '@ai-plugin-marketplace/core';

export default defineConfig({
  version: '0.1.0',
  // Gemini and Kiro are single-root extensions: they copy the plugin bundle
  // (incl. README/LICENSE) to the repo root, which would clobber this software
  // project's own root files. They need a standalone repo, so they are omitted
  // from this embedded marketplace. See README for details.
  targets: ['claude', 'codex', 'cursor', 'vercel'],
  description:
    'Teaches an AI agent to observe and control an Unraid server via the unraid-toolkit MCP tools or the `unraid` CLI, including the read-only / safe-write / destructive safety model.',
  keywords: [
    'unraid',
    'nas',
    'homelab',
    'self-hosted',
    'docker',
    'mcp',
    'cli',
    'storage',
    'server-management',
  ],
});
