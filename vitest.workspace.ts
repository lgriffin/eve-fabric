import { defineWorkspace } from 'vitest/config';
import { fabricSources } from './vitest.sources.js';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'apps/*/vitest.config.ts',
  {
    test: {
      name: 'unit',
      include: ['packages/*/tests/**/*.test.ts', 'examples/**/*.test.ts'],
    },
    resolve: { alias: fabricSources },
  },
]);
