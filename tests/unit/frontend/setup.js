// Setup file for frontend unit tests
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock browser globals
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost',
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = {
  userAgent: 'node.js',
};

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

global.localStorage = localStorageMock;

// Mock fetch
global.fetch = vi.fn();

// Mock performance API
global.performance = {
  now: () => Date.now(),
};

// Reset mocks and cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
  cleanup();
  localStorage.clear();
});
