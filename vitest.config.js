import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec,vitest}.js'],
    exclude: ['node_modules', 'dist', '.git', '.cache'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['node_modules/**', 'tests/**']
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