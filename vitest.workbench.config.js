import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.js';

// Workbench tests - Frontend workbench interface
export default mergeConfig(sharedConfig, defineConfig({
  test: {
    name: 'workbench',
    include: [
      'tests/ui/workbench/**/*.test.{js,jsx,ts,tsx}',
      'tests/unit/frontend/workbench/**/*.test.{js,jsx,ts,tsx}' // Keep existing tests
    ],
    testTimeout: 20000,
    environment: 'jsdom', // Browser environment for frontend tests
    coverage: {
      reportsDirectory: './coverage/workbench',
      thresholds: {
        lines: 65,
        functions: 65,
        branches: 55,
        statements: 65
      }
    }
  }
}));