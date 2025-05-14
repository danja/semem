// tests/setup.js - Global test setup for Vitest
import { beforeEach, afterEach, vi } from 'vitest';
import { registerCustomMatchers } from './helpers/testSetup.js';
import './helpers/setupGlobals.js'; // Import polyfills

// Set up global test timeout
setTimeout.default = 5000;

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