/**
 * Ambient declaration for the fetch-API `HeadersInit` type.
 *
 * This umbrella re-exports `@unraid-toolkit/mcp`, whose public types transitively
 * reference `@modelcontextprotocol/sdk`'s declarations that use the global
 * `HeadersInit`. We target a Node lib (`ES2024`) without `DOM`, and
 * `@types/node` does not expose `HeadersInit` as a global, so we declare it
 * here — keeping the build green WITHOUT `skipLibCheck` or the DOM lib.
 */
declare global {
  type HeadersInit = Headers | [string, string][] | Record<string, string>;
}

export {};
