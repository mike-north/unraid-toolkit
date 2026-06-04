---
'@unraid-toolkit/sdk': minor
'@unraid-toolkit/mcp': minor
'@unraid-toolkit/cli': minor
'unraid-toolkit': minor
---

Add read-only observability operations across the toolkit.

The SDK gains typed operations (returning the `UnraidResult` envelope) for system
info and live metrics; array state, capacity, and parity status plus parity-check
history; physical disks; Docker containers, container detail, logs, and update
status; virtual machines; user shares; notifications and a severity overview; and
UPS battery/power telemetry. List operations support `limit`/`offset` paging and a
character-budget guard that flags truncated results.

Each operation is surfaced as a read-only MCP tool (`unraid_*`) and a CLI
subcommand grouped by domain (`unraid system|array|disks|docker|vm|shares|notifications|ups …`).

GraphQL operations are now generated and type-checked against a vendored copy of
the Unraid GraphQL schema via GraphQL Code Generator (`pnpm codegen`).
