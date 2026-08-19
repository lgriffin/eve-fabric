import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
  'apps/*/vitest.config.ts',
  {
    test: {
      name: 'unit',
      include: ['packages/*/tests/**/*.test.ts'],
    },
  },
]);
