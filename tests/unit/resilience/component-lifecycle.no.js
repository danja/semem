import { describe, it, expect, beforeEach, vi } from 'vitest';
import NavigationEndpoint from '../../../src/zpt/api/NavigationEndpoint.js';

/**
 * Tests for component initialization and lifecycle management
 */
describe('Component Lifecycle Management', () => {
    let navigationEndpoint;
    let mockDependencies;

    beforeEach(() => {
        navigationEndpoint = new NavigationEndpoint({
            enableCaching: true,
            enableMetrics: true
        });

        mockDependencies = {
            ragnoCorpus: {
                id: 'test-corpus'
            },
            sparqlStore: {
                healthCheck: vi.fn().mockResolvedValue({ healthy: true })
            },
            embeddingHandler: {
                healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
                generateEmbedding: vi.fn().mockResolvedValue([1, 2, 3])
            },
            llmHandler: {
                healthCheck: vi.fn().mockResolvedValue({ healthy: true }),
                extractConcepts: vi.fn().mockResolvedValue(['test', 'concepts'])
            }
        };

        // Mock the component constructors
        global.CorpuscleSelector = vi.fn().mockImplementation(() => ({
            initialize: vi.fn().mockResolvedValue(),
            getMetrics: vi.fn().mockReturnValue({
                totalSelections: 10,
                avgSelectionTime: 100,
                cacheHitRate: 0.8
            }),
            dispose: vi.fn().mockResolvedValue()
        }));

        global.TiltProjector = vi.fn().mockImplementation(() => ({
            project: vi.fn()
        }));

        global.CorpuscleTransformer = vi.fn().mockImplementation(() => ({
            healthCheck: vi.fn().mockResolvedValue({ healthy: true, issues: [] }),
            dispose: vi.fn().mockResolvedValue()
        }));
    });

    describe('validateDependencies', () => {
        it('should validate required dependencies are present', async () => {
            await expect(
                navigationEndpoint.validateDependencies(mockDependencies)
            ).resolves.not.toThrow();
        });

        it('should throw error for missing required dependencies', async () => {
            const incompleteDependencies = {
                ragnoCorpus: mockDependencies.ragnoCorpus
                // missing sparqlStore, embeddingHandler, llmHandler
            };

            await expect(
                navigationEndpoint.validateDependencies(incompleteDependencies)
            ).rejects.toThrow('Missing required dependencies');
        });

        it('should perform health checks on dependencies', async () => {
            await navigationEndpoint.validateDependencies(mockDependencies);

            expect(mockDependencies.sparqlStore.healthCheck).toHaveBeenCalled();
            expect(mockDependencies.embeddingHandler.healthCheck).toHaveBeenCalled();
            expect(mockDependencies.llmHandler.healthCheck).toHaveBeenCalled();
        });

        it('should handle health check timeouts gracefully', async () => {
            mockDependencies.sparqlStore.healthCheck = vi.fn()
                .mockImplementation(() => new Promise(resolve => 
                    setTimeout(() => resolve({ healthy: true }), 10000)
                ));

            // Should not throw, but should log warning
            await expect(
                navigationEndpoint.validateDependencies(mockDependencies)
            ).resolves.not.toThrow();
        });
    });

    describe('sequential initialization', () => {
        it('should initialize components in proper sequence', async () => {
            const initOrder = [];
            
            global.CorpuscleSelector.mockImplementation(() => {
                initOrder.push('CorpuscleSelector');
                return {
                    initialize: vi.fn().mockResolvedValue(),
                    getMetrics: vi.fn().mockReturnValue({}),
                    dispose: vi.fn().mockResolvedValue()
                };
            });

            global.TiltProjector.mockImplementation(() => {
                initOrder.push('TiltProjector');
                return { project: vi.fn() };
            });

            global.CorpuscleTransformer.mockImplementation(() => {
                initOrder.push('CorpuscleTransformer');
                return {
                    healthCheck: vi.fn().mockResolvedValue({ healthy: true, issues: [] }),
                    dispose: vi.fn().mockResolvedValue()
                };
            });

            await navigationEndpoint.initialize(mockDependencies);

            expect(initOrder).toEqual(['CorpuscleSelector', 'TiltProjector', 'CorpuscleTransformer']);
        });

        it('should wait for component initialization before proceeding', async () => {
            let selectorInitialized = false;
            const mockSelector = {
                initialize: vi.fn().mockImplementation(async () => {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    selectorInitialized = true;
                }),
                getMetrics: vi.fn().mockReturnValue({}),
                dispose: vi.fn().mockResolvedValue()
            };

            global.CorpuscleSelector.mockReturnValue(mockSelector);

            global.TiltProjector.mockImplementation(() => {
                // This should only be called after CorpuscleSelector is initialized
                expect(selectorInitialized).toBe(true);
                return { project: vi.fn() };
            });

            await navigationEndpoint.initialize(mockDependencies);

            expect(mockSelector.initialize).toHaveBeenCalled();
        });
    });

    describe('component verification', () => {
        it('should verify all components are ready after initialization', async () => {
            await navigationEndpoint.initialize(mockDependencies);

            expect(navigationEndpoint.corpuscleSelector).toBeDefined();
            expect(navigationEndpoint.tiltProjector).toBeDefined();
            expect(navigationEndpoint.transformer).toBeDefined();
        });

        it('should call isReady method if available', async () => {
            const mockIsReady = vi.fn().mockResolvedValue(true);
            global.CorpuscleSelector.mockReturnValue({
                initialize: vi.fn().mockResolvedValue(),
                isReady: mockIsReady,
                getMetrics: vi.fn().mockReturnValue({}),
                dispose: vi.fn().mockResolvedValue()
            });

            await navigationEndpoint.initialize(mockDependencies);

            expect(mockIsReady).toHaveBeenCalled();
        });

        it('should throw error if component is not ready', async () => {
            global.CorpuscleSelector.mockReturnValue({
                initialize: vi.fn().mockResolvedValue(),
                isReady: vi.fn().mockResolvedValue(false),
                getMetrics: vi.fn().mockReturnValue({}),
                dispose: vi.fn().mockResolvedValue()
            });

            await expect(
                navigationEndpoint.initialize(mockDependencies)
            ).rejects.toThrow('Component corpuscleSelector is not ready');
        });
    });

    describe('cleanup on failure', () => {
        it('should cleanup partial initialization on failure', async () => {
            const mockDispose = vi.fn().mockResolvedValue();
            
            global.CorpuscleSelector.mockReturnValue({
                initialize: vi.fn().mockResolvedValue(),
                getMetrics: vi.fn().mockReturnValue({}),
                dispose: mockDispose
            });

            global.TiltProjector.mockImplementation(() => {
                throw new Error('TiltProjector initialization failed');
            });

            await expect(
                navigationEndpoint.initialize(mockDependencies)
            ).rejects.toThrow('NavigationEndpoint initialization failed');

            expect(mockDispose).toHaveBeenCalled();
            expect(navigationEndpoint.corpuscleSelector).toBeNull();
        });
    });

    describe('shutdown procedure', () => {
        beforeEach(async () => {
            await navigationEndpoint.initialize(mockDependencies);
        });

        it('should shutdown components in reverse order', async () => {
            const shutdownOrder = [];
            
            navigationEndpoint.transformer.dispose = vi.fn().mockImplementation(async () => {
                shutdownOrder.push('transformer');
            });
            
            navigationEndpoint.corpuscleSelector.dispose = vi.fn().mockImplementation(async () => {
                shutdownOrder.push('corpuscleSelector');
            });

            await navigationEndpoint.shutdown();

            expect(shutdownOrder).toEqual(['transformer', 'corpuscleSelector']);
        });

        it('should handle missing dispose methods gracefully', async () => {
            navigationEndpoint.tiltProjector.dispose = undefined;
            navigationEndpoint.tiltProjector.shutdown = vi.fn().mockResolvedValue();

            await expect(navigationEndpoint.shutdown()).resolves.not.toThrow();
            expect(navigationEndpoint.tiltProjector.shutdown).toHaveBeenCalled();
        });

        it('should continue shutdown even if component cleanup fails', async () => {
            navigationEndpoint.transformer.dispose = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
            navigationEndpoint.corpuscleSelector.dispose = vi.fn().mockResolvedValue();

            await expect(navigationEndpoint.shutdown()).resolves.not.toThrow();
            expect(navigationEndpoint.corpuscleSelector.dispose).toHaveBeenCalled();
        });

        it('should reset component references after shutdown', async () => {
            await navigationEndpoint.shutdown();

            expect(navigationEndpoint.corpuscleSelector).toBeNull();
            expect(navigationEndpoint.tiltProjector).toBeNull();
            expect(navigationEndpoint.transformer).toBeNull();
        });
    });

    describe('health checks', () => {
        beforeEach(async () => {
            await navigationEndpoint.initialize(mockDependencies);
        });

        it('should perform comprehensive health checks', async () => {
            const health = await navigationEndpoint.handleHealth({}, 'test-request');

            expect(health.success).toBe(true);
            expect(health.checks.api.status).toBe('healthy');
            expect(health.checks.corpuscleSelector).toBeDefined();
            expect(health.checks.transformer).toBeDefined();
            expect(health.checks.sparqlStore).toBeDefined();
        });

        it('should test external services during health check', async () => {
            await navigationEndpoint.handleHealth({}, 'test-request');

            expect(mockDependencies.embeddingHandler.generateEmbedding).toHaveBeenCalledWith('test', { enableFallbacks: false });
            expect(mockDependencies.llmHandler.extractConcepts).toHaveBeenCalledWith('test text', { timeoutMs: 5000 });
        });

        it('should handle health check timeouts', async () => {
            mockDependencies.sparqlStore.healthCheck = vi.fn()
                .mockImplementation(() => new Promise(resolve => 
                    setTimeout(() => resolve({ healthy: true }), 10000)
                ));

            const health = await navigationEndpoint.handleHealth({}, 'test-request');

            expect(health.checks.sparqlStore.status).toBe('unhealthy');
            expect(health.checks.sparqlStore.error).toContain('timeout');
        });
    });
});