import { defineConfig } from '@playwright/test';

/**
 * The designer's journeys run against `pnpm workbench`: the gateway over the
 * offline Tranquility fixture, and the designer on 5173 against it. CI
 * installs Playwright's Chromium; a machine with one already can name it
 * in PLAYWRIGHT_CHROMIUM_PATH.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.journey.ts',
  timeout: 60_000,
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    launchOptions: process.env['PLAYWRIGHT_CHROMIUM_PATH']
      ? { executablePath: process.env['PLAYWRIGHT_CHROMIUM_PATH'] }
      : {},
  },
  webServer: {
    command: 'pnpm workbench',
    cwd: '../..',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
