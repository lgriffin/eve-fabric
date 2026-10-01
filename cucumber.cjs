module.exports = {
  default: {
    requireModule: ['tsx'],
    require: ['packages/core/tests/bdd/steps/**/*.steps.ts'],
    paths: ['packages/core/tests/bdd/features/**/*.feature'],
    worldParameters: {},
    format: ['progress-bar', 'html:reports/cucumber-report.html'],
  },
  // The question bank (constitution 2.0.0, FAB-BANK-01). Run through
  // scripts/question-bank.ts, which counts the questions that pass.
  bank: {
    requireModule: ['tsx'],
    require: ['bank/steps/**/*.steps.ts'],
    paths: ['bank/features/**/*.feature'],
    format: ['message:reports/bank/messages.ndjson'],
    strict: true,
  },
};
