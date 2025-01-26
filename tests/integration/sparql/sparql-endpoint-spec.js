// tests/integration/sparql/sparql-endpoint-spec.js
import Config from '../../../src/Config.js'
import { SPARQLHelpers } from '../../../src/utils/SPARQLHelpers.js'

describe('SPARQL Endpoint Integration', () => {
    let config
    let endpoint
    let auth
    const testGraph = 'http://example.org/mcp/test-memory'

    beforeAll(async () => {
        config = new Config()
        await config.init()
        const sparqlConfig = config.get('sparqlEndpoints')[0]

        endpoint = {
            query: `${sparqlConfig.urlBase}${sparqlConfig.query}`,
            update: `${sparqlConfig.urlBase}${sparqlConfig.update}`
        }
        auth = SPARQLHelpers.createAuthHeader(sparqlConfig.user, sparqlConfig.password)
    })

    beforeEach(async () => {
        // Ensure clean test graph
        const clearQuery = `
            DROP SILENT GRAPH <${testGraph}>;
            CREATE GRAPH <${testGraph}>
        `
        await SPARQLHelpers.executeSPARQLUpdate(endpoint.update, clearQuery, auth)
    })

    afterAll(async () => {
        const dropQuery = `DROP SILENT GRAPH <${testGraph}>`
        await SPARQLHelpers.executeSPARQLUpdate(endpoint.update, dropQuery, auth)
    })

    describe('Graph Operations', () => {
        it('should create and verify graph existence', async () => {
            const verifyQuery = `ASK { GRAPH <${testGraph}> { ?s ?p ?o } }`
            const result = await SPARQLHelpers.executeSPARQLQuery(
                endpoint.query,
                verifyQuery,
                auth
            )
            const data = await result.json()
            expect(data.boolean).toBe(false) // Empty but exists
        })

        it('should insert and query data', async () => {
            const insertQuery = `
                PREFIX ex: <http://example.org/>
                INSERT DATA {
                    GRAPH <${testGraph}> {
                        ex:subject ex:predicate "test value" .
                    }
                }
            `
            await SPARQLHelpers.executeSPARQLUpdate(endpoint.update, insertQuery, auth)

            const selectQuery = `
                SELECT ?o
                WHERE {
                    GRAPH <${testGraph}> {
                        ex:subject ex:predicate ?o
                    }
                }
            `
            const response = await SPARQLHelpers.executeSPARQLQuery(
                endpoint.query,
                selectQuery,
                auth
            )
            const data = await response.json()
            expect(data.results.bindings[0].o.value).toBe('test value')
        })
    })

    describe('Transaction Management', () => {
        it('should handle atomic updates', async () => {
            const transaction = `
                PREFIX ex: <http://example.org/>
                INSERT DATA { GRAPH <${testGraph}> { ex:s1 ex:p "v1" } };
                INSERT DATA { GRAPH <${testGraph}> { ex:s2 ex:p "v2" } }
            `
            await SPARQLHelpers.executeSPARQLUpdate(endpoint.update, transaction, auth)

            const countQuery = `
                SELECT (COUNT(?s) as ?count)
                WHERE {
                    GRAPH <${testGraph}> { ?s ?p ?o }
                }
            `
            const response = await SPARQLHelpers.executeSPARQLQuery(
                endpoint.query,
                countQuery,
                auth
            )
            const data = await response.json()
            expect(parseInt(data.results.bindings[0].count.value)).toBe(2)
        })

        it('should rollback failed transactions', async () => {
            const invalidQuery = `
                PREFIX ex: <http://example.org/>
                INSERT DATA { GRAPH <${testGraph}> { ex:s1 ex:p "v1" } };
                INSERT DATA { GRAPH <${testGraph}> { INVALID SYNTAX } }
            `
            await expectAsync(
                SPARQLHelpers.executeSPARQLUpdate(endpoint.update, invalidQuery, auth)
            ).toBeRejected()

            const verifyQuery = `ASK { GRAPH <${testGraph}> { ?s ?p ?o } }`
            const response = await SPARQLHelpers.executeSPARQLQuery(
                endpoint.query,
                verifyQuery,
                auth
            )
            const data = await response.json()
            expect(data.boolean).toBe(false) // No data persisted
        })
    })

    describe('Authentication', () => {
        it('should reject invalid credentials', async () => {
            const invalidAuth = SPARQLHelpers.createAuthHeader('invalid', 'wrong')
            const query = 'SELECT * WHERE { ?s ?p ?o } LIMIT 1'

            await expectAsync(
                SPARQLHelpers.executeSPARQLQuery(endpoint.query, query, invalidAuth)
            ).toBeRejected()
        })

        it('should accept valid credentials', async () => {
            const query = 'ASK { ?s ?p ?o }'
            const response = await SPARQLHelpers.executeSPARQLQuery(
                endpoint.query,
                query,
                auth
            )
            expect(response.ok).toBe(true)
        })
    })

    describe('Content Negotiation', () => {
        it('should handle different RDF formats', async () => {
            const data = `
                PREFIX ex: <http://example.org/>
                INSERT DATA {
                    GRAPH <${testGraph}> {
                        ex:subject ex:predicate "test" .
                    }
                }
            `
            await SPARQLHelpers.executeSPARQLUpdate(endpoint.update, data, auth)

            const constructQuery = `
                CONSTRUCT { ?s ?p ?o }
                WHERE {
                    GRAPH <${testGraph}> { ?s ?p ?o }
                }
            `

            // Test Turtle format
            const turtleResponse = await SPARQLHelpers.executeSPARQLQuery(
                endpoint.query,
                constructQuery,
                auth,
                'text/turtle'
            )
            const turtle = await turtleResponse.text()
            expect(turtle).toContain('ex:subject')
            expect(turtle).toContain('ex:predicate')

            // Test JSON-LD format
            const jsonResponse = await SPARQLHelpers.executeSPARQLQuery(
                endpoint.query,
                constructQuery,
                auth,
                'application/ld+json'
            )
            const jsonld = await jsonResponse.json()
            expect(jsonld['@graph']).toBeDefined()
        })
    })
})