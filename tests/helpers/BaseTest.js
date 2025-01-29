// tests/helpers/BaseTest.js
import { TestHelper } from './TestHelper.js'

export class BaseTest {
    constructor() {
        this.mocks = new Set()
        this.cleanupFunctions = new Set()
        this.pendingPromises = new Set()
    }

    beforeAll() {
        jasmine.addMatchers(TestHelper.jasmineMatchers)
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 5000
    }

    beforeEach() {
        this.errorSpy = spyOn(console, 'error')
        this.logSpy = spyOn(console, 'log')
        this.warnSpy = spyOn(console, 'warn')
        this.debugSpy = spyOn(console, 'debug')
        jasmine.clock().install()
    }

    afterEach(done) {
        jasmine.clock().uninstall()
        Promise.all(this.pendingPromises)
            .then(() => {
                this.cleanupFunctions.forEach(cleanup => cleanup())
                this.cleanupFunctions.clear()
                this.pendingPromises.clear()
                done()
            })
            .catch(done.fail)
    }

    async afterAll() {
        await Promise.all([...this.pendingPromises])
        await TestHelper.cleanupMocks(...this.mocks)
        this.mocks.clear()
    }

    trackPromise(promise) {
        this.pendingPromises.add(promise)
        promise.finally(() => this.pendingPromises.delete(promise))
        return promise
    }

    addMock(mock) {
        this.mocks.add(mock)
        return mock
    }

    addCleanup(fn) {
        this.cleanupFunctions.add(fn)
        return fn
    }

    mockPromise(value) {
        return Promise.resolve(value)
    }

    mockRejection(error) {
        return Promise.reject(error instanceof Error ? error : new Error(error))
    }
}