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
    // Shorter timeouts for integration tests
    testTimeout: 5000, // 5 seconds for regular tests
    hookTimeout: 3000, // 3 seconds for hooks
    // Override for integration tests
    env: {
      NODE_ENV: 'test'
    },
    silent: false,
    setupFiles: ['tests/setup.js'],
    // Define test-specific overrides
    testTimeout: process.env.INTEGRATION_TEST ? 3000 : 10000, // 3s for integration, 10s for unit tests
    hookTimeout: process.env.INTEGRATION_TEST ? 2000 : 5000,   // 2s for integration, 5s for unit tests
  }
});