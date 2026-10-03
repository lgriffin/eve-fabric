import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      name: '@eve-fabric/designer',
      setupFiles: ['./tests/setup.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        thresholds: { lines: 60, statements: 60, functions: 55, branches: 55 },
      },
    },
  }),
);
