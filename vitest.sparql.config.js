import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.js';

// SPARQL tests - Requires live SPARQL store
export default mergeConfig(sharedConfig, defineConfig({
  test: {
    name: 'sparql',
    include: [
      'tests/integration/sparql/**/*.test.{js,jsx,ts,tsx}',
      'tests/integration/storage/**/*.test.{js,jsx,ts,tsx}',
      'tests/integration/ragno/**/*.test.{js,jsx,ts,tsx}'
    ],
    testTimeout: 60000, // Longer timeout for SPARQL operations
    hookTimeout: 120000,
    coverage: {
      reportsDirectory: './coverage/sparql',
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60
      }
    }
  }
}));