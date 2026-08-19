import { defineConfig } from 'vitest/config';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const graphqlPath = require.resolve('graphql');

export default defineConfig({
  test: {
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      graphql: graphqlPath,
    },
    dedupe: ['graphql'],
  },
});
