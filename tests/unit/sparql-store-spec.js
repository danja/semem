// tests/unit/sparql-store-spec.js
import SPARQLStore from '../../src/stores/SPARQLStore.js'
import { v4 as uuidv4 } from 'uuid'

describe('SPARQLStore', () => {
    let store
    let mockFetch

    const endpoint = {
        query: 'http://example.org/sparql/query',
        update: 'http://example.org/sparql/update'
    }

    const mockInteraction = {
        id: uuidv4(),
        prompt: 'test prompt',
        output: 'test output',
        embedding: new Array(1536).fill(0),
        timestamp: Date.now(),
        accessCount: 1,
        concepts: ['test'],
        decayFactor: 1.0
    }

    const mockMemoryStore = {
        shortTermMemory: [mockInteraction],
        longTermMemory: []
    }

    beforeEach(() => {
        mockFetch = jasmine.createSpy('fetch').and.returnValue(
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    results: { bindings: [] }
                }),
                text: () => Promise.resolve('')
            })
        )
        global.fetch = mockFetch

        store = new SPARQLStore(endpoint, {
            user: 'test',
            password: 'test',
            graphName: 'http://test.org/memory',
            dimension: 1536
        })
    })

    afterEach(() => {
        delete global.fetch
    })

    describe('Transaction Management', () => {
        it('should execute transaction lifecycle', async () => {
            await store.beginTransaction()
            expect(store.inTransaction).toBeTrue()

            await store.commitTransaction()
            expect(store.inTransaction).toBeFalse()
        })

        it('should prevent nested transactions', async () => {
            await store.beginTransaction()
            await expectAsync(store.beginTransaction())
                .toBeRejectedWithError('Transaction already in progress')
            await store.rollbackTransaction()
        })

        it('should rollback failed transactions', async () => {
            mockFetch.and.returnValues(
                Promise.resolve({ ok: true }), // begin
                Promise.resolve({ ok: false, status: 500 }), // operation
                Promise.resolve({ ok: true }) // rollback
            )

            await store.beginTransaction()
            await expectAsync(store.saveMemoryToHistory(mockMemoryStore))
                .toBeRejected()

            expect(store.inTransaction).toBeFalse()
            expect(mockFetch).toHaveBeenCalledTimes(3)
        })
    })

    describe('Graph Operations', () => {
        it('should verify graph existence', async () => {
            await store.verify()
            expect(mockFetch).toHaveBeenCalledWith(
                endpoint.update,
                jasmine.objectContaining({
                    body: jasmine.stringContaining('CREATE SILENT GRAPH')
                })
            )
        })

        it('should save memory to history', async () => {
            await store.saveMemoryToHistory(mockMemoryStore)

            expect(mockFetch).toHaveBeenCalledWith(
                endpoint.update,
                jasmine.objectContaining({
                    method: 'POST',
                    body: jasmine.stringContaining('INSERT DATA')
                })
            )
        })

        it('should load history', async () => {
            mockFetch.and.returnValue(Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    results: {
                        bindings: [{
                            id: { value: mockInteraction.id },
                            prompt: { value: mockInteraction.prompt },
                            output: { value: mockInteraction.output },
                            embedding: { value: JSON.stringify(mockInteraction.embedding) },
                            timestamp: { value: mockInteraction.timestamp.toString() },
                            accessCount: { value: '1' },
                            concepts: { value: JSON.stringify(mockInteraction.concepts) },
                            decayFactor: { value: '1.0' },
                            memoryType: { value: 'short-term' }
                        }]
                    }
                })
            }))

            const [shortTerm, longTerm] = await store.loadHistory()

            expect(shortTerm.length).toBe(1)
            expect(longTerm.length).toBe(0)
            expect(shortTerm[0].id).toBe(mockInteraction.id)
        })
    })

    describe('Validation', () => {
        it('should validate embedding dimensions', () => {
            const validEmbedding = new Array(1536).fill(0)
            expect(() => store.validateEmbedding(validEmbedding)).not.toThrow()

            const invalidEmbedding = new Array(100).fill(0)
            expect(() => store.validateEmbedding(invalidEmbedding))
                .toThrowError('Embedding dimension mismatch')
        })

        it('should handle invalid embedding values', () => {
            const invalidEmbedding = new Array(1536).fill('not a number')
            expect(() => store.validateEmbedding(invalidEmbedding))
                .toThrowError('Embedding must contain only valid numbers')
        })
    })

    describe('Query Generation', () => {
        it('should generate valid SPARQL UPDATE', async () => {
            await store.saveMemoryToHistory(mockMemoryStore)

            const updateCall = mockFetch.calls.mostRecent()
            const updateBody = updateCall.args[1].body

            expect(updateBody).toContain('INSERT DATA')
            expect(updateBody).toContain(mockInteraction.id)
            expect(updateBody).toContain('mcp:Interaction')
            expect(updateBody).not.toContain('undefined')
        })

        it('should handle special characters in queries', async () => {
            const specialInteraction = {
                ...mockInteraction,
                prompt: 'test "quotes" and \\backslashes\\',
                output: "test 'apostrophes' and newlines\n"
            }

            await store.saveMemoryToHistory({
                shortTermMemory: [specialInteraction],
                longTermMemory: []
            })

            const updateBody = mockFetch.calls.mostRecent().args[1].body
            expect(() => updateBody.replace(/\\"/g, '"')).not.toThrow()
        })
    })

    describe('Resource Management', () => {
        it('should clean up on close', async () => {
            store.inTransaction = true
            await store.close()
            expect(store.inTransaction).toBeFalse()
        })

        it('should handle multiple operations in transaction', async () => {
            await store.beginTransaction()

            await store.saveMemoryToHistory({
                shortTermMemory: [mockInteraction],
                longTermMemory: []
            })

            await store._executeSparqlQuery('SELECT * WHERE { ?s ?p ?o }', endpoint.query)

            await store.commitTransaction()
            expect(mockFetch.calls.count()).toBe(3) // begin + query + commit
        })
    })
})