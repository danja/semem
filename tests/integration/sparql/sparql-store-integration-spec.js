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

describe('SPARQLStore Integration', () => {
    let store;
    let config;
    let testMemory;
    let embeddingDimension;

    beforeAll(async () => {
        // Initialize with real config
        config = new Config('config/config.json');
        await config.init();
        const sparqlConfig = config.get('sparqlEndpoints')[0];
        embeddingDimension = getEmbeddingDimension(config);

        store = new SPARQLStore({
            query: `${sparqlConfig.urlBase}${sparqlConfig.query}`,
            update: `${sparqlConfig.urlBase}${sparqlConfig.update}`,
            data: `${sparqlConfig.urlBase}${sparqlConfig.gspRead}`
        }, {
            user: sparqlConfig.user,
            password: sparqlConfig.password,
            graphName: 'http://example.org/mcp/test-memory',
            dimension: embeddingDimension
        }, config);

        // Test data
        testMemory = {
            shortTermMemory: [{
                id: 'test-integration-1',
                prompt: 'integration test prompt',
                output: 'integration test output',
                embedding: new Array(embeddingDimension).fill(0).map(() => Math.random()),
                timestamp: Date.now(),
                accessCount: 1,
                concepts: ['test', 'integration'],
                decayFactor: 1.0
            }],
            longTermMemory: []
        };

        // Clear test graph before starting
        try {
            await store.beginTransaction();
            const clearQuery = `
                DROP SILENT GRAPH <http://example.org/mcp/test-memory>;
                CREATE GRAPH <http://example.org/mcp/test-memory>
            `;
            await store.executeSparqlUpdate(clearQuery);
            await store.commitTransaction();
        } catch (error) {
            throw error;
        }
    });

    afterAll(async () => {
        // Cleanup test graph
        try {
            await store.beginTransaction();
            const dropQuery = `DROP SILENT GRAPH <http://example.org/mcp/test-memory>`;
            await store.executeSparqlUpdate(dropQuery);
            await store.commitTransaction();
        } finally {
            await store.close();
        }
    });

    it('should verify empty graph exists', async () => {
        const exists = await store.verify();
        expect(exists).toBe(true);
    });

    it('should save and load memory data', async () => {
        // Save test memory
        await store.saveMemoryToHistory(testMemory);

        // Load and verify
        const [shortTerm, longTerm] = await store.loadHistory();

        expect(shortTerm.length).toBe(1);
        expect(longTerm.length).toBe(0);

        const loaded = shortTerm[0];
        expect(loaded.id).toBe(testMemory.shortTermMemory[0].id);
        expect(loaded.prompt).toBe(testMemory.shortTermMemory[0].prompt);
        expect(loaded.concepts).toEqual(testMemory.shortTermMemory[0].concepts);
        expect(loaded.embedding.length).toBe(embeddingDimension);
    });

    it('should handle transaction rollback', async () => {
        await store.beginTransaction();

        const badMemory = {
            shortTermMemory: [{
                id: 'test-rollback',
                prompt: 'should not persist',
                output: 'rollback test',
            embedding: new Array(embeddingDimension).fill(0),
                timestamp: Date.now(),
                accessCount: 1,
                concepts: ['rollback'],
                decayFactor: 1.0
            }],
            longTermMemory: []
        };

        try {
            // Save data that will be rolled back
            await store.saveMemoryToHistory(badMemory);
            // Force a rollback by throwing an error
            throw new Error('Test rollback');
        } catch (error) {
            await store.rollbackTransaction();
        }

        // Verify original data is still intact
        const [shortTerm] = await store.loadHistory();
        expect(shortTerm.length).toBe(1);
        expect(shortTerm[0].id).toBe('test-integration-1');
    });

    it('should support query pagination', async () => {
        // Add multiple memories
        const bulkMemory = {
            shortTermMemory: Array(5).fill(null).map((_, i) => ({
                id: `bulk-test-${i}`,
                prompt: `bulk test prompt ${i}`,
                output: `bulk test output ${i}`,
                embedding: new Array(embeddingDimension).fill(0).map(() => Math.random()),
                timestamp: Date.now(),
                accessCount: 1,
                concepts: ['bulk', `test-${i}`],
                decayFactor: 1.0
            })),
            longTermMemory: []
        };

        await store.saveMemoryToHistory(bulkMemory);

        // Custom paginated query
        const pageSize = 2;
        const query = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            SELECT ?id ?prompt
            FROM <${store.graphName}>
            WHERE {
                ?s semem:id ?id ;
                   semem:prompt ?prompt .
            }
            LIMIT ${pageSize}
        `;

        const results = await store.executeSparqlQuery(query, store.endpoint.query);
        expect(results.results.bindings.length).toBe(pageSize);
    });
});
