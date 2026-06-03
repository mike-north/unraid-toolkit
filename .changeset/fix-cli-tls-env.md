---
'@unraid-cli/cli': patch
'unraid-cli': patch
---

Fix the CLI ignoring `UNRAID_TLS_SKIP_VERIFY` unless `--insecure` was passed.

The `--insecure` flag defaulted to a concrete `false`, which shadowed the
`UNRAID_TLS_SKIP_VERIFY` environment variable in the SDK's override layering, so
connecting to a self-signed Unraid endpoint via the env var alone failed with
`CONNECTION_FAILED`. An absent `--insecure` now maps to `undefined`, letting the
env var apply; passing `--insecure` still forces TLS-skip on.
