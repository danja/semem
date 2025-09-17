// tests/integration/sparql/enhanced-sparql-core.test.js

// Load environment variables FIRST before ANY imports that might use them
import dotenv from 'dotenv';
dotenv.config();

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fetch from 'node-fetch';
import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Set up global fetch for integration tests
global.fetch = fetch;
globalThis.fetch = fetch;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Enhanced SPARQLStore Core Integration', () => {
    let store;
    let config;
    let testGraphName;

    beforeAll(async () => {
        // Initialize config
        const projectRoot = path.resolve(__dirname, '../../../..');
        const configPath = path.join(projectRoot, 'config/config.json');
        config = new Config(configPath);
        await config.init();

        testGraphName = 'http://hyperdata.it/test-enhanced-core';

        // Get storage options
        const storageOptions = config.get('storage.options');

        // Create enhanced SPARQLStore
        store = new SPARQLStore(storageOptions, {
            dimension: 1536,
            graphName: testGraphName,
            enableResilience: false,  // Disable resilience for testing
            maxRetries: 1,
            timeoutMs: 30000
        }, config);

        console.log('Enhanced SPARQLStore created for core tests');
    }, 30000);

    afterAll(async () => {
        if (store) {
            try {
                const storageOptions = config.get('storage.options');
                const dropQuery = `DROP SILENT GRAPH <${testGraphName}>`;
                await store._executeSparqlUpdate(dropQuery, storageOptions.update);
                await store.close();
            } catch (error) {
                console.warn('Cleanup warning:', error.message);
            }
        }
    }, 15000);

    describe('Enhanced Features', () => {
        it('should have FAISS index initialized', () => {
            expect(store.index).toBeDefined();
            expect(store.index.getDimension()).toBe(1536);
            expect(store.dimension).toBe(1536);
        });

        it('should have concept graph initialized', () => {
            expect(store.graph).toBeDefined();
            expect(store.graph.nodes()).toEqual([]);
            expect(store.graph.edges()).toEqual([]);
        });

        it('should have in-memory structures initialized', () => {
            expect(store.shortTermMemory).toEqual([]);
            expect(store.longTermMemory).toEqual([]);
            expect(store.embeddings).toEqual([]);
            expect(store.timestamps).toEqual([]);
            expect(store.accessCounts).toEqual([]);
            expect(store.conceptsList).toEqual([]);
        });

        it('should have semantic memory initialized', () => {
            expect(store.semanticMemory).toBeDefined();
            expect(store.semanticMemory instanceof Map).toBe(true);
            expect(store.semanticMemory.size).toBe(0);
            expect(store.clusterLabels).toEqual([]);
        });
    });

    describe('Concept Graph Operations', () => {
        it('should update concept graph', () => {
            const concepts = ['AI', 'machine learning'];

            store.updateGraph(concepts);

            expect(store.graph.nodes()).toHaveLength(2);
            expect(store.graph.nodes()).toContain('AI');
            expect(store.graph.nodes()).toContain('machine learning');
            expect(store.graph.edges()).toHaveLength(1);
        });

        it('should perform spreading activation', async () => {
            const activatedNodes = await store.spreadingActivation(['AI']);

            expect(activatedNodes).toHaveProperty('AI');
            expect(activatedNodes['AI']).toBe(1.0);
            expect(Object.keys(activatedNodes).length).toBeGreaterThan(1);
        });
    });

    describe('Memory Classification', () => {
        it('should calculate importance scores', () => {
            const interaction = {
                id: 'test-1',
                prompt: 'test prompt',
                response: 'test response',
                timestamp: Date.now(),
                concepts: ['test'],
                decayFactor: 1.0
            };

            store.shortTermMemory = [interaction];
            store.accessCounts = [1];
            store.timestamps = [Date.now()];

            const score = store.calculateMemoryImportance(interaction, 0, Date.now());

            expect(typeof score).toBe('number');
            expect(score).toBeGreaterThan(0);
        });

        it('should handle semantic connectivity', () => {
            const interaction = {
                id: 'test-connectivity',
                concepts: ['AI', 'testing']
            };

            const connectivity = store.calculateSemanticConnectivity(interaction, ['AI', 'testing']);

            expect(typeof connectivity).toBe('number');
            expect(connectivity).toBeGreaterThanOrEqual(0);
        });
    });

    describe('SPARQL Connectivity', () => {
        it('should verify SPARQL endpoint works', async () => {
            const result = await store.verify();
            expect(result).toBe(true);
        });

        it('should execute basic SPARQL operations', async () => {
            const storageOptions = config.get('storage.options');

            // Test basic graph creation
            const testQuery = `
                ASK {
                    GRAPH <${testGraphName}> {
                        ?s ?p ?o
                    }
                }
            `;

            const response = await store._executeSparqlQuery(testQuery, storageOptions.query);
            expect(response).toBeDefined();
            expect(response.boolean !== undefined || response.results !== undefined).toBe(true);
        });
    });

    describe('Enhanced Storage Operations', () => {
        it('should add to FAISS index via storeWithMemory', async () => {
            const testData = {
                id: 'faiss-test-1',
                prompt: 'test prompt',
                response: 'test response',
                embedding: new Array(1536).fill(0.1),
                timestamp: Date.now(),
                concepts: ['test', 'faiss']
            };

            await store.storeWithMemory(testData);

            expect(store.shortTermMemory).toHaveLength(1);
            expect(store.embeddings).toHaveLength(1);
            expect(store.index.ntotal()).toBe(1);
            expect(store.conceptsList[0]).toEqual(['test', 'faiss']);
        });

        it('should cluster interactions', () => {
            // Add test data for clustering
            const embeddings = [
                new Array(1536).fill(0.1),
                new Array(1536).fill(0.2),
                new Array(1536).fill(0.3)
            ];

            const interactions = embeddings.map((emb, i) => ({
                id: `cluster-${i}`,
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

    describe('Cache Management', () => {
        it('should handle cache timeout logic', async () => {
            // Set cache as valid
            store._memoryCache.loaded = true;
            store._memoryCache.lastLoaded = Date.now() - 30000; // 30 seconds ago
            store._memoryCache.cacheTimeoutMs = 60000; // 1 minute timeout

            // Mock loadHistory to track if it's called
            let loadHistoryCalled = false;
            const originalLoadHistory = store.loadHistory;
            store.loadHistory = async () => {
                loadHistoryCalled = true;
                return [[], []];
            };

            await store._ensureMemoryLoaded();

            // Should not reload as cache is valid
            expect(loadHistoryCalled).toBe(false);

            // Restore original method
            store.loadHistory = originalLoadHistory;
        });
    });
});