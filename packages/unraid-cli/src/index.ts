/**
 * `unraid-cli` — umbrella package.
 *
 * Re-exports the public surface of the SDK, CLI, and MCP server so consumers
 * can depend on a single package. The `unraid` binary (see `bin.ts`) runs the
 * CLI.
 */

export * from '@unraid-cli/sdk';
export { createCli } from '@unraid-cli/cli';
export { buildServer, loadMcpConfig, type ServerContext, type McpConfig } from '@unraid-cli/mcp';
