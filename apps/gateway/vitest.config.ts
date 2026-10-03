import { defineConfig } from 'vitest/config';
import { createRequire } from 'module';
import { fabricSources } from '../../vitest.sources.js';

const require = createRequire(import.meta.url);
const graphqlPath = require.resolve('graphql');

export default defineConfig({
  test: {
    passWithNoTests: true,
  },
  resolve: {
    alias: [...fabricSources, { find: 'graphql', replacement: graphqlPath }],
    dedupe: ['graphql'],
  },
});
