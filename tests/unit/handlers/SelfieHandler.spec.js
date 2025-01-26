// tests/unit/handlers/SelfieHandler.spec.js
import SelfieHandler from '../../../src/api/features/SelfieHandler.js'
import APIRegistry from '../../../src/api/common/APIRegistry.js'
import BaseAPI from '../../../src/api/common/BaseAPI.js'

describe('SelfieHandler', () => {
    let handler
    let mockAPI
    let mockMeter
    let mockHistogram
    let mockCounter

    beforeEach(() => {
        mockHistogram = {
            record: jasmine.createSpy('record')
        }
        mockCounter = {
            add: jasmine.createSpy('add')
        }
        mockMeter = {
            createHistogram: () => mockHistogram,
            createCounter: () => mockCounter
        }

        mockAPI = new BaseAPI()
        spyOn(mockAPI, 'getMetrics').and.resolveTo({
            size: 100,
            operations: 50,
            latency: 150
        })

        const registry = new APIRegistry()
        spyOn(registry, 'get').and.returnValue(mockAPI)
        spyOn(registry, 'getAll').and.returnValue(new Map([['test', mockAPI]]))

        handler = new SelfieHandler({
            interval: 100,
            openTelemetry: {
                metrics: true
            }
        })
        handler.registry = registry
    })

    describe('Metric Collection', () => {
        it('should collect metrics from registered APIs', async () => {
            await handler.collectMetrics()
            const metrics = handler.getMetrics()

            expect(metrics.collectors.storage).toBeDefined()
            expect(metrics.collectors.storage.values.size).toBe(100)
            expect(metrics.collectors.storage.values.operations).toBe(50)
        })

        it('should track metric timestamps', async () => {
            await handler.collectMetrics()
            const metrics = handler.getMetrics()

            expect(metrics.timestamp).toBeDefined()
            expect(metrics.collectors.storage.timestamp).toBeDefined()
            expect(metrics.collectors.storage.timestamp).toBeLessThanOrEqual(Date.now())
        })

        it('should aggregate metrics over time', async () => {
            await handler.collectMetrics()
            mockAPI.getMetrics.and.resolveTo({
                size: 150,
                operations: 75,
                latency: 200
            })
            await handler.collectMetrics()

            const metrics = handler.getMetrics()
            expect(metrics.collectors.storage.values.operations).toBe(75)
        })
    })

    describe('Error Tracking', () => {
        it('should track error occurrences', () => {
            const error = new Error('Test error')
            handler.trackError('test', error)

            const metrics = handler.getMetrics()
            const errorEntry = metrics.errors.find(e => e.message === 'Test error')

            expect(errorEntry).toBeDefined()
            expect(errorEntry.count).toBe(1)
            expect(errorEntry.type).toBe('test')
        })

        it('should aggregate repeated errors', () => {
            const error = new Error('Repeated error')
            handler.trackError('test', error)
            handler.trackError('test', error)

            const metrics = handler.getMetrics()
            const errorEntry = metrics.errors.find(e => e.message === 'Repeated error')

            expect(errorEntry.count).toBe(2)
            expect(errorEntry.firstOccurred).toBeLessThan(errorEntry.lastOccurred)
        })
    })

    describe('OpenTelemetry Integration', () => {
        beforeEach(async () => {
            await handler.setupOpenTelemetry()
            handler.setupMetricInstruments(mockMeter)
        })

        it('should record memory metrics', async () => {
            await handler.collectMetrics()

            expect(mockHistogram.record).toHaveBeenCalledWith(
                jasmine.any(Number),
                { type: 'heap_used' }
            )
        })

        it('should track API latency', async () => {
            await handler.collectMetrics()

            expect(mockHistogram.record).toHaveBeenCalledWith(
                150, // from mockAPI metrics
                jasmine.objectContaining({ api: 'test' })
            )
        })

        it('should count storage operations', async () => {
            await handler.collectMetrics()

            expect(mockCounter.add).toHaveBeenCalledWith(
                50, // from mockAPI metrics
                { type: 'total' }
            )
        })
    })

    describe('Event Emission', () => {
        it('should emit metric events', (done) => {
            handler.onMetrics((data) => {
                expect(data.name).toBe('storage')
                expect(data.metrics).toBeDefined()
                expect(data.timestamp).toBeDefined()
                done()
            })

            handler.collectMetrics()
        })

        it('should emit error events', (done) => {
            handler.onError((data) => {
                expect(data.type).toBe('test')
                expect(data.error).toBeDefined()
                expect(data.count).toBe(1)
                done()
            })

            handler.trackError('test', new Error('Test error'))
        })
    })

    describe('Resource Management', () => {
        it('should cleanup resources on shutdown', async () => {
            const storageEndpoint = 'http://test.com/metrics'
            handler.config.storageEndpoint = storageEndpoint

            spyOn(global, 'fetch').and.resolveTo({
                ok: true
            })

            await handler.shutdown()

            expect(global.fetch).toHaveBeenCalledWith(
                storageEndpoint,
                jasmine.objectContaining({
                    method: 'POST',
                    headers: jasmine.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            )
        })

        it('should handle storage errors during shutdown', async () => {
            handler.config.storageEndpoint = 'http://invalid'
            spyOn(global, 'fetch').and.rejectWith(new Error('Network error'))

            await expectAsync(handler.shutdown()).toBeResolved()
            expect(handler.errors.size).toBeGreaterThan(0)
        })
    })
})