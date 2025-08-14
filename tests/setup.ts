// Global test setup for Vitest
import { vi, expect, afterEach, beforeAll, afterAll } from 'vitest';
// import matchers from '@testing-library/jest-dom/matchers';
// import { cleanup } from '@testing-library/react';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

// Extend Vitest's expect with DOM matchers - commented out due to missing package
// expect.extend(matchers);

// Global mocks and utilities
global.console = {
  ...console,
  // Override console methods to reduce test noise
  log: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

// Setup MSW for API mocking
export const server = setupServer(
  rest.get('*', (req, res, ctx) => {
    console.warn(`Unhandled GET request: ${req.url.toString()}`);
    return res(ctx.status(404), ctx.json({ error: 'Not found' }));
  }),
  rest.post('*', (req, res, ctx) => {
    console.warn(`Unhandled POST request: ${req.url.toString()}`);
    return res(ctx.status(404), ctx.json({ error: 'Not found' }));
  })
);

// Setup before all tests
beforeAll(() => {
  // Start the mock server
  server.listen({ onUnhandledRequest: 'warn' });
  
  // Set test timezone for consistent results
  process.env.TZ = 'UTC';
});

// Cleanup after each test
afterEach(() => {
  // Cleanup DOM - commented out due to missing dependency
  // cleanup();
  
  // Reset all mocks
  vi.clearAllMocks();
  
  // Reset the mock server handlers
  server.resetHandlers();
  
  // Reset fetch mock
  fetchMock.mockReset();
});

// Cleanup after all tests
afterAll(() => {
  // Close the mock server
  server.close();
  
  // Restore original console methods
  vi.restoreAllMocks();
});

// Re-export test utilities
export * from './helpers/testUtils';

// Mock commonly used modules
vi.mock('node-fetch', () => ({
  default: vi.fn(),
  __esModule: true,
}));

// Mock environment variables
vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('MCP_DEBUG', 'false');
vi.stubEnv('MCP_PORT', '3001');
vi.stubEnv('MCP_HOST', 'localhost');

// Mock timers
vi.useFakeTimers();

// Mock dates for consistent testing
const mockDate = new Date('2025-01-01T00:00:00.000Z');
vi.setSystemTime(mockDate);

// Global test utilities
global.waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Vi {
    interface JestAssertion<T = any>
      extends jest.Matchers<void, T>,
        TestingLibraryMatchers<T, void> {}
  }
}
