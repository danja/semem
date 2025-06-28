#!/usr/bin/env node

/**
 * ZPTNavigationDemo.js - Complete RDF-based ZPT Navigation Demonstration
 * 
 * This demo shows how to use the ZPT ontology integration with Semem:
 * 1. Create navigation views using RDF and the ZPT ontology
 * 2. Query corpuscles with ZPT parameters converted to URIs
 * 3. Store navigation history with provenance
 * 4. Perform semantic navigation analysis
 * 
 * Prerequisites:
 * - BeerQA data loaded (run examples/beerqa/BeerETLDemo.js)
 * - Embeddings generated (run examples/beerqa/BeerEmbedding.js)
 * - SPARQL endpoint running with data
 */

import chalk from 'chalk';
import logger from 'loglevel';
import Config from '../../src/Config.js';
import SPARQLStore from '../../src/stores/SPARQLStore.js';
import { ZPTDataFactory } from '../../src/zpt/ontology/ZPTDataFactory.js';
import { ZPTQueryBuilder } from '../../src/zpt/ontology/ZPTQueries.js';
import { ZPT_TERMS, NamespaceUtils, getSPARQLPrefixes } from '../../src/zpt/ontology/ZPTNamespaces.js';

// Configure logging
logger.setLevel('info');

/**
 * Display demo header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('            🗺️  ZPT ONTOLOGY NAVIGATION DEMO                 ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('     RDF-based knowledge navigation with formal semantics    ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * Demo configuration and state
 */
class ZPTNavigationDemo {
    constructor() {
        this.config = null;
        this.sparqlStore = null;
        this.dataFactory = null;
        this.queryBuilder = null;
        this.sessionURI = null;
        this.navigationViews = [];
    }

    /**
     * Initialize demo with configuration and connections
     */
    async initialize() {
        console.log(chalk.yellow('⚙️  Initializing ZPT Navigation Demo...'));

        // Load configuration
        this.config = new Config('config/config.json');
        await this.config.init();
        console.log(chalk.green('✅ Configuration loaded'));

        // Setup SPARQL store
        const sparqlEndpoint = this.config.get('sparqlEndpoints.0');
        if (!sparqlEndpoint) {
            throw new Error('No SPARQL endpoint configured');
        }

        const endpoint = {
            query: `${sparqlEndpoint.urlBase}${sparqlEndpoint.query}`,
            update: `${sparqlEndpoint.urlBase}${sparqlEndpoint.update}`
        };

        this.sparqlStore = new SPARQLStore(endpoint, {
            graphName: 'http://purl.org/stuff/navigation',
            user: sparqlEndpoint.user,
            password: sparqlEndpoint.password
        });

        console.log(chalk.green('✅ SPARQL store connected'));

        // Initialize ZPT components
        this.dataFactory = new ZPTDataFactory({
            navigationGraph: 'http://purl.org/stuff/navigation'
        });

        this.queryBuilder = new ZPTQueryBuilder({
            defaultGraph: 'http://purl.org/stuff/navigation',
            ragnoGraph: 'http://purl.org/stuff/ragno',
            beerQAGraph: 'http://purl.org/stuff/beerqa'
        });

        console.log(chalk.green('✅ ZPT components initialized'));
    }

    /**
     * Demonstrate creating a navigation session with RDF provenance
     */
    async demoNavigationSession() {
        console.log(chalk.bold.cyan('\n📍 Demo 1: Creating Navigation Session with RDF Provenance'));
        console.log('='.repeat(70));

        // Create navigation session
        const session = this.dataFactory.createNavigationSession({
            agentURI: 'http://example.org/agents/demo_user',
            startTime: new Date()
        });

        this.sessionURI = session.uri;

        console.log(chalk.white(`🆔 Session URI: ${chalk.cyan(session.uri.value)}`));
        console.log(chalk.white(`⏰ Start Time: ${chalk.cyan(session.startTime.toISOString())}`));

        // Store session in SPARQL
        try {
            for (const quad of session.quads) {
                await this.sparqlStore.addQuad(quad);
            }
            console.log(chalk.green('✅ Navigation session stored in RDF graph'));
        } catch (error) {
            console.log(chalk.yellow('⚠️  Session storage failed (continuing demo):', error.message));
        }

        return session;
    }

