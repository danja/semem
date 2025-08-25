// tests/unit/handlers/SelfieHandler.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import SelfieHandler from '../../../../src/api/features/SelfieHandler.js';
import APIRegistry from '../../../../src/api/common/APIRegistry.js';
import BaseAPI from '../../../../src/api/common/BaseAPI.js';

describe('SelfieHandler', () => {
    let handler;
    let mockAPI;
    let mockMeter;
    let mockHistogram;
    let mockCounter;

    beforeEach(() => {
        mockHistogram = {
            record: vi.fn()
        };
        mockCounter = {
            add: vi.fn()
        };
        mockMeter = {
            createHistogram: () => mockHistogram,
            createCounter: () => mockCounter
        };

        mockAPI = new BaseAPI();
        mockAPI.getMetrics = vi.fn().mockResolvedValue({
            size: 100,
            operations: 50,
            latency: 150
        });

        const registry = new APIRegistry();
        registry.get = vi.fn().mockReturnValue(mockAPI);
        registry.getAll = vi.fn().mockReturnValue(new Map([['test', mockAPI]]));

        handler = new SelfieHandler({
            interval: 100,
            openTelemetry: {
                metrics: true
            }
        });
        handler.registry = registry;
        
        // Mock imports to prevent actual OpenTelemetry initialization
        vi.mock('@opentelemetry/api', () => ({
            trace: { getTracer: vi.fn() },
            metrics: { getMeter: () => mockMeter }
        }));
        
        vi.mock('@opentelemetry/resources', () => ({
            Resource: class Resource {
                constructor() {}
            }
        }));
        
        vi.mock('@opentelemetry/semantic-conventions', () => ({
            SemanticResourceAttributes: { SERVICE_NAME: 'service.name' }
        }));
    });

    afterEach(() => {
        vi.resetAllMocks();
        if (handler.collectionTimer) {
            clearInterval(handler.collectionTimer);
        }
    });

    describe('Metric Collection', () => {
        it('should collect metrics from registered APIs', async () => {
            await handler.collectMetrics();
            const metrics = handler.getMetrics();

            expect(metrics.collectors.storage).toBeDefined();
            expect(metrics.collectors.storage.values.size).toBe(100);
            expect(metrics.collectors.storage.values.operations).toBe(50);
        });

        it('should track metric timestamps', async () => {
            await handler.collectMetrics();
            const metrics = handler.getMetrics();

            expect(metrics.timestamp).toBeDefined();
            expect(metrics.collectors.storage.timestamp).toBeDefined();
            expect(metrics.collectors.storage.timestamp).toBeLessThanOrEqual(Date.now());
        });

        it('should aggregate metrics over time', async () => {
            await handler.collectMetrics();
            mockAPI.getMetrics.mockResolvedValue({
                size: 150,
                operations: 75,
                latency: 200
            });
            await handler.collectMetrics();

            const metrics = handler.getMetrics();
            expect(metrics.collectors.storage.values.operations).toBe(75);
        });
    });

    describe('Error Tracking', () => {
        it('should track error occurrences', () => {
            // Mock eventBus.emit to prevent errors being emitted
            const originalEmit = handler.eventBus.emit;
            handler.eventBus.emit = vi.fn();
            
            const error = new Error('Test error');
            handler.trackError('test', error);

            const metrics = handler.getMetrics();
            const errorEntry = metrics.errors.find(e => e.message === 'Test error');

            expect(errorEntry).toBeDefined();
            expect(errorEntry.count).toBe(1);
            expect(errorEntry.type).toBe('test');
            
            // Restore original emit
            handler.eventBus.emit = originalEmit;
        });

        it('should aggregate repeated errors', () => {
            // Mock eventBus.emit to prevent errors being emitted
            const originalEmit = handler.eventBus.emit;
            handler.eventBus.emit = vi.fn();
            
            const error = new Error('Repeated error');
            handler.trackError('test', error);
            handler.trackError('test', error);

            const metrics = handler.getMetrics();
            const errorEntry = metrics.errors.find(e => e.message === 'Repeated error');

            expect(errorEntry.count).toBe(2);
            expect(errorEntry.firstOccurred).toBeLessThanOrEqual(errorEntry.lastOccurred);
            
            // Restore original emit
            handler.eventBus.emit = originalEmit;
        });
    });

    describe('OpenTelemetry Integration', () => {
        beforeEach(async () => {
            // Mock the import functions
            handler.setupMetricInstruments(mockMeter);
        });

        it('should record memory metrics', async () => {
            await handler.collectMetrics();

            expect(mockHistogram.record).toHaveBeenCalledWith(
                expect.any(Number),
                { type: 'heap_used' }
            );
        });

        it('should track API latency', async () => {
            await handler.collectMetrics();

            expect(mockHistogram.record).toHaveBeenCalledWith(
                150, // from mockAPI metrics
                expect.objectContaining({ api: 'test' })
            );
        });

        it('should count storage operations', async () => {
            await handler.collectMetrics();

            expect(mockCounter.add).toHaveBeenCalledWith(
                50, // from mockAPI metrics
                { type: 'total' }
            );
        });
    });

    describe('Event Emission', () => {
        it('should emit metric events', () => {
            // Mock the collectors to only emit the storage collector
            // to make the test more predictable
            const originalCollectors = handler.collectors;
            handler.collectors = {
                storage: originalCollectors.storage
            };
            
            return new Promise(done => {
                handler.onMetrics((data) => {
                    expect(data.name).toBe('storage');
                    expect(data.metrics).toBeDefined();
                    expect(data.timestamp).toBeDefined();
                    done();
                });

                handler.collectMetrics();
            }).finally(() => {
                // Restore original collectors
                handler.collectors = originalCollectors;
            });
        });

        it('should emit error events', () => {
            // Create a temporary event listener that won't persist
            // beyond this test
            return new Promise(done => {
                const onErrorOnce = (data) => {
                    handler.eventBus.removeListener('error', onErrorOnce);
                    expect(data.type).toBe('test');
                    expect(data.error).toBeDefined();
                    expect(data.count).toBe(1);
                    done();
                };
                
                handler.eventBus.once('error', onErrorOnce);
                handler.trackError('test', new Error('Test error'));
            });
        });
    });

    describe('Resource Management', () => {
        it('should cleanup resources on shutdown', async () => {
            const storageEndpoint = 'http://test.com/metrics';
            handler.config.storageEndpoint = storageEndpoint;

            // Mock eventBus.emit to prevent errors being emitted
            handler.eventBus.emit = vi.fn();
            
            // Initialize handler artificially for test
            handler.initialized = true;
            
            // Mock fetch
            global.fetch = vi.fn().mockResolvedValue({
                ok: true
            });

            await handler.shutdown();

            expect(global.fetch).toHaveBeenCalledWith(
                storageEndpoint,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    })
                })
            );
            
            // Cleanup
            delete global.fetch;
        });

        it('should handle storage errors during shutdown', async () => {
            // Mock eventBus.emit to prevent errors being emitted
            const originalEmit = handler.eventBus.emit;
            handler.eventBus.emit = vi.fn();
            
            handler.config.storageEndpoint = 'http://invalid';
            global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
            
            // Initialize handler artificially for test
            handler.initialized = true;

            await handler.shutdown();
            expect(handler.errors.size).toBeGreaterThan(0);
            
            // Restore original emit
            handler.eventBus.emit = originalEmit;
            
            // Cleanup
            delete global.fetch;
        });
    });
});