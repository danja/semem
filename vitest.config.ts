import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
  test: {
    // Test environment
    environment: 'node',
    globals: true,
    
    // Test timeouts
    testTimeout: 10000, // 10s default timeout
    hookTimeout: 30000, // 30s for hooks
    teardownTimeout: 60000, // 60s for teardown
    
    // Watch mode
    watch: false,
    
    // Test reporters
    reporters: ['default'],
    
    // Test coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/.{idea,git,cache,output,temp}/**',
        '**/*.d.ts',
        '**/test{,s}/**',
        '**/__{test,mock}s__/**',
        '**/*.config.{js,ts}',
        '**/vitest.{workspace,projects}.{js,ts}'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    },
    
    // Test file matching
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    
    // Environment variables
    env: {
      NODE_ENV: 'test',
      MCP_DEBUG: 'false',
      MCP_PORT: '3001',
      MCP_HOST: 'localhost'
    },
    
    // Global setup files
    setupFiles: ['./tests/setup-unified.js'],
    
    // TypeScript support
    typecheck: {
      include: ['**/*.test-d.ts']
    },
    
    // Isolate tests for better reliability
    isolate: true,
    
    // Enable test retries
    retry: 2,
    
    // Test output settings
    logHeapUsage: true,
    logHeapUsageThreshold: 1024 * 1024, // 1MB
    
    // Watch mode settings
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.git/**'
    ]
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url))
    }
  }
});
