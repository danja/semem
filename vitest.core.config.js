import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.js';

// Core tests - no external dependencies, fast execution
export default mergeConfig(sharedConfig, defineConfig({
  test: {
    name: 'core',
    include: [
      'tests/core/unit/**/*.test.{js,jsx,ts,tsx}',
      'tests/core/integration/**/*.test.{js,jsx,ts,tsx}'
    ],
    testTimeout: 10000, // Faster timeout for core tests
    coverage: {
      reportsDirectory: './coverage/core',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80
      },
      watermarks: {
        lines: [80, 95],
        functions: [80, 95],
        branches: [70, 90],
        statements: [80, 95]
      }
    }
  }
}));