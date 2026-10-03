import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';
import { fabricSources } from '../../vitest.sources.js';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: '@eve-fabric/designer',
      // Playwright's journeys live in e2e/ and run on their own.
      include: ['tests/**/*.test.{ts,tsx}'],
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        thresholds: { lines: 90, statements: 90, functions: 75, branches: 80 },
      },
    },
    resolve: { alias: fabricSources },
  }),
);
