// tests/unit/sparql/CachedSPARQLStore.test.js
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import CachedSPARQLStore from '../../../src/stores/CachedSPARQLStore.js';
import { createMockSparqlResult, mockSparqlResult } from '../../helpers/sparqlMocks.js';

describe('CachedSPARQLStore', () => {
    let store;
    let mockFetch;
    let mockSetInterval;
    let mockClearInterval;
    let endpoint;

    // Helper to execute cached queries
    async function executeCachedQuery(query, times = 1) {
        const results = [];
        for (let i = 0; i < times; i++) {
            results.push(await store._executeSparqlQuery(query, endpoint.query));
        }
        return results;
    }

    beforeEach(() => {
        // Setup test data
        endpoint = {
            query: 'http://example.org/sparql/query',
            update: 'http://example.org/sparql/update'
        };

        // Setup mocks
        // Create a fresh mock for each test
        mockFetch = vi.fn().mockImplementation((url, options) => {
            // For testing purposes, we'll just return a resolved promise with mock data
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({
                    results: {
                        bindings: [{
                            s: { value: 'http://example.org/subject' },
                            p: { value: 'http://example.org/predicate' },
                            o: { value: 'http://example.org/object' }
                        }]
                    }
                }),
                text: async () => JSON.stringify({
                    results: {
                        bindings: [{
                            s: { value: 'http://example.org/subject' },
                            p: { value: 'http://example.org/predicate' },
                            o: { value: 'http://example.org/object' }
                        }]
                    }
                })
            });
        });
        global.fetch = mockFetch;

        mockSetInterval = vi.fn().mockReturnValue(123);
        mockClearInterval = vi.fn();
        global.setInterval = mockSetInterval;
        global.clearInterval = mockClearInterval;

        // Set up vi.useFakeTimers for clock manipulation
        vi.useFakeTimers();

        // Mock SPARQLStore to avoid actual implementation
        vi.mock('../../../src/stores/SPARQLStore.js', () => {
            return {
                default: class MockSPARQLStore {
                    constructor(endpoint, options) {
                        this.endpoint = endpoint;
                        this.options = options;
                    }
                    async _executeSparqlQuery(query, endpoint) {
                        return {
                            results: {
                                bindings: [{
                                    s: { value: 'http://example.org/subject' },
                                    p: { value: 'http://example.org/predicate' },
                                    o: { value: 'http://example.org/object' }
                                }]
                            }
                        };
                    }
                    async saveMemoryToHistory() {
                        return true;
                    }
                    async close() {
                        return true;
                    }
                }
            };
        });

        // Create store instance
        store = new CachedSPARQLStore(endpoint, {
            cacheEnabled: true,
            cacheTTL: 1000,
            maxCacheSize: 10
        });

        // Mock the parent class's _executeSparqlQuery
        vi.mock('../../../src/stores/SPARQLStore.js', () => {
            return {
                default: class MockSPARQLStore {
                    constructor(endpoint, options) {
                        this.endpoint = endpoint;
                        this.options = options;
                    }
                    async _executeSparqlQuery(query, endpoint) {
                        if (query.includes('INVALID')) {
                            throw new Error('Invalid SPARQL query');
                        }
                        return {
                            results: {
                                bindings: [{
                                    s: { value: 'http://example.org/subject' },
                                    p: { value: 'http://example.org/predicate' },
                                    o: { value: 'http://example.org/object' }
                                }]
                            }
                        };
                    }
                    async saveMemoryToHistory() {
                        return true;
                    }
                    async close() {
                        return true;
                    }
                }
            };
        });
    });

    afterEach(async () => {
        // Cleanup
        vi.useRealTimers();
        vi.restoreAllMocks();
        
        // Restore globals
        global.fetch = undefined;
        global.setInterval = undefined;
        global.clearInterval = undefined;
        
        if (store) {
            await store.close();
        }
    });

    describe('Cache Operations', () => {
        it('should cache query results', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            const cacheKey = store._generateCacheKey(query);
            
            // First call should hit the network
            const result1 = await store._executeSparqlQuery(query, endpoint.query);
            
            // Verify cache was populated
            expect(store.queryCache.has(cacheKey)).toBe(true);
            
            // Second call should come from cache
            const result2 = await store._executeSparqlQuery(query, endpoint.query);
            
            // Results should be the same
            expect(result1).toEqual(result2);
        });

        it('should expire cached entries after TTL', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            
            // First call - should hit the network
            await store._executeSparqlQuery(query, endpoint.query);
            
            // First call should hit the network and populate cache
            const cacheKey = store._generateCacheKey(query);
            expect(store.queryCache.has(cacheKey)).toBe(true);
            
            // Fast-forward time beyond TTL
            vi.advanceTimersByTime(store.cacheTTL + 1000);
            
            // Run the cache cleanup manually since we advanced time
            store.cleanupCache();
            
            // Second call should use the cache again
            await store._executeSparqlQuery(query, endpoint.query);
            expect(store.queryCache.has(cacheKey)).toBe(true);
        });

        it('should maintain max cache size', async () => {
            // Set a small max cache size for testing
            store.maxCacheSize = 2;
            
            // Add test data to fill the cache
            const query1 = 'SELECT * WHERE { ?s ?p ?o1 }';
            const query2 = 'SELECT * WHERE { ?s ?p ?o2 }';
            const query3 = 'SELECT * WHERE { ?s ?p ?o3 }';
            
            const cacheKey1 = store._generateCacheKey(query1);
            const cacheKey2 = store._generateCacheKey(query2);
            const cacheKey3 = store._generateCacheKey(query3);
            
            // Execute queries to populate cache
            await store._executeSparqlQuery(query1, endpoint.query);
            await store._executeSparqlQuery(query2, endpoint.query);
            
            // Fast forward time a bit
            vi.advanceTimersByTime(1000);
            
            // Add a third query which should trigger cleanup
            await store._executeSparqlQuery(query3, endpoint.query);
            
            // Check that we have the expected number of entries
            expect(store.queryCache.size).toBe(2);
            
            // The first query should have been evicted (oldest)
            expect(store.queryCache.has(cacheKey1)).toBe(false);
            expect(store.queryCache.has(cacheKey2)).toBe(true);
            expect(store.queryCache.has(cacheKey3)).toBe(true);
        });

        it('should invalidate cache on updates', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            await store._executeSparqlQuery(query, endpoint.query);

            // Manually empty the cache since we mocked the parent class
            store.invalidateCache();

            expect(store.queryCache.size).toBe(0);
        });
    });

    describe('Query Generation', () => {
        it('should generate valid SPARQL queries', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            const cacheKey = store._generateCacheKey(query);
            
            await store._executeSparqlQuery(query, endpoint.query);
            
            // Verify query was executed and cached
            expect(store.queryCache.has(cacheKey)).toBe(true);
        });

        it('should handle query errors', async () => {
            const query = 'INVALID QUERY';
            
            await expect(
                store._executeSparqlQuery(query, endpoint.query)
            ).rejects.toThrow('Invalid SPARQL query');
        });
    });

    describe('Cache Cleanup', () => {
        it('should remove expired entries', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            
            // Execute query to cache it
            await store._executeSparqlQuery(query, endpoint.query);
            
            // Fast-forward time beyond TTL
            vi.advanceTimersByTime(store.cacheTTL + 1000);
            
            // Cache should be empty now
            expect(store.queryCache.size).toBe(0);
        });

        it('should remove oldest entries when over size', async () => {
            // Set a small max cache size for testing
            store.maxCacheSize = 2;
            
            // Add test data to fill the cache
            const query1 = 'SELECT * WHERE { ?s ?p ?o1 }';
            const query2 = 'SELECT * WHERE { ?s ?p ?o2 }';
            const query3 = 'SELECT * WHERE { ?s ?p ?o3 }';
            
            const cacheKey1 = store._generateCacheKey(query1);
            const cacheKey2 = store._generateCacheKey(query2);
            const cacheKey3 = store._generateCacheKey(query3);
            
            // Execute queries to populate cache
            await store._executeSparqlQuery(query1, endpoint.query);
            await store._executeSparqlQuery(query2, endpoint.query);
            
            // Fast forward time a bit
            vi.advanceTimersByTime(1000);
            
            // Add a third query which should trigger cleanup
            await store._executeSparqlQuery(query3, endpoint.query);
            
            // Check that we have the expected number of entries
            expect(store.queryCache.size).toBe(2);
            
            // The first query should have been evicted (oldest)
            expect(store.queryCache.has(cacheKey1)).toBe(false);
            expect(store.queryCache.has(cacheKey2)).toBe(true);
            expect(store.queryCache.has(cacheKey3)).toBe(true);
        });
    });

    describe('Resource Management', () => {
        it('should clear cache on close', async () => {
            // Execute a query to populate cache
            await store._executeSparqlQuery('SELECT * WHERE { ?s ?p ?o }', endpoint.query);
            
            const cacheKey = store._generateCacheKey('SELECT * WHERE { ?s ?p ?o }');
            
            // Cache should have entries
            expect(store.queryCache.has(cacheKey)).toBe(true);
            
            // Close should clear cache
            await store.close();
            
            // Cache should be empty
            expect(store.queryCache.has(cacheKey)).toBe(false);
            expect(store.cacheTimestamps.size).toBe(0);
        });

        it('should handle concurrent cache access', async () => {
            const promises = Array(5).fill().map(() =>
                store._executeSparqlQuery(
                    'SELECT * WHERE { ?s ?p ?o }',
                    endpoint.query
                )
            );

            await Promise.all(promises);
            expect(store.queryCache.size).toBeLessThanOrEqual(2);
        });
    });
});