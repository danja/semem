// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  testMatch: ['**/e2e/**/*.test.js', '**/ui/**/*.e2e.js', '**/workbench/**/*.test.js'],
  fullyParallel: false, // Run tests sequentially for integration tests
  forbidOnly: !!process.env.CI,
  retries: 0, // Disable retries to prevent repeated browser restarts
  workers: process.env.CI ? 1 : 1, // Single worker for integration tests
  reporter: [
    ['list'], // Use the list reporter for detailed error messages
  ],
  timeout: 60 * 1000, // 1 minute per test for integration
  expect: {
    timeout: 10000 // 10 seconds for assertions
  },
  use: {
    baseURL: process.env.WORKBENCH_URL || 'http://localhost:4102',
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
          args: ['--enable-logging', '--v=1'],
          headless: false // Ensure the browser is visible
        }
      },
    },
  ],
  // Output directories
  outputDir: 'test-results/e2e-artifacts',
});
