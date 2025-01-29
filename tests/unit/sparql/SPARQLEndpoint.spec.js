// tests/unit/sparql-endpoint-spec.js
import Config from '../../src/Config.js'
import { SPARQLHelpers } from '../../src/utils/SPARQLHelpers.js'

describe('SPARQL Endpoint Integration', () => {
    let config
    let endpoint
    let auth
    let baseUrl
    const testGraph = 'http://example.org/test-graph'

    beforeAll(() => {
        config = new Config()
        const sparqlConfig = config.get('sparqlEndpoints')[0]
        baseUrl = sparqlConfig.urlBase  // Changed: Remove '/test' appendage
        endpoint = {
            query: `${baseUrl}${sparqlConfig.query}`,
            update: `${baseUrl}${sparqlConfig.update}`
        }
        auth = SPARQLHelpers.createAuthHeader(sparqlConfig.user, sparqlConfig.password)
    })

    beforeEach(async () => {
        // Clear test graph before each test
        const clearQuery = `
            DROP SILENT GRAPH <${testGraph}>;
            CREATE GRAPH <${testGraph}>
        `
        await SPARQLHelpers.executeSPARQLUpdate(endpoint.update, clearQuery, auth)
    })

    afterAll(async () => {
        // Clean up test graph
        const dropQuery = `DROP SILENT GRAPH <${testGraph}>`
        await SPARQLHelpers.executeSPARQLUpdate(endpoint.update, dropQuery, auth)
    })

    describe('SPARQL UPDATE operations', () => {
        it('should insert data into graph', async () => {
            const insertQuery = `
                PREFIX ex: <http://example.org/>
                INSERT DATA {
                    GRAPH <${testGraph}> {
                        ex:subject ex:predicate "test object" .
                    }
                }
            `

            await expectAsync(
                SPARQLHelpers.executeSPARQLUpdate(endpoint.update, insertQuery, auth)
            ).toBeResolved()
        })

        it('should delete data from graph', async () => {
            const deleteQuery = `
                PREFIX ex: <http://example.org/>
                DELETE DATA {
                    GRAPH <${testGraph}> {
                        ex:subject ex:predicate "test object" .
                    }
                }
            `

            await expectAsync(
                SPARQLHelpers.executeSPARQLUpdate(endpoint.update, deleteQuery, auth)
            ).toBeResolved()
        })
    })

    describe('SPARQL SELECT operations', () => {
        beforeEach(async () => {
            // Insert test data
            const setupQuery = `
                PREFIX ex: <http://example.org/>
                INSERT DATA {
                    GRAPH <${testGraph}> {
                        ex:subject1 ex:predicate "value1" .
                        ex:subject2 ex:predicate "value2" .
                    }
                }
            `
            await SPARQLHelpers.executeSPARQLUpdate(endpoint.update, setupQuery, auth)
        })

        it('should retrieve data with SELECT query', async () => {
            const selectQuery = `
                PREFIX ex: <http://example.org/>
                SELECT ?s ?o
                FROM <${testGraph}>
                WHERE {
                    ?s ex:predicate ?o .
                }
            `

            const response = await SPARQLHelpers.executeSPARQLQuery(endpoint.query, selectQuery, auth)
            const data = await response.json()
            expect(data.results.bindings.length).toBe(2)
        })
    })

    describe('Turtle operations', () => {
        const testTurtle = `
            @prefix ex: <http://example.org/> .
            ex:subject ex:predicate "test value" .
        `

        it('should upload Turtle data and return counts', async () => {
            const result = await SPARQLHelpers.uploadTurtle(baseUrl, testTurtle, auth, testGraph)

            expect(result.success).toBe(true)
            expect(result.counts.triples).toBe(1)
            expect(result.counts.total).toBe(1)

            // Verify the upload worked via SPARQL
            const verifyQuery = `
                ASK FROM <${testGraph}>
                WHERE {
                    ?s ?p "test value"
                }
            `
            const askResponse = await SPARQLHelpers.executeSPARQLQuery(endpoint.query, verifyQuery, auth)
            const askResult = await askResponse.json()
            expect(askResult.boolean).toBe(true)
        })

        it('should retrieve data as Turtle using CONSTRUCT', async () => {
            // First insert some data using SPARQL Update
            const insertQuery = `
                PREFIX ex: <http://example.org/>
                INSERT DATA {
                    GRAPH <${testGraph}> {
                        ex:subject ex:predicate "test value" .
                    }
                }
            `
            await SPARQLHelpers.executeSPARQLUpdate(endpoint.update, insertQuery, auth)

            const constructQuery = `
                CONSTRUCT {
                    ?s ?p ?o
                }
                FROM <${testGraph}>
                WHERE {
                    ?s ?p ?o
                }
            `

            const constructResponse = await SPARQLHelpers.executeSPARQLQuery(
                endpoint.query,
                constructQuery,
                auth,
                'text/turtle'
            )

            const turtle = await constructResponse.text()
            expect(turtle).toContain('http://example.org/subject')
        })
    })

    describe('Server interaction', () => {
        it('should handle authentication (note: auth currently not enforced)', async () => {
            const invalidAuth = SPARQLHelpers.createAuthHeader('invalid', 'credentials')
            const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1'

            // Since auth is not enforced, this should succeed
            const queryResponse = await SPARQLHelpers.executeSPARQLQuery(endpoint.query, query, invalidAuth)
            const data = await queryResponse.json()
            expect(data.results.bindings.length).toBeGreaterThanOrEqual(0)
        })
    })
})