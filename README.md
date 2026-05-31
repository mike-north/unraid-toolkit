# unraid-mcp

[![CI](https://github.com/mike-north/unraid-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/mike-north/unraid-mcp/actions/workflows/ci.yml)

A [Model Context Protocol](https://modelcontextprotocol.io) server for observing and controlling an [Unraid](https://unraid.net) server through its built-in GraphQL API. It lets MCP-capable agents (Claude Desktop, Claude Code, and others) query array, disk, Docker, VM, and system state — and, with explicit safeguards, perform control operations.

> **Status:** early development. The connection-health tool and the full server/transport/config foundation are in place; the read and control tool surface is being built out (see [Roadmap](#roadmap)).

## Why talk to Unraid's GraphQL API directly?

Unraid 7.2+ ships a first-class GraphQL API at `/graphql`. Going through it (rather than a generic Docker-socket MCP) preserves Unraid-specific context — container templates, autostart ordering, update availability — and gives one consistent, authenticated surface for Docker, VMs, the array, shares, notifications, and UPS.

## Requirements

- **Unraid 7.2 or newer** with the API enabled (Settings → Management Access → API Keys).
- A scoped **API key** (prefer least privilege — grant only the resources/actions you intend to use).
- For self-hosting the server: **Node.js 22+** (or Docker).

## Configuration

All configuration is supplied via environment variables.

| Variable                 | Required | Default | Description                                                 |
| ------------------------ | -------- | ------- | ----------------------------------------------------------- |
| `UNRAID_API_URL`         | ✅       | —       | GraphQL endpoint, e.g. `https://tower.local/graphql`        |
| `UNRAID_API_KEY`         | ✅       | —       | Unraid API key (sent as `x-api-key`)                        |
| `UNRAID_TLS_SKIP_VERIFY` |          | `false` | Skip TLS verification (for Unraid's self-signed local cert) |
| `MCP_TRANSPORT`          |          | `stdio` | `stdio`, `http`, or `both`                                  |
| `MCP_HTTP_PORT`          |          | `3000`  | Port for the Streamable HTTP transport                      |
| `MCP_AUTH_TOKEN`         |          | —       | Optional bearer token required on the HTTP transport        |
| `MCP_READ_ONLY`          |          | `false` | Block all mutating tools                                    |
| `MCP_MAX_BATCH`          |          | `10`    | Blast-radius cap: max items a destructive op may affect     |
| `MCP_DENY_TOOLS`         |          | —       | Comma-separated tool names to disable                       |
| `LOG_LEVEL`              |          | `info`  | `debug`, `info`, `warn`, or `error`                         |
| `MCP_AUDIT_LOG`          |          | —       | Path to append an audit log of mutations                    |

> Pointing at a self-signed `https://` endpoint? Set `UNRAID_TLS_SKIP_VERIFY=true`. TLS-skip is scoped to this server's API client only.

## Usage

### Local (stdio)

```bash
pnpm install
pnpm build
UNRAID_API_URL=https://tower.local/graphql \
UNRAID_API_KEY=your-key \
UNRAID_TLS_SKIP_VERIFY=true \
node dist/index.js
```

Example Claude Desktop / Claude Code MCP client entry:

```json
{
  "mcpServers": {
    "unraid": {
      "command": "node",
      "args": ["/absolute/path/to/unraid-mcp/dist/index.js"],
      "env": {
        "UNRAID_API_URL": "https://tower.local/graphql",
        "UNRAID_API_KEY": "your-key",
        "UNRAID_TLS_SKIP_VERIFY": "true"
      }
    }
  }
}
```

### Network (Streamable HTTP)

Run the server with `MCP_TRANSPORT=http`; clients connect to `POST /mcp`. A `GET /healthz` liveness endpoint is also exposed. When `MCP_AUTH_TOKEN` is set, requests must send `Authorization: Bearer <token>`. Browser-`Origin` requests are rejected (DNS-rebinding protection).

## Safety model

Control operations are protected in layers:

1. **Policy floor** (independent of the client and model): `MCP_READ_ONLY`, the `MCP_MAX_BATCH` blast-radius cap, `MCP_DENY_TOOLS`, and an audit log.
2. **Human approval** for destructive operations: MCP elicitation where the client supports it, with a confirmation-token fallback otherwise.
3. **Batch approvals bound to the exact set of affected items**, so an approval can't be replayed against a different set.

## Roadmap

- **Phase 1 — Observability:** connection health ✅, then system info/metrics, array/parity status, disks, Docker containers/logs, VMs, shares, notifications, UPS.
- **Phase 2 — Safe control:** Docker and VM lifecycle, notifications.
- **Phase 3 — Gated destructive control:** array start/stop, parity checks, container/disk removal — behind the safety model above.
- **Distribution:** Docker image + Unraid Community Applications template.

## Development

```bash
pnpm install         # install (applies the bundled SDK patch)
pnpm check           # typecheck + lint + format:check + test
pnpm build           # compile to dist/
pnpm dev             # run via tsx with reload
pnpm exec vitest run -t "<name>"   # run a single test by name
```

See [CLAUDE.md](CLAUDE.md) for architecture notes and important toolchain gotchas (notably the committed `pnpm` patch that keeps the project compiling under strict TypeScript without `skipLibCheck`).

## License

[MIT](LICENSE) © Mike North
