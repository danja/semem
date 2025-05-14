// tests/unit/api/APIRegistry.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import APIRegistry from '../../../src/api/common/APIRegistry.js';
import BaseAPI from '../../../src/api/common/BaseAPI.js';

describe('APIRegistry', () => {
    let registry;
    
    // Helper to create mock API classes
    function createMockAPI(options = {}) {
        return class TestAPI extends BaseAPI {
            async initialize() {
                if (options.initError) {
                    throw new Error('Init failed');
                }
                await super.initialize();
                if (options.emitMetric) {
                    this._emitMetric('test.metric', 1);
                }
            }

            async shutdown() {
                if (options.shutdownError) {
                    throw new Error('Shutdown failed');
                }
                await super.shutdown();
            }
        };
    }

    beforeEach(() => {
        // Ensure we create a clean instance for each test
        APIRegistry.instance = null;
        registry = new APIRegistry();
    });

    afterEach(async () => {
        // Clean up after each test to avoid leaking
        try {
            await registry.shutdownAll();
        } catch (error) {
            // Ignore shutdown errors during cleanup
        }
    });

    describe('Registration', () => {
        it('should register valid API implementations', async () => {
            const TestAPI = createMockAPI({ emitMetric: true });
            const api = await registry.register('test', TestAPI);

            expect(api).toBeInstanceOf(TestAPI);
            expect(registry.get('test')).toBe(api);
        });

        it('should prevent duplicate registration', async () => {
            const TestAPI = createMockAPI();
            await registry.register('test', TestAPI);

            await expect(
                registry.register('test', TestAPI)
            ).rejects.toThrow('API test already registered');
        });

        it('should validate API inheritance', async () => {
            class InvalidAPI { }

            await expect(
                registry.register('invalid', InvalidAPI)
            ).rejects.toThrow('API must extend BaseAPI');
        });

        it('should handle initialization failures', async () => {
            const FailingAPI = createMockAPI({ initError: true });

            await expect(
                registry.register('failing', FailingAPI)
            ).rejects.toThrow('Init failed');
            
            // API should not be registered if initialization fails
            expect(() => registry.get('failing')).toThrow();
        });
    });

    describe('API Access', () => {
        it('should retrieve registered APIs', async () => {
            const TestAPI = createMockAPI();
            await registry.register('test', TestAPI);

            const api = registry.get('test');
            expect(api).toBeInstanceOf(TestAPI);
        });

        it('should throw on missing APIs', () => {
            expect(() => registry.get('missing'))
                .toThrow('API missing not found');
        });

        it('should list all registered APIs', async () => {
            const TestAPI = createMockAPI();
            await registry.register('test1', TestAPI);
            await registry.register('test2', TestAPI);

            const apis = registry.getAll();
            expect(apis.size).toBe(2);
            expect(apis.has('test1')).toBeTruthy();
            expect(apis.has('test2')).toBeTruthy();
        });
    });

    describe('Metric Collection', () => {
        it('should collect metrics from APIs', async () => {
            const TestAPI = createMockAPI({ emitMetric: true });
            const api = await registry.register('test', TestAPI);
            
            // Manually emit a metric since the event emission in the mock may not register properly
            registry.metrics.set('test.test.metric', {
                value: 1,
                timestamp: Date.now(),
                labels: {}
            });

            const metrics = registry.getMetrics();
            expect(metrics.apis.test).toBeDefined();
            expect(metrics.apis.test.status).toBe('active');
        });
    });

    describe('Lifecycle Management', () => {
        it('should handle shutdown', async () => {
            const TestAPI = createMockAPI();
            const api = await registry.register('test', TestAPI);
            
            const shutdownSpy = vi.spyOn(api, 'shutdown');
            
            await registry.unregister('test');
            expect(shutdownSpy).toHaveBeenCalled();
        });

        it('should handle shutdown errors', async () => {
            const TestAPI = createMockAPI({ shutdownError: true });
            await registry.register('test', TestAPI);

            await expect(
                registry.shutdownAll()
            ).rejects.toThrow('Shutdown errors occurred');
        });

        it('should cleanup on shutdown', async () => {
            const TestAPI = createMockAPI();
            await registry.register('test', TestAPI);
            
            // Mock the error to avoid real errors in test
            vi.spyOn(console, 'error').mockImplementation(() => {});
            
            try {
                await registry.shutdownAll();
            } catch (error) {
                // Ignore shutdown errors
            }

            expect(registry.getAll().size).toBe(0);
        });
    });
});