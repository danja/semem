// Global test setup for Vitest
import { vi } from 'vitest';
import fetch from 'node-fetch';

// Set test timeouts
const TEST_TIMEOUT = 10000; // 10s
global.TEST_TIMEOUT = TEST_TIMEOUT;

// Make fetch available globally for integration tests
global.fetch = fetch;

// Global test utilities
global.createTestContext = () => ({
  // Add any test context here
  timestamp: new Date().toISOString(),
});

// Set environment variables
process.env.NODE_ENV = 'test';
process.env.MCP_DEBUG = 'false';
process.env.MCP_PORT = '3001';
process.env.MCP_HOST = 'localhost';
