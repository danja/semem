// tests/unit/sparql-store-spec.js
import { BaseTest } from '../helpers/BaseTest.js'
import SPARQLStore from '../../src/stores/SPARQLStore.js'
import { v4 as uuidv4 } from 'uuid'

class SPARQLStoreTest extends BaseTest {
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
                json: () => Promise.resolve({ results: { bindings: [] } }),
                text: () => Promise.resolve('')
            })
        )
        global.fetch = this.mockFetch
        this.addCleanup(() => delete global.fetch)

        // Create store instance
        this.store = new SPARQLStore(this.endpoint, {
            user: 'test',
            password: 'test',
            graphName: 'http://test.org/memory',
            dimension: 1536
        })
        this.addCleanup(() => this.store.close())

        // Create test interaction data
        this.testInteraction = {
            id: uuidv4(),
            prompt: 'test prompt',
            output: 'test output',
            embedding: new Array(1536).fill(0),
            timestamp: Date.now(),
            accessCount: 1,
            concepts: ['test'],
            decayFactor: 1.0
        }

        this.testMemoryStore = {
            shortTermMemory: [this.testInteraction],
            longTermMemory: []
        }
    }

    // Helper to set mock response
    setMockResponse(response, ok = true) {
        this.mockFetch.and.returnValue(Promise.resolve({
            ok,
            json: () => Promise.resolve(response),
            text: () => Promise.resolve('')
        }))
    }

    // Helper to create mock bindings
    createMockBindings(interaction) {
        return {
            results: {
                bindings: [{
                    id: { value: interaction.id },
                    prompt: { value: interaction.prompt },
                    output: { value: interaction.output },
                    embedding: { value: JSON.stringify(interaction.embedding) },
                    timestamp: { value: interaction.timestamp.toString() },
                    accessCount: { value: '1' },
                    concepts: { value: JSON.stringify(interaction.concepts) },
                    decayFactor: { value: '1.0' },
                    memoryType: { value: 'short-term' }
                }]
            }
        }
    }
}

describe('SPARQLStore', () => {
    let test

    beforeEach(() => {
        test = new SPARQLStoreTest()
    })

    describe('Transaction Management', () => {
        it('should execute transaction lifecycle', async (done) => {
            await test.trackPromise(test.store.beginTransaction())
            expect(test.store.inTransaction).toBeTrue()

            await test.trackPromise(test.store.commitTransaction())
            expect(test.store.inTransaction).toBeFalse()
            done()
        })

        it('should prevent nested transactions', async (done) => {
            await test.trackPromise(test.store.beginTransaction())
            await expectAsync(test.store.beginTransaction())
                .toBeRejectedWithError('Transaction already in progress')
            await test.trackPromise(test.store.rollbackTransaction())
            done()
        })

        it('should rollback failed transactions', async (done) => {
            test.setMockResponse(null, true) // begin
            test.setMockResponse(null, false) // operation
            test.setMockResponse(null, true) // rollback

            await test.trackPromise(test.store.beginTransaction())
            await expectAsync(test.store.saveMemoryToHistory(test.testMemoryStore))
                .toBeRejected()

            expect(test.store.inTransaction).toBeFalse()
            expect(test.mockFetch).toHaveBeenCalledTimes(3)
            done()
        })
    })

    describe('Graph Operations', () => {
        it('should verify graph existence', async (done) => {
            await test.trackPromise(test.store.verify())

            expect(test.mockFetch).toHaveBeenCalledWith(
                test.endpoint.update,
                jasmine.objectContaining({
                    body: jasmine.stringContaining('CREATE SILENT GRAPH')
                })
            )
            done()
        })

        it('should save memory to history', async (done) => {
            await test.trackPromise(test.store.saveMemoryToHistory(test.testMemoryStore))

            expect(test.mockFetch).toHaveBeenCalledWith(
                test.endpoint.update,
                jasmine.objectContaining({
                    method: 'POST',
                    body: jasmine.stringContaining('INSERT DATA')
                })
            )
            done()
        })

        it('should load history', async (done) => {
            test.setMockResponse(test.createMockBindings(test.testInteraction))

            const [shortTerm, longTerm] = await test.trackPromise(test.store.loadHistory())

            expect(shortTerm.length).toBe(1)
            expect(longTerm.length).toBe(0)
            expect(shortTerm[0].id).toBe(test.testInteraction.id)
            done()
        })
    })

    describe('Validation', () => {
        it('should validate embedding dimensions', async (done) => {
            const validEmbedding = new Array(1536).fill(0)
            expect(() => test.store.validateEmbedding(validEmbedding)).not.toThrow()

            const invalidEmbedding = new Array(100).fill(0)
            expect(() => test.store.validateEmbedding(invalidEmbedding))
                .toThrowError('Embedding dimension mismatch')
            done()
        })

        it('should handle invalid embedding values', async (done) => {
            const invalidEmbedding = new Array(1536).fill('not a number')
            expect(() => test.store.validateEmbedding(invalidEmbedding))
                .toThrowError('Embedding must contain only valid numbers')
            done()
        })
    })

    describe('Query Generation', () => {
        it('should generate valid SPARQL UPDATE', async (done) => {
            await test.trackPromise(test.store.saveMemoryToHistory(test.testMemoryStore))

            const updateCall = test.mockFetch.calls.mostRecent()
            const updateBody = updateCall.args[1].body

            expect(updateBody).toContain('INSERT DATA')
            expect(updateBody).toContain(test.testInteraction.id)
            expect(updateBody).toContain('mcp:Interaction')
            expect(updateBody).not.toContain('undefined')
            done()
        })

        it('should handle special characters in queries', async (done) => {
            const specialInteraction = {
                ...test.testInteraction,
                prompt: 'test "quotes" and \\backslashes\\',
                output: "test 'apostrophes' and newlines\n"
            }

            await test.trackPromise(test.store.saveMemoryToHistory({
                shortTermMemory: [specialInteraction],
                longTermMemory: []
            }))

            const updateBody = test.mockFetch.calls.mostRecent().args[1].body
            expect(() => updateBody.replace(/\\"/g, '"')).not.toThrow()
            done()
        })
    })

    describe('Resource Management', () => {
        it('should clean up on close', async (done) => {
            test.store.inTransaction = true
            await test.trackPromise(test.store.close())
            expect(test.store.inTransaction).toBeFalse()
            done()
        })

        it('should handle multiple operations in transaction', async (done) => {
            await test.trackPromise(test.store.beginTransaction())

            await test.trackPromise(test.store.saveMemoryToHistory({
                shortTermMemory: [test.testInteraction],
                longTermMemory: []
            }))

            await test.trackPromise(test.store._executeSparqlQuery(
                'SELECT * WHERE { ?s ?p ?o }',
                test.endpoint.query
            ))

            await test.trackPromise(test.store.commitTransaction())
            expect(test.mockFetch.calls.count()).toBe(3) // begin + query + commit
            done()
        })
    })
})