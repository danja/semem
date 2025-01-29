// tests/helpers/TestHelper.js
import { EventEmitter } from 'events'

/**
 * Utility class providing test helpers and mock factories
 */
export class TestHelper {
    // Mock factories
    static createMockAPI() {
        return {
            executeOperation: jasmine.createSpy('executeOperation').and.resolveTo({}),
            initialized: true,
            on: jasmine.createSpy('on'),
            emit: jasmine.createSpy('emit'),
            getMetrics: jasmine.createSpy('getMetrics').and.resolveTo({})
        }
    }

    static createMockLLMProvider() {
        return {
            generateEmbedding: jasmine.createSpy('generateEmbedding')
                .and.resolveTo(new Array(1536).fill(0)),
            generateChat: jasmine.createSpy('generateChat')
                .and.resolveTo('test response'),
            generateCompletion: jasmine.createSpy('generateCompletion')
                .and.resolveTo('["test"]')
        }
    }

    static createMockStore() {
        return {
            loadHistory: jasmine.createSpy('loadHistory').and.resolveTo([[], []]),
            saveMemoryToHistory: jasmine.createSpy('saveMemoryToHistory'),
            close: jasmine.createSpy('close'),
            beginTransaction: jasmine.createSpy('beginTransaction'),
            commitTransaction: jasmine.createSpy('commitTransaction'),
            rollbackTransaction: jasmine.createSpy('rollbackTransaction')
        }
    }

    static createMockEventEmitter() {
        const emitter = new EventEmitter()
        spyOn(emitter, 'emit').and.callThrough()
        spyOn(emitter, 'on').and.callThrough()
        return emitter
    }

    // Custom matchers
    static jasmineMatchers = {
        toHaveBeenCalledWithError: () => ({
            compare: (actual, expected) => ({
                pass: actual.calls.any(call =>
                    call.args.some(arg => arg instanceof Error &&
                        (!expected || arg.message.includes(expected))
                    )
                )
            })
        }),

        toBeWithinRange: () => ({
            compare: (actual, min, max) => ({
                pass: actual >= min && actual <= max,
                message: `Expected ${actual} to be within range ${min}-${max}`
            })
        })
    };

    // Error simulation
    static simulateNetworkError() {
        return Promise.reject(new Error('Network error'))
    }

    static simulateTimeoutError() {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
        )
    }

    // Method isolation
    static isolateMethod(object, method, mock) {
        const original = object[method]
        object[method] = mock
        return () => { object[method] = original }
    }

    // Promise wrapping
    static async wrapPromise(promise) {
        try {
            const value = await promise
            return { success: true, value }
        } catch (error) {
            return { success: false, error }
        }
    }

    // Mock cleanup
    static async cleanupMocks(...mocks) {
        for (const mock of mocks) {
            if (mock?.reset) mock.reset()
            if (mock?.restore) mock.restore()
            if (mock?.removeAllListeners) mock.removeAllListeners()
            if (mock?.dispose) await mock.dispose()
        }
    }
}