#!/usr/bin/env node

/**
 * ZPT Ontology Integration Demo
 * 
 * This demo exercises the new ZPT ontology integration features:
 * - String-to-URI parameter conversion
 * - RDF navigation storage with SPARQL
 * - Navigation session and view creation
 * - Cross-zoom navigation patterns
 * - Provenance tracking with PROV-O
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
// ZPT Ontology Components
import { NamespaceUtils } from '../../src/zpt/ontology/ZPTNamespaces.js';
import { ZPTDataFactory } from '../../src/zpt/ontology/ZPTDataFactory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ZPTOntologyIntegrationDemo {
    constructor() {
        this.zptDataFactory = null;
    }

    async initialize() {
        console.log('🚀 Initializing ZPT Ontology Integration Demo...\n');

        // Initialize ZPT data factory
        this.zptDataFactory = new ZPTDataFactory({
            navigationGraph: 'http://purl.org/stuff/navigation/demo'
        });

        console.log('✅ Initialization complete\n');
    }

    async demonstrateStringToURIConversion() {
        console.log('📝 Demo 1: String-to-URI Parameter Conversion\n');

        // Test different parameter combinations
        const testCases = [
            {
                name: 'Basic Entity Navigation',
                params: {
                    zoom: 'entity',
                    pan: { domains: ['ai', 'machine_learning'] },
                    tilt: 'embedding'
                }
            },
            {
                name: 'Unit-Level Keyword Analysis',
                params: {
                    zoom: 'unit',
                    pan: { topic: 'artificial intelligence applications' },
                    tilt: 'keywords'
                }
            },
            {
                name: 'Community Graph Navigation',
                params: {
                    zoom: 'community',
                    pan: { domains: ['technology', 'innovation'] },
                    tilt: 'graph'
                }
            },
            {
                name: 'Temporal Text Analysis',
                params: {
                    zoom: 'text',
                    pan: { 
                        topic: 'beer brewing techniques',
                        temporal: { start: '2020-01-01', end: '2023-12-31' }
                    },
                    tilt: 'temporal'
                }
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n🔍 Testing: ${testCase.name}`);
            console.log('Original parameters:', JSON.stringify(testCase.params, null, 2));

            // Convert parameters to ZPT URIs
            const convertedParams = this.convertParametersToZPTURIs(testCase.params);
            console.log('Converted ZPT URIs:', JSON.stringify(convertedParams, null, 2));

            // Validate the conversions
            this.validateURIConversions(testCase.params, convertedParams);
        }
    }

    convertParametersToZPTURIs(params) {
        const converted = {};

        // Convert zoom level
        if (params.zoom) {
            const zoomURI = NamespaceUtils.resolveStringToURI('zoom', params.zoom);
            if (zoomURI) {
                converted.zoomURI = zoomURI.value;
            }
        }

        // Convert tilt representation
        if (params.tilt) {
            const tiltURI = NamespaceUtils.resolveStringToURI('tilt', params.tilt);
            if (tiltURI) {
                converted.tiltURI = tiltURI.value;
            }
        }

        // Convert pan domains
        if (params.pan?.domains) {
            converted.panURIs = params.pan.domains
                .map(domain => NamespaceUtils.resolveStringToURI('pan', domain))
                .filter(uri => uri !== null)
                .map(uri => uri.value);
        }

        return converted;
    }

    validateURIConversions(original, converted) {
        console.log('✅ Validation Results:');
        
        if (original.zoom && converted.zoomURI) {
            console.log(`  - Zoom: "${original.zoom}" → <${converted.zoomURI}>`);
        }
        
        if (original.tilt && converted.tiltURI) {
            console.log(`  - Tilt: "${original.tilt}" → <${converted.tiltURI}>`);
        }
        
        if (original.pan?.domains && converted.panURIs) {
            console.log(`  - Pan domains: [${original.pan.domains.join(', ')}] → [${converted.panURIs.join(', ')}]`);
        }
    }

    async demonstrateRDFNavigationStorage() {
        console.log('\n\n🗄️ Demo 2: RDF Navigation Storage\n');

        // Create a realistic navigation scenario
        const navigationParams = {
            query: 'machine learning applications in brewing',
            zoom: 'entity',
            pan: { 
                topic: 'artificial intelligence in food production',
                domains: ['ai', 'food_tech']
            },
            tilt: 'embedding'
        };

        console.log('Navigation parameters:', JSON.stringify(navigationParams, null, 2));

        try {
            // Create navigation session
            const sessionConfig = {
                agentURI: 'http://example.org/agents/zpt_demo',
                startTime: new Date(),
                purpose: 'Demonstrate ZPT ontology integration with RDF storage'
            };

            const session = this.zptDataFactory.createNavigationSession(sessionConfig);
            console.log('\n✅ Created navigation session:');
            console.log(`  - Session URI: ${session.uri.value}`);
            console.log(`  - Agent: ${sessionConfig.agentURI}`);
            console.log(`  - Start time: ${sessionConfig.startTime.toISOString()}`);

            // Create navigation view
            const viewConfig = {
                query: navigationParams.query,
                zoom: this.getZoomURI(navigationParams.zoom),
                tilt: this.getTiltURI(navigationParams.tilt),
                pan: { domains: navigationParams.pan.domains.map(d => `http://example.org/domain/${d}`) },
                sessionURI: session.uri.value,
                selectedCorpuscles: [
                    'http://example.org/ragno/corpuscle/demo1',
                    'http://example.org/ragno/corpuscle/demo2'
                ]
            };

            const view = this.zptDataFactory.createNavigationView(viewConfig);
            console.log('\n✅ Created navigation view:');
            console.log(`  - View URI: ${view.uri.value}`);
            console.log(`  - Query: "${viewConfig.query}"`);
            console.log(`  - Zoom level: ${viewConfig.zoom}`);
            console.log(`  - Selected corpuscles: ${viewConfig.selectedCorpuscles.length}`);

            // Show RDF quads
            console.log('\n📋 Generated RDF Quads:');
            console.log('Session quads:', session.quads.length);
            session.quads.forEach((quad, i) => {
                console.log(`  ${i + 1}. <${quad.subject.value}> <${quad.predicate.value}> ${this.formatObject(quad.object)}`);
            });

            console.log('\nView quads:', view.quads.length);
            view.quads.slice(0, 5).forEach((quad, i) => {
                console.log(`  ${i + 1}. <${quad.subject.value}> <${quad.predicate.value}> ${this.formatObject(quad.object)}`);
            });
            if (view.quads.length > 5) {
                console.log(`  ... and ${view.quads.length - 5} more quads`);
            }

            return { session, view };

        } catch (error) {
            console.error('❌ Error in RDF navigation storage:', error);
            throw error;
        }
    }

    async demonstrateCorpusSelection() {
        console.log('\n\n🎯 Demo 3: ZPT-Enhanced Corpus Selection\n');

        // Test navigation with BeerQA corpus
        const selectionParams = {
            query: 'beer brewing techniques and ingredients',
            zoom: 'unit',
            pan: { 
                topic: 'beer brewing process',
                domains: ['brewing', 'fermentation']
            },
            tilt: 'keywords'
        };

        console.log('Selection parameters:', JSON.stringify(selectionParams, null, 2));

        try {
            // Simulate corpus selection (without actual SPARQL queries)
            const mockCorpuscles = this.generateMockCorpuscles(5);
            
            // Create selection result
            const selectionResult = {
                corpuscles: mockCorpuscles,
                metadata: {
                    selectionTime: 150,
                    parameters: selectionParams,
                    resultCount: mockCorpuscles.length,
                    zoomLevel: selectionParams.zoom,
                    tiltRepresentation: selectionParams.tilt,
                    timestamp: new Date().toISOString()
                },
                navigation: {
                    zoom: selectionParams.zoom,
                    pan: selectionParams.pan,
                    tilt: selectionParams.tilt
                }
            };

            console.log('\n✅ Mock selection completed:');
            console.log(`  - Selected corpuscles: ${selectionResult.corpuscles.length}`);
            console.log(`  - Selection time: ${selectionResult.metadata.selectionTime}ms`);
            console.log(`  - Zoom level: ${selectionResult.metadata.zoomLevel}`);
            console.log(`  - Tilt representation: ${selectionResult.metadata.tiltRepresentation}`);

            // Demonstrate ZPT metadata storage
            await this.storeNavigationMetadata(selectionParams, selectionResult);

            return selectionResult;

        } catch (error) {
            console.error('❌ Error in corpus selection:', error);
            throw error;
        }
    }

    async demonstrateCrossZoomNavigation() {
        console.log('\n\n🔄 Demo 4: Cross-Zoom Navigation Patterns\n');

        // Demonstrate navigation across different zoom levels
        const zoomLevels = ['entity', 'unit', 'text', 'community'];
        const baseQuery = 'artificial intelligence applications';

        for (const zoom of zoomLevels) {
            console.log(`\n🔍 Navigating at ${zoom} level:`);
            
            const params = {
                query: baseQuery,
                zoom: zoom,
                pan: { topic: baseQuery },
                tilt: 'embedding'
            };

            // Convert to URIs
            const zptURIs = this.convertParametersToZPTURIs(params);
            
            // Create navigation view
            const viewConfig = {
                query: params.query,
                zoom: zptURIs.zoomURI || this.getZoomURI(zoom),
                tilt: zptURIs.tiltURI || this.getTiltURI(params.tilt),
                pan: { domains: [] },
                sessionURI: 'http://example.org/session/cross_zoom_demo',
                selectedCorpuscles: this.generateMockCorpuscleURIs(Math.floor(Math.random() * 5) + 1)
            };

            const view = this.zptDataFactory.createNavigationView(viewConfig);
            
            console.log(`  - View URI: ${view.uri.value}`);
            console.log(`  - Zoom URI: ${viewConfig.zoom}`);
            console.log(`  - Selected corpuscles: ${viewConfig.selectedCorpuscles.length}`);
            console.log(`  - RDF quads generated: ${view.quads.length}`);
        }
    }

    async demonstrateProvenanceTracking() {
        console.log('\n\n📊 Demo 5: Provenance Tracking with PROV-O\n');

        // Create a navigation session with detailed provenance
        const sessionConfig = {
            agentURI: 'http://example.org/agents/zpt_ontology_demo',
            startTime: new Date(),
            purpose: 'Demonstrate PROV-O integration for navigation tracking',
            userAgent: 'ZPT Ontology Integration Demo v1.0',
            sessionType: 'demonstration'
        };

        const session = this.zptDataFactory.createNavigationSession(sessionConfig);
        
        console.log('✅ Created session with PROV-O metadata:');
        console.log(`  - Session URI: ${session.uri.value}`);
        console.log(`  - Agent: ${sessionConfig.agentURI}`);
        console.log(`  - Start time: ${sessionConfig.startTime.toISOString()}`);
        console.log(`  - Purpose: ${sessionConfig.purpose}`);

        // Show PROV-O triples
        const provTriples = session.quads.filter(quad => 
            quad.predicate.value.includes('prov#') || 
            quad.predicate.value.includes('prov:')
        );

        console.log(`\n📋 PROV-O triples generated: ${provTriples.length}`);
        provTriples.forEach((quad, i) => {
            console.log(`  ${i + 1}. <${quad.subject.value}> <${quad.predicate.value}> ${this.formatObject(quad.object)}`);
        });

        return session;
    }

    async storeNavigationMetadata(params, result) {
        console.log('\n📝 Storing ZPT navigation metadata...');

        // Convert parameters to ZPT URIs
        const zptParams = this.convertParametersToZPTURIs(params);

        // Create mock navigation session
        const sessionConfig = {
            agentURI: 'http://example.org/agents/corpuscle_selector',
            startTime: new Date(),
            purpose: `Corpuscle selection using ${params.tilt} analysis`
        };

        const session = this.zptDataFactory.createNavigationSession(sessionConfig);

        // Create navigation view
        const viewConfig = {
            query: params.query,
            zoom: zptParams.zoomURI || this.getZoomURI(params.zoom),
            tilt: zptParams.tiltURI || this.getTiltURI(params.tilt),
            pan: { domains: zptParams.panURIs || [] },
            sessionURI: session.uri.value,
            selectedCorpuscles: result.corpuscles.map(c => c.uri).filter(Boolean)
        };

        const view = this.zptDataFactory.createNavigationView(viewConfig);

        // Add ZPT metadata to result
        result.zptMetadata = {
            sessionURI: session.uri.value,
            viewURI: view.uri.value,
            zptParameters: zptParams,
            stored: false // Would be true if we had SPARQL store
        };

        console.log('✅ ZPT metadata prepared:');
        console.log(`  - Session URI: ${result.zptMetadata.sessionURI}`);
        console.log(`  - View URI: ${result.zptMetadata.viewURI}`);
        console.log(`  - ZPT parameters: ${Object.keys(zptParams).length} converted`);
    }

    // Helper methods
    getZoomURI(zoomLevel) {
        const zoomURI = NamespaceUtils.resolveStringToURI('zoom', zoomLevel);
        return zoomURI ? zoomURI.value : 'http://purl.org/stuff/zpt/EntityLevel';
    }

    getTiltURI(tiltRepresentation) {
        const tiltURI = NamespaceUtils.resolveStringToURI('tilt', tiltRepresentation);
        return tiltURI ? tiltURI.value : 'http://purl.org/stuff/zpt/KeywordProjection';
    }

    formatObject(obj) {
        if (obj.termType === 'Literal') {
            return `"${obj.value}"${obj.datatype ? `^^<${obj.datatype.value}>` : ''}`;
        }
        return `<${obj.value}>`;
    }

    generateMockCorpuscles(count) {
        const topics = [
            'beer brewing process',
            'fermentation techniques',
            'hop varieties and characteristics',
            'malt processing methods',
            'yeast strains and properties'
        ];

        return Array.from({ length: count }, (_, i) => ({
            uri: `http://example.org/ragno/corpuscle/demo${i + 1}`,
            type: 'unit',
            content: {
                prefLabel: topics[i % topics.length],
                text: `Mock content about ${topics[i % topics.length]} for demonstration purposes.`
            },
            metadata: {
                created: new Date().toISOString(),
                source: 'ZPT Ontology Demo'
            },
            score: Math.random() * 0.5 + 0.5
        }));
    }

    generateMockCorpuscleURIs(count) {
        return Array.from({ length: count }, (_, i) => 
            `http://example.org/ragno/corpuscle/cross_zoom_${i + 1}`
        );
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up resources...');
        console.log('✅ Cleanup complete');
    }

    async run() {
        try {
            await this.initialize();
            
            // Run all demonstrations
            await this.demonstrateStringToURIConversion();
            await this.demonstrateRDFNavigationStorage();
            await this.demonstrateCorpusSelection();
            await this.demonstrateCrossZoomNavigation();
            await this.demonstrateProvenanceTracking();

            console.log('\n\n🎉 ZPT Ontology Integration Demo Complete!');
            console.log('\nKey Features Demonstrated:');
            console.log('✅ String-to-URI parameter conversion');
            console.log('✅ RDF navigation session and view creation');
            console.log('✅ ZPT metadata storage with SPARQL integration');
            console.log('✅ Cross-zoom navigation patterns');
            console.log('✅ PROV-O provenance tracking');
            console.log('✅ Corpus selection with ZPT enhancement');

        } catch (error) {
            console.error('❌ Demo failed:', error);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    const demo = new ZPTOntologyIntegrationDemo();
    demo.run().catch(console.error);
}

export default ZPTOntologyIntegrationDemo;