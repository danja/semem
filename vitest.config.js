import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.js'],
    exclude: ['node_modules', 'dist', '.git', '.cache'],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html'],
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