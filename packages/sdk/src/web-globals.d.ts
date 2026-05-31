/**
 * Ambient declaration for the fetch-API `HeadersInit` type.
 *
 * `graphql-request`'s shipped declarations reference the global `HeadersInit`
 * type from the DOM/fetch lib. This package targets a Node lib (`ES2024`)
 * without `DOM`, and `@types/node` does not expose `HeadersInit` as a global,
 * so we declare it here. This lets those third-party declarations type-check
 * WITHOUT enabling `skipLibCheck` or pulling the entire DOM lib into Node.
 */
declare global {
  type HeadersInit = Headers | [string, string][] | Record<string, string>;
}

export {};
