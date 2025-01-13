import Config from '../../../../src/Config.js';
import SPARQLStore from '../../../../src/stores/SPARQLStore.js';
import { logger } from '../../../../src/Utils.js';

describe('SPARQLStore Basic Backup Integration', () => {
    let store;
    let config;
    const testGraph = 'http://example.org/mcp/test-backup-basic';
    let originalData;

    beforeAll(async () => {
        config = new Config();
        const sparqlConfig = config.get('sparqlEndpoints')[0];

        store = new SPARQLStore({
            query: `${sparqlConfig.urlBase}${sparqlConfig.query}`,
            update: `${sparqlConfig.urlBase}${sparqlConfig.update}`
        }, {
            user: sparqlConfig.user,
            password: sparqlConfig.password,
            graphName: testGraph
        });

        // Test data
        originalData = {
            shortTermMemory: [{
                id: 'backup-test-1',
                prompt: 'backup test prompt',
                output: 'backup test output',
                embedding: new Array(1536).fill(0).map(() => Math.random()),
                timestamp: Date.now(),
                accessCount: 1,
                concepts: ['backup', 'test'],
                decayFactor: 1.0
            }],
            longTermMemory: []
        };

        // Setup test graph
        try {
            await store.beginTransaction();
            const setupQuery = `
                DROP SILENT GRAPH <${testGraph}>;
                CREATE GRAPH <${testGraph}>
            `;
            await store._executeSparqlUpdate(setupQuery, store.endpoint.update);
            await store.commitTransaction();

            // Save initial data
            await store.saveMemoryToHistory(originalData);
        } catch (error) {
            logger.error('Error in backup test setup:', error);
            throw error;
        }
    });

    afterAll(async () => {
        try {
            await store.beginTransaction();
            const cleanupQuery = `
                DROP SILENT GRAPH <${testGraph}>;
                DROP SILENT GRAPH <${testGraph}.backup>
            `;
            await store._executeSparqlUpdate(cleanupQuery, store.endpoint.update);
            await store.commitTransaction();
        } finally {
            await store.close();
        }
    });

    it('should create backup during transaction', async () => {
        await store.beginTransaction();

        // Verify backup graph exists
        const verifyQuery = `
            ASK { GRAPH <${testGraph}.backup> { ?s ?p ?o } }
        `;
        const result = await store._executeSparqlQuery(verifyQuery, store.endpoint.query);
        expect(result.boolean).toBe(true);

        await store.commitTransaction();
    });

    it('should restore from backup on rollback', async () => {
        await store.beginTransaction();

        // Modify data
        const modifiedData = {
            shortTermMemory: [{
                ...originalData.shortTermMemory[0],
                output: 'modified output'
            }],
            longTermMemory: []
        };

        await store.saveMemoryToHistory(modifiedData);

        // Verify modification
        let [shortTerm] = await store.loadHistory();
        expect(shortTerm[0].output).toBe('modified output');

        // Rollback
        await store.rollbackTransaction();

        // Verify restoration
        [shortTerm] = await store.loadHistory();
        expect(shortTerm[0].output).toBe('backup test output');
    });

    it('should cleanup backup graphs after commit', async () => {
        await store.beginTransaction();
        await store.commitTransaction();

        // Verify backup graph is removed
        const verifyQuery = `
            ASK { GRAPH <${testGraph}.backup> { ?s ?p ?o } }
        `;
        const result = await store._executeSparqlQuery(verifyQuery, store.endpoint.query);
        expect(result.boolean).toBe(false);
    });

    it('should handle nested transaction attempts', async () => {
        await store.beginTransaction();

        await expectAsync(store.beginTransaction())
            .toBeRejectedWithError('Transaction already in progress');

        await store.rollbackTransaction();
    });

    it('should preserve backup during multiple operations', async () => {
        await store.beginTransaction();

        // Multiple modifications
        const modifications = [
            { output: 'first modification' },
            { output: 'second modification' },
            { output: 'third modification' }
        ];

        for (const mod of modifications) {
            const modData = {
                shortTermMemory: [{
                    ...originalData.shortTermMemory[0],
                    ...mod
                }],
                longTermMemory: []
            };
            await store.saveMemoryToHistory(modData);
        }

        // Rollback should restore original
        await store.rollbackTransaction();

        const [shortTerm] = await store.loadHistory();
        expect(shortTerm[0].output).toBe('backup test output');
    });
});
