#!/usr/bin/env node

/**
 * 02-ZPTNavigationWithRealData.js - ZPT Ontology Demo with Real BeerQA Data
 * 
 * This demo demonstrates ZPT ontology integration using BeerQA corpus data
 * with multiple navigation parameter scenarios and cross-graph queries.
 * 
 * Features:
 * 1. Navigation scenarios with different parameter combinations
 * 2. Corpus filtering and selection based on ZPT parameters
 * 3. Cross-graph queries between ZPT metadata and corpus content
 * 4. Navigation state creation and storage
 * 5. Multi-phase analysis workflow
 * 
 * Uses direct SPARQL fetch approach for reliable execution
 */

import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import { ZPTDataFactory } from '../../src/zpt/ontology/ZPTDataFactory.js';
import { NamespaceUtils, getSPARQLPrefixes } from '../../src/zpt/ontology/ZPTNamespaces.js';

/**
 * ZPT Navigation Demo with Real Data
 */
class ZPTNavigationDemo {
    constructor() {
        this.config = null;
        this.queryEndpoint = null;
        this.updateEndpoint = null;
        this.dataFactory = null;
        this.sessionURI = null;
        this.navigationViews = [];
        this.stats = {
            corpusclesAnalyzed: 0,
            viewsCreated: 0,
            crossGraphQueries: 0,
            filtersApplied: 0
        };
    }

    /**
     * Initialize demo with proper configuration
     */
    async initialize() {
        console.log(chalk.yellow('⚙️  Initializing ZPT Navigation Demo...'));

        // Load configuration
        this.config = new Config('config/config.json');
        await this.config.init();

        // Setup endpoints from config
        const sparqlEndpoints = this.config.get('sparqlEndpoints');
        if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
            throw new Error('No SPARQL endpoints configured');
        }

        const endpoint = sparqlEndpoints[0];
        this.queryEndpoint = `${endpoint.urlBase}${endpoint.query}`;
        this.updateEndpoint = `${endpoint.urlBase}${endpoint.update}`;

        console.log(chalk.gray(`   Query endpoint: ${this.queryEndpoint}`));

        // Initialize ZPT data factory
        this.dataFactory = new ZPTDataFactory({
            navigationGraph: 'http://purl.org/stuff/navigation'
        });

