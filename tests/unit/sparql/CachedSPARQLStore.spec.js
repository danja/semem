// tests/unit/cached-sparql-store-spec.js
import { BaseTest } from '../helpers/BaseTest.js'
import CachedSPARQLStore from '../../src/stores/CachedSPARQLStore.js'

class CachedSPARQLStoreTest extends BaseTest {
    beforeEach() {
        super.beforeEach()

        this.endpoint = {
            query: 'http://example.org/sparql/query',
            update: 'http://example.org/sparql/update'
        }

        // Setup mock fetch
        this.mockFetch = jasmine.createSpy('fetch').and.returnValue(
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve(this.createMockSparqlResult())
            })
        )
        global.fetch = this.mockFetch
        this.addCleanup(() => delete global.fetch)

        // Setup timer mocks
        this.mockSetInterval = jasmine.createSpy('setInterval').and.returnValue(123)
        this.mockClearInterval = jasmine.createSpy('clearInterval')
        global.setInterval = this.mockSetInterval
        global.clearInterval = this.mockClearInterval
        this.addCleanup(() => {
            delete global.setInterval
            delete global.clearInterval
        })

        // Create store instance
        this.store = new CachedSPARQLStore(this.endpoint, {
            user: 'test',
            password: 'test',
            graphName: 'http://test.org/graph',
            cacheTTL: 1000,
            maxCacheSize: 2
        })
        this.addCleanup(() => this.store.close())
    }

    createMockSparqlResult(data = []) {
        return {
            results: {
                bindings: data.map(item => ({
                    id: { value: item.id || 'test-id' },
                    value: { value: item.value || 'test value' }
                }))
            }
        }
    }

    setMockResponse(response, ok = true) {
        this.mockFetch.and.returnValue(Promise.resolve({
            ok,
            json: () => Promise.resolve(response)
        }))
    }

    async executeCachedQuery(query, times = 1) {
        const results = []
        for (let i = 0; i < times; i++) {
            results.push(await this.store._executeSparqlQuery(query, this.endpoint.query))
        }
        return results
    }
}

describe('CachedSPARQLStore', () => {
    let test

    beforeEach(() => {
        test = new CachedSPARQLStoreTest()
    })

    describe('Cache Operations', () => {
        it('should cache query results', async (done) => {
            const query = 'SELECT * WHERE { ?s ?p ?o }'

            await test.trackPromise(test.executeCachedQuery(query, 2))
            expect(test.mockFetch).toHaveBeenCalledTimes(1)
            done()
        })

        it('should expire cached entries after TTL', async (done) => {
            const query = 'SELECT * WHERE { ?s ?p ?o }'

            await test.trackPromise(test.executeCachedQuery(query))
            jasmine.clock().tick(1001)
            await test.trackPromise(test.executeCachedQuery(query))

            expect(test.mockFetch).toHaveBeenCalledTimes(2)
            done()
        })

        it('should maintain max cache size', async (done) => {
            for (let i = 0; i < 3; i++) {
                await test.trackPromise(test.store._executeSparqlQuery(
                    `query${i}`,
                    test.endpoint.query
                ))
            }

            expect(test.store.queryCache.size).toBeLessThanOrEqual(2)
            expect([...test.store.queryCache.keys()]).not.toContain('query0')
            done()
        })

        it('should invalidate cache on updates', async (done) => {
            const query = 'SELECT * WHERE { ?s ?p ?o }'
            await test.trackPromise(test.store._executeSparqlQuery(query, test.endpoint.query))

            await test.trackPromise(test.store.saveMemoryToHistory({
                shortTermMemory: [],
                longTermMemory: []
            }))

            expect(test.store.queryCache.size).toBe(0)
            done()
        })
    })

    describe('Query Generation', () => {
        it('should generate valid SPARQL queries', async (done) => {
            await test.trackPromise(test.store._executeSparqlQuery(
                'SELECT * WHERE { ?s ?p ?o }',
                test.endpoint.query
            ))

            expect(test.mockFetch).toHaveBeenCalledWith(
                test.endpoint.query,
                jasmine.objectContaining({
                    method: 'POST',
                    headers: jasmine.objectContaining({
                        'Content-Type': 'application/sparql-query'
                    })
                })
            )
            done()
        })

        it('should handle query errors', async (done) => {
            test.setMockResponse(null, false)

            await expectAsync(
                test.store._executeSparqlQuery('INVALID QUERY', test.endpoint.query)
            ).toBeRejectedWithError(/SPARQL query failed/)
            done()
        })
    })

    describe('Cache Cleanup', () => {
        it('should remove expired entries', async (done) => {
            test.store.queryCache.set('test1', { data: 1 })
            test.store.cacheTimestamps.set('test1', Date.now() - 2000)
            test.store.queryCache.set('test2', { data: 2 })
            test.store.cacheTimestamps.set('test2', Date.now())

            test.store.cleanupCache()

            expect(test.store.queryCache.has('test1')).toBeFalse()
            expect(test.store.queryCache.has('test2')).toBeTrue()
            done()
        })

        it('should remove oldest entries when over size', async (done) => {
            test.store.queryCache.set('test1', { data: 1 })
            test.store.cacheTimestamps.set('test1', 1000)
            test.store.queryCache.set('test2', { data: 2 })
            test.store.cacheTimestamps.set('test2', 2000)
            test.store.queryCache.set('test3', { data: 3 })
            test.store.cacheTimestamps.set('test3', 3000)

            test.store.cleanupCache()

            expect(test.store.queryCache.size).toBe(2)
            expect(test.store.queryCache.has('test1')).toBeFalse()
            expect(test.store.queryCache.has('test3')).toBeTrue()
            done()
        })
    })

    describe('Resource Management', () => {
        it('should clear interval and cache on close', async (done) => {
            await test.trackPromise(test.store.close())

            expect(test.mockClearInterval).toHaveBeenCalledWith(123)
            expect(test.store.queryCache.size).toBe(0)
            expect(test.store.cacheTimestamps.size).toBe(0)
            done()
        })

        it('should handle concurrent cache access', async (done) => {
            const promises = Array(5).fill().map(() =>
                test.store._executeSparqlQuery(
                    'SELECT * WHERE { ?s ?p ?o }',
                    test.endpoint.query
                )
            )

            await expectAsync(Promise.all(promises)).toBeResolved()
            expect(test.store.queryCache.size).toBeLessThanOrEqual(2)
            done()
        })
    })
})