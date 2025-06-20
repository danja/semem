import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      // Node.js tests (MCP and backend)
      {
        name: 'node',
        environment: 'node',
        setupFiles: ['./tests/setup-node.js'],
        include: [
          'tests/unit/mcp/**/*.{test,spec}.{js,jsx,ts,tsx}',
          'tests/unit/**/!(frontend)/**/*.{test,spec}.{js,jsx,ts,tsx}',
          'tests/integration/**/*.{test,spec}.{js,jsx,ts,tsx}'
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
          '**/search/SearchService.test.js',
          '**/frontend/**'
        ],
        globals: true,
        testTimeout: 10000,
        hookTimeout: 5000,
        env: {
          NODE_ENV: 'test'
        }
      },
      // Browser/JSDOM tests (frontend)
      {
        name: 'jsdom',
        environment: 'jsdom',
        setupFiles: ['./tests/setup.js'],
        include: [
          'tests/unit/frontend/**/*.{test,spec}.{js,jsx,ts,tsx}'
        ],
        exclude: [
          'node_modules',
          'dist',
          '.git',
          '.cache',
          '**/e2e/**',
          '**/*.e2e.*',
          '**/playwright-report/**',
          '**/test-results/**'
        ],
        globals: true,
        testTimeout: 10000,
        hookTimeout: 5000,
        env: {
          NODE_ENV: 'test'
        }
      }
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.js', 'mcp/**/*.js'],
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
    silent: false
  }
});