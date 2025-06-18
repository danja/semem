// tests/setup.js - Global test setup for Vitest
import { beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { registerCustomMatchers } from './helpers/testSetup.js';
import './helpers/setupGlobals.js'; // Import polyfills

// Set up JSDOM for frontend tests
const { JSDOM } = await import('jsdom');

// Create a basic DOM environment
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost:3000',
  pretendToBeVisual: true,
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock requestAnimationFrame
global.requestAnimationFrame = (callback) => {
  return setTimeout(callback, 0);
};

global.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

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

// Mock D3.js
global.d3 = {
  select: vi.fn().mockReturnThis(),
  selectAll: vi.fn().mockReturnThis(),
  append: vi.fn().mockReturnThis(),
  attr: vi.fn().mockReturnThis(),
  style: vi.fn().mockReturnThis(),
  on: vi.fn().mockReturnThis(),
  data: vi.fn().mockReturnThis(),
  enter: vi.fn().mockReturnThis(),
  exit: vi.fn().mockReturnThis(),
  remove: vi.fn().mockReturnThis(),
  transition: vi.fn().mockReturnThis(),
  duration: vi.fn().mockReturnThis(),
  delay: vi.fn().mockReturnThis()
};

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