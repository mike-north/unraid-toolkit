---
'@unraid-toolkit/cli': patch
'@unraid-toolkit/mcp': patch
'unraid-toolkit': patch
---

Report the real package version instead of a hardcoded literal. `unraid --version`
and the MCP server's initialize handshake previously returned a stale `0.1.0`
regardless of the installed release; both now read the version from their
package's `package.json` at runtime.
