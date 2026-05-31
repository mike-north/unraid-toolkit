# unraid-cli

[![CI](https://github.com/mike-north/unraid-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/mike-north/unraid-cli/actions/workflows/ci.yml)

A toolkit for observing and controlling an [Unraid](https://unraid.net) server through its built-in GraphQL API, structured as a **core SDK with thin CLI and MCP wrappers**.

> **Status:** early development. The connection-health surface and the full SDK/wrapper/monorepo foundation are in place; the read and control operations are being built out (see [Roadmap](#roadmap)).

## Architecture

A core SDK holds all the real logic; the CLI and MCP server are thin adapters over it.

```
@unraid-cli/sdk   ← core: GraphQL client, auth, validation, domain ops, result envelope
      ▲   ▲
      │   │
@unraid-cli/cli   @unraid-cli/mcp   ← thin wrappers (Commander CLI / MCP server)
      ▲   ▲   ▲
      └───┴───┴── unraid-cli         ← umbrella: re-exports all three, ships the `unraid` binary
```

| Package                             | Role                                                                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`@unraid-cli/sdk`](packages/sdk)   | Core SDK. Owns the GraphQL transport, API-key auth, validation, domain models, structured errors, and the `UnraidResult<T>` result envelope. No protocol or UI concerns. |
| [`@unraid-cli/cli`](packages/cli)   | Commander-based CLI. Parses flags, calls SDK operations, formats output (JSON / human).                                                                                  |
| [`@unraid-cli/mcp`](packages/mcp)   | Model Context Protocol server. Exposes SDK operations as MCP tools over stdio / Streamable HTTP.                                                                         |
| [`unraid-cli`](packages/unraid-cli) | Umbrella package. Re-exports the three above and provides the `unraid` command.                                                                                          |

The boundary is deliberate: **operations, validation, and error handling live in the SDK once**; each wrapper only adapts input (flags vs. tool schemas) and output (stdout vs. `CallToolResult`). Adding a third interface (e.g. an HTTP API) would be another thin adapter, not a reimplementation.

## Requirements

- **Unraid 7.2 or newer** with the API enabled (Settings → Management Access → API Keys).
- A scoped **API key** (prefer least privilege).
- **Node.js 24+** to run the CLI or MCP server from source.

## Configuration

The Unraid **connection** is resolved by the SDK from explicit values (CLI flags) or environment variables:

| Variable                 | Description                                               |
| ------------------------ | --------------------------------------------------------- |
| `UNRAID_API_URL`         | GraphQL endpoint, e.g. `https://tower.local/graphql`      |
| `UNRAID_API_KEY`         | Unraid API key (sent as `x-api-key`)                      |
| `UNRAID_TLS_SKIP_VERIFY` | Skip TLS verification for Unraid's self-signed local cert |

The MCP server additionally reads runtime settings: `MCP_TRANSPORT` (`stdio`\|`http`\|`both`), `MCP_HTTP_PORT`, `MCP_AUTH_TOKEN`, `MCP_READ_ONLY`, `MCP_MAX_BATCH`, `MCP_DENY_TOOLS`, `LOG_LEVEL`, `MCP_AUDIT_LOG`.

## Usage

### CLI

Installing the umbrella package globally provides the `unraid` command:

```bash
pnpm add -g unraid-cli
UNRAID_API_URL=https://tower.local/graphql UNRAID_API_KEY=your-key unraid health
# or pass connection details as flags:
unraid health --url https://tower.local/graphql --api-key your-key --insecure
```

From a source checkout, the same binary is `node packages/cli/dist/index.js` after `pnpm build`.

Global flags: `--url`, `--api-key`, `--insecure` (skip TLS), `--json` (default) / `--human`.

### MCP server

Run with `MCP_TRANSPORT=http` for a hosted server (clients connect to `POST /mcp`; `GET /healthz` for liveness), or the default `stdio` for local clients that spawn it. Example Claude Desktop entry:

```json
{
  "mcpServers": {
    "unraid": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp/dist/index.js"],
      "env": {
        "UNRAID_API_URL": "https://tower.local/graphql",
        "UNRAID_API_KEY": "your-key",
        "UNRAID_TLS_SKIP_VERIFY": "true"
      }
    }
  }
}
```

## Roadmap

- **Phase 1 — Observability:** connection health ✅, then system info/metrics, array/parity status, disks, Docker containers/logs, VMs, shares, notifications, UPS.
- **Phase 2 — Safe control:** Docker and VM lifecycle, notifications.
- **Phase 3 — Gated destructive control:** array start/stop, parity checks, removals — behind a layered safety model (read-only flag, blast-radius cap, human approval via MCP elicitation with a confirmation-token fallback, batch approvals bound to the affected item set).
- **Distribution:** Docker image + Unraid Community Applications template; npm publish via Changesets.

## Development

This is a pnpm + TypeScript project-references monorepo.

```bash
pnpm install         # install workspace (applies the bundled MCP SDK patch)
pnpm build           # tsc --build across all packages (incremental)
pnpm check           # build + lint + format:check + syncpack + knip + test
pnpm test            # run all package tests (vitest)
pnpm -F @unraid-cli/sdk test   # test a single package
pnpm lint            # eslint packages/*/src
pnpm changeset       # record a release note
```

See [CLAUDE.md](CLAUDE.md) for architecture notes and toolchain gotchas (notably the committed `pnpm` patch that keeps the build compiling under strict TypeScript without `skipLibCheck`).

## License

[MIT](LICENSE) © Mike North
