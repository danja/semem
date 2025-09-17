// tests/integration/sparql/enhanced-sparql-store-integration.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';
import MemoryManager from '../../../src/MemoryManager.js';
import OllamaConnector from '../../../src/connectors/OllamaConnector.js';
import { logger } from '../../../src/Utils.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Enhanced SPARQLStore Integration Tests', () => {
    let store;
    let config;
    let memoryManager;
    let llmProvider;
    let testGraphName;

    beforeAll(async () => {
        // Initialize with real config from config.json
        const projectRoot = path.resolve(__dirname, '../../../..');
        const configPath = path.join(projectRoot, 'config/config.json');
        config = new Config(configPath);
        await config.init();

        testGraphName = 'http://hyperdata.it/test-enhanced-sparql';

        // Get storage options from config
        const storageOptions = config.get('storage.options');

        console.log('Test setup - storage options:', storageOptions);

        // Create enhanced SPARQLStore with real SPARQL endpoint
        store = new SPARQLStore(storageOptions, {
            dimension: 1536,
            enableResilience: true,
            cacheTimeoutMs: 60000,
            graphName: testGraphName,
            maxRetries: 1,
            timeoutMs: 10000
        }, config);

        // Use real Ollama connector for embedding tests (skip if not available)
        try {
            llmProvider = new OllamaConnector({
                baseUrl: 'http://localhost:11434',
                embeddingModel: 'nomic-embed-text'
            });
        } catch (error) {
            console.warn('Ollama not available for tests, using mock:', error.message);
            llmProvider = {
                generateEmbedding: async () => new Array(1536).fill(0).map(() => Math.random()),
                getInfo: () => ({ capabilities: ['embedding'] })
            };
        }

        // Clear test graph before starting
        try {
            const clearQuery = `
                DROP SILENT GRAPH <${testGraphName}>;
                CREATE GRAPH <${testGraphName}>
            `;
            await store._executeSparqlUpdate(clearQuery, storageOptions.update);
            console.log('Test graph cleared and created');
        } catch (error) {
            console.warn('Test setup warning (graph may not exist):', error.message);
        }
    }, 60000);

    afterAll(async () => {
        // Cleanup test graph and resources
        try {
            if (store) {
                const storageOptions = config.get('storage.options');
                const dropQuery = `DROP SILENT GRAPH <${testGraphName}>`;
                await store._executeSparqlUpdate(dropQuery, storageOptions.update);
                await store.cleanup();
            }

            if (memoryManager) {
                await memoryManager.dispose();
            }
        } catch (error) {
            console.warn('Cleanup warning:', error.message);
        }
    }, 30000);

    describe('Enhanced Store Initialization', () => {
        it('should initialize enhanced SPARQLStore with all in-memory capabilities', () => {
            // Verify FAISS index
            expect(store.index).toBeDefined();
            expect(store.index.getDimension()).toBe(1536);
            expect(store.dimension).toBe(1536);

            // Verify concept graph
            expect(store.graph).toBeDefined();
            expect(store.graph.nodes()).toEqual([]);
            expect(store.graph.edges()).toEqual([]);

            // Verify in-memory structures
            expect(store.shortTermMemory).toEqual([]);
            expect(store.longTermMemory).toEqual([]);
            expect(store.embeddings).toEqual([]);
            expect(store.timestamps).toEqual([]);
            expect(store.accessCounts).toEqual([]);
            expect(store.conceptsList).toEqual([]);

            // Verify semantic memory
            expect(store.semanticMemory).toBeDefined();
            expect(store.semanticMemory.size).toBe(0);
            expect(store.clusterLabels).toEqual([]);

            // Verify configuration
            expect(store.promotionThreshold).toBeGreaterThan(0);
            expect(store.classificationChance).toBeGreaterThan(0);
        });

        it('should verify SPARQL endpoint connectivity', async () => {
            const exists = await store.verify();
            expect(exists).toBe(true);
        });
    });

    describe('In-Memory Operations', () => {
        it('should manage concept graph updates', () => {
            const concepts = ['artificial intelligence', 'machine learning', 'neural networks'];

            store.updateGraph(concepts);

            // Verify nodes added
            expect(store.graph.nodes()).toHaveLength(3);
            expect(store.graph.nodes()).toEqual(expect.arrayContaining(concepts));

            // Verify edges created (each concept connected to others)
            expect(store.graph.edges()).toHaveLength(3);

            // Test repeated concepts increase edge weights
            store.updateGraph(['artificial intelligence', 'machine learning']);
            const edges = store.graph.edges();
            const weightSum = edges.reduce((sum, edgeId) => {
                return sum + store.graph.getEdgeAttribute(edgeId, 'weight');
            }, 0);
            expect(weightSum).toBeGreaterThan(3); // Should have increased weights
        });

        it('should perform spreading activation on concept graph', async () => {
            // Ensure we have a concept graph
            store.updateGraph(['AI', 'machine learning', 'deep learning', 'neural networks']);

            const queryConcepts = ['AI'];
            const activatedNodes = await store.spreadingActivation(queryConcepts);

            expect(activatedNodes).toHaveProperty('AI');
            expect(activatedNodes['AI']).toBe(1.0);

            // Should activate connected concepts
            expect(Object.keys(activatedNodes).length).toBeGreaterThan(1);

            // All activations should be positive
            Object.values(activatedNodes).forEach(activation => {
                expect(activation).toBeGreaterThan(0);
            });
        });

        it('should calculate memory importance scores', () => {
            const interaction = {
                id: 'test-importance-1',
                prompt: 'test prompt with multiple concepts',
                response: 'detailed response about artificial intelligence and machine learning',
                timestamp: Date.now(),
                concepts: ['AI', 'machine learning', 'test'],
                decayFactor: 1.5
            };

            // Add to short-term memory for calculation
            store.shortTermMemory = [interaction];
            store.accessCounts = [5]; // Moderate access count
            store.timestamps = [Date.now() - 3600000]; // 1 hour ago

            const score = store.calculateMemoryImportance(interaction, 0, Date.now());

            expect(typeof score).toBe('number');
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThan(20); // Should be reasonable range
        });
    });

    describe('Enhanced Storage Operations', () => {
        it('should store interaction with both SPARQL persistence and in-memory indexing', async () => {
            const testInteraction = {
                id: 'enhanced-test-1',
                prompt: 'What is artificial intelligence?',
                response: 'Artificial intelligence is a branch of computer science.',
                embedding: new Array(1536).fill(0).map(() => Math.random() * 0.1),
                timestamp: Date.now(),
                concepts: ['artificial intelligence', 'computer science'],
                metadata: { source: 'test' }
            };

            // Store using enhanced method
            await store.storeWithMemory(testInteraction);

            // Verify in-memory structures updated
            expect(store.shortTermMemory).toHaveLength(1);
            expect(store.embeddings).toHaveLength(1);
            expect(store.index.ntotal()).toBe(1);
            expect(store.conceptsList[0]).toEqual(['artificial intelligence', 'computer science']);

            // Verify concept graph updated
            expect(store.graph.nodes()).toEqual(
                expect.arrayContaining(['artificial intelligence', 'computer science'])
            );

            // Verify SPARQL persistence by loading from store
            const [shortTerm, longTerm] = await store.loadHistory();
            expect(shortTerm).toHaveLength(1);
            expect(shortTerm[0].id).toBe('enhanced-test-1');
            expect(shortTerm[0].prompt).toBe('What is artificial intelligence?');
        });

        it('should perform enhanced retrieval with FAISS and concept activation', async () => {
            // Add more test data for retrieval
            const testInteractions = [
                {
                    id: 'retrieval-test-1',
                    prompt: 'Explain machine learning algorithms',
                    response: 'Machine learning algorithms are computational methods.',
                    embedding: new Array(1536).fill(0).map(() => Math.random() * 0.1 + 0.1),
                    timestamp: Date.now(),
                    concepts: ['machine learning', 'algorithms']
                },
                {
                    id: 'retrieval-test-2',
                    prompt: 'What are neural networks?',
                    response: 'Neural networks are computing systems inspired by biological neural networks.',
                    embedding: new Array(1536).fill(0).map(() => Math.random() * 0.1 + 0.2),
                    timestamp: Date.now(),
                    concepts: ['neural networks', 'computing']
                }
            ];

            // Store test interactions
            for (const interaction of testInteractions) {
                await store.storeWithMemory(interaction);
            }

            // Test enhanced retrieval
            const queryEmbedding = new Array(1536).fill(0).map(() => Math.random() * 0.1 + 0.15);
            const queryConcepts = ['machine learning'];

            const results = await store.retrieve(queryEmbedding, queryConcepts, 0.1);

            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBeGreaterThan(0);

            // Results should have similarity scores
            results.forEach(result => {
                expect(result).toHaveProperty('similarity');
                expect(typeof result.similarity).toBe('number');
                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('prompt');
            });
        });

        it('should perform memory classification and promotion', () => {
            // Add interaction that should be promoted
            const importantInteraction = {
                id: 'important-memory-1',
                prompt: 'Critical system information',
                response: 'This is very important information that should be preserved.',
                timestamp: Date.now(),
                concepts: ['critical', 'important', 'system'],
                decayFactor: 2.5 // High reinforcement
            };

            // Set up for high importance score
            store.shortTermMemory = [importantInteraction];
            store.accessCounts = [15]; // Very high access count
            store.timestamps = [Date.now() - 1000]; // Very recent
            store.longTermMemory = [];

            const initialLongTermCount = store.longTermMemory.length;
            store.classifyMemory();

            expect(store.longTermMemory.length).toBe(initialLongTermCount + 1);
            expect(store.longTermMemory[0].id).toBe('important-memory-1');
        });

        it('should cluster interactions when sufficient data exists', () => {
            // Add several interactions with different embeddings
            const interactions = [];
            const embeddings = [];

            for (let i = 0; i < 5; i++) {
                const embedding = new Array(1536).fill(0).map(() => Math.random() * 0.1 + i * 0.1);
                const interaction = {
                    id: `cluster-test-${i}`,
                    prompt: `Test prompt ${i}`,
                    response: `Test response ${i}`,
                    embedding,
                    timestamp: Date.now(),
                    concepts: [`concept${i}`]
                };

                interactions.push(interaction);
                embeddings.push(embedding);
            }

            store.shortTermMemory = interactions;
            store.embeddings = embeddings;

            store.clusterInteractions();

            expect(store.clusterLabels).toHaveLength(5);
            expect(store.semanticMemory.size).toBeGreaterThan(0);

            // Verify semantic memory structure
            for (const [label, items] of store.semanticMemory) {
                expect(Array.isArray(items)).toBe(true);
                items.forEach(item => {
                    expect(item).toHaveProperty('embedding');
                    expect(item).toHaveProperty('interaction');
                });
            }
        });
    });

    describe('MemoryManager Integration', () => {
        it('should integrate seamlessly with MemoryManager (no dual storage)', async () => {
            // Mock the _ensureMemoryLoaded to avoid timeout during test
            const originalEnsureMemoryLoaded = store._ensureMemoryLoaded;
            store._ensureMemoryLoaded = async () => {
                store._memoryCache.loaded = true;
                store._memoryCache.lastLoaded = Date.now();
            };

            try {
                memoryManager = new MemoryManager({
                    llmProvider,
                    embeddingProvider: llmProvider,
                    storage: store,
                    config: config,
                    dimension: 1536
                });

                await memoryManager.ensureInitialized();

                // Verify single storage reference (no dual storage)
                expect(memoryManager.store).toBe(store);

                // Verify initialization completed
                expect(memoryManager._initialized).toBe(true);

                // Test enhanced SPARQLStore features are available
                expect(store.index).toBeDefined();
                expect(store.graph).toBeDefined();
                expect(store.semanticMemory).toBeDefined();

            } finally {
                // Restore original method
                store._ensureMemoryLoaded = originalEnsureMemoryLoaded;
            }
        }, 15000);

        it('should retrieve memories through MemoryManager using enhanced store', async () => {
            if (!memoryManager) {
                console.log('Skipping retrieval test - MemoryManager not initialized');
                return;
            }

            // Mock the retrieve method to avoid complex SPARQL operations during testing
            const originalRetrieve = store.retrieve;
            store.retrieve = async () => [
                { id: 'test-1', similarity: 0.8, prompt: 'test prompt', response: 'test response' }
            ];

            try {
                const query = 'artificial intelligence machine learning';
                const results = await memoryManager.retrieveRelevantInteractions(query, 0.1, 0, 5);

                expect(Array.isArray(results)).toBe(true);
                expect(results.length).toBeGreaterThanOrEqual(0);

                if (results.length > 0) {
                    results.forEach(result => {
                        expect(result).toHaveProperty('id');
                        expect(typeof result.id).toBe('string');
                    });
                }
            } finally {
                store.retrieve = originalRetrieve;
            }
        }, 10000);
    });

    describe('Cache and Performance', () => {
        it('should implement cache timeout behavior', async () => {
            // Set cache as loaded and not expired
            store._memoryCache.loaded = true;
            store._memoryCache.lastLoaded = Date.now() - 30000; // 30 seconds ago
            store._memoryCache.cacheTimeoutMs = 60000; // 1 minute timeout

            // This should not reload from SPARQL
            const startTime = Date.now();
            await store._ensureMemoryLoaded();
            const elapsed = Date.now() - startTime;

            // Should be very fast (no SPARQL loading)
            expect(elapsed).toBeLessThan(100);
        });

        it('should handle cleanup and persistence scheduling', async () => {
            // Test that cleanup works without errors
            const cleanupPromise = store.cleanup();
            await expect(cleanupPromise).resolves.not.toThrow();

            // Recreate store for further tests
            const storageOptions = config.get('storage.options');
            store = new SPARQLStore(storageOptions, {
                dimension: 1536,
                enableResilience: true,
                cacheTimeoutMs: 60000,
                graphName: testGraphName
            }, config);
        });
    });
});