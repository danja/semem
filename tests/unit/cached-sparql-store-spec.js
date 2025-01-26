// tests/unit/cached-sparql-store-spec.js
import CachedSPARQLStore from '../../src/stores/CachedSPARQLStore.js'

describe('CachedSPARQLStore', () => {
    let store
    let mockFetch
    let mockInterval
    let mockClearInterval

    const endpoint = {
        query: 'http://example.org/sparql/query',
        update: 'http://example.org/sparql/update'
    }

    const mockSparqlResult = {
        results: {
            bindings: [{
                id: { value: 'test-id' },
                prompt: { value: 'test prompt' },
                output: { value: 'test output' },
                embedding: { value: '[0,1,2]' },
                timestamp: { value: '1000' },
                accessCount: { value: '1' },
                concepts: { value: '["test"]' },
                decayFactor: { value: '1.0' },
                memoryType: { value: 'short-term' }
            }]
        }
    }

    beforeEach(() => {
        mockFetch = jasmine.createSpy('fetch').and.returnValue(
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(mockSparqlResult)
            })
        )
        global.fetch = mockFetch

        mockInterval = jasmine.createSpy('setInterval').and.returnValue(123)
        mockClearInterval = jasmine.createSpy('clearInterval')
        global.setInterval = mockInterval
        global.clearInterval = mockClearInterval

        store = new CachedSPARQLStore(endpoint, {
            user: 'test',
            password: 'test',
            graphName: 'http://test.org/graph',
            cacheTTL: 1000,
            maxCacheSize: 2
        })

        jasmine.clock().install()
    })

    afterEach(() => {
        delete global.fetch
        delete global.setInterval
        delete global.clearInterval
        jasmine.clock().uninstall()
    })

    describe('Cache Operations', () => {
        it('should cache query results', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }'

            await store._executeSparqlQuery(query, endpoint.query)
            expect(mockFetch).toHaveBeenCalledTimes(1)

            mockFetch.calls.reset()
            const cachedResult = await store._executeSparqlQuery(query, endpoint.query)
            expect(mockFetch).not.toHaveBeenCalled()
            expect(cachedResult).toEqual(mockSparqlResult)
        })

        it('should expire cached entries after TTL', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }'

            await store._executeSparqlQuery(query, endpoint.query)
            jasmine.clock().tick(1001)

            await store._executeSparqlQuery(query, endpoint.query)
            expect(mockFetch).toHaveBeenCalledTimes(2)
        })

        it('should maintain max cache size', async () => {
            for (let i = 0; i < 3; i++) {
                await store._executeSparqlQuery(`query${i}`, endpoint.query)
            }

            expect(store.queryCache.size).toBeLessThanOrEqual(2)
            expect([...store.queryCache.keys()]).not.toContain('query0')
        })

        it('should invalidate cache on updates', async () => {
            const query = 'SELECT * WHERE { ?s ?p ?o }'
            await store._executeSparqlQuery(query, endpoint.query)

            await store.saveMemoryToHistory({
                shortTermMemory: [],
                longTermMemory: []
            })

            expect(store.queryCache.size).toBe(0)
        })
    })

    describe('Query Generation', () => {
        it('should generate valid SPARQL queries', async () => {
            await store._executeSparqlQuery(
                'SELECT * WHERE { ?s ?p ?o }',
                endpoint.query
            )

            expect(mockFetch).toHaveBeenCalledWith(
                endpoint.query,
                jasmine.objectContaining({
                    method: 'POST',
                    headers: jasmine.objectContaining({
                        'Content-Type': 'application/sparql-query'
                    })
                })
            )
        })

        it('should handle query errors', async () => {
            mockFetch.and.returnValue(Promise.resolve({ ok: false, status: 400 }))

            await expectAsync(
                store._executeSparqlQuery('INVALID QUERY', endpoint.query)
            ).toBeRejectedWithError(/SPARQL query failed/)
        })
    })

    describe('Cache Cleanup', () => {
        it('should remove expired entries', () => {
            store.queryCache.set('test1', { data: 1 })
            store.cacheTimestamps.set('test1', Date.now() - 2000)
            store.queryCache.set('test2', { data: 2 })
            store.cacheTimestamps.set('test2', Date.now())

            store.cleanupCache()

            expect(store.queryCache.has('test1')).toBe(false)
            expect(store.queryCache.has('test2')).toBe(true)
        })

        it('should remove oldest entries when over size', () => {
            store.queryCache.set('test1', { data: 1 })
            store.cacheTimestamps.set('test1', 1000)
            store.queryCache.set('test2', { data: 2 })
            store.cacheTimestamps.set('test2', 2000)
            store.queryCache.set('test3', { data: 3 })
            store.cacheTimestamps.set('test3', 3000)

            store.cleanupCache()

            expect(store.queryCache.size).toBe(2)
            expect(store.queryCache.has('test1')).toBe(false)
            expect(store.queryCache.has('test3')).toBe(true)
        })
    })

    describe('Resource Management', () => {
        it('should clear interval and cache on close', async () => {
            await store.close()

            expect(mockClearInterval).toHaveBeenCalledWith(123)
            expect(store.queryCache.size).toBe(0)
            expect(store.cacheTimestamps.size).toBe(0)
        })

        it('should handle concurrent cache access', async () => {
            const promises = Array(5).fill().map(() =>
                store._executeSparqlQuery('SELECT * WHERE { ?s ?p ?o }', endpoint.query)
            )

            await expectAsync(Promise.all(promises)).toBeResolved()
            expect(store.queryCache.size).toBeLessThanOrEqual(2)
        })
    })
})