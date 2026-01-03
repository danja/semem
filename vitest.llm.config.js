import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedConfig } from './vitest.shared.js';

// LLM tests - Requires chat completion and embedding providers
export default mergeConfig(sharedConfig, defineConfig({
  test: {
    name: 'llm',
    include: [
      'tests/integration/llm/**/*.test.{js,jsx,ts,tsx}',
      'tests/integration/llms/**/*.test.{js,jsx,ts,tsx}',
      'tests/integration/embeddings/**/*.test.{js,jsx,ts,tsx}',
      'tests/integration/extract-concepts-*.test.{js,jsx,ts,tsx}'
    ],
    testTimeout: 120000, // Very long timeout for LLM operations
    hookTimeout: 180000,
    coverage: {
      reportsDirectory: './coverage/llm',
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 40,
        statements: 50
      }
    }
  }
}));