    /**
     * Demonstrate string parameter conversion to ZPT URIs
     */
    async demoParameterConversion() {
        console.log(chalk.bold.cyan('\n🔄 Demo 2: Converting String Parameters to ZPT URIs'));
        console.log('='.repeat(70));

        const stringParams = {
            zoom: 'unit',
            tilt: 'embedding',
            pan: { domains: ['ai', 'technology'] }
        };

        console.log(chalk.white('📝 String Parameters:'));
        console.log(chalk.gray('  zoom:'), chalk.white(stringParams.zoom));
        console.log(chalk.gray('  tilt:'), chalk.white(stringParams.tilt));
        console.log(chalk.gray('  pan domains:'), chalk.white(stringParams.pan.domains.join(', ')));

        // Convert to ZPT URIs
        const zptParams = {
            zoomLevel: NamespaceUtils.resolveStringToURI('zoom', stringParams.zoom),
            tiltProjection: NamespaceUtils.resolveStringToURI('tilt', stringParams.tilt),
            panDomains: stringParams.pan.domains.map(domain => 
                NamespaceUtils.resolveStringToURI('pan', domain) || 
                `http://example.org/domains/${domain}`
            )
        };

        console.log(chalk.white('\n🔗 ZPT URI Parameters:'));
        console.log(chalk.gray('  zoom:'), chalk.cyan(zptParams.zoomLevel.value));
        console.log(chalk.gray('  tilt:'), chalk.cyan(zptParams.tiltProjection.value));
        console.log(chalk.gray('  pan domains:'));
        zptParams.panDomains.forEach(domain => {
            console.log(chalk.gray('    -'), chalk.cyan(domain));
        });

        return zptParams;
    }

    /**
     * Demonstrate creating RDF navigation views
     */
    async demoNavigationViewCreation(zptParams) {
        console.log(chalk.bold.cyan('\n📋 Demo 3: Creating RDF Navigation Views'));
        console.log('='.repeat(70));

        const queries = [
            'beer brewing techniques',
            'machine learning in brewing',
            'quality control in beer production'
        ];

        for (const query of queries) {
            console.log(chalk.white(`\n🔍 Creating view for: "${chalk.yellow(query)}"`));

            // Create navigation view
            const viewConfig = {
                query: query,
                zoom: zptParams.zoomLevel.value,
                pan: { domains: zptParams.panDomains.map(d => typeof d === 'string' ? d : d.value) },
                tilt: zptParams.tiltProjection.value,
                sessionURI: this.sessionURI?.value,
                selectedCorpuscles: [] // Will be populated by corpuscle selection
            };

            const navigationView = this.dataFactory.createNavigationView(viewConfig);
            this.navigationViews.push(navigationView);

            console.log(chalk.gray('  📌 View URI:'), chalk.cyan(navigationView.uri.value));
            console.log(chalk.gray('  🔍 Zoom State:'), chalk.white(navigationView.states.zoom.uri.value));
            console.log(chalk.gray('  🔄 Pan State:'), chalk.white(navigationView.states.pan.uri.value));
            console.log(chalk.gray('  📐 Tilt State:'), chalk.white(navigationView.states.tilt.uri.value));

            // Store in SPARQL
            try {
                for (const quad of navigationView.quads) {
                    await this.sparqlStore.addQuad(quad);
                }
                console.log(chalk.green('  ✅ Navigation view stored in RDF'));
            } catch (error) {
                console.log(chalk.yellow('  ⚠️  View storage failed:', error.message));
            }
        }

        return this.navigationViews;
    }

