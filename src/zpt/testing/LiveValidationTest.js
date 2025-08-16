#!/usr/bin/env node

/**
 * Live Validation Test for Enhanced ZPT Navigation System
 * 
 * Tests all the fixes implemented in the resolution plan:
 * - Enhanced ragno vocabulary with embeddings
 * - Correct graph configuration
 * - Live SPARQL filtering for pan operations
 * - Session continuity
 */

import { EnhancedZPTQueries } from '../enhanced/EnhancedZPTQueries.js';
import { ZPTSessionManager } from '../session/ZPTSessionManager.js';
import CorpuscleSelector from '../selection/CorpuscleSelector.js';
import SPARQLStore from '../../stores/SPARQLStore.js';
import logger from 'loglevel';

logger.setLevel('info');

class LiveValidationTest {
    constructor() {
        this.sparqlStore = new SPARQLStore({
            query: 'http://localhost:3030/semem/query',
            update: 'http://localhost:3030/semem/update'
        }, {
            user: 'admin',
            password: 'admin',
            graphName: 'http://hyperdata.it/content'
        });

        this.enhancedQueries = new EnhancedZPTQueries({
            contentGraph: 'http://hyperdata.it/content',
            navigationGraph: 'http://purl.org/stuff/navigation',
            sparqlStore: this.sparqlStore
        });

        this.sessionManager = new ZPTSessionManager(this.sparqlStore, {
            sessionGraph: 'http://tensegrity.it/semem',
            navigationGraph: 'http://purl.org/stuff/navigation',
            contentGraph: 'http://hyperdata.it/content'
        });

        this.corpuscleSelector = new CorpuscleSelector(null, {
            sparqlStore: this.sparqlStore,
            enableZPTStorage: true,
            navigationGraph: 'http://purl.org/stuff/navigation'
        });

        this.testResults = {
            totalTests: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    async runAllTests() {
        console.log('🚀 Starting Live Validation Tests for Enhanced ZPT Navigation\n');

        try {
            // Test 1: Data availability in correct graphs
            await this.testDataAvailability();

            // Test 2: Enhanced ZPT queries
            await this.testEnhancedQueries();

            // Test 3: Pan filtering functionality
            await this.testPanFiltering();

            // Test 4: Session continuity
            await this.testSessionContinuity();

            // Test 5: Complete ZPT navigation workflow
            await this.testCompleteWorkflow();

            // Summary
            this.printSummary();

        } catch (error) {
            console.error('❌ Test suite failed:', error);
            this.testResults.errors.push(error.message);
        }
    }

    async testDataAvailability() {
        console.log('📊 Test 1: Data Availability in Correct Graphs');
        
        try {
            // Check content graph
            const contentResult = await this.sparqlStore._executeSparqlQuery(`
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                SELECT (COUNT(?item) as ?count) WHERE {
                    GRAPH <http://hyperdata.it/content> {
                        ?item a ragno:TextElement .
                    }
                }
            `, this.sparqlStore.endpoint.query);

            const textElementCount = parseInt((contentResult.results || contentResult.data.results).bindings[0].count.value);
            this.assert(textElementCount > 0, `Found ${textElementCount} TextElements in content graph`);

            // Check embeddings
            const embeddingResult = await this.sparqlStore._executeSparqlQuery(`
                PREFIX ragno: <http://purl.org/stuff/ragno/>
                SELECT (COUNT(?embedding) as ?count) WHERE {
                    GRAPH <http://hyperdata.it/content> {
                        ?item ragno:hasEmbedding ?embedding .
                    }
                }
            `, this.sparqlStore.endpoint.query);

            const embeddingCount = parseInt((embeddingResult.results || embeddingResult.data.results).bindings[0].count.value);
            this.assert(embeddingCount > 0, `Found ${embeddingCount} embedding links`);

            // Check navigation graph
            const navResult = await this.sparqlStore._executeSparqlQuery(`
                PREFIX zpt: <http://purl.org/stuff/zpt/>
                SELECT (COUNT(?session) as ?count) WHERE {
                    GRAPH <http://purl.org/stuff/navigation> {
                        ?session a zpt:NavigationSession .
                    }
                }
            `, this.sparqlStore.endpoint.query);

            const sessionCount = parseInt((navResult.results || navResult.data.results).bindings[0].count.value);
            this.assert(sessionCount >= 0, `Found ${sessionCount} navigation sessions`);

            console.log('✅ Test 1 Passed: Data is available in correct graphs\n');

        } catch (error) {
            this.fail('Test 1 Failed: Data availability check failed', error);
        }
    }

    async testEnhancedQueries() {
        console.log('🔍 Test 2: Enhanced ZPT Queries');

        try {
            // Test entity zoom
            const entityResult = await this.enhancedQueries.executeNavigation({
                zoom: 'entity',
                pan: {},
                tilt: 'keywords',
                query: 'Test entity navigation'
            });

            this.assert(entityResult.success, 'Entity navigation query executed successfully');
            this.assert(Array.isArray(entityResult.results), 'Entity results are array');

            // Test unit zoom
            const unitResult = await this.enhancedQueries.executeNavigation({
                zoom: 'unit',
                pan: {},
                tilt: 'keywords',
                query: 'Test unit navigation'
            });

            this.assert(unitResult.success, 'Unit navigation query executed successfully');
            this.assert(Array.isArray(unitResult.results), 'Unit results are array');

            console.log(`✅ Test 2 Passed: Enhanced queries working (Entity: ${entityResult.results.length}, Unit: ${unitResult.results.length} results)\n`);

        } catch (error) {
            this.fail('Test 2 Failed: Enhanced query execution failed', error);
        }
    }

    async testPanFiltering() {
        console.log('🔽 Test 3: Pan Filtering Functionality');

        try {
            // Test domain filtering
            const domainResult = await this.enhancedQueries.executeNavigation({
                zoom: 'entity',
                pan: { domains: ['machine', 'learning'] },
                tilt: 'keywords',
                query: 'Test domain filtering'
            });

            this.assert(domainResult.success, 'Domain filtering executed successfully');

            // Test keyword filtering  
            const keywordResult = await this.enhancedQueries.executeNavigation({
                zoom: 'unit',
                pan: { keywords: ['text', 'content'] },
                tilt: 'keywords',
                query: 'Test keyword filtering'
            });

            this.assert(keywordResult.success, 'Keyword filtering executed successfully');

            // Test temporal filtering
            const temporalResult = await this.enhancedQueries.executeNavigation({
                zoom: 'text',
                pan: { 
                    temporal: { 
                        start: '2024-01-01',
                        end: '2024-12-31' 
                    }
                },
                tilt: 'temporal',
                query: 'Test temporal filtering'
            });

            this.assert(temporalResult.success, 'Temporal filtering executed successfully');

            console.log(`✅ Test 3 Passed: Pan filtering working (Domain: ${domainResult.results.length}, Keyword: ${keywordResult.results.length}, Temporal: ${temporalResult.results.length} results)\n`);

        } catch (error) {
            this.fail('Test 3 Failed: Pan filtering failed', error);
        }
    }

    async testSessionContinuity() {
        console.log('🔄 Test 4: Session Continuity');

        try {
            // Initialize session
            const session = await this.sessionManager.initializeSession(null, {
                zoom: 'entity',
                pan: {},
                tilt: 'keywords'
            });

            this.assert(session.sessionId, 'Session created with ID');
            this.assert(session.state.zoom === 'entity', 'Initial zoom state set correctly');

            // Update session state
            await this.sessionManager.updateSessionState({
                zoom: 'unit',
                tilt: 'embedding'
            });

            const updatedState = this.sessionManager.getZPTState();
            this.assert(updatedState.zoom === 'unit', 'Session state updated correctly');
            this.assert(updatedState.tilt === 'embedding', 'Tilt state updated correctly');

            // Add navigation result
            await this.sessionManager.addNavigationResult(
                { zoom: 'unit', pan: {}, tilt: 'embedding', query: 'test' },
                [{ item: 'test-result' }],
                { selectionTime: 123 }
            );

            const stats = this.sessionManager.getSessionStats();
            this.assert(stats.interactions > 0, 'Session interactions tracked');

            console.log(`✅ Test 4 Passed: Session continuity working (Session: ${session.sessionId}, Interactions: ${stats.interactions})\n`);

        } catch (error) {
            this.fail('Test 4 Failed: Session continuity failed', error);
        }
    }

    async testCompleteWorkflow() {
        console.log('🌟 Test 5: Complete ZPT Navigation Workflow');

        try {
            // Initialize session
            const session = await this.sessionManager.initializeSession();
            
            // Execute navigation with enhanced corpuscle selector
            const zptParams = {
                zoom: 'entity',
                pan: { domains: ['semantic'] },
                tilt: 'keywords',
                query: 'What semantic concepts are available?'
            };

            const result = await this.corpuscleSelector.selectEnhanced(zptParams);
            
            this.assert(result.metadata.enhanced, 'Enhanced selection used');
            this.assert(Array.isArray(result.corpuscles), 'Corpuscles returned as array');
            this.assert(result.metadata.zoomLevel === 'entity', 'Zoom level tracked correctly');

            // Add result to session
            await this.sessionManager.addNavigationResult(
                zptParams,
                result.corpuscles,
                result.metadata
            );

            // Verify session state
            const finalState = this.sessionManager.getZPTState();
            this.assert(finalState.lastQuery === zptParams.query, 'Query tracked in session');

            console.log(`✅ Test 5 Passed: Complete workflow working (${result.corpuscles.length} corpuscles found)\n`);

        } catch (error) {
            this.fail('Test 5 Failed: Complete workflow failed', error);
        }
    }

    assert(condition, message) {
        this.testResults.totalTests++;
        if (condition) {
            this.testResults.passed++;
            console.log(`  ✅ ${message}`);
        } else {
            this.testResults.failed++;
            console.log(`  ❌ ${message}`);
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    fail(message, error) {
        this.testResults.totalTests++;
        this.testResults.failed++;
        this.testResults.errors.push(`${message}: ${error.message}`);
        console.log(`❌ ${message}`);
        console.error('Error details:', error.message);
        console.log('');
    }

    printSummary() {
        console.log('📋 Test Summary');
        console.log('═'.repeat(50));
        console.log(`Total Tests: ${this.testResults.totalTests}`);
        console.log(`Passed: ${this.testResults.passed}`);
        console.log(`Failed: ${this.testResults.failed}`);
        
        if (this.testResults.errors.length > 0) {
            console.log('\\nErrors:');
            this.testResults.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }

        const successRate = (this.testResults.passed / this.testResults.totalTests * 100).toFixed(1);
        console.log(`\\nSuccess Rate: ${successRate}%`);

        if (this.testResults.failed === 0) {
            console.log('\\n🎉 All tests passed! Enhanced ZPT Navigation is working correctly.');
        } else {
            console.log(`\\n⚠️  ${this.testResults.failed} test(s) failed. Please review the errors above.`);
        }
    }
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new LiveValidationTest();
    test.runAllTests().catch(console.error);
}

export default LiveValidationTest;