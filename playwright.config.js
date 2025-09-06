// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  testMatch: ['**/e2e/**/*.test.js', '**/ui/**/*.e2e.js'],
  fullyParallel: false, // Run tests sequentially for integration tests
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 1, // Single worker for integration tests
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['junit', { outputFile: 'test-results/playwright-results.xml' }],
    ['list']
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
        // Increase viewport for workbench UI
        viewport: { width: 1280, height: 720 },
        // Enable console logging
        launchOptions: {
          args: ['--enable-logging', '--v=1']
        }
      },
    },
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 }
      },
    },
  ],
  // Output directories
  outputDir: 'test-results/e2e-artifacts',
  
  webServer: {
    command: 'npm run mcp:http',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
