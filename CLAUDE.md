# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A toolkit for observing and controlling an **Unraid** server via its built-in **GraphQL API** (`/graphql`, Unraid 7.2+, `x-api-key` auth), structured as a **core SDK with thin CLI and MCP wrappers**. We talk to Unraid's GraphQL directly (not a generic Docker-socket MCP), preserving Unraid context (templates, autostart, update status).

The design + phased roadmap lives in the approved plan at `~/.claude/plans/i-want-to-create-generic-unicorn.md`.

## Monorepo layout

pnpm workspace + TypeScript **project references** (composite, `tsc --build`). Dependency direction is strictly **wrappers → SDK**; never the reverse.

| Package (dir)             | Name                  | Role                                                                                                          |
| ------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------- |
| `packages/sdk`            | `@unraid-toolkit/sdk` | **Core.** GraphQL client, connection config/auth, validation, domain ops, structured errors, result envelope. |
| `packages/mcp`            | `@unraid-toolkit/mcp` | MCP server (bin `unraid-mcp`). Thin adapter: SDK ops → MCP tools.                                             |
| `packages/cli`            | `@unraid-toolkit/cli` | Commander CLI (bin `unraid`). Thin adapter: flags → SDK ops → stdout.                                         |
| `packages/unraid-toolkit` | `unraid-toolkit`      | Umbrella: re-exports all three; ships the `unraid` binary.                                                    |

Internal deps use `workspace:*` (enforced by syncpack). Each package `tsconfig.json` extends `tsconfig.base.json` and lists `references` to its dependency packages.

## The SDK ↔ wrapper boundary (most important concept)

The SDK owns **all logic and returns a result envelope**; wrappers never throw-handle or reimplement.

- **`UnraidResult<T>`** (`packages/sdk/src/result.ts`) — a discriminated `{ success, data, error }` envelope. Every SDK operation returns it; operations catch transport errors internally and convert them with `toUnraidError` (`errors.ts`) into a structured `UnraidError` (`{ code, message, details? }`). Operations **do not throw** for expected failures.
- **SDK operations** live in `packages/sdk/src/operations/*.ts` as functions taking an `UnraidClient` (e.g. `getHealth(client)`). `UnraidClient` (`client.ts`) is the single GraphQL boundary: `x-api-key` auth, per-request timeout, and client-scoped TLS-skip via an undici `Agent` dispatcher (never global `NODE_TLS_REJECT_UNAUTHORIZED`).
- **Connection config** (`config.ts`) is the SDK's only config concern: `resolveConnectionConfig(overrides, env)` layers explicit overrides over `UNRAID_API_URL`/`UNRAID_API_KEY`/`UNRAID_TLS_SKIP_VERIFY`. Wrappers reuse it.
- **Wrappers adapt the envelope once**: MCP's `formatResult` (`packages/mcp/src/format.ts`) → `CallToolResult`; CLI's `output` (`packages/cli/src/output.ts`) → stdout/stderr. Add a tool group via `packages/mcp/src/tools/<domain>.ts` (`register*Tools`); add a CLI command via `packages/cli/src/commands/<domain>.ts`. Runtime/server concerns (transports, ports, read-only, log level) live in the **wrapper** configs, not the SDK.

## Commands

Package manager is **pnpm**. Use `pnpm exec`, never `npx`.

| Task                        | Command                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| Build all (incremental)     | `pnpm build` (`tsc --build`)                                        |
| Full CI gate                | `pnpm check` (build + lint + format:check + syncpack + knip + test) |
| Lint / fix                  | `pnpm lint` / `pnpm lint:fix`                                       |
| Format / check              | `pnpm format` / `pnpm format:check`                                 |
| Test all                    | `pnpm test`                                                         |
| Test one package            | `pnpm -F @unraid-toolkit/sdk test`                                  |
| Single test by name         | `pnpm -F @unraid-toolkit/sdk exec vitest run -t "<name>"`           |
| Dep consistency / dead code | `pnpm syncpack:check` / `pnpm knip`                                 |
| Record a release            | `pnpm changeset`                                                    |

## Critical gotchas

- **Do NOT set `esModuleInterop: false`.** `module: NodeNext` implies `esModuleInterop: true`, which is required to compile zod 4's shipped `.d.cts` declarations under `skipLibCheck:false`. The base config omits the flag (inherits the NodeNext default). Forcing it false breaks the build with ~50 zod TS1259 errors.
- **Do NOT enable `skipLibCheck` or disable `exactOptionalPropertyTypes`.** The official `@modelcontextprotocol/sdk` ships `streamableHttp.d.ts` with accessor types incompatible with strict checking; this is fixed by a committed **pnpm patch** (`patches/@modelcontextprotocol__sdk@1.29.0.patch`, wired via `pnpm-workspace.yaml`) that narrows the transport getters. **Bumping the SDK version** will likely break the patch — re-create with `pnpm patch @modelcontextprotocol/sdk@<version>` (narrow `get sessionId/onclose/onerror/onmessage`, drop `| undefined`) in both `dist/esm` and `dist/cjs`.
- **`web-globals.d.ts`** declares the global `HeadersInit` type. It must exist in **every package whose compilation sees** the fetch-typed third-party declarations: `packages/sdk` (graphql-request), `packages/mcp` (MCP SDK transport), and `packages/unraid-toolkit` (transitively, via re-exporting `@unraid-toolkit/mcp`'s `McpServer`-typed API). Don't delete these — without them, `skipLibCheck:false` fails.
- **NodeNext + `verbatimModuleSyntax`**: relative imports MUST carry a `.js` extension; type-only imports MUST use `import type`.
- **Zod 4** (not 3): use `z.enum`; customize required-field messages with `z.string({ error: '...' })` (the bare default emits "expected string, received undefined" for missing fields).
- **MCP/CLI entry files guard `main()`** behind an `import.meta.url` main-module check so the umbrella can re-export them without side effects.

## Conventions

- Tests: Vitest. Include negative paths; every bug fix gets a regression test. Use fixed date constants / `vi.useFakeTimers()` — never `new Date()` in test data. When a test depends on the Unraid GraphQL schema, add an `@see` link to the authoritative docs.
- Releases via **Changesets** (`access: public`). Internal `@unraid-toolkit/*` deps are pinned to `workspace:*` (syncpack-enforced); `typescript` is pinned to a minor (`~`) because api-extractor expects 5.9.x.
