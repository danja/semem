import CachedSPARQLStore from '../../src/stores/CachedSPARQLStore.js';

describe('CachedSPARQLStore', () => {
    let store;
    let mockFetch;
    let originalSetInterval;
    let mockSetInterval;

    const endpoint = {
        query: 'http://example.org/sparql/query',
        update: 'http://example.org/sparql/update'
    };

    beforeEach(() => {
        // Mock interval timer
        originalSetInterval = global.setInterval;
        mockSetInterval = jasmine.createSpy('setInterval').and.returnValue(123);
        global.setInterval = mockSetInterval;

        // Mock fetch API
        mockFetch = jasmine.createSpy('fetch').and.returnValue(
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    results: { bindings: [] }
                })
            })
        );
        global.fetch = mockFetch;
        global.Buffer = {
            from: (str) => ({ toString: () => 'mock-base64' })
        };

        store = new CachedSPARQLStore(endpoint, {
            user: 'testuser',
            password: 'testpass',
            graphName: 'http://test.org/memory',
            cacheTTL: 1000,
            maxCacheSize: 2
        });

        jasmine.clock().install();
    });

    afterEach(() => {
        delete global.fetch;
        delete global.Buffer;
        global.setInterval = originalSetInterval;
        jasmine.clock().uninstall();
    });

    describe('cache operations', () => {
        it('should cache query results', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';
            const mockResult = { results: { bindings: [{ s: { value: 'test' } }] } };

            mockFetch.and.returnValue(
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockResult)
                })
            );

            // First call should hit the network
            await store._executeSparqlQuery(query, endpoint.query);
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Second call should use cache
            mockFetch.calls.reset();
            const cachedResult = await store._executeSparqlQuery(query, endpoint.query);
            expect(mockFetch).not.toHaveBeenCalled();
            expect(cachedResult).toEqual(mockResult);
        });

        it('should expire cache entries after TTL', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }';

            // First call
            await store._executeSparqlQuery(query, endpoint.query);
            expect(mockFetch).toHaveBeenCalledTimes(1);

            // Advance time past TTL
            jasmine.clock().tick(1001);

            // Should make new request
            mockFetch.calls.reset();
            await store._executeSparqlQuery(query, endpoint.query);
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should respect max cache size', async () => {
            // Fill cache beyond max size
            await store._executeSparqlQuery('query1', endpoint.query);
            await store._executeSparqlQuery('query2', endpoint.query);
            await store._executeSparqlQuery('query3', endpoint.query);

            expect(store.queryCache.size).toBeLessThanOrEqual(2);
        });

        it('should invalidate cache on data updates', async () => {
            // Cache a query
            await store._executeSparqlQuery('SELECT * WHERE { ?s ?p ?o }', endpoint.query);
            expect(store.queryCache.size).toBe(1);

            // Update should clear cache
            await store.saveMemoryToHistory({ shortTermMemory: [], longTermMemory: [] });
            expect(store.queryCache.size).toBe(0);
        });
    });

    describe('cache cleanup', () => {
        it('should remove expired entries during cleanup', () => {
            // Add cache entries
            store.queryCache.set('test1', { data: 1 });
            store.cacheTimestamps.set('test1', Date.now() - 2000); // Expired
            store.queryCache.set('test2', { data: 2 });
            store.cacheTimestamps.set('test2', Date.now()); // Current

            store.cleanupCache();

            expect(store.queryCache.has('test1')).toBeFalse();
            expect(store.queryCache.has('test2')).toBeTrue();
        });

        it('should remove oldest entries when over size limit', () => {
            // Add entries
            store.queryCache.set('test1', { data: 1 });
            store.cacheTimestamps.set('test1', 1000);
            store.queryCache.set('test2', { data: 2 });
            store.cacheTimestamps.set('test2', 2000);
            store.queryCache.set('test3', { data: 3 });
            store.cacheTimestamps.set('test3', 3000);

            store.cleanupCache();

            expect(store.queryCache.size).toBe(2);
            expect(store.queryCache.has('test1')).toBeFalse();
            expect(store.queryCache.has('test3')).toBeTrue();
        });
    });

    describe('cleanup on close', () => {
        it('should clear interval and cache on close', async () => {
            const mockClearInterval = jasmine.createSpy('clearInterval');
            global.clearInterval = mockClearInterval;

            await store.close();

            expect(mockClearInterval).toHaveBeenCalledWith(123);
            expect(store.queryCache.size).toBe(0);
            expect(store.cacheTimestamps.size).toBe(0);
        });
    });
});
