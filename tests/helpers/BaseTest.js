// tests/helpers/BaseTest.js
import { TestHelper } from './TestHelper.js'

export class BaseTest {
    constructor() {
        this.mocks = new Set()
        this.cleanupFunctions = new Set()
    }

    beforeAll() {
        jasmine.addMatchers(TestHelper.jasmineMatchers)
    }

    beforeEach() {
        this.errorSpy = spyOn(console, 'error')
        this.logSpy = spyOn(console, 'log')
        jasmine.clock().install()
    }

    afterEach() {
        jasmine.clock().uninstall()
        this.cleanupFunctions.forEach(cleanup => cleanup())
        this.cleanupFunctions.clear()
    }

    async afterAll() {
        await TestHelper.cleanupMocks(...this.mocks)
        this.mocks.clear()
    }

    addMock(mock) {
        this.mocks.add(mock)
        return mock
    }

    addCleanup(fn) {
        this.cleanupFunctions.add(fn)
        return fn
    }

    isolateMethod(object, method, mock) {
        const cleanup = TestHelper.isolateMethod(object, method, mock)
        this.addCleanup(cleanup)
        return cleanup
    }

    async expectSuccess(promise) {
        const result = await TestHelper.wrapPromise(promise)
        expect(result.success).toBe(true,
            result.error ? `Unexpected error: ${result.error.message}` : '')
        return result.value
    }

    async expectFailure(promise, errorType) {
        const result = await TestHelper.wrapPromise(promise)
        expect(result.success).toBe(false, 'Expected failure but got success')
        if (errorType) {
            expect(result.error).toBeInstanceOf(errorType)
        }
        return result.error
    }

    mockPromise(value) {
        return Promise.resolve(value)
    }

    mockRejection(error) {
        return Promise.reject(error instanceof Error ? error : new Error(error))
    }
}