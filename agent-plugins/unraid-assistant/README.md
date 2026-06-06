# unraid-assistant

An AI assistant plugin that teaches an agent to observe and control an
[Unraid](https://unraid.net) server through the **unraid-toolkit** toolkit — either the
`unraid_*` **MCP tools** or the `unraid` **CLI** — including the read-only / safe-write /
destructive safety model that gates writes.

The plugin ships:

- **A skill** (`skills/unraid-assistant/SKILL.md`) — the tool/command map across all eight
  domains (system, array & parity, disks, shares, UPS, Docker, VMs, notifications), the
  three-tier safety model and approval flow, and common recipes.
- **A bundled MCP server** (`.mcp.json`) — runs `docker.io/mikenorth/unraid-mcp` over stdio,
  configured **read-only by default** for safety.

## Installation

Install via your host's marketplace flow (this repo is an `aipm` marketplace):

- **Claude Code / Cursor:** `/plugin marketplace add mike-north/unraid-toolkit`
- **Codex:** `codex plugin marketplace add mike-north/unraid-toolkit`

## Configuration

Set these in your environment before using the MCP server (see the skill for full detail):

| Variable                 | Meaning                                                    |
| ------------------------ | ---------------------------------------------------------- |
| `UNRAID_API_URL`         | GraphQL endpoint, e.g. `https://tower.local/graphql`       |
| `UNRAID_API_KEY`         | Unraid API key (Settings → Management Access → API Keys)   |
| `UNRAID_TLS_SKIP_VERIFY` | `true` to accept Unraid's self-signed local cert           |
| `MCP_READ_ONLY`          | Defaults to `true`; set `false` to enable control (writes) |

The bundled `.mcp.json` launches the server with Docker over stdio. Alternatives the skill
documents: pointing a client at an MCP server already running on the Unraid box over HTTP, or
running the `unraid` CLI directly (no MCP) — install it with `npm i -g unraid-toolkit`.

## Targets

This plugin targets **Claude Code, Codex, Cursor, and Vercel**. Gemini and Kiro are intentionally
omitted: they install a single root extension that would copy this plugin's `README`/`LICENSE`
over the host software repo's own root files. Shipping those hosts would require a standalone repo.

## License

MIT © Mike North (inherits the repository [LICENSE](../../LICENSE)).
