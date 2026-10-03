import { defineConfig } from 'vitest/config';
import { fabricSources } from '../../vitest.sources.js';

export default defineConfig({
  test: {
    name: '@eve-fabric/cli',
  },
  resolve: { alias: fabricSources },
});
