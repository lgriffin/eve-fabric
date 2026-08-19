/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  mutate: [
    'packages/compiler/src/**/*.ts',
    'packages/planner/src/**/*.ts',
    '!packages/compiler/src/**/*.test.ts',
    '!packages/compiler/src/**/*.spec.ts',
    '!packages/compiler/src/**/index.ts',
    '!packages/compiler/src/**/*.d.ts',
    '!packages/planner/src/**/*.test.ts',
    '!packages/planner/src/**/*.spec.ts',
    '!packages/planner/src/**/index.ts',
    '!packages/planner/src/**/*.d.ts',
  ],
  testRunner: 'vitest',
  mutator: {
    name: 'typescript',
  },
  incremental: true,
  thresholds: {
    high: 80,
    low: 60,
    break: 50,
  },
  reporters: ['json', 'html'],
  jsonReporter: {
    fileName: 'reports/mutation/mutation.json',
  },
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },
  concurrency: 4,
  timeoutMS: 30000,
};

export default config;
