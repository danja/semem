import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';
import { logger } from '../../../src/Utils.js';

describe('SPARQLStore Integration', () => {
    let store;
    let config;
    let testMemory;

    beforeAll(async () => {
        // Initialize with real config
        config = new Config();
        const sparqlConfig = config.get('sparqlEndpoints')[0];

        store = new SPARQLStore({
            query: `${sparqlConfig.urlBase}${sparqlConfig.query}`,
            update: `${sparqlConfig.urlBase}${sparqlConfig.update}`
        }, {
            user: sparqlConfig.user,
            password: sparqlConfig.password,
            graphName: 'http://example.org/mcp/test-memory'
        });

        // Test data
        testMemory = {
            shortTermMemory: [{
                id: 'test-integration-1',
                prompt: 'integration test prompt',
                output: 'integration test output',
                embedding: new Array(1536).fill(0).map(() => Math.random()),
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
            await store._executeSparqlUpdate(clearQuery, `${sparqlConfig.urlBase}${sparqlConfig.update}`);
            await store.commitTransaction();
        } catch (error) {
            logger.error('Error in test setup:', error);
            throw error;
        }
    });

    afterAll(async () => {
        // Cleanup test graph
        try {
            await store.beginTransaction();
            const dropQuery = `DROP SILENT GRAPH <http://example.org/mcp/test-memory>`;
            await store._executeSparqlUpdate(dropQuery, `${config.get('sparqlEndpoints')[0].urlBase}${config.get('sparqlEndpoints')[0].update}`);
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
        expect(loaded.embedding.length).toBe(1536);
    });

    it('should handle transaction rollback', async () => {
        await store.beginTransaction();

        const badMemory = {
            shortTermMemory: [{
                id: 'test-rollback',
                prompt: 'should not persist',
                output: 'rollback test',
                embedding: new Array(1536).fill(0),
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

    it('should handle concurrent transactions', async () => {
        const store2 = new SPARQLStore(store.endpoint, {
            user: store.credentials.user,
            password: store.credentials.password,
            graphName: store.graphName
        });

        await store.beginTransaction();

        // Second transaction should fail while first is in progress
        await expectAsync(store2.beginTransaction())
            .toBeRejectedWithError(/Transaction already in progress/);

        await store.commitTransaction();
        await store2.close();
    });

    it('should support query pagination', async () => {
        // Add multiple memories
        const bulkMemory = {
            shortTermMemory: Array(5).fill(null).map((_, i) => ({
                id: `bulk-test-${i}`,
                prompt: `bulk test prompt ${i}`,
                output: `bulk test output ${i}`,
                embedding: new Array(1536).fill(0).map(() => Math.random()),
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
            PREFIX mcp: <http://purl.org/stuff/mcp/>
            SELECT ?id ?prompt
            FROM <${store.graphName}>
            WHERE {
                ?s mcp:id ?id ;
                   mcp:prompt ?prompt .
            }
            LIMIT ${pageSize}
        `;

        const results = await store._executeSparqlQuery(query, store.endpoint.query);
        expect(results.results.bindings.length).toBe(pageSize);
    });
});