    /**
     * Demonstrate SPARQL querying with ZPT terms
     */
    async demoZPTSPARQLQueries() {
        console.log(chalk.bold.cyan('\n📊 Demo 4: SPARQL Queries with ZPT Ontology Terms'));
        console.log('='.repeat(70));

        const demoQueries = [
            {
                name: 'Navigation Views by Zoom Level',
                query: this.buildNavigationViewsQuery()
            },
            {
                name: 'Corpuscle Selection with ZPT Parameters',
                query: this.buildCorpuscleSelectionQuery()
            },
            {
                name: 'Navigation History Analysis',
                query: this.buildNavigationHistoryQuery()
            }
        ];

        for (const demo of demoQueries) {
            console.log(chalk.white(`\n🔍 ${demo.name}:`));
            console.log(chalk.gray(demo.query.substring(0, 200) + '...'));
            
            try {
                const result = await this.sparqlStore._executeSparqlQuery(demo.query);
                const bindings = result.results?.bindings || [];
                console.log(chalk.green(`  ✅ Query executed successfully - ${bindings.length} results`));
                
                if (bindings.length > 0) {
                    console.log(chalk.gray(`  📄 First result:`));
                    const firstResult = bindings[0];
                    Object.entries(firstResult).forEach(([key, value]) => {
                        console.log(chalk.gray(`    ${key}:`), chalk.white(value.value));
                    });
                }
            } catch (error) {
                console.log(chalk.yellow(`  ⚠️  Query failed: ${error.message}`));
            }
        }
    }

    /**
     * Demonstrate semantic navigation with optimization scores
     */
    async demoSemanticNavigation() {
        console.log(chalk.bold.cyan('\n🎯 Demo 5: Semantic Navigation with Optimization Scores'));
        console.log('='.repeat(70));

        // Simulate corpuscle optimization scores
        const mockCorpuscles = [
            {
                uri: 'http://purl.org/stuff/beerqa/corpuscle/brewing_001',
                optimizationScore: 0.92,
                zoomRelevance: 0.95,
                panCoverage: 0.88,
                tiltEffectiveness: 0.93
            },
            {
                uri: 'http://purl.org/stuff/beerqa/corpuscle/quality_002',
                optimizationScore: 0.87,
                zoomRelevance: 0.90,
                panCoverage: 0.85,
                tiltEffectiveness: 0.86
            }
        ];

        console.log(chalk.white('📊 Adding optimization metadata to corpuscles:'));

        for (const corpuscle of mockCorpuscles) {
            console.log(chalk.gray(`\n🔸 ${corpuscle.uri}`));
            console.log(chalk.gray('  Overall Score:'), chalk.green(corpuscle.optimizationScore));
            console.log(chalk.gray('  Zoom Relevance:'), chalk.blue(corpuscle.zoomRelevance));
            console.log(chalk.gray('  Pan Coverage:'), chalk.yellow(corpuscle.panCoverage));
            console.log(chalk.gray('  Tilt Effectiveness:'), chalk.magenta(corpuscle.tiltEffectiveness));

            // Add optimization metadata as RDF
            const metadataQuads = this.dataFactory.addOptimizationMetadata(
                corpuscle.uri,
                {
                    optimizationScore: corpuscle.optimizationScore,
                    zoomRelevance: corpuscle.zoomRelevance,
                    panCoverage: corpuscle.panCoverage,
                    tiltEffectiveness: corpuscle.tiltEffectiveness
                }
            );

            try {
                for (const quad of metadataQuads) {
                    await this.sparqlStore.addQuad(quad);
                }
                console.log(chalk.green('  ✅ Optimization metadata stored'));
            } catch (error) {
                console.log(chalk.yellow('  ⚠️  Metadata storage failed:', error.message));
            }
        }
    }

    /**
     * Build query for navigation views by zoom level
     */
    buildNavigationViewsQuery() {
        return getSPARQLPrefixes() + `
SELECT ?view ?query ?timestamp ?zoomLevel WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query ;
              zpt:navigationTimestamp ?timestamp ;
              zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] .
    }
}
ORDER BY DESC(?timestamp)
LIMIT 10`;
    }

