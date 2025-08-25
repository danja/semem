import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.js';

// Full integration tests - Requires all external services
export default mergeConfig(sharedConfig, defineConfig({
  test: {
    name: 'integration',
    include: [
      'tests/integration/**/*.test.{js,jsx,ts,tsx}'
    ],
    exclude: [
      'tests/integration/sparql/**',
      'tests/integration/storage/**',
      'tests/integration/ragno/**',
      'tests/integration/llms/**',
      'tests/integration/embeddings/**',
      'tests/integration/extract-concepts-*'
    ],
    testTimeout: 180000, // Very long timeout for full integration
    hookTimeout: 300000,
    coverage: {
      reportsDirectory: './coverage/integration',
      thresholds: {
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40
      }
    }
  }
}));