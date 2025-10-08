/**
 * Integration test for augment label operation
 * Tests keyword-based label generation for unlabeled entities
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Config from '../../../src/Config.js';
import SPARQLStore from '../../../src/stores/SPARQLStore.js';
import { getSimpleVerbsService } from '../../../src/mcp/tools/simple-verbs.js';
import { initializeServices } from '../../../src/mcp/lib/initialization.js';

describe('Augment Label Integration Tests', () => {
    let config;
    let store;
    let simpleVerbsService;
    let testEntityUri;
    const testGraph = 'http://hyperdata.it/content';

    beforeAll(async () => {
        // Skip if not running integration tests
        if (!process.env.INTEGRATION_TESTS) {
            console.log('⏭️  Skipping integration tests (set INTEGRATION_TESTS=true to run)');
            return;
        }

        // Initialize config
        config = new Config('config/config.json');
        await config.init();

        // Initialize MCP services
        await initializeServices();
        simpleVerbsService = getSimpleVerbsService();

        // Initialize SPARQL store
        const storage = config.get('storage');
        const endpoints = {
            query: storage.options.query,
            update: storage.options.update
        };

        store = new SPARQLStore(endpoints, {
            user: storage.options.user,
            password: storage.options.password,
            graphName: testGraph,
            dimension: config.get('embeddingDimension') || 768
        }, config);

        console.log('✅ Test environment initialized');
    });

    afterAll(async () => {
        if (!process.env.INTEGRATION_TESTS) return;

        // Clean up test entity if it exists
        if (testEntityUri && store) {
            try {
                const deleteQuery = `
                    PREFIX ragno: <http://purl.org/stuff/ragno/>
                    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
                    PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

                    DELETE WHERE {
                        GRAPH <${testGraph}> {
                            <${testEntityUri}> ?p ?o .
                        }
                    }
                `;
                await store.executeSparqlUpdate(deleteQuery);
                console.log('🧹 Cleaned up test entity');
            } catch (error) {
                console.error('Failed to clean up test entity:', error.message);
            }
        }
    });

    it('should generate label for unlabeled ragno:Element', async () => {
        if (!process.env.INTEGRATION_TESTS) {
            console.log('⏭️  Skipping test');
            return;
        }

        // Step 1: Create unlabeled ragno:Element with content
        const timestamp = Date.now();
        testEntityUri = `http://hyperdata.it/test/element-${timestamp}`;
        const testContent = 'This is a test document about semantic memory systems and knowledge graph integration with artificial intelligence';

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

            INSERT DATA {
                GRAPH <${testGraph}> {
                    <${testEntityUri}> a ragno:Element , skos:Concept ;
                                       ragno:content "${testContent}" .
                }
            }
        `;

        await store.executeSparqlUpdate(insertQuery);
        console.log('📝 Created unlabeled test entity:', testEntityUri);

        // Step 2: Verify entity exists and has no label
        const checkQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT ?content ?label
            WHERE {
                GRAPH <${testGraph}> {
                    <${testEntityUri}> ragno:content ?content .
                    OPTIONAL { <${testEntityUri}> rdfs:label ?label }
                }
            }
        `;

        const beforeResult = await store.executeSparqlQuery(checkQuery);
        expect(beforeResult.results.bindings).toHaveLength(1);
        expect(beforeResult.results.bindings[0].content.value).toBe(testContent);
        expect(beforeResult.results.bindings[0].label).toBeUndefined();
        console.log('✅ Verified entity has no label initially');

        // Step 3: Run augment label operation
        // Use a high limit to ensure our test entity is included
        const augmentResult = await simpleVerbsService.augment({
            target: 'all',
            operation: 'label',
            options: {
                limit: 500,
                keywordCount: 5,
                dryRun: false
            }
        });

        console.log('🏷️  Augment label result:', JSON.stringify(augmentResult, null, 2));
        expect(augmentResult.success).toBe(true);
        expect(augmentResult.processed).toBeGreaterThan(0);

        // Step 4: Verify label was added
        const afterResult = await store.executeSparqlQuery(checkQuery);
        expect(afterResult.results.bindings).toHaveLength(1);

        const binding = afterResult.results.bindings[0];
        expect(binding.label).toBeDefined();
        expect(binding.label.value).toBeTruthy();
        expect(binding.label.value.length).toBeGreaterThan(0);

        console.log('✅ Label added successfully:', binding.label.value);

        // Step 5: Verify skos:prefLabel was also added
        const prefLabelQuery = `
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

            SELECT ?prefLabel
            WHERE {
                GRAPH <${testGraph}> {
                    <${testEntityUri}> skos:prefLabel ?prefLabel .
                }
            }
        `;

        const prefLabelResult = await store.executeSparqlQuery(prefLabelQuery);
        expect(prefLabelResult.results.bindings).toHaveLength(1);
        expect(prefLabelResult.results.bindings[0].prefLabel.value).toBe(binding.label.value);
        console.log('✅ skos:prefLabel matches rdfs:label');

        // Step 6: Verify label contains keywords from content
        const label = binding.label.value.toLowerCase();
        const keywords = label.split(' ');

        // Should have extracted meaningful keywords
        expect(keywords.length).toBeGreaterThan(0);
        expect(keywords.length).toBeLessThanOrEqual(5);

        // At least one keyword should appear in the original content
        const contentLower = testContent.toLowerCase();
        const hasRelevantKeyword = keywords.some(keyword =>
            contentLower.includes(keyword)
        );
        expect(hasRelevantKeyword).toBe(true);
        console.log('✅ Label contains relevant keywords:', keywords);
    });

    it('should handle dry run mode without modifying data', async () => {
        if (!process.env.INTEGRATION_TESTS) {
            console.log('⏭️  Skipping test');
            return;
        }

        // Create another unlabeled entity
        const timestamp = Date.now();
        const dryRunEntityUri = `http://hyperdata.it/test/dryrun-${timestamp}`;
        const testContent = 'Machine learning algorithms for natural language processing and text analysis';

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>

            INSERT DATA {
                GRAPH <${testGraph}> {
                    <${dryRunEntityUri}> a ragno:Element ;
                                         ragno:content "${testContent}" .
                }
            }
        `;

        await store.executeSparqlUpdate(insertQuery);

        // Run dry run
        const dryRunResult = await simpleVerbsService.augment({
            target: 'all',
            operation: 'label',
            options: {
                limit: 10,
                dryRun: true
            }
        });

        expect(dryRunResult.success).toBe(true);
        expect(dryRunResult.dryRun).toBe(true);
        expect(dryRunResult.found).toBeGreaterThan(0);
        console.log('✅ Dry run completed:', dryRunResult.message);

        // Verify entity still has no label
        const checkQuery = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT ?label
            WHERE {
                GRAPH <${testGraph}> {
                    <${dryRunEntityUri}> rdfs:label ?label .
                }
            }
        `;

        const result = await store.executeSparqlQuery(checkQuery);
        expect(result.results.bindings).toHaveLength(0);
        console.log('✅ Dry run did not modify data');

        // Clean up
        const deleteQuery = `
            DELETE WHERE {
                GRAPH <${testGraph}> {
                    <${dryRunEntityUri}> ?p ?o .
                }
            }
        `;
        await store.executeSparqlUpdate(deleteQuery);
    });

    it('should not relabel already labeled entities', async () => {
        if (!process.env.INTEGRATION_TESTS) {
            console.log('⏭️  Skipping test');
            return;
        }

        // Create entity with existing label
        const timestamp = Date.now();
        const labeledEntityUri = `http://hyperdata.it/test/labeled-${timestamp}`;
        const existingLabel = 'Existing Test Label';
        const testContent = 'Some test content that would generate different keywords';

        const insertQuery = `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            INSERT DATA {
                GRAPH <${testGraph}> {
                    <${labeledEntityUri}> a ragno:Element ;
                                          ragno:content "${testContent}" ;
                                          rdfs:label "${existingLabel}" .
                }
            }
        `;

        await store.executeSparqlUpdate(insertQuery);

        // Run label operation
        await simpleVerbsService.augment({
            target: 'all',
            operation: 'label',
            options: {
                limit: 10,
                dryRun: false
            }
        });

        // Verify original label unchanged
        const checkQuery = `
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

            SELECT ?label
            WHERE {
                GRAPH <${testGraph}> {
                    <${labeledEntityUri}> rdfs:label ?label .
                }
            }
        `;

        const result = await store.executeSparqlQuery(checkQuery);
        expect(result.results.bindings).toHaveLength(1);
        expect(result.results.bindings[0].label.value).toBe(existingLabel);
        console.log('✅ Existing label preserved');

        // Clean up
        const deleteQuery = `
            DELETE WHERE {
                GRAPH <${testGraph}> {
                    <${labeledEntityUri}> ?p ?o .
                }
            }
        `;
        await store.executeSparqlUpdate(deleteQuery);
    });
});
