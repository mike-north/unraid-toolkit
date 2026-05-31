# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An MCP (Model Context Protocol) server that lets agents observe and control an **Unraid** server through Unraid's built-in **GraphQL API** (`/graphql`, Unraid 7.2+, `x-api-key` auth). It is distributed as a Docker container ("Unraid App" via Community Applications). We talk to Unraid's GraphQL directly rather than a generic Docker-socket MCP, so Unraid context (templates, autostart, update status) is preserved.

The full design + phased roadmap lives in the approved plan at `~/.claude/plans/i-want-to-create-generic-unicorn.md`.

## Commands

Package manager is **pnpm** (enforced via `packageManager`). Use `pnpm exec`, never `npx`/`pnpm dlx tsc`.

| Task                     | Command                                                  |
| ------------------------ | -------------------------------------------------------- |
| Build (emit to `dist/`)  | `pnpm build`                                             |
| Typecheck only           | `pnpm typecheck`                                         |
| Lint / autofix           | `pnpm lint` / `pnpm lint:fix`                            |
| Format / check           | `pnpm format` / `pnpm format:check`                      |
| Run all tests            | `pnpm test` (vitest)                                     |
| Watch tests              | `pnpm test:watch`                                        |
| Single test file         | `pnpm exec vitest run test/config.test.ts`               |
| Single test by name      | `pnpm exec vitest run -t "rejects missing api key"`      |
| Type-level tests         | `pnpm test:types` (tsd)                                  |
| Everything (CI gate)     | `pnpm check` (typecheck + lint + format + test)          |
| Regenerate GraphQL types | `pnpm codegen` (and `pnpm codegen:check` fails if stale) |
| Run locally (stdio)      | `UNRAID_API_URL=… UNRAID_API_KEY=… pnpm dev`             |

`/clean_blt` should pass before declaring a task complete.

## Architecture (big picture)

Request flow: **MCP client → transport → `McpServer` (tools) → `UnraidClient` (GraphQL) → Unraid**.

- **`src/index.ts`** — entry point. `loadConfig()` → build `ServerContext` → start the transport(s) chosen by `MCP_TRANSPORT` (`stdio` | `http` | `both`).
- **`src/server.ts`** — `buildServer(ctx)` constructs the `McpServer` and calls each domain's `register<Domain>Tools(server, ctx)`. **`ServerContext = { config, client, logger }`** is the shared dependency bag threaded everywhere. Adding a tool group = new `src/tools/<domain>.ts` exporting a `register*Tools` function, wired in `buildServer`.
- **`src/tools/*.ts`** — thin handlers. Each validates input with Zod, calls the GraphQL client, and returns via `toolResult()`/`errorResult()`. Tools declare `annotations` (readOnlyHint/destructiveHint/…) and both `inputSchema` and `outputSchema`. Tool names use `snake_case` with a service prefix (e.g. `unraid_array_status`).
- **`src/unraid/client.ts`** — the single GraphQL boundary. Wraps `graphql-request`, injects `x-api-key`, normalizes failures into `UnraidApiError` with agent-actionable messages. TLS-skip for self-signed local certs is scoped to this client via a per-instance **undici `Agent` dispatcher** (never the global `NODE_TLS_REJECT_UNAUTHORIZED`).
- **`src/transports/`** — `stdio.ts` (local) and `http.ts` (Streamable HTTP, the primary hosted transport). HTTP is **stateless**: a fresh `McpServer` + transport per request (`buildServer` is passed as a factory), with `Origin`-header rejection (DNS-rebinding) and optional bearer auth.
- **`src/config.ts`** — all config is env-driven; `loadConfig()` validates with Zod and throws one multi-line error listing every problem. Env vars: `UNRAID_API_URL`, `UNRAID_API_KEY`, `UNRAID_TLS_SKIP_VERIFY`, `MCP_TRANSPORT`, `MCP_HTTP_PORT`, `MCP_AUTH_TOKEN`, `MCP_READ_ONLY`, `MCP_MAX_BATCH`, `MCP_DENY_TOOLS`, `LOG_LEVEL`, `MCP_AUDIT_LOG`.
- **`src/format.ts`** — dual markdown/JSON output. Every tool takes `response_format` and returns a `ToolResult` (note: it has an `[key: string]: unknown` index signature so it stays assignable to the SDK's `CallToolResult`). Responses truncate at `CHARACTER_LIMIT`.
- **`src/log.ts`** — leveled logger that writes **only to stderr**. stdout is the stdio JSON-RPC channel; logging there corrupts the protocol.

### Safety model (planned, partially built)

Destructive control uses three layers (see plan): (1) a **policy floor** independent of client/model — `MCP_READ_ONLY`, `MCP_MAX_BATCH` blast-radius cap, `MCP_DENY_TOOLS`, audit log; (2) **approval UX** detected at `initialize` — MCP elicitation when the client advertises it, confirmation-token fallback otherwise; (3) batch approvals **bound to a hash of the enumerated item IDs** (confused-deputy guard). Keep this layering when implementing Phase 2/3 tools.

## Critical gotchas

- **Do NOT enable `skipLibCheck` or disable `exactOptionalPropertyTypes`.** The official `@modelcontextprotocol/sdk` ships `streamableHttp.d.ts` with accessor types incompatible with strict checking. This is fixed by a committed **pnpm patch** (`patches/@modelcontextprotocol__sdk@1.29.0.patch`, wired via `pnpm-workspace.yaml`) that narrows the transport getters. **If you bump the SDK version**, the patch will likely fail to apply — re-create it with `pnpm patch @modelcontextprotocol/sdk@<version>` (narrow the `get sessionId/onclose/onerror/onmessage` return types, drop `| undefined`) in both `dist/esm` and `dist/cjs`.
- **`src/web-globals.d.ts`** declares the global `HeadersInit` type. `graphql-request` and the SDK reference it but we target the Node `ES2023` lib (no `DOM`), and `@types/node` doesn't expose it as a global. Don't delete it — without it `skipLibCheck:false` fails to compile.
- **NodeNext + `verbatimModuleSyntax`**: relative imports MUST carry a `.js` extension (e.g. `./config.js`), and type-only imports MUST use `import type`.
- **Zod 4** (not 3): use `z.enum`, `z.strictObject`, top-level `z.url()`; avoid deprecated `.strict()`/`z.nativeEnum`.
- **`src/unraid/generated.ts`** is codegen output (excluded from lint/format/coverage). Edit `operations/*.graphql` + the vendored `schema.graphql` and run `pnpm codegen` instead.

## Conventions

- This is a publishable library + bin: api-extractor is configured; commit `/docs` and `/api-report`, gitignore `/temp`.
- Tests: Vitest for runtime, tsd for types. Include negative paths; every bug fix gets a regression test. Use fixed date constants / `vi.useFakeTimers()` — never `new Date()` in test data. When a test depends on the Unraid GraphQL schema, add an `@see` link to the authoritative docs.
