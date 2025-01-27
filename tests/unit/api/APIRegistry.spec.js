import APIRegistry from '../../../src/api/common/APIRegistry.js'
import BaseAPI from '../../../src/api/common/BaseAPI.js'

describe('APIRegistry', () => {
    let registry

    beforeEach(() => {
        registry = new APIRegistry()
    })

    afterEach(async () => {
        await registry.shutdownAll()
    })

    describe('API Registration', () => {
        it('should register valid API implementations', async () => {
            class TestAPI extends BaseAPI {
                async initialize() {
                    await super.initialize()
                    this._emitMetric('test.initialized', 1)
                }
            }

            const api = await registry.register('test', TestAPI)
            expect(api).toBeInstanceOf(TestAPI)
            expect(registry.get('test')).toBe(api)
        })

        it('should prevent duplicate registration', async () => {
            class TestAPI extends BaseAPI { }
            await registry.register('test', TestAPI)

            try {
                await registry.register('test', TestAPI)
                fail('Should have thrown duplicate registration error')
            } catch (error) {
                expect(error.message).toBe('API test already registered')
            }
        })

        it('should validate API inheritance', async () => {
            class InvalidAPI { }

            try {
                await registry.register('invalid', InvalidAPI)
                fail('Should have thrown inheritance error')
            } catch (error) {
                expect(error.message).toBe('API must extend BaseAPI')
            }
        })

        it('should handle initialization failures', async () => {
            class FailingAPI extends BaseAPI {
                async initialize() {
                    throw new Error('Initialization failed')
                }
            }

            try {
                await registry.register('failing', FailingAPI)
                fail('Should have thrown initialization error')
            } catch (error) {
                expect(error.message).toBe('Initialization failed')
                expect(registry.apis.has('failing')).toBeFalse()
                expect(registry.getAll().size).toBe(0)
            }
        })
    })

    describe('API Access', () => {
        it('should retrieve registered APIs', async () => {
            class TestAPI extends BaseAPI { }
            await registry.register('test', TestAPI)
            const api = registry.get('test')
            expect(api).toBeInstanceOf(TestAPI)
        })

        it('should throw on missing APIs', () => {
            expect(() => registry.get('missing'))
                .toThrowError('API missing not found')
        })

        it('should list all registered APIs', async () => {
            class TestAPI extends BaseAPI { }
            await registry.register('test1', TestAPI)
            await registry.register('test2', TestAPI)

            const apis = registry.getAll()
            expect(apis.size).toBe(2)
            expect(apis.has('test1')).toBeTrue()
            expect(apis.has('test2')).toBeTrue()
        })
    })

    describe('Metric Collection', () => {
        it('should collect metrics from APIs', async () => {
            class TestAPI extends BaseAPI {
                async initialize() {
                    await super.initialize()
                    this._emitMetric('test.metric', 1)
                }
            }

            const api = await registry.register('test', TestAPI)
            await api.initialize()

            const metrics = registry.getMetrics()
            expect(metrics.apis.test.metrics['test.metric']).toBeDefined()
        })
    })

    describe('Lifecycle Management', () => {
        it('should handle shutdown', async () => {
            class TestAPI extends BaseAPI {
                async shutdown() {
                    await super.shutdown()
                }
            }
            const api = await registry.register('test', TestAPI)
            spyOn(api, 'shutdown').and.callThrough()

            await registry.unregister('test')
            expect(api.shutdown).toHaveBeenCalled()
        })

        it('should cleanup on shutdown', async () => {
            class TestAPI extends BaseAPI { }
            await registry.register('test', TestAPI)
            await registry.shutdownAll()
            expect(registry.getAll().size).toBe(0)
        })
    })
})