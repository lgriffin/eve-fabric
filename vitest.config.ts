import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      clean: true,
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
        'apps/gateway/**',
        'cucumber.cjs',
        'vitest.workspace.ts',
        'examples/**',
        'packages/core/src/execution-plan/execution-plan.ts',
        'packages/core/src/pipeline/pipeline-definition.ts',
        'packages/core/src/pipeline/pipeline-io.ts',
        'packages/core/src/pipeline/pipeline-node.ts',
        'packages/core/src/pipeline/pipeline-edge.ts',
        'packages/core/src/capability/capability-definition.ts',
        'packages/core/src/ports/**',
        'packages/core/src/provenance/provenance-record.ts',
        'packages/core/src/registry/registry-types.ts',
        'packages/core/src/discovery/discovery-types.ts',
      ],
    },
  },
});
