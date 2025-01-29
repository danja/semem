// tests/unit/api/MetricsCollector.spec.js
import { BaseTest } from '../../helpers/BaseTest.js'
import MetricsCollector from '../../../src/api/MetricsCollector.js'

class MetricsCollectorTest extends BaseTest {
    beforeEach() {
        super.beforeEach()
        this.collector = new MetricsCollector({
            interval: 1000,  // 1 second for testing
            maxHistory: 5
        })
        this.addCleanup(() => this.collector.dispose())
    }

    // Helper to add test metrics
    addTestMetrics(count = 1, baseValue = 0) {
        for (let i = 0; i < count; i++) {
            this.collector.collect('test.metric', baseValue + i, { type: 'test' })
        }
    }

    // Helper to advance time and trigger cleanup
    async advanceTimeWithCleanup(ms) {
        jasmine.clock().tick(ms)
        await this.collector.pruneMetrics()
    }
}

describe('MetricsCollector', () => {
    let test

    beforeEach(() => {
        test = new MetricsCollectorTest()
    })

    describe('Metric Collection', () => {
        it('should collect simple metrics', async (done) => {
            test.collector.collect('test.counter', 1)
            const metrics = test.collector.getMetric('test.counter')

            expect(metrics.length).toBe(1)
            expect(metrics[0].value).toBe(1)
            expect(metrics[0].timestamp).toBeDefined()
            done()
        })

        it('should handle metrics with labels', async (done) => {
            test.collector.collect('api.requests', 1, { method: 'GET', path: '/test' })
            const metrics = test.collector.getMetric('api.requests', { method: 'GET' })

            expect(metrics.length).toBe(1)
            expect(metrics[0].value).toBe(1)
            done()
        })

        it('should enforce maxHistory limit', async (done) => {
            test.addTestMetrics(10)
            const metrics = test.collector.getMetric('test.metric')

            expect(metrics.length).toBe(5)  // maxHistory from config
            expect(metrics[metrics.length - 1].value).toBe(9)
            done()
        })
    })

    describe('Metric Retrieval', () => {
        beforeEach(() => {
            test.addTestMetrics(3)
        })

        it('should calculate summary statistics', async (done) => {
            const summary = test.collector.getSummary('test.metric')

            expect(summary.count).toBe(3)
            expect(summary.min).toBe(0)
            expect(summary.max).toBe(2)
            expect(summary.avg).toBe(1)
            expect(summary.last).toBe(2)
            done()
        })

        it('should handle missing metrics', async (done) => {
            const summary = test.collector.getSummary('missing.metric')
            expect(summary).toBeNull()
            done()
        })

        it('should generate snapshots', async (done) => {
            const snapshot = test.collector.getSnapshot()

            expect(snapshot.timestamp).toBeDefined()
            expect(snapshot.uptime).toBeGreaterThan(0)
            expect(snapshot.metrics['test.metric']).toBeDefined()
            done()
        })
    })

    describe('Cleanup Operations', () => {
        it('should prune old metrics', async (done) => {
            test.collector.collect('test.temp', 1)
            await test.advanceTimeWithCleanup(2000)  // Past interval

            expect(test.collector.getMetric('test.temp').length).toBe(0)
            done()
        })

        it('should remove empty series', async (done) => {
            test.collector.collect('test.temp', 1)
            await test.advanceTimeWithCleanup(2000)

            const snapshot = test.collector.getSnapshot()
            expect(snapshot.metrics['test.temp']).toBeUndefined()
            done()
        })

        it('should retain recent metrics', async (done) => {
            test.collector.collect('test.recent', 1)
            await test.advanceTimeWithCleanup(500)  // Within interval

            expect(test.collector.getMetric('test.recent').length).toBe(1)
            done()
        })
    })

    describe('Event Emission', () => {
        it('should emit metric events', async (done) => {
            const eventPromise = test.waitForEvent(test.collector, 'metric')
            test.collector.collect('test.event', 1, { type: 'test' })

            const event = await eventPromise
            expect(event.name).toBe('test.event')
            expect(event.value).toBe(1)
            expect(event.timestamp).toBeDefined()
            expect(event.labels).toEqual({ type: 'test' })
            done()
        })
    })

    describe('Resource Management', () => {
        it('should cleanup on reset', async (done) => {
            test.collector.collect('test.value', 1)
            test.collector.reset()

            expect(test.collector.getSnapshot().metrics).toEqual({})
            expect(test.collector.getMetric('test.value').length).toBe(0)
            done()
        })

        it('should dispose cleanup timer', async (done) => {
            spyOn(global, 'clearInterval')
            test.collector.dispose()
            expect(global.clearInterval).toHaveBeenCalled()
            done()
        })

        it('should remove listeners on dispose', async (done) => {
            const listener = jasmine.createSpy('metricListener')
            test.collector.on('metric', listener)

            test.collector.dispose()
            test.collector.collect('test.value', 1)

            expect(listener).not.toHaveBeenCalled()
            done()
        })
    })

    describe('Label Management', () => {
        it('should generate consistent keys', async (done) => {
            const key1 = test.collector.generateKey('test', { a: '1', b: '2' })
            const key2 = test.collector.generateKey('test', { b: '2', a: '1' })

            expect(key1).toBe(key2)
            done()
        })

        it('should handle missing labels', async (done) => {
            const key = test.collector.generateKey('test')
            expect(key).toBe('test')
            done()
        })
    })

    describe('Time Series Operations', () => {
        it('should track metric series', async (done) => {
            const timestamps = []
            for (let i = 0; i < 3; i++) {
                jasmine.clock().tick(100)
                test.collector.collect('test.series', i)
                timestamps.push(Date.now())
            }

            const metrics = test.collector.getMetric('test.series')
            expect(metrics.length).toBe(3)
            metrics.forEach((m, i) => {
                expect(m.timestamp).toBe(timestamps[i])
                expect(m.value).toBe(i)
            })
            done()
        })

        it('should handle rate calculations', async (done) => {
            test.collector.collect('test.counter', 10)
            jasmine.clock().tick(1000)
            test.collector.collect('test.counter', 20)

            const summary = test.collector.getSummary('test.counter')
            expect(summary.last - summary.min).toBe(10)  // Rate over 1 second
            done()
        })
    })
})