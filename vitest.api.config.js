import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.js';

// API tests - HTTP server and endpoint functionality
export default mergeConfig(sharedConfig, defineConfig({
  test: {
    name: 'api',
    include: [
      'tests/api/http/**/*.test.{js,jsx,ts,tsx}'
    ],
    testTimeout: 30000,
    coverage: {
      reportsDirectory: './coverage/api',
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  }
}));