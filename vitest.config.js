import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      ['**/frontend/**', 'jsdom']
    ],
    include: [
      'tests/unit/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}'
    ],
    exclude: [
      'node_modules',
      'dist',
      '.git',
      '.cache',
      '**/e2e/**',
      '**/*.e2e.*',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/*.llm.*',
      '**/llms/**',
      '**/Ollama*',
      '**/embeddings/**',
      '**/search/SearchService.test.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.js'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/e2e/**',
        '**/*.e2e.*',
        '**/playwright-report/**',
        '**/test-results/**'
      ]
    },
    reporters: ['default'],
    // Test timeouts - conditional based on test type
    testTimeout: process.env.INTEGRATION_TEST ? 30000 : 10000, // 30s for integration, 10s for unit tests
    hookTimeout: process.env.INTEGRATION_TEST ? 10000 : 5000,   // 10s for integration, 5s for unit tests
    env: {
      NODE_ENV: 'test'
    },
    silent: false,
    setupFiles: ['tests/setup.js']
  }
});