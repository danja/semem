/**
 * Integration tests for bookmark ingestion system
 * Tests BookmarkIngest.js CLI utility with live services
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';

// Only run if INTEGRATION_TESTS=true
const integrationTestsEnabled = process.env.INTEGRATION_TESTS === 'true';
const describeIntegration = integrationTestsEnabled ? describe : describe.skip;

describeIntegration('Bookmark Ingestion Integration Tests', () => {
    let config;
    let store;
    let testEndpoint;
    let testGraph;

    beforeAll(async () => {
        config = new Config('config/config.json');
        await config.init();

        const storage = config.get('storage');
        testEndpoint = storage.options.query;
        testGraph = storage.options.graphName;

        // Initialize store for verification
        const endpoints = {
            query: storage.options.query,
            update: storage.options.update
        };

        store = new SPARQLStore(endpoints, {
            user: storage.options.user,
            password: storage.options.password,
            graphName: testGraph,
            dimension: config.get('embeddingDimension') || 1536
        }, config);
    });

    afterAll(async () => {
        if (store?.sparqlExecute) {
            await store.sparqlExecute.dispose();
        }
    });

    /**
     * Helper to run BookmarkIngest CLI
     */
    function runBookmarkIngest(args = []) {
        return new Promise((resolve, reject) => {
            const proc = spawn('node', ['utils/BookmarkIngest.js', ...args], {
                cwd: process.cwd(),
                stdio: ['ignore', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            proc.on('close', (code) => {
                resolve({ code, stdout, stderr });
            });

            proc.on('error', (error) => {
                reject(error);
            });

            // Timeout after 2 minutes
            setTimeout(() => {
                proc.kill();
                reject(new Error('Process timeout'));
            }, 120000);
        });
    }

    /**
     * Helper to count lazy items in store
     */
    async function countLazyItems() {
        const query = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            SELECT (COUNT(?element) as ?count)
            FROM <${testGraph}>
            WHERE {
                ?element semem:processingStatus "lazy" .
            }
        `;

        const result = await store.sparqlExecute.executeSparqlQuery(query);
        const count = parseInt(result.results.bindings[0]?.count?.value || '0');
        return count;
    }

    /**
     * Helper to clean up test data
     */
    async function cleanupTestData() {
        const deleteQuery = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX ragno: <http://purl.org/stuff/ragno/>

            DELETE {
                GRAPH <${testGraph}> {
                    ?element ?p ?o .
                }
            }
            WHERE {
                GRAPH <${testGraph}> {
                    ?element a ragno:Entity ;
                             semem:processingStatus ?status .
                    ?element ?p ?o .
                }
            }
        `;

        await store.sparqlExecute.executeSparqlUpdate(deleteQuery);
    }

    describe('CLI Help and Validation', () => {
        it('should show help message', async () => {
            const result = await runBookmarkIngest(['--help']);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Bookmark Ingestion Tool');
            expect(result.stdout).toContain('USAGE:');
            expect(result.stdout).toContain('--endpoint');
            expect(result.stdout).toContain('--lazy');
        });

        it('should fail without required endpoint parameter', async () => {
            const result = await runBookmarkIngest([]);

            expect(result.code).toBe(1);
            expect(result.stdout).toContain('--endpoint is required');
        });
    });

    describe('Dry Run Mode', () => {
        it('should preview bookmarks without storing them', async () => {
            const initialCount = await countLazyItems();

            const result = await runBookmarkIngest([
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--dry-run',
                '--limit', '3'
            ]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Dry Run Successful');
            expect(result.stdout).toContain('Total bookmarks found');

            // Verify no items were actually stored
            const finalCount = await countLazyItems();
            expect(finalCount).toBe(initialCount);
        });
    });

    describe('Lazy Mode Ingestion', () => {
        beforeAll(async () => {
            await cleanupTestData();
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should ingest bookmarks with lazy processing', async () => {
            const initialCount = await countLazyItems();

            const result = await runBookmarkIngest([
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--lazy',
                '--limit', '2'
            ]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('INGESTION COMPLETE');
            expect(result.stdout).toContain('Success: true');

            // Verify items were stored as lazy
            const finalCount = await countLazyItems();
            expect(finalCount).toBeGreaterThan(initialCount);
        }, 60000);

        it('should complete lazy ingestion quickly', async () => {
            await cleanupTestData();

            const startTime = Date.now();

            const result = await runBookmarkIngest([
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--lazy',
                '--limit', '2'
            ]);

            const duration = Date.now() - startTime;

            expect(result.code).toBe(0);
            // Should complete in under 10 seconds for 2 items
            expect(duration).toBeLessThan(10000);
        }, 30000);

        it('should store bookmarks with correct metadata', async () => {
            await cleanupTestData();

            await runBookmarkIngest([
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--lazy',
                '--limit', '1'
            ]);

            // Query stored item
            const query = `
                PREFIX semem: <http://purl.org/stuff/semem/>
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

                SELECT ?element ?content ?label ?status
                FROM <${testGraph}>
                WHERE {
                    ?element semem:processingStatus "lazy" ;
                             ragno:content ?content ;
                             semem:processingStatus ?status .
                    OPTIONAL { ?element rdfs:label ?label }
                }
                LIMIT 1
            `;

            const result = await store.sparqlExecute.executeSparqlQuery(query);
            expect(result.results.bindings.length).toBeGreaterThan(0);

            const item = result.results.bindings[0];
            expect(item.status.value).toBe('lazy');
            expect(item.content.value).toBeTruthy();
        }, 60000);
    });

    describe('Full Processing Mode', () => {
        beforeAll(async () => {
            await cleanupTestData();
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should ingest bookmark with full processing', async () => {
            const result = await runBookmarkIngest([
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--limit', '1'
            ]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('INGESTION COMPLETE');
            expect(result.stdout).toContain('Success: true');

            // Full processing should not create lazy items
            const lazyCount = await countLazyItems();
            expect(lazyCount).toBe(0);
        }, 120000);

        it('should take longer than lazy mode', async () => {
            await cleanupTestData();

            const startTime = Date.now();

            await runBookmarkIngest([
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--limit', '1'
            ]);

            const duration = Date.now() - startTime;

            // Full processing should take at least 30 seconds for embedding generation
            expect(duration).toBeGreaterThan(30000);
        }, 120000);
    });

    describe('Error Handling', () => {
        it('should handle invalid endpoint gracefully', async () => {
            const result = await runBookmarkIngest([
                '--endpoint', 'http://invalid-endpoint:9999/query',
                '--graph', testGraph,
                '--lazy',
                '--limit', '1'
            ]);

            expect(result.code).toBe(1);
            expect(result.stdout).toContain('failed');
        }, 30000);

        it('should handle empty result set', async () => {
            const result = await runBookmarkIngest([
                '--endpoint', testEndpoint,
                '--graph', 'http://nonexistent/graph',
                '--dry-run',
                '--limit', '1'
            ]);

            // Should not crash, just report 0 items
            expect(result.code).toBe(0);
            expect(result.stdout).toContain('0');
        });
    });

    describe('Verbose Mode', () => {
        it('should provide detailed output in verbose mode', async () => {
            const result = await runBookmarkIngest([
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--dry-run',
                '--limit', '1',
                '--verbose'
            ]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('📝 Query:');
            expect(result.stdout).toContain('PREFIX bm:');
        });
    });
});