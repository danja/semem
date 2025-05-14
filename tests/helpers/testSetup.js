// tests/helpers/testSetup.js
import { vi, beforeEach, afterEach, expect } from 'vitest';
import { VitestTestHelper } from './VitestTestHelper.js';

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
            }
        };
    });
    
    // After each test, clean up resources
    afterEach(async () => {
        vi.useRealTimers();
        
        // Wait for all pending promises to resolve
        if (pendingPromises.size > 0) {
            await Promise.all([...pendingPromises]);
            pendingPromises.clear();
        }
        
        // Call cleanup functions
        cleanupFunctions.forEach(cleanup => cleanup());
        cleanupFunctions.clear();
        
        // Clean up mocks
        await VitestTestHelper.cleanupMocks(...mocks);
        mocks.clear();
    });
}

// Register custom matchers
export function registerCustomMatchers() {
    expect.extend(VitestTestHelper.vitestMatchers);
}