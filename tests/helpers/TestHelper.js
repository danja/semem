// tests/helpers/TestHelper.js
import { EventEmitter } from 'events'

export class TestHelper {
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

    static createMockResponse() {
        return {
            ok: true,
            json: jasmine.createSpy('json').and.resolveTo({}),
            text: jasmine.createSpy('text').and.resolveTo(''),
            status: 200,
            headers: new Map()
        }
    }

    static createMockFetch() {
        return jasmine.createSpy('fetch').and.resolveTo(this.createMockResponse())
    }

    // Custom jasmine matchers
    static jasmineMatchers = {
        toHaveBeenCalledWithError: () => ({
            compare: (actual, expected) => ({
                pass: actual.calls.any(call =>
                    call.args.some(arg => arg instanceof Error &&
                        (!expected || arg.message.includes(expected))
                    )
                )
            })
        })
    };

    // Error simulation helpers
    static simulateNetworkError() {
        return Promise.reject(new Error('Network error'))
    }

    static simulateTimeoutError() {
        return new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 100)
        )
    }

    // Test isolation helpers
    static isolateMethod(object, method, mock) {
        const original = object[method]
        object[method] = mock
        return () => { object[method] = original }
    }

    static wrapPromise(promise) {
        return promise.then(
            value => ({ success: true, value }),
            error => ({ success: false, error })
        )
    }

    // Cleanup helpers
    static async cleanupMocks(...mocks) {
        for (const mock of mocks) {
            if (mock?.reset) mock.reset()
            if (mock?.restore) mock.restore()
            if (mock?.removeAllListeners) mock.removeAllListeners()
        }
    }
}