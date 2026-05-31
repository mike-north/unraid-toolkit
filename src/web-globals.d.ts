/**
 * Ambient declaration for the fetch-API `HeadersInit` type.
 *
 * Several dependencies' shipped declarations — the MCP SDK's
 * `shared/transport.d.ts` and graphql-request — reference the global
 * `HeadersInit` type that normally comes from the DOM/fetch lib. This project
 * targets a Node lib (`ES2023`) without `DOM`, and `@types/node` does not
 * expose `HeadersInit` as a global, so we declare it here.
 *
 * Declaring it lets those third-party declarations type-check WITHOUT enabling
 * `skipLibCheck` or pulling the entire DOM lib into a Node project.
 */
declare global {
  type HeadersInit = Headers | [string, string][] | Record<string, string>;
}

export {};
