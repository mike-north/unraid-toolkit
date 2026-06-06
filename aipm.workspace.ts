import { defineWorkspace } from '@ai-plugin-marketplace/core';

/**
 * Opts this repo into marketplace-registry generation. The presence of this
 * file makes `aipm build` emit the per-target `marketplace.json` registries
 * (and any repo-root Gemini/Kiro artifacts) from this metadata plus the
 * discovered plugins under `agent-plugins/`.
 */
export default defineWorkspace({
  marketplace: {
    name: 'unraid-toolkit',
    owner: { name: 'Mike North', email: 'michael.l.north@gmail.com' },
    description:
      'Agent plugins for observing and controlling an Unraid server via the unraid-toolkit toolkit.',
  },
});
