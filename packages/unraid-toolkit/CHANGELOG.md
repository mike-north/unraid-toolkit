# unraid-toolkit

## 0.2.1

### Patch Changes

- 66feb67: Report the real package version instead of a hardcoded literal. `unraid --version`
  and the MCP server's initialize handshake previously returned a stale `0.1.0`
  regardless of the installed release; both now read the version from their
  package's `package.json` at runtime.
- Updated dependencies [66feb67]
  - @unraid-toolkit/cli@0.2.1
  - @unraid-toolkit/mcp@0.2.1

## 0.2.0

### Minor Changes

- 6e9ee13: Add gated destructive control operations with layered human-in-the-loop approval.

  The SDK gains destructive mutations returning the `UnraidResult` envelope: array
  `setArrayState`, `addDiskToArray`/`removeDiskFromArray`, `mountArrayDisk`/`unmountArrayDisk`;
  parity `startParityCheck`/`pauseParityCheck`/`resumeParityCheck`/`cancelParityCheck`;
  Docker `removeContainer`; and VM `forceStopVm`/`rebootVm`/`resetVm`.

  Each destructive MCP tool (`destructiveHint: true`) is gated by two safety layers:
  - **Layer 1 — policy floor** (client/model-independent): `MCP_READ_ONLY` disables all
    writes; a deny-list (`MCP_DENY_TOOLS`, glob-aware) protects named targets; a
    blast-radius cap (`MCP_MAX_BATCH`) refuses oversized batches even when approved; and
    every attempt is written to an audit log (`MCP_AUDIT_LOG`, or stderr otherwise).
  - **Layer 2 — approval**: MCP elicitation when the client advertises it, else a
    confirmation-token gate. Approval is bound to a hash of the sorted target ids
    (confused-deputy guard): a token minted for one set cannot be replayed against another.

  CLI destructive subcommands (`array start|stop|add-disk|remove-disk|mount-disk|unmount-disk`,
  `parity start|pause|resume|cancel`, `docker remove`, `vm force-stop|reboot|reset`) require
  an explicit `--yes` confirmation flag.

- 48506a7: Add read-only observability operations across the toolkit.

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

- 6ba7d7c: Add safe control (write) operations.

  The SDK gains lifecycle mutations returning the `UnraidResult` envelope: Docker
  `startContainer`/`stopContainer`/`pauseContainer`/`unpauseContainer`/`updateContainer`/`updateAllContainers`;
  VM `startVm`/`stopVm`/`pauseVm`/`resumeVm`; and notification `createNotification`/`archiveNotification`/`unarchiveNotification`.

  Each is exposed as a write MCP tool (`unraid_docker_*`, `unraid_vm_*`,
  `unraid_*_notification`) and a CLI subcommand (`unraid docker start|stop|pause|unpause|update|update-all`,
  `unraid vm start|stop|pause|resume`, `unraid notifications create|archive|unarchive`).

  A read-only policy floor (`MCP_READ_ONLY`) short-circuits every MCP control tool
  with a structured error when enabled, independent of the client or model.

### Patch Changes

- f67bcea: Fix the CLI ignoring `UNRAID_TLS_SKIP_VERIFY` unless `--insecure` was passed.

  The `--insecure` flag defaulted to a concrete `false`, which shadowed the
  `UNRAID_TLS_SKIP_VERIFY` environment variable in the SDK's override layering, so
  connecting to a self-signed Unraid endpoint via the env var alone failed with
  `CONNECTION_FAILED`. An absent `--insecure` now maps to `undefined`, letting the
  env var apply; passing `--insecure` still forces TLS-skip on.

- e41312f: `createNotification` now returns a usable notification `id`.

  Unraid's create mutation echoes back a UUID-based id but stores the notification
  under a different, timestamp-based id, so the returned id could not be passed to
  `archiveNotification`/`unarchiveNotification` (they failed with not-found).
  `createNotification` now does a best-effort lookup of the unread queue and
  returns the notification with the server's canonical id, so the
  create → archive/unarchive flow works without an intervening list. If the lookup
  can't run (e.g. an API key with notification write but not read scope) or finds
  no match, the raw create response is returned unchanged.

- Updated dependencies [f67bcea]
- Updated dependencies [e41312f]
- Updated dependencies [6e9ee13]
- Updated dependencies [48506a7]
- Updated dependencies [6ba7d7c]
  - @unraid-toolkit/cli@0.2.0
  - @unraid-toolkit/sdk@0.2.0
  - @unraid-toolkit/mcp@0.2.0
