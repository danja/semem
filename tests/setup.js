// tests/setup.js - Global test setup for Vitest
import { beforeEach, afterEach, vi } from 'vitest';
import { registerCustomMatchers } from './helpers/testSetup.js';
import './helpers/setupGlobals.js'; // Import polyfills

// Set up test timeouts based on test type
const isIntegrationTest = process.env.INTEGRATION_TEST === 'true';
const DEFAULT_TIMEOUT = isIntegrationTest ? 3000 : 10000; // 3s for integration, 10s for unit tests
setTimeout.default = DEFAULT_TIMEOUT;

// Set test timeout for all tests
if (typeof beforeEach === 'function') {
  beforeEach(() => {
    // Set default test timeout
    vi.setConfig({ testTimeout: DEFAULT_TIMEOUT });
  });
}

// Register custom matchers
registerCustomMatchers();

// Mock console methods to avoid cluttering test output
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

// Clean up mocks after tests
afterEach(() => {
  vi.restoreAllMocks();
});