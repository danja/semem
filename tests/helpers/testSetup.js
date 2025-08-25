// tests/helpers/testSetup.js
import { vi, beforeEach, afterEach, expect, beforeAll, afterAll } from 'vitest';
import { VitestTestHelper } from './VitestTestHelper.js';
import ConfigFactory from './configFactory.js';
import ServiceChecker from './serviceChecks.js';

// Mock external dependencies that might not be available in test environment
vi.mock('d3', () => ({
  default: {
    select: vi.fn(() => ({
      selectAll: vi.fn(() => ({
        data: vi.fn(() => ({
          enter: vi.fn(() => ({
            append: vi.fn(() => ({
              attr: vi.fn(() => ({})),
              style: vi.fn(() => ({})),
              text: vi.fn(() => ({}))
            }))
          }))
        }))
      }))
    })),
    scaleLinear: vi.fn(() => ({
      domain: vi.fn(() => ({
        range: vi.fn(() => vi.fn())
      }))
    }))
  }
}));

// Global test setup
global.console = {
  ...console,
  // Reduce noise in tests unless explicitly needed
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: console.error // Keep errors visible for debugging
};

// Global service availability check
let serviceStatus = {};

beforeAll(async () => {
  // Check service availability at start of test run
  try {
    serviceStatus = await ServiceChecker.checkAllServices();
  } catch (error) {
    console.error('Service check failed:', error);
    serviceStatus = {};
  }
});

// Global test lifecycle hooks
beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Cleanup temporary config files
  ConfigFactory.cleanupTempFiles();
});

afterAll(() => {
  // Final cleanup
  ConfigFactory.cleanupTempFiles();
});

/**
 * Set up and tear down test utilities for Vitest tests
 */
export function setupTestEnvironment() {
    let mocks = new Set();
    let cleanupFunctions = new Set();
    let pendingPromises = new Set();
    
    // Before each test, set up console spies
    beforeEach(() => {
        // These spies are already set up in the global test setup,
        // but we're adding them here for completeness
        vi.spyOn(console, 'error');
        vi.spyOn(console, 'log');
        vi.spyOn(console, 'warn');
        vi.spyOn(console, 'debug');
        
        // Return an object with utility functions
        return {
            /**
             * Track a promise to ensure it completes before test teardown
             */
            trackPromise(promise) {
                pendingPromises.add(promise);
                promise.finally(() => pendingPromises.delete(promise));
                return promise;
            },
            
            /**
             * Add a mock to be cleaned up after the test
             */
            addMock(mock) {
                mocks.add(mock);
                return mock;
            },
            
            /**
             * Add a cleanup function to be called after the test
             */
            addCleanup(fn) {
                cleanupFunctions.add(fn);
                return fn;
            },
            
            /**
             * Create a resolved promise for testing
             */
            mockPromise(value) {
                return Promise.resolve(value);
            },
            
            /**
             * Create a rejected promise for testing
             */
            mockRejection(error) {
                return Promise.reject(error instanceof Error ? error : new Error(error));
            },
            
            /**
             * Set up mock timers
             */
            setupTimers() {
                vi.useFakeTimers();
            },

            /**
             * Get service availability status
             */
            getServiceStatus() {
                return serviceStatus;
            }
        };
    });
    
    // After each test, clean up resources
    afterEach(async () => {
        vi.useRealTimers();
        
        // Wait for all pending promises to resolve
        if (pendingPromises.size > 0) {
            try {
                await Promise.all([...pendingPromises]);
            } catch (error) {
                // Ignore cleanup errors
            }
            pendingPromises.clear();
        }
        
        // Call cleanup functions
        cleanupFunctions.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                // Ignore cleanup errors
            }
        });
        cleanupFunctions.clear();
        
        // Clean up mocks
        try {
            await VitestTestHelper.cleanupMocks(...mocks);
        } catch (error) {
            // Ignore cleanup errors
        }
        mocks.clear();
    });
}

// Register custom matchers
export function registerCustomMatchers() {
    expect.extend(VitestTestHelper.vitestMatchers);
}

// Export service status for use in tests
export { serviceStatus };