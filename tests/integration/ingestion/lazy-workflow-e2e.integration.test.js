/**
 * End-to-End Integration Tests for Complete Lazy Batch Processing Workflow
 * Tests the full lifecycle: Ingest → Query → Augment → Verify
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';

// Only run if INTEGRATION_TESTS=true
const integrationTestsEnabled = process.env.INTEGRATION_TESTS === 'true';
const describeIntegration = integrationTestsEnabled ? describe : describe.skip;

describeIntegration('Lazy Batch Processing E2E Workflow', () => {
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
     * Helper to run CLI utilities
     */
    function runCLI(script, args = []) {
        return new Promise((resolve, reject) => {
            const proc = spawn('node', [script, ...args], {
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

            // Timeout after 5 minutes
            setTimeout(() => {
                proc.kill();
                reject(new Error('Process timeout'));
            }, 300000);
        });
    }

    /**
     * Helper to cleanup test data
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
                    FILTER(?status IN ("lazy", "processed"))
                    ?element ?p ?o .
                }
            }
        `;

        await store.sparqlExecute.executeSparqlUpdate(deleteQuery);
    }

    /**
     * Helper to count items by status
     */
    async function countByStatus(status) {
        const query = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            SELECT (COUNT(?element) as ?count)
            FROM <${testGraph}>
            WHERE {
                ?element semem:processingStatus "${status}" .
            }
        `;

        const result = await store.sparqlExecute.executeSparqlQuery(query);
        return parseInt(result.results.bindings[0]?.count?.value || '0');
    }

    describe('Complete Workflow: Ingest → Query → Augment', () => {
        beforeAll(async () => {
            await cleanupTestData();
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should complete full workflow successfully', async () => {
            // Step 1: Ingest bookmarks with lazy mode
            console.log('\n📥 Step 1: Ingesting bookmarks (lazy mode)...');
            const ingestResult = await runCLI('utils/BookmarkIngest.js', [
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--lazy',
                '--limit', '2'
            ]);

            expect(ingestResult.code).toBe(0);
            expect(ingestResult.stdout).toContain('Success: true');

            // Verify lazy items were created
            let lazyCount = await countByStatus('lazy');
            expect(lazyCount).toBeGreaterThan(0);
            console.log(`✅ Created ${lazyCount} lazy items`);

            // Step 2: Query lazy content
            console.log('\n🔍 Step 2: Querying lazy content...');
            const queryResult = await runCLI('utils/QueryLazyContent.js', [
                '--limit', '10'
            ]);

            expect(queryResult.code).toBe(0);
            expect(queryResult.stdout).toContain('Found');
            expect(queryResult.stdout).toContain('lazy items');
            console.log('✅ Lazy content query successful');

            // Step 3: Augment lazy content
            console.log('\n⚙️  Step 3: Augmenting lazy content...');
            const augmentResult = await runCLI('utils/AugmentLazyContent.js', [
                '--limit', lazyCount.toString(),
                '--batch-size', '2'
            ]);

            expect(augmentResult.code).toBe(0);
            expect(augmentResult.stdout).toContain('AUGMENTATION COMPLETE');
            console.log('✅ Augmentation complete');

            // Step 4: Verify all items processed
            console.log('\n✔️  Step 4: Verifying processing...');
            const finalLazyCount = await countByStatus('lazy');
            const processedCount = await countByStatus('processed');

            expect(finalLazyCount).toBe(0);
            expect(processedCount).toBeGreaterThan(0);
            console.log(`✅ All items processed: ${processedCount} processed, ${finalLazyCount} remaining`);

            // Step 5: Verify no more lazy content
            const finalQueryResult = await runCLI('utils/QueryLazyContent.js');

            expect(finalQueryResult.code).toBe(0);
            expect(finalQueryResult.stdout).toContain('No lazy content found');
            console.log('✅ Workflow complete - no lazy items remaining');

        }, 300000); // 5 minute timeout for full workflow
    });

    describe('Workflow Performance Comparison', () => {
        beforeAll(async () => {
            await cleanupTestData();
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should demonstrate lazy workflow speed advantage', async () => {
            // Test lazy workflow
            const lazyStartTime = Date.now();

            // Ingest with lazy mode
            await runCLI('utils/BookmarkIngest.js', [
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--lazy',
                '--limit', '2'
            ]);

            const lazyIngestDuration = Date.now() - lazyStartTime;

            // Augment
            const augmentStartTime = Date.now();
            await runCLI('utils/AugmentLazyContent.js', ['--limit', '2']);
            const augmentDuration = Date.now() - augmentStartTime;

            const totalLazyDuration = lazyIngestDuration + augmentDuration;

            console.log(`\n📊 Performance Metrics:`);
            console.log(`   Lazy ingest: ${Math.round(lazyIngestDuration / 1000)}s`);
            console.log(`   Augmentation: ${Math.round(augmentDuration / 1000)}s`);
            console.log(`   Total: ${Math.round(totalLazyDuration / 1000)}s`);

            // Lazy ingest should be under 10 seconds for 2 items
            expect(lazyIngestDuration).toBeLessThan(10000);

            // For comparison info only (not a failure if slow)
            if (augmentDuration < 120000) {
                console.log(`   ✅ Augmentation completed in reasonable time`);
            }

        }, 300000);
    });

    describe('Workflow Error Recovery', () => {
        beforeAll(async () => {
            await cleanupTestData();
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should handle interrupted workflow gracefully', async () => {
            // Ingest items
            await runCLI('utils/BookmarkIngest.js', [
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--lazy',
                '--limit', '3'
            ]);

            const lazyCount = await countByStatus('lazy');
            expect(lazyCount).toBeGreaterThan(0);

            // Augment only some items
            await runCLI('utils/AugmentLazyContent.js', ['--limit', '1']);

            // Verify partial processing
            const remainingLazy = await countByStatus('lazy');
            const processed = await countByStatus('processed');

            expect(remainingLazy).toBeGreaterThan(0);
            expect(processed).toBeGreaterThan(0);
            expect(remainingLazy + processed).toBe(lazyCount);

            // Resume augmentation
            await runCLI('utils/AugmentLazyContent.js', [
                '--limit', remainingLazy.toString()
            ]);

            // Verify all processed
            const finalLazy = await countByStatus('lazy');
            expect(finalLazy).toBe(0);

        }, 300000);
    });

    describe('Workflow with Different Content Types', () => {
        beforeAll(async () => {
            await cleanupTestData();
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should handle mixed content types', async () => {
            // Ingest bookmarks
            await runCLI('utils/BookmarkIngest.js', [
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--lazy',
                '--limit', '2'
            ]);

            // Query all lazy content
            const queryResult = await runCLI('utils/QueryLazyContent.js');
            expect(queryResult.code).toBe(0);

            // Augment all types
            const augmentResult = await runCLI('utils/AugmentLazyContent.js', [
                '--limit', '10'
            ]);

            expect(augmentResult.code).toBe(0);
            expect(augmentResult.stdout).toContain('AUGMENTATION COMPLETE');

            // Verify all processed
            const lazyCount = await countByStatus('lazy');
            expect(lazyCount).toBe(0);

        }, 300000);
    });

    describe('Workflow Documentation Compliance', () => {
        it('should match documented workflow steps', async () => {
            await cleanupTestData();

            // This test verifies the workflow matches docs/manual/lazy-batch-processing.md

            // Step 1: Dry run
            const dryRunResult = await runCLI('utils/BookmarkIngest.js', [
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--dry-run',
                '--limit', '1'
            ]);
            expect(dryRunResult.code).toBe(0);

            // Step 2: Lazy ingest
            const ingestResult = await runCLI('utils/BookmarkIngest.js', [
                '--endpoint', testEndpoint,
                '--graph', testGraph,
                '--lazy',
                '--limit', '1'
            ]);
            expect(ingestResult.code).toBe(0);

            // Step 3: Check stored
            const queryResult = await runCLI('utils/QueryLazyContent.js', [
                '--limit', '10'
            ]);
            expect(queryResult.code).toBe(0);

            // Step 4: Augment
            const augmentResult = await runCLI('utils/AugmentLazyContent.js', [
                '--limit', '1'
            ]);
            expect(augmentResult.code).toBe(0);

            // Step 5: Verify complete
            const finalQueryResult = await runCLI('utils/QueryLazyContent.js');
            expect(finalQueryResult.code).toBe(0);
            expect(finalQueryResult.stdout).toContain('No lazy content found');

        }, 300000);
    });
});