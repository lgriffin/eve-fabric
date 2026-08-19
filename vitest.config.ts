import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        branches: 80,
        functions: 75,
        lines: 90,
        statements: 90,
      },
      exclude: [
        '**/*.d.ts',
        '**/dist/**',
        '**/build/**',
        '**/tests/**',
        '**/node_modules/**',
        '**/*.config.*',
        '**/*.conf.*',
        '**/index.ts',
        'scripts/**',
        'apps/designer/**',
        'cucumber.cjs',
        'vitest.workspace.ts',
        'examples/**',
      ],
    },
  },
});