        console.log(chalk.green('✅ ZPT demo initialized'));
    }

    /**
     * Execute SPARQL query with error handling
     */
    async executeSPARQLQuery(sparql, description = '') {
        try {
            if (description) {
                console.log(chalk.gray(`   🔍 ${description}...`));
            }

            const response = await fetch(this.queryEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-query',
                    'Accept': 'application/sparql-results+json'
                },
                body: sparql
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            if (description) {
                console.log(chalk.green(`   ✅ ${description} successful`));
            }
            return result;

        } catch (error) {
            if (description) {
                console.log(chalk.yellow(`   ⚠️  ${description} failed: ${error.message}`));
            }
            return { results: { bindings: [] } };
        }
    }

    /**
     * Execute SPARQL update with error handling
     */
    async executeSPARQLUpdate(sparql, description = '') {
        try {
            if (description) {
                console.log(chalk.gray(`   📝 ${description}...`));
            }

            const response = await fetch(this.updateEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/sparql-update'
                },
                body: sparql
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (description) {
                console.log(chalk.green(`   ✅ ${description} successful`));
            }
            return response;

        } catch (error) {
            if (description) {
                console.log(chalk.yellow(`   ⚠️  ${description} failed: ${error.message}`));
            }
            return null;
        }
    }

    /**
     * Phase 1: Corpus analysis
     */
    async phase1_CorpusAnalysis() {
        console.log(chalk.bold.cyan('\n📊 Phase 1: BeerQA Corpus Analysis'));
        console.log('='.repeat(70));

        // Analyze corpus distribution by content length
        const lengthAnalysisQuery = getSPARQLPrefixes(['ragno']) + `
SELECT 
    (COUNT(?corpuscle) AS ?total)
    (AVG(STRLEN(?content)) AS ?avgLength)
    (MIN(STRLEN(?content)) AS ?minLength)
    (MAX(STRLEN(?content)) AS ?maxLength)
WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:content ?content .
    }
}`;

        const lengthResult = await this.executeSPARQLQuery(lengthAnalysisQuery, 'Analyzing content length distribution');
        const lengthStats = lengthResult.results.bindings[0];

        if (lengthStats) {
            console.log(chalk.white('📊 Content Length Statistics:'));
            console.log(chalk.gray(`   Total Corpuscles: ${chalk.green(lengthStats.total.value)}`));
            console.log(chalk.gray(`   Average Length: ${chalk.green(Math.round(parseFloat(lengthStats.avgLength.value)))} chars`));
            console.log(chalk.gray(`   Length Range: ${chalk.green(lengthStats.minLength.value)} - ${chalk.green(lengthStats.maxLength.value)} chars`));
            this.stats.corpusclesAnalyzed = parseInt(lengthStats.total.value);
        }

        // Analyze question vs answer patterns
        const patternAnalysisQuery = getSPARQLPrefixes(['ragno']) + `
SELECT ?corpuscle ?content WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:content ?content .
        FILTER(CONTAINS(LCASE(?content), "question:") && CONTAINS(LCASE(?content), "answer:"))
    }
}
LIMIT 5`;

        const patternResult = await this.executeSPARQLQuery(patternAnalysisQuery, 'Analyzing Q&A patterns');
        const patterns = patternResult.results.bindings;

        if (patterns.length > 0) {
            console.log(chalk.white('\n📋 Sample Q&A Patterns:'));
            patterns.forEach((pattern, index) => {
                const content = pattern.content.value;
                const questionMatch = content.match(/Question:\s*([^\\n]*)/i);
                const answerMatch = content.match(/Answer:\s*([^\\n]*)/i);

                console.log(chalk.gray(`  ${index + 1}.`), chalk.cyan(pattern.corpuscle.value));
                if (questionMatch) {
                    console.log(chalk.gray(`     Q: ${questionMatch[1].substring(0, 80)}...`));
                }
                if (answerMatch) {
                    console.log(chalk.gray(`     A: ${answerMatch[1].substring(0, 60)}...`));
                }
            });
        }

        return this.stats.corpusclesAnalyzed;
    }

    /**
     * Phase 2: Parameter scenarios
     */
    async phase2_ParameterScenarios() {
        console.log(chalk.bold.cyan('\n🔄 Phase 2: ZPT Parameter Scenarios'));
        console.log('='.repeat(70));

        const navigationScenarios = [
            {
                name: 'Entity-Level Analysis',
                query: 'entity extraction and classification',
                params: {
                    zoom: 'entity',
                    tilt: 'embedding',
                    pan: ['topic', 'entity'],
                    temporal: 'recent',
                    complexity: 'high'
                }
            },
            {
                name: 'Unit-Level Semantic Mapping',
                query: 'semantic relationships between text units',
                params: {
                    zoom: 'unit',
                    tilt: 'graph',
                    pan: ['topic', 'temporal'],
                    focus: 'relationships',
                    depth: 'deep'
                }
            },
            {
                name: 'Community-Level Clustering',
                query: 'knowledge community detection and analysis',
                params: {
                    zoom: 'community',
                    tilt: 'keywords',
                    pan: ['topic', 'geospatial'],
                    clustering: 'hierarchical',
                    threshold: 'adaptive'
                }
            },
            {
                name: 'Corpus-Level Pattern Analysis',
                query: 'global patterns and anomaly detection',
                params: {
                    zoom: 'corpus',
                    tilt: 'temporal',
                    pan: ['topic', 'entity', 'temporal'],
                    scope: 'global',
                    analysis: 'comprehensive'
                }
            }
        ];

        const convertedScenarios = [];

        console.log(chalk.white('Converting navigation scenarios to ZPT URIs:\n'));

        for (let i = 0; i < navigationScenarios.length; i++) {
            const scenario = navigationScenarios[i];

            console.log(chalk.white(`${i + 1}. ${chalk.yellow(scenario.name)}`));
            console.log(chalk.gray(`   Query: "${scenario.query}"`));
            console.log(chalk.gray(`   Parameters:`));
            console.log(chalk.gray(`     zoom: ${scenario.params.zoom}`));
            console.log(chalk.gray(`     tilt: ${scenario.params.tilt}`));
            console.log(chalk.gray(`     pan: [${scenario.params.pan.join(', ')}]`));

            // Convert core ZPT parameters
            const zoomURI = NamespaceUtils.resolveStringToURI('zoom', scenario.params.zoom);
            const tiltURI = NamespaceUtils.resolveStringToURI('tilt', scenario.params.tilt);
            const panURIs = scenario.params.pan.map(domain =>
                NamespaceUtils.resolveStringToURI('pan', domain)
            ).filter(uri => uri !== null);

            console.log(chalk.cyan(`   ZPT URIs:`));
            console.log(chalk.cyan(`     🔍 zoom: ${zoomURI.value}`));
            console.log(chalk.cyan(`     📐 tilt: ${tiltURI.value}`));
            console.log(chalk.cyan(`     🎯 pan: [${panURIs.map(uri => uri.value).join(', ')}]`));

            // Add additional parameters
            const additionalParams = Object.keys(scenario.params)
                .filter(key => !['zoom', 'tilt', 'pan'].includes(key))
                .map(key => `${key}: ${scenario.params[key]}`);

            if (additionalParams.length > 0) {
                console.log(chalk.gray(`   Additional: [${additionalParams.join(', ')}]`));
            }

            convertedScenarios.push({
                ...scenario,
                zptParams: {
                    zoomURI: zoomURI.value,
                    tiltURI: tiltURI.value,
                    panURIs: panURIs.map(uri => uri.value),
                    additional: scenario.params
                }
            });

            this.stats.filtersApplied++;
            console.log(''); // spacing
        }

        return convertedScenarios;
    }

    /**
     * Phase 3: Create navigation session
     */
    async phase3_CreateNavigationSession() {
        console.log(chalk.bold.cyan('\n🛠️  Phase 3: Navigation Session Creation'));
        console.log('='.repeat(70));

        const sessionConfig = {
            agentURI: 'http://purl.org/stuff/agents/zpt_navigator',
            startTime: new Date(),
            purpose: 'ZPT ontology demonstration with navigation patterns',
            complexity: 'high',
            analysisDepth: 'comprehensive'
        };

        console.log(chalk.white('Creating navigation session...'));
        const session = this.dataFactory.createNavigationSession(sessionConfig);
        this.sessionURI = session.uri.value;

        console.log(chalk.green(`✅ Session created:`));
        console.log(chalk.gray(`   URI: ${chalk.cyan(session.uri.value)}`));
        console.log(chalk.gray(`   Agent: ${sessionConfig.agentURI}`));
        console.log(chalk.gray(`   Purpose: ${sessionConfig.purpose}`));
        console.log(chalk.gray(`   Complexity: ${sessionConfig.complexity}`));
        console.log(chalk.gray(`   Analysis Depth: ${sessionConfig.analysisDepth}`));

        // Store session with metadata
        const sessionTriples = this.generateTriplesFromQuads(session.quads);
        const sessionInsert = getSPARQLPrefixes(['zpt', 'prov']) + `
INSERT DATA {
    GRAPH <http://purl.org/stuff/navigation> {
${sessionTriples}
        <${session.uri.value}> <http://purl.org/stuff/zpt/complexity> "${sessionConfig.complexity}" .
        <${session.uri.value}> <http://purl.org/stuff/zpt/analysisDepth> "${sessionConfig.analysisDepth}" .
    }
}`;

        await this.executeSPARQLUpdate(sessionInsert, 'Storing navigation session');

        return session;
    }

    /**
     * Phase 4: Create navigation views
     */
    async phase4_CreateNavigationViews(scenarios) {
        console.log(chalk.bold.cyan('\n📋 Phase 4: Navigation View Creation'));
        console.log('='.repeat(70));

        console.log(chalk.white(`Creating ${scenarios.length} navigation views...\n`));

        for (let i = 0; i < scenarios.length; i++) {
            const scenario = scenarios[i];

            console.log(chalk.white(`${i + 1}. ${chalk.yellow(scenario.name)}`));
            console.log(chalk.gray(`   Query: "${scenario.query}"`));

            // Create navigation view
            const viewConfig = {
                query: scenario.query,
                zoom: scenario.zptParams.zoomURI,
                tilt: scenario.zptParams.tiltURI,
                pan: { domains: scenario.zptParams.panURIs },
                sessionURI: this.sessionURI,
                selectedCorpuscles: [],
                additionalConfig: scenario.zptParams.additional
            };

            const view = this.dataFactory.createNavigationView(viewConfig);
            this.navigationViews.push(view);
            this.stats.viewsCreated++;

            console.log(chalk.gray(`   View URI: ${view.uri.value}`));

            // Query corpus with filtering
            await this.corpusQuery(view, scenario);

            // Store view with metadata
            await this.storeNavigationView(view, scenario);
            console.log(chalk.green('   ✅ View stored'));
            console.log(''); // spacing
        }

        console.log(chalk.green(`✅ Created ${this.navigationViews.length} navigation views`));
    }

    /**
     * Corpus querying with filters
     */
    async corpusQuery(view, scenario) {
        // Build SPARQL query based on scenario parameters
        let query = getSPARQLPrefixes(['ragno']) + `
SELECT ?corpuscle ?content 
       (STRLEN(?content) AS ?length)
       (SUBSTR(?content, 1, 100) AS ?preview) WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:content ?content .
        
        # Apply filtering based on scenario
        ${this.generateFilter(scenario)}
    }
}
ORDER BY DESC(?length)
LIMIT 3`;

        const result = await this.executeSPARQLQuery(query, `Corpus filtering for ${scenario.name}`);
        const corpuscles = result.results.bindings;

        if (corpuscles.length > 0) {
            console.log(chalk.gray(`   📊 Filter found ${corpuscles.length} matching corpuscles:`));
            corpuscles.forEach((corpuscle, index) => {
                console.log(chalk.gray(`     ${index + 1}. Length: ${corpuscle.length.value} chars`));
                console.log(chalk.gray(`        Preview: ${corpuscle.preview.value}...`));
            });

            // Update view with selected corpuscles
            view.selectedCorpuscles = corpuscles.map(c => c.corpuscle.value);
        }
    }

    /**
     * Generate SPARQL filters based on scenario
     */
    generateFilter(scenario) {
        const params = scenario.params;
        let filters = [];

        // Zoom-level specific filters
        if (params.zoom === 'entity') {
            filters.push('FILTER(CONTAINS(LCASE(?content), "entity") || CONTAINS(LCASE(?content), "concept") || CONTAINS(LCASE(?content), "object"))');
        } else if (params.zoom === 'unit') {
            filters.push('FILTER(CONTAINS(LCASE(?content), "system") || CONTAINS(LCASE(?content), "process") || CONTAINS(LCASE(?content), "method"))');
        } else if (params.zoom === 'community') {
            filters.push('FILTER(CONTAINS(LCASE(?content), "network") || CONTAINS(LCASE(?content), "group") || CONTAINS(LCASE(?content), "cluster"))');
        } else if (params.zoom === 'corpus') {
            filters.push('FILTER(STRLEN(?content) > 500)'); // Focus on longer content
        }

        // Tilt-projection specific filters
        if (params.tilt === 'embedding') {
            filters.push('FILTER(CONTAINS(LCASE(?content), "similar") || CONTAINS(LCASE(?content), "related") || CONTAINS(LCASE(?content), "pattern"))');
        } else if (params.tilt === 'graph') {
            filters.push('FILTER(CONTAINS(LCASE(?content), "connection") || CONTAINS(LCASE(?content), "relationship") || CONTAINS(LCASE(?content), "link"))');
        } else if (params.tilt === 'temporal') {
            filters.push('FILTER(CONTAINS(LCASE(?content), "time") || CONTAINS(LCASE(?content), "period") || CONTAINS(LCASE(?content), "when"))');
        }

        // Complexity-based filters
        if (params.complexity === 'high') {
            filters.push('FILTER(STRLEN(?content) > 800)'); // Longer content
        }

        return filters.length > 0 ? filters.join('\n        ') : '';
    }

    /**
     * Store navigation view
     */
    async storeNavigationView(view, scenario) {
        const viewTriples = this.generateTriplesFromQuads(view.quads);
        const additionalMetadata = Object.entries(scenario.params)
            .filter(([key, value]) => !['zoom', 'tilt', 'pan'].includes(key))
            .map(([key, value]) => `        <${view.uri.value}> <http://purl.org/stuff/zpt/${key}> "${value}" .`)
            .join('\n');

        const viewInsert = getSPARQLPrefixes(['zpt']) + `
INSERT DATA {
    GRAPH <http://purl.org/stuff/navigation> {
${viewTriples}
${additionalMetadata}
    }
}`;

        await this.executeSPARQLUpdate(viewInsert, `Storing view ${view.uri.value}`);
    }

    /**
     * Phase 5: Cross-graph analysis
     */
    async phase5_CrossGraphAnalysis() {
        console.log(chalk.bold.cyan('\n📊 Phase 5: Cross-Graph Analysis'));
        console.log('='.repeat(70));

        const analysisQueries = [
            {
                name: 'Navigation Pattern Analysis',
                description: 'Analyze navigation patterns and correlations',
                sparql: getSPARQLPrefixes(['zpt']) + `
SELECT ?view ?query ?complexity ?analysisDepth ?zoomLevel 
       (COUNT(?selectedCorpuscle) AS ?corpuscleCount) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query ;
              zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] .
        OPTIONAL { ?view <http://purl.org/stuff/zpt/complexity> ?complexity }
        OPTIONAL { ?view <http://purl.org/stuff/zpt/analysisDepth> ?analysisDepth }
        OPTIONAL { ?view zpt:selectedCorpuscle ?selectedCorpuscle }
    }
}
GROUP BY ?view ?query ?complexity ?analysisDepth ?zoomLevel
ORDER BY DESC(?corpuscleCount)`
            },
            {
                name: 'Parameter Distribution Analysis',
                description: 'Distribution of parameters across views',
                sparql: getSPARQLPrefixes(['zpt']) + `
SELECT ?zoomLevel ?tiltProjection 
       (COUNT(?view) AS ?viewCount)
       (AVG(STRLEN(?query)) AS ?avgQueryLength) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query ;
              zpt:hasZoomState [ zpt:atZoomLevel ?zoomLevel ] ;
              zpt:hasTiltState [ zpt:withProjection ?tiltProjection ] .
    }
}
GROUP BY ?zoomLevel ?tiltProjection
ORDER BY DESC(?viewCount)`
            },
            {
                name: 'Corpus-Navigation Correlation Analysis',
                description: 'Correlation between navigation patterns and corpus characteristics',
                sparql: getSPARQLPrefixes(['zpt', 'ragno']) + `
SELECT ?view ?query (COUNT(?corpuscle) AS ?corpuscleCount) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query .
    }
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle .
    }
}
GROUP BY ?view ?query
ORDER BY DESC(?corpuscleCount)
LIMIT 5`
            }
        ];

        for (const queryDef of analysisQueries) {
            console.log(chalk.white(`\n🔍 ${queryDef.name}:`));
            console.log(chalk.gray(`   ${queryDef.description}`));

            const result = await this.executeSPARQLQuery(queryDef.sparql, queryDef.name);
            const bindings = result.results.bindings;
            this.stats.crossGraphQueries++;

            if (bindings.length > 0) {
                console.log(chalk.green(`   ✅ Found ${bindings.length} results`));

                // Display results
                const displayCount = Math.min(bindings.length, 3);
                for (let i = 0; i < displayCount; i++) {
                    const binding = bindings[i];
                    console.log(chalk.gray(`     ${i + 1}.`));
                    Object.entries(binding).forEach(([key, value]) => {
                        let displayValue = value.value;
                        if (displayValue.length > 50) {
                            displayValue = displayValue.substring(0, 50) + '...';
                        }
                        console.log(chalk.gray(`       ${key}:`), chalk.white(displayValue));
                    });
                }

                if (bindings.length > displayCount) {
                    console.log(chalk.gray(`     ... and ${bindings.length - displayCount} more results`));
                }
            } else {
                console.log(chalk.yellow('   ⚠️  No results found for this analysis'));
            }
        }
    }

    /**
     * Display summary
     */
    displaySummary() {
        console.log(chalk.bold.cyan('\n🎉 ZPT Demo Summary'));
        console.log('='.repeat(70));

        console.log(chalk.bold.green('✅ Features Demonstrated:'));
        console.log(chalk.white('📊 Corpus Analysis'));
        console.log(chalk.gray(`   • Analyzed ${this.stats.corpusclesAnalyzed} corpuscles with metrics`));
        console.log(chalk.gray('   • Content length distribution analysis'));
        console.log(chalk.gray('   • Q&A pattern recognition and extraction'));

        console.log(chalk.white('\n🔄 Parameter Scenarios'));
        console.log(chalk.gray(`   • Created ${this.stats.filtersApplied} parameter combinations`));
        console.log(chalk.gray('   • Entity-level analysis'));
        console.log(chalk.gray('   • Unit-level semantic mapping'));
        console.log(chalk.gray('   • Community-level clustering'));
        console.log(chalk.gray('   • Corpus-level pattern analysis'));

        console.log(chalk.white('\n🛠️  Navigation Session'));
        console.log(chalk.gray('   • Created navigation session with metadata'));
        console.log(chalk.gray('   • RDF storage with provenance tracking'));
        console.log(chalk.gray('   • Parameter configuration storage'));

        console.log(chalk.white('\n📋 Navigation Views'));
        console.log(chalk.gray(`   • Generated ${this.stats.viewsCreated} navigation views`));
        console.log(chalk.gray('   • Corpus filtering based on parameters'));
        console.log(chalk.gray('   • Parameter-based selection logic'));
        console.log(chalk.gray('   • Metadata storage in RDF format'));

        console.log(chalk.white('\n📊 Cross-Graph Analysis'));
        console.log(chalk.gray(`   • Executed ${this.stats.crossGraphQueries} analysis queries`));
        console.log(chalk.gray('   • Navigation pattern analysis'));
        console.log(chalk.gray('   • Parameter distribution analysis'));
        console.log(chalk.gray('   • Corpus-navigation correlation'));

        console.log(chalk.bold.cyan('\n💡 Technical Achievements:'));
        console.log(chalk.white('🎯 Parameter Filtering:'), chalk.gray('Multi-parameter corpus selection'));
        console.log(chalk.white('📚 RDF Metadata:'), chalk.gray('Structured RDF annotations'));
        console.log(chalk.white('🔍 Pattern Analysis:'), chalk.gray('Multi-dimensional navigation patterns'));
        console.log(chalk.white('⚡ Live Integration:'), chalk.gray('Real-time SPARQL querying'));
        console.log(chalk.white('🏗️  Extensible Design:'), chalk.gray('Framework for navigation patterns'));

        console.log(chalk.bold.green('\n🚀 ZPT Navigation Demo: COMPLETE'));
        console.log(chalk.white('ZPT ontology navigation patterns have been'));
        console.log(chalk.white('demonstrated with real corpus data and analysis.'));
        console.log('');
    }

    /**
     * Helper: Generate SPARQL triples from RDF quads
     */
    generateTriplesFromQuads(quads) {
        return quads.map(quad => {
            const obj = this.formatRDFObject(quad.object);
            return `        <${quad.subject.value}> <${quad.predicate.value}> ${obj} .`;
        }).join('\n');
    }

    /**
     * Helper: Format RDF object for SPARQL
     */
    formatRDFObject(object) {
        if (object.termType === 'Literal') {
            let formatted = `"${object.value.replace(/"/g, '\\"')}"`;
            if (object.datatype) {
                formatted += `^^<${object.datatype.value}>`;
            } else if (object.language) {
                formatted += `@${object.language}`;
            }
            return formatted;
        } else {
            return `<${object.value}>`;
        }
    }
}

/**
 * Main execution function
 */
async function main() {
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('           🗺️  ZPT NAVIGATION DEMO                      ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('         Navigation patterns with real BeerQA data         ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));

    const demo = new ZPTNavigationDemo();

    try {
        // Execute all demo phases
        console.log(chalk.white('🚀 Starting ZPT navigation demonstration...\n'));

        await demo.initialize();
        const corpuscleCount = await demo.phase1_CorpusAnalysis();

        if (corpuscleCount === 0) {
            console.log(chalk.red('\n❌ No BeerQA data found. Please run: node examples/beerqa/BeerETLDemo.js'));
            process.exit(1);
        }

        const scenarios = await demo.phase2_ParameterScenarios();
        await demo.phase3_CreateNavigationSession();
        await demo.phase4_CreateNavigationViews(scenarios);
        await demo.phase5_CrossGraphAnalysis();

        demo.displaySummary();

        console.log(chalk.green('🎯 All demo phases completed successfully!'));

    } catch (error) {
        console.log(chalk.red('\n❌ Demo failed:'), error.message);
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