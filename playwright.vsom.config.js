// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for VSOM standalone testing
 * Assumes servers are already running
 */
export default defineConfig({
  testDir: './src/frontend/vsom-standalone/tests',
  testMatch: ['**/e2e/**/*.test.js'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'test-results/vsom-playwright-report' }],
    ['junit', { outputFile: 'test-results/vsom-playwright-results.xml' }],
    ['list']
  ],
  timeout: 60 * 1000,
  expect: {
    timeout: 10000
  },
  use: {
    baseURL: 'http://localhost:4103',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          args: ['--enable-logging', '--v=1']
        }
      },
    }
  ],
  outputDir: 'test-results/vsom-e2e-artifacts',
});