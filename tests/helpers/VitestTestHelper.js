// tests/helpers/VitestTestHelper.js
import { vi } from 'vitest';
import { EventEmitter } from 'events';

/**
 * Utility class providing test helpers and mock factories for Vitest
 */
export class VitestTestHelper {
    // Mock factories
    static createMockAPI() {
        return {
            executeOperation: vi.fn().mockResolvedValue({}),
            initialized: true,
            on: vi.fn(),
            emit: vi.fn(),
            getMetrics: vi.fn().mockResolvedValue({})
        };
    }

    static createMockLLMProvider() {
        return {
            generateEmbedding: vi.fn()
                .mockResolvedValue(new Array(1536).fill(0)),
            generateChat: vi.fn()
                .mockResolvedValue('test response'),
            generateCompletion: vi.fn()
                .mockResolvedValue('["test"]')
        };
    }

    static createMockStore() {
        return {
            loadHistory: vi.fn().mockResolvedValue([[], []]),
            saveMemoryToHistory: vi.fn(),
            close: vi.fn(),
            beginTransaction: vi.fn(),
            commitTransaction: vi.fn(),
            rollbackTransaction: vi.fn()
        };
    }

    static createMockEventEmitter() {
        const emitter = new EventEmitter();
        vi.spyOn(emitter, 'emit');
        vi.spyOn(emitter, 'on');
        return emitter;
    }

    // Custom matchers that can be used with expect.extend
    static vitestMatchers = {
        toHaveBeenCalledWithError: (received, expected) => {
            const pass = received.mock.calls.some(call => 
                call.some(arg => arg instanceof Error && 
                    (!expected || arg.message.includes(expected))
                )
            );
            
            if (pass) {
                return {
                    message: () => `Expected ${received.mock.calls} not to contain an error with message containing "${expected}"`,
                    pass: true,
                };
            } else {
                return {
                    message: () => `Expected ${received.mock.calls} to contain an error with message containing "${expected}"`,
                    pass: false,
                };
            }
        },

        toBeWithinRange: (received, min, max) => {
            const pass = received >= min && received <= max;
            if (pass) {
                return {
                    message: () => `Expected ${received} not to be within range ${min}-${max}`,
                    pass: true,
                };
            } else {
                return {
                    message: () => `Expected ${received} to be within range ${min}-${max}`,
                    pass: false,
                };
            }
        }
    };

    // Error simulation
    static simulateNetworkError() {
        return Promise.reject(new Error('Network error'));
    }

    static simulateTimeoutError() {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
        );
    }

    // Method isolation
    static isolateMethod(object, method, mock) {
        const original = object[method];
        object[method] = mock;
        return () => { object[method] = original; };
    }

    // Promise wrapping
    static async wrapPromise(promise) {
        try {
            const value = await promise;
            return { success: true, value };
        } catch (error) {
            return { success: false, error };
        }
    }

    // Mock cleanup
    static async cleanupMocks(...mocks) {
        for (const mock of mocks) {
            if (mock?.mockReset) mock.mockReset();
            if (mock?.mockRestore) mock.mockRestore();
            if (mock?.removeAllListeners) mock.removeAllListeners();
            if (mock?.dispose) await mock.dispose();
        }
    }
}