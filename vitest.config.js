import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Main test configuration (unit + integration)
    name: 'unit',
    environment: 'node',
    setupFiles: ['./tests/setup-vitest.js'],
    include: [
      'tests/unit/**/*.test.{js,jsx,ts,tsx}',
      'tests/integration/**/*.test.{js,jsx,ts,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/.cache/**',
      '**/e2e/**',
      '**/ui/**',  // Exclude UI tests
      '**/*.e2e.*',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.llm.*',
      '**/llms/**',
      '**/Ollama*',
      '**/embeddings/**',
      '**/search/SearchService.test.js'
    ],
    testTimeout: 30000,
    hookTimeout: 60000,
    globals: true,
    // Enable test isolation for better reliability
    isolate: true,
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'clover'],
      reportsDirectory: './coverage/unit',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/__mocks__/**',
        '**/*.test.{js,jsx,ts,tsx}',
        '**/ui/**',
        '**/types/**',
        '**/__tests__/**'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      },
      watermarks: {
        lines: [70, 90],
        functions: [70, 90],
        branches: [60, 80],
        statements: [70, 90]
      }
    }
  }
});