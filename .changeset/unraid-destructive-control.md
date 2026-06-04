---
'@unraid-toolkit/sdk': minor
'@unraid-toolkit/mcp': minor
'@unraid-toolkit/cli': minor
'unraid-toolkit': minor
---

Add gated destructive control operations with layered human-in-the-loop approval.

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
