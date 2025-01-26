// tests/unit/api/APIRegistry.spec.js
import { APIRegistry } from '../../../src/api/common/APIRegistry.js'
import BaseAPI from '../../../src/api/common/BaseAPI.js'

class TestAPI extends BaseAPI {
    async initialize() {
        await super.initialize()
        this._emitMetric('test.initialized', 1)
    }

    async executeOperation(operation, params) {
        this._emitMetric('test.operation', 1)
        return { operation, params }
    }
}

describe('APIRegistry', () => {
    let registry

    beforeEach(() => {
        registry = new APIRegistry()
    })

    describe('API Registration', () => {
        it('should register valid API implementations', async () => {
            const api = await registry.register('test', TestAPI)
            expect(api).toBeInstanceOf(TestAPI)
            expect(registry.get('test')).toBe(api)
        })

        it('should prevent duplicate registration', async () => {
            await registry.register('test', TestAPI)
            await expectAsync(
                registry.register('test', TestAPI)
            ).toBeRejectedWithError('API test already registered')
        })

        it('should validate API inheritance', async () => {
            class InvalidAPI { }
            await expectAsync(
                registry.register('invalid', InvalidAPI)
            ).toBeRejectedWithError('API must extend BaseAPI')
        })

        it('should handle initialization failures', async () => {
            class FailingAPI extends BaseAPI {
                async initialize() {
                    throw new Error('Initialization failed')
                }
            }

            await expectAsync(
                registry.register('failing', FailingAPI)
            ).toBeRejectedWithError('Initialization failed')
        })
    })

    describe('API Access', () => {
        it('should retrieve registered APIs', async () => {
            await registry.register('test', TestAPI)
            const api = registry.get('test')
            expect(api).toBeInstanceOf(TestAPI)
        })

        it('should throw on missing APIs', () => {
            expect(() => registry.get('missing'))
                .toThrowError('API missing not found')
        })

        it('should list all registered APIs', async () => {
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
            const api = await registry.register('test', TestAPI)
            await api.executeOperation('test', {})

            const metrics = registry.getMetrics()
            expect(metrics.apis.test.metrics['test.operation']).toBeDefined()
        })

        it('should track API status', async () => {
            await registry.register('test', TestAPI)
            const metrics = registry.getMetrics()

            expect(metrics.apis.test.status).toBe('active')
            expect(metrics.apiCount).toBe(1)
        })

        it('should aggregate metrics across APIs', async () => {
            const api1 = await registry.register('test1', TestAPI)
            const api2 = await registry.register('test2', TestAPI)

            await api1.executeOperation('op1', {})
            await api2.executeOperation('op2', {})

            const metrics = registry.getMetrics()
            expect(Object.keys(metrics.apis)).toContain('test1')
            expect(Object.keys(metrics.apis)).toContain('test2')
        })
    })

    describe('API Lifecycle', () => {
        it('should unregister APIs', async () => {
            const api = await registry.register('test', TestAPI)
            spyOn(api, 'shutdown').and.returnValue(Promise.resolve())

            await registry.unregister('test')
            expect(() => registry.get('test')).toThrow()
            expect(api.shutdown).toHaveBeenCalled()
        })

        it('should handle unregister errors', async () => {
            const api = await registry.register('test', TestAPI)
            spyOn(api, 'shutdown').and.rejectWith(new Error('Shutdown failed'))

            await expectAsync(registry.unregister('test'))
                .toBeRejectedWithError('Shutdown failed')
        })

        it('should shutdown all APIs', async () => {
            await registry.register('test1', TestAPI)
            await registry.register('test2', TestAPI)

            await registry.shutdownAll()
            expect(registry.getAll().size).toBe(0)
        })
    })

    describe('Error Handling', () => {
        it('should handle API operation errors', async () => {
            class ErrorAPI extends BaseAPI {
                async executeOperation() {
                    this._emitMetric('error.count', 1)
                    throw new Error('Operation failed')
                }
            }

            const api = await registry.register('error', ErrorAPI)
            await expectAsync(
                api.executeOperation('test', {})
            ).toBeRejected()

            const metrics = registry.getMetrics()
            expect(metrics.apis.error.metrics['error.count'].value).toBe(1)
        })

        it('should cleanup on registration failure', async () => {
            class CleanupAPI extends BaseAPI {
                async initialize() {
                    this._emitMetric('init', 1)
                    throw new Error('Init failed')
                }
            }

            await expectAsync(
                registry.register('cleanup', CleanupAPI)
            ).toBeRejected()

            expect(registry.getAll().size).toBe(0)
            expect(registry.metrics.size).toBe(0)
        })
    })
})