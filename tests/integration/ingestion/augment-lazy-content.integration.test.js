/**
 * Integration tests for lazy content augmentation
 * Tests AugmentLazyContent.js CLI utility with live services
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';

// Only run if INTEGRATION_TESTS=true
const integrationTestsEnabled = process.env.INTEGRATION_TESTS === 'true';
const describeIntegration = integrationTestsEnabled ? describe : describe.skip;

describeIntegration('Augment Lazy Content Integration Tests', () => {
    let config;
    let store;
    let testGraph;

    beforeAll(async () => {
        config = new Config('config/config.json');
        await config.init();

        const storage = config.get('storage');
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
     * Helper to run AugmentLazyContent CLI
     */
    function runAugmentLazyContent(args = []) {
        return new Promise((resolve, reject) => {
            const proc = spawn('node', ['utils/AugmentLazyContent.js', ...args], {
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
     * Helper to create test lazy item
     */
    async function createLazyItem(content, label) {
        const id = `semem:test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const timestamp = new Date().toISOString();

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX semem: <http://purl.org/stuff/semem/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            PREFIX dcterms: <http://purl.org/dc/terms/>

            INSERT DATA {
                GRAPH <${testGraph}> {
                    <${id}> a ragno:Entity ;
                        ragno:content """${content}""" ;
                        ragno:subType semem:document ;
                        ragno:isEntryPoint false ;
                        semem:processingStatus "lazy" ;
                        rdfs:label "${label}" ;
                        dcterms:created "${timestamp}"^^xsd:dateTime .
                }
            }
        `;

        await store.sparqlExecute.executeSparqlUpdate(insertQuery);
        return id;
    }

    /**
     * Helper to count lazy items
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
        return parseInt(result.results.bindings[0]?.count?.value || '0');
    }

    /**
     * Helper to count processed items
     */
    async function countProcessedItems() {
        const query = `
            PREFIX semem: <http://purl.org/stuff/semem/>
            SELECT (COUNT(?element) as ?count)
            FROM <${testGraph}>
            WHERE {
                ?element semem:processingStatus "processed" .
            }
        `;

        const result = await store.sparqlExecute.executeSparqlQuery(query);
        return parseInt(result.results.bindings[0]?.count?.value || '0');
    }

    /**
     * Helper to check if item has embedding
     */
    async function hasEmbedding(itemId) {
        const query = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            ASK FROM <${testGraph}>
            WHERE {
                <${itemId}> ragno:embedding ?emb .
            }
        `;

        const result = await store.sparqlExecute.executeSparqlQuery(query);
        return result.boolean === true;
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

    describe('CLI Help and Validation', () => {
        it('should show help message', async () => {
            const result = await runAugmentLazyContent(['--help']);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Augment Lazy Content Utility');
            expect(result.stdout).toContain('USAGE:');
            expect(result.stdout).toContain('--limit');
            expect(result.stdout).toContain('--batch-size');
        });
    });

    describe('Dry Run Mode', () => {
        beforeAll(async () => {
            await cleanupTestData();
            await createLazyItem('Test content for dry run', 'Dry Run Test');
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should preview lazy items without processing them', async () => {
            const initialLazy = await countLazyItems();
            const initialProcessed = await countProcessedItems();

            const result = await runAugmentLazyContent([
                '--dry-run',
                '--limit', '5'
            ]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('DRY RUN');
            expect(result.stdout).toContain('Would process');

            // Verify nothing was processed
            const finalLazy = await countLazyItems();
            const finalProcessed = await countProcessedItems();

            expect(finalLazy).toBe(initialLazy);
            expect(finalProcessed).toBe(initialProcessed);
        });
    });

    describe('Single Item Augmentation', () => {
        let testItemId;

        beforeAll(async () => {
            await cleanupTestData();
            testItemId = await createLazyItem(
                'The quick brown fox jumps over the lazy dog. This is a test sentence for semantic analysis.',
                'Test Single Item'
            );
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should augment a single lazy item', async () => {
            const initialLazy = await countLazyItems();

            const result = await runAugmentLazyContent([
                '--limit', '1',
                '--verbose'
            ]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('AUGMENTATION COMPLETE');
            expect(result.stdout).toContain('Processed: 1/1');

            // Verify item was processed
            const finalLazy = await countLazyItems();
            expect(finalLazy).toBe(initialLazy - 1);

            const finalProcessed = await countProcessedItems();
            expect(finalProcessed).toBeGreaterThan(0);
        }, 120000);

        it('should generate embedding for processed item', async () => {
            // Create fresh item
            const itemId = await createLazyItem(
                'Testing embedding generation with augmentation utility',
                'Embedding Test'
            );

            await runAugmentLazyContent(['--limit', '1']);

            const itemHasEmbedding = await hasEmbedding(itemId);
            expect(itemHasEmbedding).toBe(true);
        }, 120000);

        it('should update processing status to processed', async () => {
            const itemId = await createLazyItem(
                'Status update test content',
                'Status Test'
            );

            await runAugmentLazyContent(['--id', itemId]);

            const query = `
                PREFIX semem: <http://purl.org/stuff/semem/>
                SELECT ?status
                FROM <${testGraph}>
                WHERE {
                    <${itemId}> semem:processingStatus ?status .
                }
            `;

            const result = await store.sparqlExecute.executeSparqlQuery(query);
            expect(result.results.bindings[0]?.status?.value).toBe('processed');
        }, 120000);
    });

    describe('Batch Processing', () => {
        beforeAll(async () => {
            await cleanupTestData();
            // Create multiple test items
            await createLazyItem('First test item content', 'Batch Test 1');
            await createLazyItem('Second test item content', 'Batch Test 2');
            await createLazyItem('Third test item content', 'Batch Test 3');
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should process multiple items in batches', async () => {
            const initialLazy = await countLazyItems();
            expect(initialLazy).toBeGreaterThanOrEqual(3);

            const result = await runAugmentLazyContent([
                '--limit', '3',
                '--batch-size', '2'
            ]);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('Batch 1/');
            expect(result.stdout).toContain('Batch 2/');
            expect(result.stdout).toContain('Processed: 3/3');

            const finalLazy = await countLazyItems();
            expect(finalLazy).toBe(initialLazy - 3);
        }, 180000);

        it('should report statistics correctly', async () => {
            await cleanupTestData();
            await createLazyItem('Stats test 1', 'Stats 1');
            await createLazyItem('Stats test 2', 'Stats 2');

            const result = await runAugmentLazyContent(['--limit', '2']);

            expect(result.stdout).toContain('AUGMENTATION COMPLETE');
            expect(result.stdout).toContain('Processed: 2/2');
            expect(result.stdout).toContain('Failed: 0');
            expect(result.stdout).toContain('Duration:');
            expect(result.stdout).toContain('Avg time per item:');
        }, 120000);
    });

    describe('Filter by Type', () => {
        beforeAll(async () => {
            await cleanupTestData();
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should filter items by type', async () => {
            // Create items with different types
            const docId = await createLazyItem('Document content', 'Doc');

            // Manually set type to concept for one
            const conceptQuery = `
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                PREFIX semem: <http://purl.org/stuff/semem/>

                DELETE {
                    GRAPH <${testGraph}> {
                        <${docId}> ragno:subType semem:document .
                    }
                }
                INSERT {
                    GRAPH <${testGraph}> {
                        <${docId}> ragno:subType semem:concept .
                    }
                }
                WHERE {
                    GRAPH <${testGraph}> {
                        <${docId}> ragno:subType semem:document .
                    }
                }
            `;
            await store.sparqlExecute.executeSparqlUpdate(conceptQuery);

            await createLazyItem('Another document', 'Doc2');

            const result = await runAugmentLazyContent([
                '--type', 'concept',
                '--limit', '10'
            ]);

            expect(result.code).toBe(0);
            // Should only process the concept type
            expect(result.stdout).toMatch(/Processed: 1\/1/);
        }, 120000);
    });

    describe('Error Handling', () => {
        it('should handle empty lazy content gracefully', async () => {
            await cleanupTestData();

            const result = await runAugmentLazyContent(['--limit', '10']);

            expect(result.code).toBe(0);
            expect(result.stdout).toContain('No lazy content found');
        });

        it('should continue on individual item failures', async () => {
            await cleanupTestData();
            // Create item with problematic content
            await createLazyItem('Valid content', 'Valid');
            await createLazyItem('', 'Empty'); // Empty content might cause issues

            const result = await runAugmentLazyContent(['--limit', '2']);

            expect(result.code).toBe(0);
            // Should report completion even if some failed
            expect(result.stdout).toContain('AUGMENTATION COMPLETE');
        }, 120000);
    });

    describe('Performance', () => {
        beforeAll(async () => {
            await cleanupTestData();
            await createLazyItem('Performance test content', 'Perf Test');
        });

        afterAll(async () => {
            await cleanupTestData();
        });

        it('should complete within reasonable time', async () => {
            const startTime = Date.now();

            const result = await runAugmentLazyContent(['--limit', '1']);

            const duration = Date.now() - startTime;

            expect(result.code).toBe(0);
            // Should complete in under 30 seconds for 1 item
            expect(duration).toBeLessThan(30000);
        }, 60000);
    });
});