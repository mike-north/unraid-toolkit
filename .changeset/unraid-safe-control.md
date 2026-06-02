---
'@unraid-cli/sdk': minor
'@unraid-cli/mcp': minor
'@unraid-cli/cli': minor
'unraid-cli': minor
---

Add safe control (write) operations.

The SDK gains lifecycle mutations returning the `UnraidResult` envelope: Docker
`startContainer`/`stopContainer`/`pauseContainer`/`unpauseContainer`/`updateContainer`/`updateAllContainers`;
VM `startVm`/`stopVm`/`pauseVm`/`resumeVm`; and notification `createNotification`/`archiveNotification`/`unarchiveNotification`.

Each is exposed as a write MCP tool (`unraid_docker_*`, `unraid_vm_*`,
`unraid_*_notification`) and a CLI subcommand (`unraid docker start|stop|pause|unpause|update|update-all`,
`unraid vm start|stop|pause|resume`, `unraid notifications create|archive|unarchive`).

A read-only policy floor (`MCP_READ_ONLY`) short-circuits every MCP control tool
with a structured error when enabled, independent of the client or model.
