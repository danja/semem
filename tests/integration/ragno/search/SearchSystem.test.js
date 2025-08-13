/**
 * SearchSystem.test.js - Integration Tests for Document Search System
 * 
 * Comprehensive integration test suite covering end-to-end search workflows:
 * - Full search pipeline execution
 * - RagnoSearch system integration
 * - SPARQL service integration
 * - Multi-mode search testing
 * - Performance benchmarking
 * - Real data testing scenarios
 * - Error handling and resilience
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import DocumentSearchSystem from '../../../../examples/document/Search.js';
import Config from '../../../../src/Config.js';
import { SPARQLQueryService } from '../../../../src/services/sparql/index.js';
import SPARQLHelper from '../../../../src/services/sparql/SPARQLHelper.js';
import fetch from 'node-fetch';

// Test configuration constants
const TEST_TIMEOUT = 30000; // 30 seconds for integration tests
const PERFORMANCE_THRESHOLD = 5000; // 5 seconds max for search operations

describe('Document Search System Integration', () => {
    let searchSystem;
    let config;
    let sparqlHelper;
    let queryService;
    let testGraphURI;
    let servicesAvailable = false;



    beforeAll(async () => {
        try {
            console.log('Starting integration test setup...');
            
            // Unmock fetch for integration tests
            if (vi.isMockFunction(fetch)) {
                vi.unmock('node-fetch');
            }
            
            // Setup test configuration using the same pattern as other integration tests
            config = new Config();
            await config.init();
            
            // Setup test graph URI
            testGraphURI = 'http://test.semem.it/search-integration';
            
            // Get SPARQL configuration following the established pattern
            const sparqlEndpoints = config.get('sparqlEndpoints');
            console.log(`Found ${sparqlEndpoints ? sparqlEndpoints.length : 0} SPARQL endpoints`);
            if (sparqlEndpoints && sparqlEndpoints.length > 0) {
                const sparqlConfig = sparqlEndpoints[0];
                
                // Setup SPARQL helper with proper endpoints
                const updateEndpoint = `${sparqlConfig.urlBase}${sparqlConfig.update || '/update'}`;
                const queryEndpoint = `${sparqlConfig.urlBase}${sparqlConfig.query || '/query'}`;
                
                sparqlHelper = new SPARQLHelper(updateEndpoint, {
                    auth: {
                        user: sparqlConfig.user,
                        password: sparqlConfig.password
                    }
                });
                
                queryService = new SPARQLQueryService();
                
                console.log(`Using SPARQL update endpoint: ${updateEndpoint}`);
                console.log(`Using SPARQL query endpoint: ${queryEndpoint}`);
                
                // Test if services are available
                await testServiceAvailability();
                
                if (servicesAvailable) {
                    console.log('✅ SPARQL services are available, setting up test data...');
                    await setupTestData();
                } else {
                    console.log('⚠️ SPARQL services not available, tests will be skipped');
                }
            } else {
                console.log('⚠️ No SPARQL endpoints configured, tests will be skipped');
                servicesAvailable = false;
            }
        } catch (error) {
            console.error('Integration test setup failed:', error);
            console.error('Stack trace:', error.stack);
            servicesAvailable = false;
        }
    }, TEST_TIMEOUT);

    afterAll(async () => {
        // Cleanup test data
        await cleanupTestData();
        
        // Cleanup search system
        if (searchSystem) {
            await searchSystem.cleanup();
        }
    }, TEST_TIMEOUT);

    beforeEach(async () => {
        // Always create a search system, even if services not available
        // This allows tests to handle unavailable services gracefully
        
        // Create fresh search system for each test with proper config override
        const searchOptions = {
            graphName: testGraphURI,
            limit: 10,
            threshold: 0.5,
            verbose: false
        };
        
        // Create a config that uses the test graph
        const testConfig = {
            ...config,
            get: (key) => {
                if (key === 'storage') {
                    const sparqlEndpoints = config.get('sparqlEndpoints');
                    if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
                        return null; // Let the tests handle this
                    }
                    const sparqlConfig = sparqlEndpoints[0];
                    return {
                        type: 'sparql',
                        options: {
                            query: `${sparqlConfig.urlBase}${sparqlConfig.query || '/query'}`,
                            update: `${sparqlConfig.urlBase}${sparqlConfig.update || '/update'}`,
                            graphName: testGraphURI,
                            user: sparqlConfig.user,
                            password: sparqlConfig.password
                        }
                    };
                }
                return config.get(key);
            }
        };
        
        try {
            searchSystem = new DocumentSearchSystem(testConfig, searchOptions);
        } catch (error) {
            // If configuration fails, create a null system for tests to handle
            searchSystem = null;
        }
    });

    afterEach(async () => {
        if (searchSystem && searchSystem.initialized) {
            await searchSystem.cleanup();
        }
    });

    async function testServiceAvailability() {
        try {
            // Create a test helper for querying to test connectivity
            const sparqlEndpoints = config.get('sparqlEndpoints');
            const sparqlConfig = sparqlEndpoints[0];
            const queryEndpoint = `${sparqlConfig.urlBase}${sparqlConfig.query || '/query'}`;
            
            // Test with simple fetch first
            console.log(`Testing SPARQL endpoint: ${queryEndpoint}`);
            const testResponse = await fetch(queryEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/json'
                },
                body: 'SELECT * WHERE { ?s ?p ?o } LIMIT 1'
            });
            
            console.log(`Response status: ${testResponse ? testResponse.status : 'no response'}, ok: ${testResponse ? testResponse.ok : 'no response'}`);
            
            if (testResponse && testResponse.ok) {
                servicesAvailable = true;
                console.log('✅ SPARQL query service is available');
                
                // Also test update endpoint with fetch
                const updateEndpoint = `${sparqlConfig.urlBase}${sparqlConfig.update || '/update'}`;
                const updateResponse = await fetch(updateEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/sparql-update'
                    },
                    body: `DROP SILENT GRAPH <${testGraphURI}>`
                });
                
                if (updateResponse.ok) {
                    console.log('✅ SPARQL update service is available');
                } else {
                    console.log('⚠️ SPARQL update service not available, but continuing with limited tests');
                }
            } else {
                console.log('❌ SPARQL query service not available');
                servicesAvailable = false;
            }
        } catch (error) {
            console.warn('❌ SPARQL service availability check failed:', error.message);
            servicesAvailable = false;
        }
    }

    async function setupTestData() {
        if (!sparqlHelper) {
            console.warn('No SPARQL helper available, skipping test data setup');
            return;
        }

        try {
            // Clear test graph (ignore errors if graph doesn't exist)
            try {
                const clearQuery = sparqlHelper.createClearGraphQuery(testGraphURI);
                await sparqlHelper.executeUpdate(clearQuery);
            } catch (clearError) {
                console.log('Graph clear failed (graph may not exist, continuing):', clearError.message);
            }

            // Insert test entities using proper INSERT DATA query
            const testTriples = `
                <http://test.com/entity1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/stuff/ragno/Entity> .
                <http://test.com/entity1> <http://www.w3.org/2000/01/rdf-schema#label> "Machine Learning Entity" .
                <http://test.com/entity1> <http://purl.org/stuff/ragno/content> "Machine learning is a subset of artificial intelligence that focuses on algorithms." .
                <http://test.com/entity1> <http://purl.org/stuff/ragno/score> "0.9"^^<http://www.w3.org/2001/XMLSchema#float> .
                <http://test.com/entity1> <http://purl.org/dc/terms/source> <http://test.com/doc1> .
                
                <http://test.com/unit1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/stuff/ragno/Unit> .
                <http://test.com/unit1> <http://www.w3.org/2000/01/rdf-schema#label> "AI Unit" .
                <http://test.com/unit1> <http://purl.org/stuff/ragno/content> "Artificial intelligence encompasses machine learning, deep learning, and neural networks." .
                <http://test.com/unit1> <http://purl.org/stuff/ragno/score> "0.8"^^<http://www.w3.org/2001/XMLSchema#float> .
                <http://test.com/unit1> <http://purl.org/dc/terms/source> <http://test.com/doc1> .
                
                <http://test.com/textelement1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/stuff/ragno/TextElement> .
                <http://test.com/textelement1> <http://www.w3.org/2000/01/rdf-schema#label> "Neural Networks Text" .
                <http://test.com/textelement1> <http://purl.org/stuff/ragno/content> "Neural networks are computing systems inspired by biological neural networks." .
                <http://test.com/textelement1> <http://purl.org/stuff/ragno/score> "0.75"^^<http://www.w3.org/2001/XMLSchema#float> .
                <http://test.com/textelement1> <http://purl.org/dc/terms/source> <http://test.com/doc2> .
                
                <http://test.com/community1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/stuff/ragno/CommunityElement> .
                <http://test.com/community1> <http://www.w3.org/2000/01/rdf-schema#label> "Deep Learning Community" .
                <http://test.com/community1> <http://purl.org/stuff/ragno/content> "Deep learning community focuses on multi-layer neural network architectures." .
                <http://test.com/community1> <http://purl.org/stuff/ragno/score> "0.7"^^<http://www.w3.org/2001/XMLSchema#float> .
                
                <http://test.com/attribute1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/stuff/ragno/Attribute> .
                <http://test.com/attribute1> <http://www.w3.org/2000/01/rdf-schema#label> "Algorithm Attribute" .
                <http://test.com/attribute1> <http://purl.org/stuff/ragno/content> "Algorithms are step-by-step procedures for calculations and data processing." .
                <http://test.com/attribute1> <http://purl.org/stuff/ragno/score> "0.6"^^<http://www.w3.org/2001/XMLSchema#float> .
                
                <http://test.com/rel1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/stuff/ragno/Relationship> .
                <http://test.com/rel1> <http://purl.org/stuff/ragno/hasSourceEntity> <http://test.com/entity1> .
                <http://test.com/rel1> <http://purl.org/stuff/ragno/hasTargetEntity> <http://test.com/unit1> .
                <http://test.com/rel1> <http://purl.org/stuff/ragno/relationshipType> "relatedTo" .
                <http://test.com/rel1> <http://purl.org/stuff/ragno/weight> "0.8"^^<http://www.w3.org/2001/XMLSchema#float> .
                
                <http://test.com/rel2> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/stuff/ragno/Relationship> .
                <http://test.com/rel2> <http://purl.org/stuff/ragno/hasSourceEntity> <http://test.com/unit1> .
                <http://test.com/rel2> <http://purl.org/stuff/ragno/hasTargetEntity> <http://test.com/textelement1> .
                <http://test.com/rel2> <http://purl.org/stuff/ragno/relationshipType> "contains" .
                <http://test.com/rel2> <http://purl.org/stuff/ragno/weight> "0.7"^^<http://www.w3.org/2001/XMLSchema#float> .
                
                <http://test.com/doc1> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/dc/terms/Document> .
                <http://test.com/doc1> <http://www.w3.org/2000/01/rdf-schema#label> "AI Documentation" .
                <http://test.com/doc1> <http://purl.org/stuff/ragno/authorityScore> "0.9"^^<http://www.w3.org/2001/XMLSchema#float> .
                
                <http://test.com/doc2> <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <http://purl.org/dc/terms/Document> .
                <http://test.com/doc2> <http://www.w3.org/2000/01/rdf-schema#label> "Neural Network Guide" .
                <http://test.com/doc2> <http://purl.org/stuff/ragno/authorityScore> "0.8"^^<http://www.w3.org/2001/XMLSchema#float> .
            `;

            const insertQuery = sparqlHelper.createInsertDataQuery(testGraphURI, testTriples);
            await sparqlHelper.executeUpdate(insertQuery);

            console.log('Test data setup completed');
        } catch (error) {
            console.warn('Failed to setup test data:', error.message);
        }
    }

    async function cleanupTestData() {
        if (!sparqlHelper) {
            return;
        }

        try {
            try {
                const clearQuery = sparqlHelper.createClearGraphQuery(testGraphURI);
                await sparqlHelper.executeUpdate(clearQuery);
                console.log('Test data cleanup completed');
            } catch (clearError) {
                console.log('Graph cleanup failed (graph may not exist):', clearError.message);
            }
        } catch (error) {
            console.warn('Failed to cleanup test data:', error.message);
        }
    }

    describe('System Initialization', () => {
        it('should initialize the search system successfully', async () => {
            if (!servicesAvailable) {
                console.log('Skipping test - services not available');
                return;
            }
            
            await searchSystem.initialize();
            
            expect(searchSystem.initialized).toBe(true);
            expect(searchSystem.ragnoSearch).toBeDefined();
            expect(searchSystem.searchFilters).toBeDefined();
            expect(searchSystem.llmHandler).toBeDefined();
            expect(searchSystem.embeddingConnector).toBeDefined();
        }, TEST_TIMEOUT);

        it('should handle initialization with invalid configuration', async () => {
            if (!servicesAvailable) {
                console.log('Skipping test - services not available');
                return;
            }
            
            const invalidConfig = new Config();
            invalidConfig.get = vi.fn().mockReturnValue(null);
            
            expect(() => new DocumentSearchSystem(invalidConfig)).toThrow('No SPARQL storage configuration found');
        }, TEST_TIMEOUT);
    });

    describe('String Query Processing', () => {
        beforeEach(async () => {
            if (servicesAvailable && searchSystem) {
                await searchSystem.initialize();
            }
        });

        it('should process machine learning queries successfully', async () => {
            if (!servicesAvailable) {
                console.log('Skipping test - services not available');
                return;
            }
            
            const results = await searchSystem.processQuery('machine learning');
            
            expect(results).toBeDefined();
            expect(results.query).toBe('machine learning');
            expect(results.results).toBeInstanceOf(Array);
            expect(results.metadata).toBeDefined();
            expect(results.metadata.searchTime).toBeGreaterThan(0);
            expect(results.metadata.searchTime).toBeLessThan(PERFORMANCE_THRESHOLD);
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should handle different search modes', async () => {
            const testModes = ['dual', 'exact', 'similarity', 'traversal'];
            
            for (const mode of testModes) {
                searchSystem.options.mode = mode;
                
                const results = await searchSystem.processQuery('artificial intelligence');
                
                expect(results).toBeDefined();
                expect(results.metadata.searchMode).toBe(mode);
                expect(results.results).toBeInstanceOf(Array);
            }
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should respect result limits and thresholds', async () => {
            searchSystem.options.limit = 3;
            searchSystem.options.threshold = 0.8;
            
            const results = await searchSystem.processQuery('neural networks');
            
            expect(results.results.length).toBeLessThanOrEqual(3);
            expect(results.metadata.relevanceThreshold).toBe(0.8);
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should handle empty or invalid queries gracefully', async () => {
            const emptyResults = await searchSystem.processQuery('');
            expect(emptyResults.results).toHaveLength(0);
            
            const invalidResults = await searchSystem.processQuery('xyzxyzxyz_nonexistent');
            expect(invalidResults.results).toHaveLength(0);
        }, TEST_TIMEOUT);
    });

    describe('URI Query Processing', () => {
        beforeEach(async () => {
            if (servicesAvailable && searchSystem) {
                await searchSystem.initialize();
            }
        });

        it.skipIf(!servicesAvailable)('should process URI queries using traversal', async () => {
            const testURI = 'http://test.com/entity1';
            const results = await searchSystem.processQuery(testURI);
            
            expect(results).toBeDefined();
            expect(results.query).toBe(testURI);
            expect(results.results).toBeInstanceOf(Array);
            expect(results.metadata.searchMode).toBe('dual'); // Should use dual mode by default
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should detect URI queries correctly', async () => {
            const uriQueries = [
                'http://example.org/test',
                'https://example.org/test',
                'http://test.com/entity1'
            ];
            
            for (const uri of uriQueries) {
                expect(searchSystem.detectQueryType(uri)).toBe('uri');
            }
        }, TEST_TIMEOUT);
    });

    describe('Result Formatting', () => {
        beforeEach(async () => {
            if (servicesAvailable && searchSystem) {
                await searchSystem.initialize();
            }
        });

        it.skipIf(!servicesAvailable)('should format results according to format option', async () => {
            // Test detailed format
            searchSystem.options.format = 'detailed';
            const detailedResults = await searchSystem.processQuery('learning');
            
            if (detailedResults.results.length > 0) {
                expect(detailedResults.results[0]).toHaveProperty('uri');
                expect(detailedResults.results[0]).toHaveProperty('type');
                expect(detailedResults.results[0]).toHaveProperty('score');
            }
            
            // Test summary format
            searchSystem.options.format = 'summary';
            const summaryResults = await searchSystem.processQuery('learning');
            
            if (summaryResults.results.length > 0) {
                expect(summaryResults.results[0]).toHaveProperty('uri');
                expect(summaryResults.results[0]).toHaveProperty('summary');
                expect(summaryResults.results[0]).not.toHaveProperty('content');
            }
            
            // Test URI-only format
            searchSystem.options.format = 'uris';
            const uriResults = await searchSystem.processQuery('learning');
            
            if (uriResults.results.length > 0) {
                expect(typeof uriResults.results[0]).toBe('string');
                expect(uriResults.results[0]).toMatch(/^https?:\/\//);
            }
        }, TEST_TIMEOUT);
    });

    describe('Performance and Scalability', () => {
        beforeEach(async () => {
            if (servicesAvailable && searchSystem) {
                await searchSystem.initialize();
            }
        });

        it.skipIf(!servicesAvailable)('should complete searches within performance threshold', async () => {
            const startTime = Date.now();
            
            await searchSystem.processQuery('artificial intelligence machine learning');
            
            const endTime = Date.now();
            const searchTime = endTime - startTime;
            
            expect(searchTime).toBeLessThan(PERFORMANCE_THRESHOLD);
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should handle multiple concurrent searches', async () => {
            const queries = [
                'machine learning',
                'artificial intelligence',
                'neural networks',
                'deep learning',
                'algorithms'
            ];
            
            const searchPromises = queries.map(query => 
                searchSystem.processQuery(query)
            );
            
            const results = await Promise.all(searchPromises);
            
            expect(results).toHaveLength(5);
            results.forEach(result => {
                expect(result).toBeDefined();
                expect(result.metadata.searchTime).toBeLessThan(PERFORMANCE_THRESHOLD);
            });
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should maintain consistent performance across searches', async () => {
            const searchTimes = [];
            const testQuery = 'machine learning algorithms';
            
            // Perform multiple searches
            for (let i = 0; i < 5; i++) {
                const startTime = Date.now();
                await searchSystem.processQuery(testQuery);
                const endTime = Date.now();
                searchTimes.push(endTime - startTime);
            }
            
            // Check performance consistency
            const averageTime = searchTimes.reduce((sum, time) => sum + time, 0) / searchTimes.length;
            const maxTime = Math.max(...searchTimes);
            
            expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLD);
            expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLD * 1.5); // Allow 50% variance
        }, TEST_TIMEOUT);
    });

    describe('Error Handling and Resilience', () => {
        beforeEach(async () => {
            if (servicesAvailable && searchSystem) {
                await searchSystem.initialize();
            }
        });

        it.skipIf(!servicesAvailable)('should handle SPARQL endpoint failures gracefully', async () => {
            // Mock SPARQL failure
            const originalEndpoint = searchSystem.sparqlEndpoint;
            searchSystem.sparqlEndpoint = 'http://invalid-endpoint:9999/sparql';
            
            // Search should still attempt to work with local components
            const results = await searchSystem.processQuery('test query');
            
            expect(results).toBeDefined();
            expect(results.results).toBeInstanceOf(Array);
            
            // Restore original endpoint
            searchSystem.sparqlEndpoint = originalEndpoint;
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should handle LLM service failures gracefully', async () => {
            // Mock LLM failure
            const originalHandler = searchSystem.llmHandler;
            searchSystem.llmHandler = {
                generateResponse: vi.fn().mockRejectedValue(new Error('LLM service unavailable'))
            };
            
            // Search should fall back gracefully
            const results = await searchSystem.processQuery('test query');
            
            expect(results).toBeDefined();
            expect(results.results).toBeInstanceOf(Array);
            
            // Restore original handler
            searchSystem.llmHandler = originalHandler;
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should handle embedding service failures gracefully', async () => {
            // Mock embedding failure
            const originalConnector = searchSystem.embeddingConnector;
            searchSystem.embeddingConnector = {
                generateEmbedding: vi.fn().mockRejectedValue(new Error('Embedding service unavailable'))
            };
            
            // Search should fall back to exact matching
            const results = await searchSystem.processQuery('test query');
            
            expect(results).toBeDefined();
            expect(results.results).toBeInstanceOf(Array);
            
            // Restore original connector
            searchSystem.embeddingConnector = originalConnector;
        }, TEST_TIMEOUT);
    });

    describe('Statistics and Monitoring', () => {
        beforeEach(async () => {
            if (servicesAvailable && searchSystem) {
                await searchSystem.initialize();
            }
        });

        it.skipIf(!servicesAvailable)('should track search statistics correctly', async () => {
            const initialStats = searchSystem.getStatistics();
            
            await searchSystem.processQuery('test query 1');
            await searchSystem.processQuery('test query 2');
            
            const updatedStats = searchSystem.getStatistics();
            
            expect(updatedStats.totalSearches).toBe(initialStats.totalSearches + 2);
            expect(updatedStats.lastSearchTime).toBeGreaterThan(0);
            expect(updatedStats.averageSearchTime).toBeGreaterThan(0);
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should provide comprehensive system status', async () => {
            const status = searchSystem.getStatistics();
            
            expect(status).toHaveProperty('totalSearches');
            expect(status).toHaveProperty('successfulSearches');
            expect(status).toHaveProperty('averageSearchTime');
            expect(status).toHaveProperty('configuration');
            expect(status.configuration).toHaveProperty('mode');
            expect(status.configuration).toHaveProperty('limit');
            expect(status.configuration).toHaveProperty('threshold');
        }, TEST_TIMEOUT);
    });

    describe('Integration with RAG System', () => {
        beforeEach(async () => {
            if (servicesAvailable && searchSystem) {
                await searchSystem.initialize();
            }
        });

        it.skipIf(!servicesAvailable)('should provide compatible search results for RAG pipeline', async () => {
            const results = await searchSystem.processQuery('machine learning applications');
            
            expect(results).toBeDefined();
            expect(results.results).toBeInstanceOf(Array);
            
            // Check that results have the expected structure for RAG integration
            if (results.results.length > 0) {
                const firstResult = results.results[0];
                expect(firstResult).toHaveProperty('uri');
                expect(firstResult).toHaveProperty('content');
                expect(firstResult).toHaveProperty('score');
            }
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should support result ranking for RAG context selection', async () => {
            searchSystem.options.limit = 5;
            const results = await searchSystem.processQuery('neural networks deep learning');
            
            if (results.results.length > 1) {
                // Results should be ranked by relevance
                for (let i = 0; i < results.results.length - 1; i++) {
                    const currentScore = results.results[i].score || 0;
                    const nextScore = results.results[i + 1].score || 0;
                    expect(currentScore).toBeGreaterThanOrEqual(nextScore);
                }
            }
        }, TEST_TIMEOUT);
    });

    describe('Configuration and Customization', () => {
        it.skipIf(!servicesAvailable)('should support different graph configurations', async () => {
            const customGraphSystem = new DocumentSearchSystem(config, {
                graphName: 'http://custom.graph.uri/test',
                limit: 5,
                threshold: 0.9
            });
            
            await customGraphSystem.initialize();
            
            expect(customGraphSystem.graphName).toBe('http://custom.graph.uri/test');
            expect(customGraphSystem.options.limit).toBe(5);
            expect(customGraphSystem.options.threshold).toBe(0.9);
            
            await customGraphSystem.cleanup();
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should support runtime option changes', async () => {
            await searchSystem.initialize();
            
            // Change options
            searchSystem.options.limit = 3;
            searchSystem.options.threshold = 0.8;
            searchSystem.options.format = 'summary';
            
            const results = await searchSystem.processQuery('test query');
            
            expect(results.results.length).toBeLessThanOrEqual(3);
            expect(results.metadata.relevanceThreshold).toBe(0.8);
        }, TEST_TIMEOUT);
    });

    describe('Cleanup and Resource Management', () => {
        it.skipIf(!servicesAvailable)('should cleanup resources properly', async () => {
            await searchSystem.initialize();
            expect(searchSystem.initialized).toBe(true);
            
            await searchSystem.cleanup();
            expect(searchSystem.initialized).toBe(false);
        }, TEST_TIMEOUT);

        it.skipIf(!servicesAvailable)('should handle multiple cleanup calls safely', async () => {
            await searchSystem.initialize();
            
            // Multiple cleanup calls should not throw errors
            await searchSystem.cleanup();
            await searchSystem.cleanup();
            await searchSystem.cleanup();
            
            expect(searchSystem.initialized).toBe(false);
        }, TEST_TIMEOUT);
    });
});