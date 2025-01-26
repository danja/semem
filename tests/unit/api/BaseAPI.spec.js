// tests/unit/api/BaseAPI.spec.js
import BaseAPI from '../../../src/api/common/BaseAPI.js'

class TestAPI extends BaseAPI {
    async executeOperation(operation, params) {
        this._validateParams(params)
        this._emitMetric('operation.count', 1)
        return { operation, params }
    }

    async storeInteraction(interaction) {
        this._validateParams(interaction)
        this._emitMetric('store.count', 1)
        return interaction
    }

    async retrieveInteractions(query) {
        this._validateParams(query)
        this._emitMetric('retrieve.count', 1)
        return [query]
    }
}

describe('BaseAPI', () => {
    let api

    beforeEach(() => {
        api = new TestAPI({ test: 'config' })
    })

    describe('Initialization', () => {
        it('should initialize with config', async () => {
            await api.initialize()
            expect(api.initialized).toBeTrue()
            expect(api.config.test).toBe('config')
        })

        it('should prevent duplicate initialization', async () => {
            await api.initialize()
            await expectAsync(api.initialize())
                .toBeRejectedWithError('API already initialized')
        })

        it('should track initialization state', async () => {
            expect(api.initialized).toBeFalse()
            await api.initialize()
            expect(api.initialized).toBeTrue()
        })
    })

    describe('Operation Management', () => {
        beforeEach(async () => {
            await api.initialize()
        })

        it('should execute operations', async () => {
            const result = await api.executeOperation('test', { param: 'value' })
            expect(result.operation).toBe('test')
            expect(result.params.param).toBe('value')
        })

        it('should validate parameters', async () => {
            await expectAsync(api.executeOperation('test', null))
                .toBeRejectedWithError('Invalid parameters')
        })

        it('should store interactions', async () => {
            const interaction = { data: 'test' }
            const result = await api.storeInteraction(interaction)
            expect(result).toEqual(interaction)
        })

        it('should retrieve interactions', async () => {
            const query = { text: 'test' }
            const results = await api.retrieveInteractions(query)
            expect(results).toContain(query)
        })
    })

    describe('Metrics Collection', () => {
        beforeEach(async () => {
            await api.initialize()
        })

        it('should emit metric events', (done) => {
            api.once('metric', (metric) => {
                expect(metric.name).toBe('test.metric')
                expect(metric.value).toBe(1)
                expect(metric.timestamp).toBeDefined()
                done()
            })

            api._emitMetric('test.metric', 1)
        })

        it('should collect system metrics', async () => {
            const metrics = await api.getMetrics()
            expect(metrics.timestamp).toBeDefined()
            expect(metrics.status).toBe('active')
            expect(metrics.memoryUsage).toBeDefined()
            expect(metrics.uptime).toBeGreaterThanOrEqual(0)
        })

        it('should track operation metrics', async () => {
            const listener = jasmine.createSpy('metricListener')
            api.on('metric', listener)

            await api.executeOperation('test', { param: 'value' })

            expect(listener).toHaveBeenCalledWith(
                jasmine.objectContaining({
                    name: 'operation.count',
                    value: 1
                })
            )
        })
    })

    describe('Lifecycle Management', () => {
        it('should handle shutdown', async () => {
            await api.initialize()
            await api.shutdown()
            expect(api.initialized).toBeFalse()
        })

        it('should prevent operations after shutdown', async () => {
            await api.initialize()
            await api.shutdown()

            await expectAsync(api.executeOperation('test', {}))
                .toBeRejectedWithError('API not initialized')
        })

        it('should prevent shutdown before initialization', async () => {
            await expectAsync(api.shutdown())
                .toBeRejectedWithError('API not initialized')
        })

        it('should cleanup on shutdown', async () => {
            const listener = jasmine.createSpy('metricListener')
            api.on('metric', listener)

            await api.initialize()
            await api.shutdown()

            api._emitMetric('test', 1)
            expect(listener).not.toHaveBeenCalled()
        })
    })

    describe('Error Handling', () => {
        beforeEach(async () => {
            await api.initialize()
        })

        it('should handle operation errors', async () => {
            class ErrorAPI extends BaseAPI {
                async executeOperation() {
                    this._emitMetric('error', 1)
                    throw new Error('Operation failed')
                }
            }

            const errorApi = new ErrorAPI()
            await errorApi.initialize()

            await expectAsync(errorApi.executeOperation('test', {}))
                .toBeRejectedWithError('Operation failed')
        })

        it('should validate input types', async () => {
            await expectAsync(api.executeOperation('test', 'invalid'))
                .toBeRejectedWithError('Invalid parameters')
        })

        it('should handle async validation', async () => {
            api._validateParams = async () => {
                throw new Error('Async validation failed')
            }

            await expectAsync(api.executeOperation('test', {}))
                .toBeRejectedWithError('Async validation failed')
        })
    })

    describe('Event Management', () => {
        it('should handle multiple metric listeners', async () => {
            const listener1 = jasmine.createSpy('listener1')
            const listener2 = jasmine.createSpy('listener2')

            api.on('metric', listener1)
            api.on('metric', listener2)

            api._emitMetric('test', 1)

            expect(listener1).toHaveBeenCalled()
            expect(listener2).toHaveBeenCalled()
        })

        it('should remove listeners on cleanup', async () => {
            const listener = jasmine.createSpy('listener')
            api.on('metric', listener)

            await api.initialize()
            await api.shutdown()

            expect(api.listenerCount('metric')).toBe(0)
        })
    })
})