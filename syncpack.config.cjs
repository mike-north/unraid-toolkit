/** @type {import("syncpack").RcFile} */
module.exports = {
  versionGroups: [
    {
      label: 'Use workspace protocol for internal packages',
      packages: ['**'],
      dependencies: ['@unraid-toolkit/*'],
      dependencyTypes: ['prod', 'dev'],
      pinVersion: 'workspace:*',
    },
  ],
  semverGroups: [
    {
      label: 'Pin TypeScript to a minor (api-extractor expects 5.9.x)',
      range: '~',
      packages: ['**'],
      dependencies: ['typescript'],
    },
    {
      label: 'Use caret ranges for external dependencies',
      range: '^',
      packages: ['**'],
      dependencies: ['**'],
    },
  ],
};
