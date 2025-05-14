// tests/setup.js - Global test setup for Vitest

// Set up global test timeout
setTimeout.default = 5000;

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