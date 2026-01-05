import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';

const getEmbeddingDimension = (config) => {
    const providers = config.get('llmProviders');
    if (!Array.isArray(providers) || providers.length === 0) {
        throw new Error('No llmProviders configured for embedding dimension');
    }

    const embeddingProviders = providers
        .filter(provider => provider.capabilities?.includes('embedding'))
        .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

    if (embeddingProviders.length === 0) {
        throw new Error('No embedding-capable providers configured');
    }

    const dimension = embeddingProviders[0].embeddingDimension;
    if (!dimension) {
        throw new Error('Embedding dimension missing from embedding provider configuration');
    }

    return dimension;
};

describe('SPARQLStore Federation Integration', () => {
    let store;
    let config;
    const testGraphs = {
        main: 'http://example.org/mcp/test-memory',
        metadata: 'http://example.org/mcp/test-metadata',
        archive: 'http://example.org/mcp/test-archive'
    };

    beforeAll(async () => {
        config = new Config('config/config.json');
        await config.init();
        const sparqlConfig = config.get('sparqlEndpoints')[0];
        const embeddingDimension = getEmbeddingDimension(config);

        store = new SPARQLStore({
            query: `${sparqlConfig.urlBase}${sparqlConfig.query}`,
            update: `${sparqlConfig.urlBase}${sparqlConfig.update}`,
            data: `${sparqlConfig.urlBase}${sparqlConfig.gspRead}`
        }, {
            user: sparqlConfig.user,
            password: sparqlConfig.password,
            graphName: testGraphs.main,
            dimension: embeddingDimension
        }, config);

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
            await store.executeSparqlUpdate(setupQuery);

            // Add test data to metadata graph
            const metadataQuery = `
                PREFIX semem: <http://purl.org/stuff/semem/>
                PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

                INSERT DATA {
                    GRAPH <${testGraphs.metadata}> {
                        <${testGraphs.main}> a semem:MemoryStore ;
                            semem:hasVersion "1.0" ;
                            semem:lastUpdated "${new Date().toISOString()}"^^xsd:dateTime .
                    }
                }
            `;
            await store.executeSparqlUpdate(metadataQuery);
            await store.commitTransaction();
        } catch (error) {
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
            await store.executeSparqlUpdate(cleanupQuery);
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
                embedding: new Array(store.dimension).fill(0).map(() => Math.random()),
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
            PREFIX semem: <http://purl.org/stuff/semem/>
            SELECT ?interaction ?version ?updated
            WHERE {
                GRAPH <${testGraphs.main}> {
                    ?interaction a semem:Interaction ;
                        semem:id "federation-test-1" .
                }
                GRAPH <${testGraphs.metadata}> {
                    <${testGraphs.main}> semem:hasVersion ?version ;
                        semem:lastUpdated ?updated .
                }
            }
        `;

        const results = await store.executeSparqlQuery(federatedQuery, store.endpoint.query);
        expect(results.results.bindings.length).toBe(1);
        expect(results.results.bindings[0].version.value).toBe('1.0');
    });

    it('should handle cross-graph data relationships', async () => {
        // Add related data across graphs
        const setupQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX qb: <http://purl.org/linked-data/cube#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            INSERT DATA {
                GRAPH <${testGraphs.main}> {
                    _:interaction1 a semem:Interaction ;
                        semem:id "related-test-1" ;
                        semem:relatedCube <cube1> .
                }

                GRAPH <${testGraphs.metadata}> {
                    <cube1> a qb:DataSet ;
                        qb:structure <dsd1> ;
                        rdfs:label "Test Cube" .
                }
            }
        `;

        await store.executeSparqlUpdate(setupQuery);

        // Query relationship
        const relationQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX qb: <http://purl.org/linked-data/cube#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT ?id ?cubeLabel
            WHERE {
                GRAPH <${testGraphs.main}> {
                    ?interaction semem:id ?id ;
                        semem:relatedCube ?cube .
                }
                GRAPH <${testGraphs.metadata}> {
                    ?cube rdfs:label ?cubeLabel .
                }
            }
        `;

        const results = await store.executeSparqlQuery(relationQuery, store.endpoint.query);
        expect(results.results.bindings.length).toBe(1);
        expect(results.results.bindings[0].cubeLabel.value).toBe('Test Cube');
    });

    it('should support federated updates across graphs', async () => {
        await store.beginTransaction();
        try {
            const federatedUpdate = `
                PREFIX semem: <http://purl.org/stuff/semem/>

                WITH <${testGraphs.main}>
                DELETE { ?i semem:accessCount ?oldCount }
                INSERT { ?i semem:accessCount ?newCount }
                WHERE {
                    ?i semem:id "federation-test-1" ;
                       semem:accessCount ?oldCount .
                    BIND(?oldCount + 1 AS ?newCount)
                };

                WITH <${testGraphs.metadata}>
                DELETE { <${testGraphs.main}> semem:lastUpdated ?old }
                INSERT { <${testGraphs.main}> semem:lastUpdated "${new Date().toISOString()}"^^xsd:dateTime }
                WHERE {
                    <${testGraphs.main}> semem:lastUpdated ?old
                }
            `;

            await store.executeSparqlUpdate(federatedUpdate);
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
            PREFIX semem: <http://purl.org/stuff/semem/>

            SELECT ?interaction ?metadata
            WHERE {
                SERVICE <${store.endpoint.query}> {
                    GRAPH <${testGraphs.main}> {
                        ?interaction semem:id "federation-test-1"
                    }
                }
                SERVICE <${store.endpoint.query}> {
                    GRAPH <${testGraphs.metadata}> {
                        <${testGraphs.main}> ?p ?metadata
                    }
                }
            }
        `;

        const results = await store.executeSparqlQuery(serviceQuery, store.endpoint.query);
        expect(results.results.bindings.length).toBeGreaterThan(0);
    });
});
