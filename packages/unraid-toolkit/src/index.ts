/**
 * `unraid-toolkit` — umbrella package.
 *
 * Re-exports the public surface of the SDK, CLI, and MCP server so consumers
 * can depend on a single package. The `unraid` binary (see `bin.ts`) runs the
 * CLI.
 */

export * from '@unraid-toolkit/sdk';
export { createCli } from '@unraid-toolkit/cli';
export {
  buildServer,
  loadMcpConfig,
  type ServerContext,
  type McpConfig,
} from '@unraid-toolkit/mcp';
