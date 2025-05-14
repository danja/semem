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
    testTimeout: 10000,
    hookTimeout: 10000,
    silent: false,
    setupFiles: ['tests/setup.js']
  }
});