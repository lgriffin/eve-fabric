module.exports = {
  default: {
    requireModule: ['tsx'],
    require: ['packages/domain/tests/bdd/steps/**/*.steps.ts'],
    paths: ['packages/domain/tests/bdd/features/**/*.feature'],
    worldParameters: {},
    format: ['progress-bar', 'html:reports/cucumber-report.html'],
    publishQuiet: true,
  },
};
