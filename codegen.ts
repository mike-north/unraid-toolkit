/**
 * GraphQL Code Generator configuration.
 *
 * Generates typed query/result types for the SDK from the vendored Unraid SDL
 * (`packages/sdk/src/unraid/schema.graphql`) and the `gql`-tagged operation
 * documents embedded in the SDK's operation modules.
 *
 * Output is a types-only module (`packages/sdk/src/unraid/generated.ts`): no
 * runtime values, no `graphql` imports — so it compiles cleanly under the
 * repo's strict TS config and is excluded from eslint/prettier/knip.
 *
 * Run `pnpm codegen` to regenerate, `pnpm codegen:check` to verify the checked-in
 * output is in sync.
 *
 * @see https://the-guild.dev/graphql/codegen/docs/getting-started
 * @see https://docs.unraid.net/API/
 */

import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'packages/sdk/src/unraid/schema.graphql',
  // Operations live as `gql`-tagged template literals inside the SDK's
  // operation modules; codegen plucks them from the source.
  documents: ['packages/sdk/src/operations/**/*.ts'],
  ignoreNoDocuments: false,
  generates: {
    'packages/sdk/src/unraid/generated.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        // Pass-through domain types should not carry __typename noise.
        skipTypename: true,
        // verbatimModuleSyntax: any type imports must be `import type`.
        useTypeImports: true,
        // Avoid runtime enum objects (isolatedModules-safe); use string unions.
        enumsAsTypes: true,
        // exactOptionalPropertyTypes: model schema-nullable fields as
        // value-nullable required properties (`T | null`) rather than `?:`.
        // Input/variable optionals stay `?:` so callers may omit them.
        avoidOptionals: { field: true, object: true, inputValue: false, defaultValue: false },
        maybeValue: 'T | null',
        scalars: {
          DateTime: 'string',
          // Unraid serializes BigInt scalars as JSON numbers (KB or byte counts;
          // well within Number.MAX_SAFE_INTEGER for realistic hardware).
          BigInt: 'number',
          JSON: 'unknown',
          Port: 'number',
          URL: 'string',
          PrefixedID: 'string',
        },
        defaultScalarType: 'unknown',
      },
    },
  },
};

export default config;
