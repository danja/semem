import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';
import { logger } from '../../../src/Utils.js';

describe('SPARQLStore Advanced Backup Integration', () => {
    let store;
    let config;
    const testGraph = 'http://example.org/mcp/test-backup-advanced';
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
                id: 'advanced-backup-1',
                prompt: 'advanced backup test',
                output: 'original output',
                embedding: new Array(1536).fill(0).map(() => Math.random()),
                timestamp: Date.now(),
                accessCount: 1,
                concepts: ['advanced', 'backup'],
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
            logger.error('Error in advanced backup test setup:', error);
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

    it('should handle backup corruption', async () => {
        await store.beginTransaction();

        // Corrupt backup by inserting invalid data
        const corruptQuery = `
            INSERT DATA {
                GRAPH <${testGraph}.backup> {
                    _:corrupt a semem:Invalid ;
                        semem:invalidProp "test" .
                }
            }
        `;
        await store._executeSparqlUpdate(corruptQuery, store.endpoint.update);

        // Attempt operation that should detect corruption
        const modifiedData = {
            shortTermMemory: [{
                ...originalData.shortTermMemory[0],
                output: 'corrupt test output'
            }],
            longTermMemory: []
        };

        // Should fail gracefully and maintain data integrity
        try {
            await store.saveMemoryToHistory(modifiedData);
            fail('Should have detected corruption');
        } catch (error) {
            // Verify original data is intact
            const [shortTerm] = await store.loadHistory();
            expect(shortTerm[0].output).toBe('original output');
        }

        await store.rollbackTransaction();
    });

    it('should perform incremental backups', async () => {
        await store.beginTransaction();

        // Add new data incrementally
        const updates = [
            { id: 'incremental-1', output: 'first update' },
            { id: 'incremental-2', output: 'second update' }
        ];

        for (const update of updates) {
            const incrementalData = {
                shortTermMemory: [
                    ...originalData.shortTermMemory,
                    {
                        ...originalData.shortTermMemory[0],
                        ...update
                    }
                ],
                longTermMemory: []
            };

            await store.saveMemoryToHistory(incrementalData);

            // Verify backup contains incremental changes
            const verifyQuery = `
                PREFIX semem: <http://purl.org/stuff/semem/>
                ASK {
                    GRAPH <${testGraph}.backup> {
                        ?s semem:id "${update.id}" ;
                           semem:output "${update.output}" .
                    }
                }
            `;
            const result = await store._executeSparqlQuery(verifyQuery, store.endpoint.query);
            expect(result.boolean).toBe(true);
        }

        // Rollback should restore to original state
        await store.rollbackTransaction();

        const [shortTerm] = await store.loadHistory();
        expect(shortTerm.length).toBe(1);
        expect(shortTerm[0].id).toBe('advanced-backup-1');
    });

    it('should handle concurrent backup operations', async () => {
        const store2 = new SPARQLStore({
            query: store.endpoint.query,
            update: store.endpoint.update
        }, {
            user: store.credentials.user,
            password: store.credentials.password,
            graphName: testGraph
        });

        await store.beginTransaction();

        // Second store should detect existing backup
        await expectAsync(store2.beginTransaction())
            .toBeRejectedWithError(/Transaction already in progress/);

        await store.rollbackTransaction();
        await store2.close();
    });

    it('should verify backup integrity', async () => {
        await store.beginTransaction();

        // Verify backup matches original data
        const verifyQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            SELECT ?prop ?value
            WHERE {
                GRAPH <${testGraph}> {
                    ?s1 semem:id "advanced-backup-1" ;
                        ?prop ?value .
                }
                GRAPH <${testGraph}.backup> {
                    ?s2 semem:id "advanced-backup-1" ;
                        ?prop ?value2 .
                    FILTER(?value = ?value2)
                }
            }
        `;

        const results = await store._executeSparqlQuery(verifyQuery, store.endpoint.query);
        expect(results.results.bindings.length).toBeGreaterThan(0);

        await store.rollbackTransaction();
    });

    it('should handle large backup operations', async () => {
        await store.beginTransaction();

        // Create large dataset
        const largeData = {
            shortTermMemory: Array(100).fill(null).map((_, i) => ({
                id: `large-backup-${i}`,
                prompt: `large backup test ${i}`,
                output: `test output ${i}`,
                embedding: new Array(1536).fill(0).map(() => Math.random()),
                timestamp: Date.now(),
                accessCount: 1,
                concepts: ['large', 'backup', `test-${i}`],
                decayFactor: 1.0
            })),
            longTermMemory: []
        };

        await store.saveMemoryToHistory(largeData);

        // Verify backup contains all entries
        const countQuery = `
            SELECT (COUNT(?s) as ?count)
            WHERE {
                GRAPH <${testGraph}.backup> {
                    ?s a semem:Interaction
                }
            }
        `;

        const results = await store._executeSparqlQuery(countQuery, store.endpoint.query);
        expect(parseInt(results.results.bindings[0].count.value)).toBe(100);

        await store.rollbackTransaction();
    });
});
