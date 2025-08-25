import { defineConfig } from 'vitest/config';

// Shared configuration for all test types
export const sharedConfig = {
  test: {
    environment: 'node',
    globals: true,
    isolate: true,
    setupFiles: ['./tests/helpers/testSetup.js'],
    testTimeout: 30000,
    hookTimeout: 60000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**',
      '**/.cache/**',
      '**/playwright-report/**',
      '**/test-results/**'
    ]
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'json', 'html', 'lcov', 'clover'],
    include: ['src/**/*.{js,jsx,ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/__mocks__/**',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/ui/**',
      '**/types/**',
      '**/__tests__/**',
      '**/temp/**'
    ]
  }
};

export default defineConfig(sharedConfig);