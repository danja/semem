#!/usr/bin/env node

/**
 * Simplified Navigate Plan Test
 * Tests core ZPT navigation functionality systematically
 */

import { EnhancedZPTQueries } from '../enhanced/EnhancedZPTQueries.js';
import { ZPTSessionManager } from '../session/ZPTSessionManager.js';
import SPARQLStore from '../../stores/SPARQLStore.js';
import logger from 'loglevel';

logger.setLevel('info');

class SimpleNavigatePlanTest {
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

        this.results = {
            total: 0,
            passed: 0,
            failed: 0,
            errors: []
        };
    }

    async runTests() {
        console.log('🧪 Simple Navigate Plan Test Matrix\n');

        // Initialize session
        await this.sessionManager.initializeSession();

        // Phase 1: Zoom Level Tests
        await this.testZoomLevels();

        // Phase 2: Pan Filter Tests  
        await this.testPanFilters();

        // Phase 3: Tilt Projection Tests
        await this.testTiltProjections();

        // Phase 4: Performance Tests
        await this.testPerformance();

        this.printResults();
    }

    async testZoomLevels() {
        console.log('🔍 Testing Zoom Levels');

        const zoomTests = [
            { zoom: 'entity', query: 'What machine learning concepts exist?' },
            { zoom: 'unit', query: 'Show semantic web information' },
            { zoom: 'text', query: 'Find recent documentation' },
            { zoom: 'community', query: 'What topic clusters exist?' },
            { zoom: 'corpus', query: 'Overall knowledge structure' }
        ];

        for (const test of zoomTests) {
            await this.executeTest(`Zoom: ${test.zoom}`, async () => {
                const result = await this.enhancedQueries.executeNavigation({
                    zoom: test.zoom,
                    pan: {},
                    tilt: 'keywords',
                    query: test.query
                });
                
                if (!result.success) {
                    throw new Error('Navigation failed');
                }
                
                console.log(`  ✅ ${test.zoom} zoom: ${result.results.length} results`);
            });
        }
    }

    async testPanFilters() {
        console.log('🔽 Testing Pan Filters');

        const panTests = [
            { 
                name: 'Domain filter',
                pan: { domains: ['machine', 'learning'] },
                query: 'Find ML content'
            },
            {
                name: 'Keyword filter', 
                pan: { keywords: ['semantic', 'navigation'] },
                query: 'Find semantic navigation content'
            },
            {
                name: 'Temporal filter',
                pan: { temporal: { start: '2024-01-01' } },
                query: 'Find recent content'
            }
        ];

        for (const test of panTests) {
            await this.executeTest(`Pan: ${test.name}`, async () => {
                const result = await this.enhancedQueries.executeNavigation({
                    zoom: 'entity',
                    pan: test.pan,
                    tilt: 'keywords',
                    query: test.query
                });
                
                if (!result.success) {
                    throw new Error('Pan filtering failed');
                }
                
                console.log(`  ✅ ${test.name}: ${result.results.length} results`);
            });
        }
    }

    async testTiltProjections() {
        console.log('📐 Testing Tilt Projections');

        const tiltTests = [
            { tilt: 'keywords', query: 'Find AI concepts' },
            { tilt: 'embedding', query: 'Similar to machine learning' },
            { tilt: 'graph', query: 'Connected to knowledge graphs' },
            { tilt: 'temporal', query: 'Evolution of concepts' }
        ];

        for (const test of tiltTests) {
            await this.executeTest(`Tilt: ${test.tilt}`, async () => {
                const result = await this.enhancedQueries.executeNavigation({
                    zoom: 'entity',
                    pan: {},
                    tilt: test.tilt,
                    query: test.query
                });
                
                if (!result.success) {
                    throw new Error('Tilt projection failed');
                }
                
                console.log(`  ✅ ${test.tilt} tilt: ${result.results.length} results`);
            });
        }
    }

    async testPerformance() {
        console.log('⚡ Testing Performance');

        const performanceTests = [
            { name: 'Simple query', zoom: 'entity', pan: {}, tilt: 'keywords' },
            { name: 'Complex pan', zoom: 'unit', pan: { domains: ['ai'], keywords: ['learning'] }, tilt: 'embedding' },
            { name: 'Graph tilt', zoom: 'entity', pan: {}, tilt: 'graph' }
        ];

        for (const test of performanceTests) {
            await this.executeTest(`Performance: ${test.name}`, async () => {
                const startTime = Date.now();
                
                const result = await this.enhancedQueries.executeNavigation({
                    zoom: test.zoom,
                    pan: test.pan,
                    tilt: test.tilt,
                    query: `Performance test: ${test.name}`
                });
                
                const responseTime = Date.now() - startTime;
                
                if (!result.success) {
                    throw new Error('Performance test failed');
                }
                
                if (responseTime > 5000) {
                    throw new Error(`Response time too slow: ${responseTime}ms`);
                }
                
                console.log(`  ✅ ${test.name}: ${responseTime}ms, ${result.results.length} results`);
            });
        }
    }

    async executeTest(name, testFn) {
        this.results.total++;
        
        try {
            await testFn();
            this.results.passed++;
        } catch (error) {
            this.results.failed++;
            this.results.errors.push(`${name}: ${error.message}`);
            console.log(`  ❌ ${name}: ${error.message}`);
        }
    }

    printResults() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 SIMPLE NAVIGATE PLAN TEST RESULTS');
        console.log('='.repeat(60));
        
        console.log(`\nTotal Tests: ${this.results.total}`);
        console.log(`Passed: ${this.results.passed}`);
        console.log(`Failed: ${this.results.failed}`);
        
        const successRate = (this.results.passed / this.results.total * 100).toFixed(1);
        console.log(`Success Rate: ${successRate}%`);
        
        if (this.results.errors.length > 0) {
            console.log('\n❌ Errors:');
            this.results.errors.forEach((error, index) => {
                console.log(`  ${index + 1}. ${error}`);
            });
        }
        
        console.log('\n' + '='.repeat(60));
        
        if (successRate >= 90) {
            console.log('🎉 NAVIGATE PLAN TEST: SUCCESSFUL');
        } else if (successRate >= 75) {
            console.log('⚠️  NAVIGATE PLAN TEST: PARTIALLY SUCCESSFUL');
        } else {
            console.log('❌ NAVIGATE PLAN TEST: NEEDS IMPROVEMENT');
        }
        
        console.log('='.repeat(60));
    }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const test = new SimpleNavigatePlanTest();
    test.runTests().catch(console.error);
}

export default SimpleNavigatePlanTest;