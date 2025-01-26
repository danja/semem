// tests/unit/api/MetricsCollector.spec.js
import MetricsCollector from '../../../src/api/MetricsCollector.js'

describe('MetricsCollector', () => {
    let collector

    beforeEach(() => {
        jasmine.clock().install()
        collector = new MetricsCollector({
            interval: 1000,  // 1 second
            maxHistory: 5
        })
    })

    afterEach(() => {
        jasmine.clock().uninstall()
        collector.dispose()
    })

    describe('Metric Collection', () => {
        it('should collect simple metrics', () => {
            collector.collect('test.counter', 1)

            const metrics = collector.getMetric('test.counter')
            expect(metrics.length).toBe(1)
            expect(metrics[0].value).toBe(1)
            expect(metrics[0].timestamp).toBeDefined()
        })

        it('should handle metrics with labels', () => {
            collector.collect('api.requests', 1, { method: 'GET', path: '/test' })

            const metrics = collector.getMetric('api.requests', { method: 'GET' })
            expect(metrics.length).toBe(1)
            expect(metrics[0].value).toBe(1)
        })

        it('should enforce maxHistory limit', () => {
            for (let i = 0; i < 10; i++) {
                collector.collect('test.series', i)
            }

            const metrics = collector.getMetric('test.series')
            expect(metrics.length).toBe(5)  // maxHistory from config
            expect(metrics[metrics.length - 1].value).toBe(9)
        })
    })

    describe('Metric Retrieval', () => {
        beforeEach(() => {
            collector.collect('test.value', 1)
            collector.collect('test.value', 2)
            collector.collect('test.value', 3)
        })

        it('should calculate summary statistics', () => {
            const summary = collector.getSummary('test.value')

            expect(summary.count).toBe(3)
            expect(summary.min).toBe(1)
            expect(summary.max).toBe(3)
            expect(summary.avg).toBe(2)
            expect(summary.last).toBe(3)
        })

        it('should handle missing metrics', () => {
            const summary = collector.getSummary('missing.metric')
            expect(summary).toBeNull()
        })

        it('should generate snapshots', () => {
            const snapshot = collector.getSnapshot()

            expect(snapshot.timestamp).toBeDefined()
            expect(snapshot.uptime).toBeGreaterThan(0)
            expect(snapshot.metrics['test.value']).toBeDefined()
        })
    })

    describe('Cleanup Operations', () => {
        it('should prune old metrics', () => {
            collector.collect('test.value', 1)
            jasmine.clock().tick(2000)  // Past interval

            collector.pruneMetrics()
            expect(collector.getMetric('test.value').length).toBe(0)
        })

        it('should remove empty series', () => {
            collector.collect('test.temp', 1)
            jasmine.clock().tick(2000)

            collector.pruneMetrics()
            const snapshot = collector.getSnapshot()
            expect(snapshot.metrics['test.temp']).toBeUndefined()
        })

        it('should retain recent metrics', () => {
            collector.collect('test.recent', 1)
            jasmine.clock().tick(500)  // Within interval

            collector.pruneMetrics()
            expect(collector.getMetric('test.recent').length).toBe(1)
        })
    })

    describe('Event Emission', () => {
        it('should emit metric events', (done) => {
            collector.once('metric', (data) => {
                expect(data.name).toBe('test.event')
                expect(data.value).toBe(1)
                expect(data.timestamp).toBeDefined()
                expect(data.labels).toEqual({ type: 'test' })
                done()
            })

            collector.collect('test.event', 1, { type: 'test' })
        })
    })

    describe('Resource Management', () => {
        it('should cleanup on reset', () => {
            collector.collect('test.value', 1)
            collector.reset()

            expect(collector.getSnapshot().metrics).toEqual({})
            expect(collector.getMetric('test.value').length).toBe(0)
        })

        it('should dispose cleanup timer', () => {
            spyOn(global, 'clearInterval')
            collector.dispose()
            expect(global.clearInterval).toHaveBeenCalled()
        })

        it('should remove listeners on dispose', () => {
            const listener = jasmine.createSpy('metricListener')
            collector.on('metric', listener)

            collector.dispose()
            collector.collect('test.value', 1)

            expect(listener).not.toHaveBeenCalled()
        })
    })

    describe('Label Management', () => {
        it('should generate consistent keys', () => {
            const key1 = collector.generateKey('test', { a: '1', b: '2' })
            const key2 = collector.generateKey('test', { b: '2', a: '1' })

            expect(key1).toBe(key2)
        })

        it('should handle missing labels', () => {
            const key = collector.generateKey('test')
            expect(key).toBe('test')
        })
    })

    describe('Time Series Operations', () => {
        it('should track metric series', () => {
            const timestamps = []
            for (let i = 0; i < 3; i++) {
                jasmine.clock().tick(100)
                collector.collect('test.series', i)
                timestamps.push(Date.now())
            }

            const metrics = collector.getMetric('test.series')
            expect(metrics.length).toBe(3)
            metrics.forEach((m, i) => {
                expect(m.timestamp).toBe(timestamps[i])
                expect(m.value).toBe(i)
            })
        })

        it('should handle rate calculations', () => {
            collector.collect('test.counter', 10)
            jasmine.clock().tick(1000)
            collector.collect('test.counter', 20)

            const summary = collector.getSummary('test.counter')
            expect(summary.last - summary.min).toBe(10)  // Rate over 1 second
        })
    })
})