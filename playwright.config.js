// ═══════════════════════════════════════════════════════════════
// playwright.config.js — E2E Test Configuration
//
// Runs tests against the production build served from dist/.
// Requires: `npm run build` then server on port 8080 before testing.
// ═══════════════════════════════════════════════════════════════

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './test/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/e2e-results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 }, // iPhone 14 size — mobile-first design
      },
    },
  ],
});
