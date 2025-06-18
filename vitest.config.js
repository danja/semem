import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    environmentMatchGlobs: [
      ['**/frontend/**', 'jsdom']
    ],
    include: ['tests/unit/**/*.{test,spec,vitest}.{js,jsx,ts,tsx}'],
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
    testTimeout: 10000, // 10 second timeout for tests
    hookTimeout: 5000,  // 5 second timeout for hooks
    env: {
      NODE_ENV: 'test'
    },
    silent: false
  }
});