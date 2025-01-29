// tests/unit/api/APIRegistry.spec.js
import { BaseTest } from '../../helpers/BaseTest.js'
import APIRegistry from '../../../src/api/common/APIRegistry.js'
import BaseAPI from '../../../src/api/common/BaseAPI.js'

class APIRegistryTest extends BaseTest {
    beforeEach() {
        this.registry = new APIRegistry()
    }

    createMockAPI(options = {}) {
        return class TestAPI extends BaseAPI {
            async initialize() {
                if (options.initError) {
                    throw new Error('Init failed')
                }
                await super.initialize()
                if (options.emitMetric) {
                    this._emitMetric('test.metric', 1)
                }
            }

            async shutdown() {
                if (options.shutdownError) {
                    throw new Error('Shutdown failed')
                }
                await super.shutdown()
            }
        }
    }
}

describe('APIRegistry', () => {
    let test

    beforeEach(() => {
        test = new APIRegistryTest()
    })

    describe('Registration', () => {
        it('should register valid API implementations', async (done) => {
            const TestAPI = test.createMockAPI({ emitMetric: true })
            const api = await test.trackPromise(test.registry.register('test', TestAPI))

            expect(api).toBeInstanceOf(TestAPI)
            expect(test.registry.get('test')).toBe(api)
            done()
        })

        it('should prevent duplicate registration', async (done) => {
            const TestAPI = test.createMockAPI()
            await test.trackPromise(test.registry.register('test', TestAPI))

            try {
                await test.trackPromise(test.registry.register('test', TestAPI))
                done.fail('Should have rejected duplicate registration')
            } catch (error) {
                expect(error.message).toBe('API test already registered')
                done()
            }
        })

        it('should validate API inheritance', async (done) => {
            class InvalidAPI { }

            try {
                await test.trackPromise(test.registry.register('invalid', InvalidAPI))
                done.fail('Should have rejected invalid API')
            } catch (error) {
                expect(error.message).toBe('API must extend BaseAPI')
                done()
            }
        })

        it('should handle initialization failures', async (done) => {
            const FailingAPI = test.createMockAPI({ initError: true })

            try {
                await test.trackPromise(test.registry.register('failing', FailingAPI))
                done.fail('Should have rejected failing initialization')
            } catch (error) {
                expect(error.message).toBe('Init failed')
                expect(test.registry.apis.has('failing')).toBeFalse()
                done()
            }
        })
    })

    describe('API Access', () => {
        it('should retrieve registered APIs', async (done) => {
            const TestAPI = test.createMockAPI()
            await test.trackPromise(test.registry.register('test', TestAPI))

            const api = test.registry.get('test')
            expect(api).toBeInstanceOf(TestAPI)
            done()
        })

        it('should throw on missing APIs', () => {
            expect(() => test.registry.get('missing'))
                .toThrowError('API missing not found')
        })

        it('should list all registered APIs', async (done) => {
            const TestAPI = test.createMockAPI()
            await test.trackPromise(test.registry.register('test1', TestAPI))
            await test.trackPromise(test.registry.register('test2', TestAPI))

            const apis = test.registry.getAll()
            expect(apis.size).toBe(2)
            expect(apis.has('test1')).toBeTrue()
            expect(apis.has('test2')).toBeTrue()
            done()
        })
    })

    describe('Metric Collection', () => {
        it('should collect metrics from APIs', async (done) => {
            const TestAPI = test.createMockAPI({ emitMetric: true })
            await test.trackPromise(test.registry.register('test', TestAPI))

            const metrics = test.registry.getMetrics()
            expect(metrics.apis.test.metrics['test.metric']).toBeDefined()
            done()
        })
    })

    describe('Lifecycle Management', () => {
        it('should handle shutdown', async (done) => {
            const TestAPI = test.createMockAPI()
            const api = await test.trackPromise(test.registry.register('test', TestAPI))
            spyOn(api, 'shutdown').and.callThrough()

            await test.trackPromise(test.registry.unregister('test'))
            expect(api.shutdown).toHaveBeenCalled()
            done()
        })

        it('should handle shutdown errors', async (done) => {
            const TestAPI = test.createMockAPI({ shutdownError: true })
            await test.trackPromise(test.registry.register('test', TestAPI))

            try {
                await test.trackPromise(test.registry.shutdownAll())
                done.fail('Should have thrown shutdown error')
            } catch (error) {
                expect(error.message).toBe('Shutdown failed')
                done()
            }
        })

        it('should cleanup on shutdown', async (done) => {
            const TestAPI = test.createMockAPI()
            await test.trackPromise(test.registry.register('test', TestAPI))
            await test.trackPromise(test.registry.shutdownAll())

            expect(test.registry.getAll().size).toBe(0)
            done()
        })
    })
})