    /**
     * Build query for corpuscle selection with ZPT parameters
     */
    buildCorpuscleSelectionQuery() {
        return getSPARQLPrefixes() + `
SELECT ?corpuscle ?content ?optimizationScore WHERE {
    # Navigation view with specific parameters
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:hasZoomState [ zpt:atZoomLevel zpt:UnitLevel ] ;
              zpt:hasTiltState [ zpt:withTiltProjection zpt:EmbeddingProjection ] ;
              zpt:selectedCorpuscle ?corpuscle .
        
        OPTIONAL { ?corpuscle zpt:optimizationScore ?optimizationScore }
    }
    
    # Corpuscle content from Ragno/BeerQA graphs
    {
        GRAPH <http://purl.org/stuff/beerqa> {
            ?corpuscle ragno:content ?content .
        }
    } UNION {
        GRAPH <http://purl.org/stuff/ragno> {
            ?corpuscle ragno:content ?content .
        }
    }
}
ORDER BY DESC(?optimizationScore)
LIMIT 5`;
    }

    /**
     * Build query for navigation history analysis
     */
    buildNavigationHistoryQuery() {
        return getSPARQLPrefixes() + `
SELECT ?session ?viewCount ?zoomLevels ?queries WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?session a zpt:NavigationSession .
        
        {
            SELECT ?session 
                   (COUNT(?view) AS ?viewCount)
                   (GROUP_CONCAT(DISTINCT ?zoomLevel; separator=",") AS ?zoomLevels)
                   (GROUP_CONCAT(DISTINCT ?query; separator=" | ") AS ?queries)
            WHERE {
                ?view zpt:partOfSession ?session ;
                      zpt:answersQuery ?query ;
                      zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] .
            }
            GROUP BY ?session
        }
    }
}
ORDER BY DESC(?viewCount)`;
    }

    /**
     * Display demo summary and conclusions
     */
    displaySummary() {
        console.log(chalk.bold.cyan('\n📋 Demo Summary'));
        console.log('='.repeat(70));

        console.log(chalk.white('✅ Successfully demonstrated:'));
        console.log(chalk.gray('  🗺️  RDF-based navigation session creation'));
        console.log(chalk.gray('  🔄 String parameter conversion to ZPT URIs'));
        console.log(chalk.gray('  📋 Navigation view creation with formal semantics'));
        console.log(chalk.gray('  📊 SPARQL queries using ZPT ontology terms'));
        console.log(chalk.gray('  🎯 Semantic navigation with optimization scores'));

        console.log(chalk.white('\n🔧 Technical Achievements:'));
        console.log(chalk.gray('  • Formal RDF representation of navigation states'));
        console.log(chalk.gray('  • Integration of ZPT ontology with Ragno corpus data'));
        console.log(chalk.gray('  • Provenance tracking with PROV-O vocabulary'));
        console.log(chalk.gray('  • Semantic querying across multiple knowledge graphs'));
        console.log(chalk.gray('  • Optimization metadata for intelligent navigation'));

        console.log(chalk.white('\n💡 Benefits:'));
        console.log(chalk.gray('  • Interoperability: Standard vocabulary for knowledge navigation'));
        console.log(chalk.gray('  • Precision: Formal semantics for navigation concepts'));
        console.log(chalk.gray('  • Extensibility: Easy addition of domain-specific terms'));
        console.log(chalk.gray('  • Analytics: Rich querying capabilities for navigation patterns'));
        console.log(chalk.gray('  • Provenance: Complete audit trail of navigation sessions'));

        console.log(chalk.bold.green('\n🎉 ZPT Ontology Integration Demo Complete!'));
        console.log(chalk.white('The ZPT ontology successfully provides formal semantics'));
        console.log(chalk.white('for knowledge navigation with full RDF/SPARQL integration.'));
        console.log('');
    }
}

/**
 * Main demo execution
 */
async function main() {
    displayHeader();

    const demo = new ZPTNavigationDemo();

    try {
        // Initialize demo
        await demo.initialize();

        // Run demo phases
        await demo.demoNavigationSession();
        const zptParams = await demo.demoParameterConversion();
        await demo.demoNavigationViewCreation(zptParams);
        await demo.demoZPTSPARQLQueries();
        await demo.demoSemanticNavigation();

        // Display summary
        demo.displaySummary();

    } catch (error) {
        console.log(chalk.red('❌ Demo failed:'), error.message);
        console.log(chalk.gray('Stack trace:'), error.stack);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Demo interrupted by user'));
    process.exit(0);
});

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error(chalk.red('Fatal error:'), error.message);
        process.exit(1);
    });
}

export { ZPTNavigationDemo };