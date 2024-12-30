import Config from '../../src/Config.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import { logger } from '../../src/Utils.js';

describe('SPARQLStore Federation Integration', () => {
    let store;
    let config;
    const testGraphs = {
        main: 'http://example.org/mcp/test-memory',
        metadata: 'http://example.org/mcp/test-metadata',
        archive: 'http://example.org/mcp/test-archive'
    };

    beforeAll(async () => {
        config = new Config();
        const sparqlConfig = config.get('sparqlEndpoints')[0];
        
        store = new SPARQLStore({
            query: `${sparqlConfig.urlBase}${sparqlConfig.query}`,
            update: `${sparqlConfig.urlBase}${sparqlConfig.update}`
        }, {
            user: sparqlConfig.user,
            password: sparqlConfig.password,
            graphName: testGraphs.main
        });

        // Initialize test graphs
        try {
            await store.beginTransaction();
            const setupQuery = `
                DROP SILENT GRAPH <${testGraphs.main}>;
                DROP SILENT GRAPH <${testGraphs.metadata}>;
                DROP SILENT GRAPH <${testGraphs.archive}>;
                CREATE GRAPH <${testGraphs.main}>;
                CREATE GRAPH <${testGraphs.metadata}>;
                CREATE GRAPH <${testGraphs.archive}>
            `;
            await store._executeSparqlUpdate(setupQuery, store.endpoint.update);
            
            // Add test data to metadata graph
            const metadataQuery = `
                INSERT DATA {
                    GRAPH <${testGraphs.metadata}> {
                        <${testGraphs.main}> a mcp:MemoryStore ;
                            mcp:hasVersion "1.0" ;
                            mcp:lastUpdated "${new Date().toISOString()}"^^xsd:dateTime .
                    }
                }
            `;
            await store._executeSparqlUpdate(metadataQuery, store.endpoint.update);
            await store.commitTransaction();
        } catch (error) {
            logger.error('Error in federation test setup:', error);
            throw error;
        }
    });

    afterAll(async () => {
        try {
            await store.beginTransaction();
            const cleanupQuery = `
                DROP SILENT GRAPH <${testGraphs.main}>;
                DROP SILENT GRAPH <${testGraphs.metadata}>;
                DROP SILENT GRAPH <${testGraphs.archive}>
            `;
            await store._executeSparqlUpdate(cleanupQuery, store.endpoint.update);
            await store.commitTransaction();
        } finally {
            await store.close();
        }
    });

    it('should query across multiple graphs', async () => {
        // Add test memory data
        const testMemory = {
            shortTermMemory: [{
                id: 'federation-test-1',
                prompt: 'federation test prompt',
                output: 'federation test output',
                embedding: new Array(1536).fill(0).map(() => Math.random()),
                timestamp: Date.now(),
                concepts: ['federation', 'test'],
                accessCount: 1,
                decayFactor: 1.0
            }],
            longTermMemory: []
        };

        await store.saveMemoryToHistory(testMemory);

        // Federated query across memory and metadata
        const federatedQuery = `
            PREFIX mcp: <http://purl.org/stuff/mcp/>
            SELECT ?interaction ?version ?updated
            WHERE {
                GRAPH <${testGraphs.main}> {
                    ?interaction a mcp:Interaction ;
                        mcp:id "federation-test-1" .
                }
                GRAPH <${testGraphs.metadata}> {
                    <${testGraphs.main}> mcp:hasVersion ?version ;
                        mcp:lastUpdated ?updated .
                }
            }
        `;

        const results = await store._executeSparqlQuery(federatedQuery, store.endpoint.query);
        expect(results.results.bindings.length).toBe(1);
        expect(results.results.bindings[0].version.value).toBe('1.0');
    });

    it('should handle cross-graph data relationships', async () => {
        // Add related data across graphs
        const setupQuery = `
            PREFIX mcp: <http://purl.org/stuff/mcp/>
            PREFIX qb: <http://purl.org/linked-data/cube#>
            
            INSERT DATA {
                GRAPH <${testGraphs.main}> {
                    _:interaction1 a mcp:Interaction ;
                        mcp:id "related-test-1" ;
                        mcp:relatedCube <cube1> .
                }
                
                GRAPH <${testGraphs.metadata}> {
                    <cube1> a qb:DataSet ;
                        qb:structure <dsd1> ;
                        rdfs:label "Test Cube" .
                }
            }
        `;

        await store._executeSparqlUpdate(setupQuery, store.endpoint.update);

        // Query relationship
        const relationQuery = `
            PREFIX mcp: <http://purl.org/stuff/mcp/>
            PREFIX qb: <http://purl.org/linked-data/cube#>
            
            SELECT ?id ?cubeLabel
            WHERE {
                GRAPH <${testGraphs.main}> {
                    ?interaction mcp:id ?id ;
                        mcp:relatedCube ?cube .
                }
                GRAPH <${testGraphs.metadata}> {
                    ?cube rdfs:label ?cubeLabel .
                }
            }
        `;

        const results = await store._executeSparqlQuery(relationQuery, store.endpoint.query);
        expect(results.results.bindings.length).toBe(1);
        expect(results.results.bindings[0].cubeLabel.value).toBe('Test Cube');
    });

    it('should support federated updates across graphs', async () => {
        await store.beginTransaction();
        try {
            const federatedUpdate = `
                PREFIX mcp: <http://purl.org/stuff/mcp/>
                
                WITH <${testGraphs.main}>
                DELETE { ?i mcp:accessCount ?oldCount }
                INSERT { ?i mcp:accessCount ?newCount }
                WHERE {
                    ?i mcp:id "federation-test-1" ;
                       mcp:accessCount ?oldCount .
                    BIND(?oldCount + 1 AS ?newCount)
                };

                WITH <${testGraphs.metadata}>
                DELETE { <${testGraphs.main}> mcp:lastUpdated ?old }
                INSERT { <${testGraphs.main}> mcp:lastUpdated "${new Date().toISOString()}"^^xsd:dateTime }
                WHERE { 
                    <${testGraphs.main}> mcp:lastUpdated ?old 
                }
            `;

            await store._executeSparqlUpdate(federatedUpdate, store.endpoint.update);
            await store.commitTransaction();

            // Verify update
            const [shortTerm] = await store.loadHistory();
            expect(shortTerm[0].accessCount).toBe(2);
        } catch (error) {
            await store.rollbackTransaction();
            throw error;
        }
    });

    it('should handle service-based federation', async () => {
        // Query using SERVICE keyword for explicit federation
        const serviceQuery = `
            PREFIX mcp: <http://purl.org/stuff/mcp/>
            
            SELECT ?interaction ?metadata
            WHERE {
                SERVICE <${store.endpoint.query}> {
                    GRAPH <${testGraphs.main}> {
                        ?interaction mcp:id "federation-test-1"
                    }
                }
                SERVICE <${store.endpoint.query}> {
                    GRAPH <${testGraphs.metadata}> {
                        <${testGraphs.main}> ?p ?metadata
                    }
                }
            }
        `;

        const results = await store._executeSparqlQuery(serviceQuery, store.endpoint.query);
        expect(results.results.bindings.length).toBeGreaterThan(0);
    });
});
