// tests/core/unit/stores/EnhancedSPARQLStore.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SPARQLStore from '../../../../src/stores/SPARQLStore.js';
import MemoryManager from '../../../../src/MemoryManager.js';
import { v4 as uuidv4 } from 'uuid';

describe('Enhanced SPARQLStore Migration', () => {
    let store;
    let mockFetch;
    let endpoint;
    let testConfig;

    beforeEach(() => {
        endpoint = {
            query: 'http://localhost:3030/test/query',
            update: 'http://localhost:3030/test/update'
        };

        testConfig = {
            get: vi.fn((key) => {
                const config = {
                    'baseUri': 'http://test.org/',
                    'memory.promotionThreshold': 5.0,
                    'memory.classificationChance': 0.1
                };
                return config[key];
            })
        };

        // Mock fetch to avoid actual SPARQL calls
        mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ results: { bindings: [] } }),
            text: () => Promise.resolve(''),
            status: 200
        });
        global.fetch = mockFetch;

        // Create enhanced SPARQLStore instance
        store = new SPARQLStore(endpoint, {
            user: 'test',
            password: 'test',
            graphName: 'http://test.org/content',
            dimension: 1536,
            enableResilience: true,
            cacheTimeoutMs: 60000
        }, testConfig);
    });

    afterEach(async () => {
        if (store) {
            try {
                await store.close();
            } catch (error) {
                // Ignore cleanup errors during testing
            }
        }
        global.fetch = undefined;
        vi.resetAllMocks();
    });

    describe('Enhanced Initialization', () => {
        it('should initialize with FAISS index', () => {
            expect(store.index).toBeDefined();
            expect(store.dimension).toBe(1536);
            expect(store.index.getDimension()).toBe(1536);
        });

        it('should initialize concept graph', () => {
            expect(store.graph).toBeDefined();
            expect(store.graph.nodes()).toHaveLength(0);
            expect(store.graph.edges()).toHaveLength(0);
        });

        it('should initialize in-memory structures', () => {
            expect(store.shortTermMemory).toEqual([]);
            expect(store.longTermMemory).toEqual([]);
            expect(store.embeddings).toEqual([]);
            expect(store.timestamps).toEqual([]);
            expect(store.accessCounts).toEqual([]);
            expect(store.conceptsList).toEqual([]);
        });

        it('should initialize semantic memory structures', () => {
            expect(store.semanticMemory).toBeDefined();
            expect(store.semanticMemory.size).toBe(0);
            expect(store.clusterLabels).toEqual([]);
        });

        it('should set up memory classification configuration', () => {
            expect(store.promotionThreshold).toBe(5.0);
            expect(store.classificationChance).toBe(0.1);
        });
    });

    describe('Concept Graph Management', () => {
        it('should update graph with concepts', () => {
            const concepts = ['artificial intelligence', 'machine learning', 'neural networks'];

            store.updateGraph(concepts);

            expect(store.graph.nodes()).toHaveLength(3);
            expect(store.graph.nodes()).toContain('artificial intelligence');
            expect(store.graph.nodes()).toContain('machine learning');
            expect(store.graph.nodes()).toContain('neural networks');

            // Check that edges were created between all concept pairs
            expect(store.graph.edges()).toHaveLength(3); // 3 concepts = 3 bidirectional edges
        });

        it('should update edge weights on repeated concepts', () => {
            const concepts = ['AI', 'ML'];

            // First update
            store.updateGraph(concepts);
            const firstWeight = store.graph.getEdgeAttribute(store.graph.edges()[0], 'weight');
            expect(firstWeight).toBe(1);

            // Second update with same concepts
            store.updateGraph(concepts);
            const secondWeight = store.graph.getEdgeAttribute(store.graph.edges()[0], 'weight');
            expect(secondWeight).toBe(2);
        });
    });

    describe('Memory Classification', () => {
        it('should calculate memory importance scores', () => {
            const interaction = {
                id: uuidv4(),
                prompt: 'test prompt',
                output: 'test output',
                timestamp: Date.now(),
                concepts: ['test', 'concept'],
                decayFactor: 1.0
            };

            store.shortTermMemory = [interaction];
            store.accessCounts = [3]; // Higher access count
            store.timestamps = [Date.now() - 1000]; // Recent access

            const score = store.calculateMemoryImportance(interaction, 0, Date.now());

            expect(score).toBeGreaterThan(0);
            expect(typeof score).toBe('number');
        });

        it('should promote high-importance memories to long-term', () => {
            const interaction = {
                id: uuidv4(),
                prompt: 'important memory',
                output: 'important response',
                timestamp: Date.now(),
                concepts: ['important', 'concept', 'memory'],
                decayFactor: 2.0 // High reinforcement
            };

            store.shortTermMemory = [interaction];
            store.accessCounts = [10]; // Very high access count
            store.timestamps = [Date.now()]; // Very recent
            store.longTermMemory = [];

            store.classifyMemory();

            expect(store.longTermMemory).toHaveLength(1);
            expect(store.longTermMemory[0].id).toBe(interaction.id);
        });
    });

    describe('FAISS Index Operations', () => {
        it('should add embeddings to FAISS index via storeWithMemory', async () => {
            const testData = {
                id: uuidv4(),
                prompt: 'test prompt',
                response: 'test response',
                embedding: new Array(1536).fill(0.1),
                timestamp: Date.now(),
                concepts: ['test']
            };

            // Mock successful SPARQL store operation
            mockFetch.mockResolvedValue({
                ok: true,
                text: () => Promise.resolve(''),
                status: 200
            });

            await store.storeWithMemory(testData);

            expect(store.shortTermMemory).toHaveLength(1);
            expect(store.embeddings).toHaveLength(1);
            expect(store.index.ntotal()).toBe(1);
        });

        it('should cluster interactions when sufficient data exists', () => {
            // Add some mock embeddings
            const embeddings = [
                new Array(1536).fill(0.1),
                new Array(1536).fill(0.2),
                new Array(1536).fill(0.3)
            ];

            const interactions = embeddings.map((emb, i) => ({
                id: uuidv4(),
                prompt: `prompt ${i}`,
                response: `response ${i}`,
                embedding: emb,
                timestamp: Date.now(),
                concepts: [`concept${i}`]
            }));

            store.shortTermMemory = interactions;
            store.embeddings = embeddings;

            store.clusterInteractions();

            expect(store.clusterLabels).toHaveLength(3);
            expect(store.semanticMemory.size).toBeGreaterThan(0);
        });
    });

    describe('Spreading Activation', () => {
        it('should perform spreading activation on concept graph', async () => {
            // Set up a simple concept graph
            store.updateGraph(['AI', 'ML', 'deep learning']);

            const queryConcepts = ['AI'];
            const activated = await store.spreadingActivation(queryConcepts);

            expect(activated).toHaveProperty('AI');
            expect(activated['AI']).toBe(1.0); // Initial activation
            expect(Object.keys(activated).length).toBeGreaterThan(1); // Should activate neighbors
        });
    });

    describe('Integration with MemoryManager', () => {
        it('should work with MemoryManager without dual storage', async () => {
            // Mock a simple LLM provider
            const mockLLMProvider = {
                generateChat: vi.fn(),
                generateEmbedding: vi.fn(() => Promise.resolve(new Array(1536).fill(0))),
                getInfo: vi.fn(() => ({ capabilities: ['chat', 'embedding'] }))
            };

            // Mock the _ensureMemoryLoaded method to avoid SPARQL calls
            store._ensureMemoryLoaded = vi.fn().mockResolvedValue();
            store.shortTermMemory = [];
            store.longTermMemory = [];

            const memoryManager = new MemoryManager({
                llmProvider: mockLLMProvider,
                embeddingProvider: mockLLMProvider,
                storage: store,
                config: testConfig,
                dimension: 1536
            });

            await memoryManager.ensureInitialized();

            expect(memoryManager.store).toBe(store);
            expect(store._ensureMemoryLoaded).toHaveBeenCalled();

            await memoryManager.dispose();
        });
    });

    describe('Cache Management', () => {
        it('should implement lazy loading with cache timeout', async () => {
            const now = Date.now();

            // Set cache as loaded and recent
            store._memoryCache.loaded = true;
            store._memoryCache.lastLoaded = now - 30000; // 30 seconds ago
            store._memoryCache.cacheTimeoutMs = 60000; // 60 second timeout

            // Mock the method to track calls
            store.loadHistory = vi.fn().mockResolvedValue([[], []]);

            await store._ensureMemoryLoaded();

            // Should not reload as cache is still valid
            expect(store.loadHistory).not.toHaveBeenCalled();
        });

        it('should reload cache when expired', async () => {
            const now = Date.now();

            // Set cache as loaded but expired
            store._memoryCache.loaded = true;
            store._memoryCache.lastLoaded = now - 400000; // 400 seconds ago (expired)
            store._memoryCache.cacheTimeoutMs = 300000; // 5 minute timeout

            // Mock the method to return data
            store.loadHistory = vi.fn().mockResolvedValue([
                [{ id: '1', embedding: new Array(1536).fill(0), timestamp: now }],
                []
            ]);
            store._loadGraphFromStore = vi.fn().mockResolvedValue(false);

            await store._ensureMemoryLoaded();

            // Should reload as cache is expired
            expect(store.loadHistory).toHaveBeenCalled();
            expect(store.shortTermMemory).toHaveLength(1);
        });
    });

    describe('Cleanup and Persistence', () => {
        it('should schedule debounced persistence operations', () => {
            const concepts = ['test'];

            // Mock setTimeout to track debouncing
            const originalSetTimeout = global.setTimeout;
            const mockSetTimeout = vi.fn();
            global.setTimeout = mockSetTimeout;

            try {
                store.updateGraph(concepts);
                expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 30000);
            } finally {
                global.setTimeout = originalSetTimeout;
            }
        });

        it('should clear timers during cleanup', async () => {
            const originalClearTimeout = global.clearTimeout;
            const mockClearTimeout = vi.fn();
            global.clearTimeout = mockClearTimeout;

            try {
                // Set up some pending timers
                store._graphPersistenceTimer = 123;
                store._indexPersistenceTimer = 456;
                store._memoryPersistenceTimer = 789;

                // Mock the parent close method
                const originalClose = SPARQLStore.prototype.close;
                SPARQLStore.prototype.close = vi.fn();

                try {
                    await store.cleanup();

                    expect(mockClearTimeout).toHaveBeenCalledWith(123);
                    expect(mockClearTimeout).toHaveBeenCalledWith(456);
                    expect(mockClearTimeout).toHaveBeenCalledWith(789);
                } finally {
                    SPARQLStore.prototype.close = originalClose;
                }
            } finally {
                global.clearTimeout = originalClearTimeout;
            }
        });
    });
});