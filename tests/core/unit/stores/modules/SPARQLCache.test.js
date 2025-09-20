// tests/core/unit/stores/modules/SPARQLCache.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SPARQLCache } from '../../../../../src/stores/modules/SPARQLCache.js';

describe('SPARQLCache', () => {
    let cache;
    let originalDateNow;

    beforeEach(() => {
        // Mock Date.now to control time-based behavior
        originalDateNow = Date.now;
        Date.now = vi.fn().mockReturnValue(1000000);

        cache = new SPARQLCache({
            cacheTimeoutMs: 300000, // 5 minutes
            maxCacheSize: 100
        });
    });

    afterEach(() => {
        Date.now = originalDateNow;
        vi.restoreAllMocks();
    });

    describe('constructor', () => {
        it('should initialize with default options', () => {
            const c = new SPARQLCache();
            expect(c.cacheTimeoutMs).toBeDefined();
            expect(c.maxCacheSize).toBeDefined();
        });

        it('should initialize with custom options', () => {
            const c = new SPARQLCache({ cacheTimeoutMs: 600000, maxCacheSize: 50 });
            expect(c.cacheTimeoutMs).toBe(600000);
            expect(c.maxCacheSize).toBe(50);
        });

        it('should initialize memory cache structure', () => {
            expect(cache._memoryCache.loaded).toBe(false);
            expect(cache._memoryCache.data).toBeDefined();
            expect(cache._memoryCache.data.shortTermMemory).toEqual([]);
        });
    });

    describe('memory cache management', () => {
        describe('isMemoryCacheValid', () => {
            it('should return false when cache not loaded', () => {
                expect(cache.isMemoryCacheValid()).toBe(false);
            });

            it('should return true when cache is fresh', () => {
                cache._memoryCache.loaded = true;
                cache._memoryCache.lastLoaded = 1000000; // Current time
                expect(cache.isMemoryCacheValid()).toBe(true);
            });

            it('should return false when cache is expired', () => {
                cache._memoryCache.loaded = true;
                cache._memoryCache.lastLoaded = 1000000 - 400000; // Older than timeout
                expect(cache.isMemoryCacheValid()).toBe(false);
            });
        });

        describe('getCachedMemoryData', () => {
            it('should return null when cache invalid', () => {
                expect(cache.getCachedMemoryData()).toBeNull();
            });

            it('should return data when cache valid', () => {
                cache._memoryCache.loaded = true;
                cache._memoryCache.lastLoaded = 1000000;
                const testData = { shortTermMemory: ['test'] };
                cache._memoryCache.data = testData;

                expect(cache.getCachedMemoryData()).toBe(testData);
            });
        });

        describe('updateMemoryCache', () => {
            it('should update memory cache with new data', () => {
                const memoryData = {
                    shortTermMemory: ['test1', 'test2'],
                    longTermMemory: ['test3'],
                    embeddings: [[1, 2, 3]],
                    timestamps: [1000],
                    accessCounts: [1],
                    conceptsList: [['concept1']]
                };

                cache.updateMemoryCache(memoryData);

                expect(cache._memoryCache.loaded).toBe(true);
                expect(cache._memoryCache.lastLoaded).toBe(1000000);
                expect(cache._memoryCache.data).toEqual(memoryData);
            });

            it('should handle partial data', () => {
                const memoryData = { shortTermMemory: ['test'] };
                cache.updateMemoryCache(memoryData);

                expect(cache._memoryCache.data.shortTermMemory).toEqual(['test']);
                expect(cache._memoryCache.data.longTermMemory).toEqual([]);
            });
        });

        describe('addToMemoryCache', () => {
            beforeEach(() => {
                cache._memoryCache.loaded = true;
            });

            it('should add interaction to memory cache', () => {
                const interaction = {
                    id: 'test1',
                    embedding: [1, 2, 3],
                    timestamp: 1000,
                    accessCount: 1,
                    concepts: ['concept1']
                };

                cache.addToMemoryCache(interaction);

                expect(cache._memoryCache.data.shortTermMemory).toContain(interaction);
                expect(cache._memoryCache.data.embeddings).toContain(interaction.embedding);
                expect(cache._memoryCache.data.timestamps).toContain(interaction.timestamp);
            });

            it('should warn when cache not loaded', () => {
                cache._memoryCache.loaded = false;
                const consoleSpy = vi.spyOn(console, 'warn').mockImplementation();

                cache.addToMemoryCache({ id: 'test' });

                // Should not crash, but will warn
                expect(cache._memoryCache.data.shortTermMemory).toHaveLength(0);
            });
        });

        describe('invalidateMemoryCache', () => {
            it('should reset memory cache', () => {
                cache._memoryCache.loaded = true;
                cache._memoryCache.data.shortTermMemory = ['test'];

                cache.invalidateMemoryCache();

                expect(cache._memoryCache.loaded).toBe(false);
                expect(cache._memoryCache.lastLoaded).toBe(0);
                expect(cache._memoryCache.data.shortTermMemory).toEqual([]);
            });
        });
    });

    describe('query cache management', () => {
        describe('_generateQueryCacheKey', () => {
            it('should generate consistent keys', () => {
                const query = 'SELECT * WHERE { ?s ?p ?o }';
                const endpoint = 'http://example.org/sparql';

                const key1 = cache._generateQueryCacheKey(query, endpoint);
                const key2 = cache._generateQueryCacheKey(query, endpoint);

                expect(key1).toBe(key2);
                expect(key1).toContain(endpoint);
            });

            it('should normalize whitespace', () => {
                const query1 = 'SELECT * WHERE { ?s ?p ?o }';
                const query2 = 'SELECT  *  WHERE  {  ?s  ?p  ?o  }';
                const endpoint = 'http://example.org/sparql';

                const key1 = cache._generateQueryCacheKey(query1, endpoint);
                const key2 = cache._generateQueryCacheKey(query2, endpoint);

                expect(key1).toBe(key2);
            });
        });

        describe('cacheQueryResult', () => {
            it('should cache query result', () => {
                const query = 'SELECT * WHERE { ?s ?p ?o }';
                const endpoint = 'http://example.org/sparql';
                const result = { results: { bindings: [] } };

                cache.cacheQueryResult(query, endpoint, result);

                const cached = cache.getCachedQueryResult(query, endpoint);
                expect(cached).toBe(result);
            });

            it('should evict oldest when cache full', () => {
                // Fill cache to max
                for (let i = 0; i < 100; i++) {
                    cache.cacheQueryResult(`query${i}`, 'endpoint', { data: i });
                }

                // Add one more to trigger eviction
                Date.now = vi.fn().mockReturnValue(2000000); // Later time
                cache.cacheQueryResult('newquery', 'endpoint', { data: 'new' });

                expect(cache._queryCache.size).toBe(100);
                expect(cache.getCachedQueryResult('newquery', 'endpoint')).toBeDefined();
            });

            it('should respect TTL', () => {
                const query = 'SELECT * WHERE { ?s ?p ?o }';
                const endpoint = 'http://example.org/sparql';
                const result = { results: { bindings: [] } };

                cache.cacheQueryResult(query, endpoint, result, 1000); // 1 second TTL

                const metadata = cache._queryCacheMetadata.get(
                    cache._generateQueryCacheKey(query, endpoint)
                );
                expect(metadata.ttl).toBe(1000);
                expect(metadata.expiresAt).toBe(1000000 + 1000);
            });
        });

        describe('getCachedQueryResult', () => {
            it('should return null for non-existent query', () => {
                const result = cache.getCachedQueryResult('nonexistent', 'endpoint');
                expect(result).toBeNull();
            });

            it('should return null for expired query', () => {
                const query = 'SELECT * WHERE { ?s ?p ?o }';
                const endpoint = 'http://example.org/sparql';
                const result = { results: { bindings: [] } };

                cache.cacheQueryResult(query, endpoint, result, 1000);

                // Move time forward past expiration
                Date.now = vi.fn().mockReturnValue(1000000 + 2000);

                const cached = cache.getCachedQueryResult(query, endpoint);
                expect(cached).toBeNull();
            });

            it('should remove expired entries', () => {
                const query = 'SELECT * WHERE { ?s ?p ?o }';
                const endpoint = 'http://example.org/sparql';
                const result = { results: { bindings: [] } };

                cache.cacheQueryResult(query, endpoint, result, 1000);

                // Move time forward past expiration
                Date.now = vi.fn().mockReturnValue(1000000 + 2000);

                cache.getCachedQueryResult(query, endpoint);

                // Should be removed from cache
                const key = cache._generateQueryCacheKey(query, endpoint);
                expect(cache._queryCache.has(key)).toBe(false);
                expect(cache._queryCacheMetadata.has(key)).toBe(false);
            });
        });

        describe('invalidateQueryCache', () => {
            beforeEach(() => {
                cache.cacheQueryResult('query1', 'endpoint', { data: 1 });
                cache.cacheQueryResult('query2', 'endpoint', { data: 2 });
                cache.cacheQueryResult('other', 'endpoint', { data: 3 });
            });

            it('should clear entire cache when no pattern', () => {
                cache.invalidateQueryCache();

                expect(cache._queryCache.size).toBe(0);
                expect(cache._queryCacheMetadata.size).toBe(0);
            });

            it('should clear matching entries with string pattern', () => {
                cache.invalidateQueryCache('query');

                expect(cache._queryCache.size).toBe(1);
                expect(cache.getCachedQueryResult('other', 'endpoint')).toBeDefined();
            });

            it('should clear matching entries with regex pattern', () => {
                cache.invalidateQueryCache(/query\d/);

                expect(cache._queryCache.size).toBe(1);
                expect(cache.getCachedQueryResult('other', 'endpoint')).toBeDefined();
            });
        });

        describe('cleanupExpiredQueryCache', () => {
            it('should remove expired entries', () => {
                cache.cacheQueryResult('query1', 'endpoint', { data: 1 }, 1000);
                cache.cacheQueryResult('query2', 'endpoint', { data: 2 }, 10000);

                // Move time forward to expire first query
                Date.now = vi.fn().mockReturnValue(1000000 + 2000);

                cache.cleanupExpiredQueryCache();

                expect(cache._queryCache.size).toBe(1);
                expect(cache.getCachedQueryResult('query2', 'endpoint')).toBeDefined();
                expect(cache.getCachedQueryResult('query1', 'endpoint')).toBeNull();
            });

            it('should handle no expired entries', () => {
                cache.cacheQueryResult('query1', 'endpoint', { data: 1 }, 10000);
                const initialSize = cache._queryCache.size;

                cache.cleanupExpiredQueryCache();

                expect(cache._queryCache.size).toBe(initialSize);
            });
        });
    });

    describe('index persistence', () => {
        describe('scheduleIndexPersistence', () => {
            it('should schedule persistence callback', () => {
                const callback = vi.fn().mockResolvedValue();
                const timers = vi.useFakeTimers();

                cache.scheduleIndexPersistence(callback, 1000);

                expect(callback).not.toHaveBeenCalled();

                timers.advanceTimersByTime(1000);

                expect(callback).toHaveBeenCalled();
                timers.useRealTimers();
            });

            it('should cancel previous timer', () => {
                const callback1 = vi.fn().mockResolvedValue();
                const callback2 = vi.fn().mockResolvedValue();
                const timers = vi.useFakeTimers();

                cache.scheduleIndexPersistence(callback1, 1000);
                cache.scheduleIndexPersistence(callback2, 1000);

                timers.advanceTimersByTime(1000);

                expect(callback1).not.toHaveBeenCalled();
                expect(callback2).toHaveBeenCalled();
                timers.useRealTimers();
            });

            it('should handle callback errors', async () => {
                const callback = vi.fn().mockRejectedValue(new Error('Persistence failed'));
                const timers = vi.useFakeTimers();

                cache.scheduleIndexPersistence(callback, 1000);
                timers.advanceTimersByTime(1000);

                // Should not throw, just log error
                await new Promise(resolve => setTimeout(resolve, 0));
                timers.useRealTimers();
            });
        });

        describe('cancelScheduledPersistence', () => {
            it('should cancel scheduled persistence', () => {
                const callback = vi.fn().mockResolvedValue();
                const timers = vi.useFakeTimers();

                cache.scheduleIndexPersistence(callback, 1000);
                cache.cancelScheduledPersistence();

                timers.advanceTimersByTime(1000);

                expect(callback).not.toHaveBeenCalled();
                timers.useRealTimers();
            });
        });
    });

    describe('getCacheStats', () => {
        it('should return comprehensive cache statistics', () => {
            // Setup memory cache
            cache._memoryCache.loaded = true;
            cache._memoryCache.data.shortTermMemory = ['test1', 'test2'];
            cache._memoryCache.data.longTermMemory = ['test3'];

            // Setup query cache with some expired entries
            cache.cacheQueryResult('query1', 'endpoint', { data: 1 }, 1000);
            cache.cacheQueryResult('query2', 'endpoint', { data: 2 }, 10000);

            // Move time to expire first query
            Date.now = vi.fn().mockReturnValue(1000000 + 2000);

            const stats = cache.getCacheStats();

            expect(stats.memoryCache.loaded).toBe(true);
            expect(stats.memoryCache.shortTermMemoryCount).toBe(2);
            expect(stats.memoryCache.longTermMemoryCount).toBe(1);
            expect(stats.queryCache.totalEntries).toBe(2);
            expect(stats.queryCache.expiredEntries).toBe(1);
            expect(stats.queryCache.activeEntries).toBe(1);
        });
    });

    describe('dispose', () => {
        it('should dispose all cache resources', () => {
            cache._memoryCache.loaded = true;
            cache.cacheQueryResult('test', 'endpoint', { data: 1 });
            cache.scheduleIndexPersistence(vi.fn(), 1000);

            cache.dispose();

            expect(cache._memoryCache.loaded).toBe(false);
            expect(cache._queryCache.size).toBe(0);
            expect(cache._indexPersistenceTimer).toBeNull();
        });
    });
});