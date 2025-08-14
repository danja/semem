import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'workbench',
    environment: 'node',
    setupFiles: ['./tests/setup-vitest.js'], // Use the simpler setup
    include: [
      'tests/unit/frontend/workbench/**/*.test.{js,jsx,ts,tsx}'
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**'
    ],
    testTimeout: 10000,
    globals: true,
    isolate: true
  }
});