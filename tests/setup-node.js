// tests/setup-node.js - Node.js specific test setup for Vitest
import { beforeEach, afterEach, vi } from 'vitest';

// Set up Node.js environment variables for testing
process.env.NODE_ENV = 'test';
process.env.MCP_DEBUG = 'false';
process.env.MCP_PORT = '3001'; // Use different port for tests
process.env.MCP_HOST = 'localhost';

// Set test timeout
const DEFAULT_TIMEOUT = 10000; // 10s for Node.js tests

// Clean up console output during tests (optional - can be removed for debugging)
const SILENT_TESTS = process.env.SILENT_TESTS !== 'false';

if (SILENT_TESTS) {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });
}

// Clean up mocks after each test
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// Global test utilities for Node.js tests
global.testTimeout = DEFAULT_TIMEOUT;

// Mock common Node.js modules that might cause issues in tests
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    // Add any fs mocks if needed
  };
});

// Ensure process doesn't exit during tests
const originalExit = process.exit;
process.exit = vi.fn();

// Restore process.exit after all tests
if (typeof afterAll !== 'undefined') {
  afterAll(() => {
    process.exit = originalExit;
  });
}