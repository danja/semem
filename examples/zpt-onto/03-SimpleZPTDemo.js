#!/usr/bin/env node

/**
 * 03-SimpleZPTDemo.js - Simple ZPT Ontology Demo with Direct SPARQL
 * 
 * This demo uses direct SPARQL queries (like BeerETL) to showcase
 * ZPT ontology integration with real BeerQA data.
 */

import chalk from 'chalk';
import fetch from 'node-fetch';
import { ZPTDataFactory } from '../../src/zpt/ontology/ZPTDataFactory.js';
import { NamespaceUtils, getSPARQLPrefixes } from '../../src/zpt/ontology/ZPTNamespaces.js';

/**
 * Simple SPARQL client that mimics BeerETL approach
 */
class SimpleSPARQLClient {
    constructor() {
        this.queryEndpoint = 'https://fuseki.hyperdata.it/hyperdata.it/query';
        this.updateEndpoint = 'https://fuseki.hyperdata.it/hyperdata.it/update';
    }

    async query(sparql) {
        const response = await fetch(this.queryEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-query',
                'Accept': 'application/sparql-results+json'
            },
            body: sparql
        });

        if (!response.ok) {
            throw new Error(`SPARQL query failed: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    async update(sparql) {
        const response = await fetch(this.updateEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/sparql-update'
            },
            body: sparql
        });

        if (!response.ok) {
            throw new Error(`SPARQL update failed: ${response.status} ${response.statusText}`);
        }

        return response;
    }
}

/**
 * Main demo class
 */
class SimpleZPTDemo {
    constructor() {
        this.sparql = new SimpleSPARQLClient();
        this.dataFactory = new ZPTDataFactory({
            navigationGraph: 'http://purl.org/stuff/navigation'
        });
    }

    /**
     * Check if BeerQA data exists
     */
    async checkBeerQAData() {
        console.log(chalk.yellow('🔍 Checking BeerQA data...'));

        const query = getSPARQLPrefixes(['ragno']) + `
SELECT (COUNT(?corpuscle) AS ?count) WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle .
    }
}`;

        try {
            const result = await this.sparql.query(query);
            const count = parseInt(result.results.bindings[0]?.count?.value || '0');
            console.log(chalk.green(`✅ Found ${count} corpuscles in BeerQA graph`));
            return count;
        } catch (error) {
            console.log(chalk.red(`❌ Failed to check BeerQA data: ${error.message}`));
            return 0;
        }
    }

    /**
     * Get sample corpuscles
     */
    async getSampleCorpuscles() {
        console.log(chalk.yellow('📄 Getting sample corpuscles...'));

        const query = getSPARQLPrefixes(['ragno']) + `
SELECT ?corpuscle ?content WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:content ?content .
    }
}
LIMIT 3`;

        try {
            const result = await this.sparql.query(query);
            const corpuscles = result.results.bindings;

            console.log(chalk.green(`✅ Retrieved ${corpuscles.length} sample corpuscles:`));
            corpuscles.forEach((corpuscle, index) => {
                const preview = corpuscle.content.value.substring(0, 100) + '...';
                console.log(chalk.gray(`  ${index + 1}.`), chalk.white(preview));
            });

            return corpuscles;
        } catch (error) {
            console.log(chalk.red(`❌ Failed to get sample corpuscles: ${error.message}`));
            return [];
        }
    }

    /**
     * Demonstrate parameter conversion
     */
    demonstrateParameterConversion() {
        console.log(chalk.bold.cyan('\n🔄 ZPT Parameter Conversion Demo'));
        console.log('='.repeat(50));

        const scenarios = [
            { zoom: 'entity', tilt: 'keywords', query: 'machine learning' },
            { zoom: 'unit', tilt: 'embedding', query: 'natural language' },
            { zoom: 'community', tilt: 'graph', query: 'artificial intelligence' }
        ];

        const convertedScenarios = [];

        scenarios.forEach((scenario, index) => {
            console.log(chalk.white(`\n${index + 1}. Navigation Scenario:`));
            console.log(chalk.gray(`   Query: "${scenario.query}"`));
            console.log(chalk.gray(`   String params: zoom=${scenario.zoom}, tilt=${scenario.tilt}`));

            // Convert to ZPT URIs
            const zoomURI = NamespaceUtils.resolveStringToURI('zoom', scenario.zoom);
            const tiltURI = NamespaceUtils.resolveStringToURI('tilt', scenario.tilt);

            console.log(chalk.cyan(`   ZPT URIs:`));
            console.log(chalk.cyan(`     zoom: ${zoomURI.value}`));
            console.log(chalk.cyan(`     tilt: ${tiltURI.value}`));

            convertedScenarios.push({
                ...scenario,
                zoomURI: zoomURI.value,
                tiltURI: tiltURI.value
            });
        });

        return convertedScenarios;
    }

    /**
     * Create navigation session
     */
    async createNavigationSession() {
        console.log(chalk.bold.cyan('\n🛠️  Creating Navigation Session'));
        console.log('='.repeat(50));

        const sessionConfig = {
            agentURI: 'http://purl.org/stuff/agents/zpt_simple_demo',
            startTime: new Date(),
            purpose: 'Simple ZPT ontology demonstration'
        };

        const session = this.dataFactory.createNavigationSession(sessionConfig);

        console.log(chalk.white(`✅ Created session: ${chalk.cyan(session.uri.value)}`));
        console.log(chalk.gray(`   Agent: ${sessionConfig.agentURI}`));
        console.log(chalk.gray(`   Purpose: ${sessionConfig.purpose}`));

        // Convert quads to simple SPARQL INSERT
        const triples = session.quads.map(quad => {
            const obj = this.formatRDFObject(quad.object);
            return `    <${quad.subject.value}> <${quad.predicate.value}> ${obj} .`;
        }).join('\n');

        const sparqlUpdate = getSPARQLPrefixes(['zpt', 'prov']) + `
INSERT DATA {
    GRAPH <http://purl.org/stuff/navigation> {
${triples}
    }
}`;

        try {
            await this.sparql.update(sparqlUpdate);
            console.log(chalk.green('✅ Session stored in navigation graph'));
        } catch (error) {
            console.log(chalk.yellow(`⚠️  Session storage failed: ${error.message}`));
        }

        return session;
    }

    /**
     * Create navigation views for scenarios
     */
    async createNavigationViews(scenarios, sessionURI) {
        console.log(chalk.bold.cyan('\n📋 Creating Navigation Views'));
        console.log('='.repeat(50));

        for (let i = 0; i < scenarios.length; i++) {
            const scenario = scenarios[i];

            console.log(chalk.white(`\n${i + 1}. Creating view for: "${chalk.yellow(scenario.query)}"`));

            const viewConfig = {
                query: scenario.query,
                zoom: scenario.zoomURI,
                tilt: scenario.tiltURI,
                sessionURI: sessionURI,
                selectedCorpuscles: []
            };

            const view = this.dataFactory.createNavigationView(viewConfig);

            console.log(chalk.gray(`   View URI: ${view.uri.value}`));
            console.log(chalk.gray(`   Zoom: ${scenario.zoom} → ${scenario.zoomURI}`));
            console.log(chalk.gray(`   Tilt: ${scenario.tilt} → ${scenario.tiltURI}`));

            // Store view in RDF
            try {
                await this.storeNavigationView(view);
                console.log(chalk.green('   ✅ View stored successfully'));
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  View storage failed: ${error.message}`));
            }
        }
    }

    /**
     * Store navigation view in SPARQL
     */
    async storeNavigationView(view) {
        const triples = view.quads.map(quad => {
            const obj = this.formatRDFObject(quad.object);
            return `    <${quad.subject.value}> <${quad.predicate.value}> ${obj} .`;
        }).join('\n');

        const sparqlUpdate = getSPARQLPrefixes(['zpt']) + `
INSERT DATA {
    GRAPH <http://purl.org/stuff/navigation> {
${triples}
    }
}`;

        await this.sparql.update(sparqlUpdate);
    }

    /**
     * Query navigation metadata
     */
    async queryNavigationData() {
        console.log(chalk.bold.cyan('\n📊 Querying Navigation Metadata'));
        console.log('='.repeat(50));

        const queries = [
            {
                name: 'Navigation Sessions',
                sparql: getSPARQLPrefixes(['zpt']) + `
SELECT ?session ?purpose ?timestamp WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?session a zpt:NavigationSession ;
                 zpt:hasPurpose ?purpose ;
                 zpt:navigationTimestamp ?timestamp .
    }
}
ORDER BY DESC(?timestamp)
LIMIT 5`
            },
            {
                name: 'Navigation Views',
                sparql: getSPARQLPrefixes(['zpt']) + `
SELECT ?view ?query ?zoom ?tilt WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query ;
              zpt:hasZoomState [ zpt:atZoomLevel ?zoom ] ;
              zpt:hasTiltState [ zpt:withTiltProjection ?tilt ] .
    }
}
LIMIT 5`
            }
        ];

        for (const query of queries) {
            console.log(chalk.white(`\n🔍 ${query.name}:`));

            try {
                const result = await this.sparql.query(query.sparql);
                const bindings = result.results.bindings;

                console.log(chalk.green(`   ✅ Found ${bindings.length} results`));

                if (bindings.length > 0) {
                    bindings.forEach((binding, index) => {
                        console.log(chalk.gray(`     ${index + 1}.`));
                        Object.entries(binding).forEach(([key, value]) => {
                            const displayValue = value.value.length > 60 ?
                                value.value.substring(0, 60) + '...' : value.value;
                            console.log(chalk.gray(`       ${key}:`), chalk.white(displayValue));
                        });
                    });
                }
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  Query failed: ${error.message}`));
            }
        }
    }

    /**
     * Format RDF object for SPARQL
     */
    formatRDFObject(object) {
        if (object.termType === 'Literal') {
            if (object.datatype) {
                return `"${object.value.replace(/"/g, '\\"')}"^^<${object.datatype.value}>`;
            } else if (object.language) {
                return `"${object.value.replace(/"/g, '\\"')}"@${object.language}`;
            } else {
                return `"${object.value.replace(/"/g, '\\"')}"`;
            }
        } else {
            return `<${object.value}>`;
        }
    }

    /**
     * Display demo summary
     */
    displaySummary() {
        console.log(chalk.bold.cyan('\n🎉 Demo Summary'));
        console.log('='.repeat(50));

        console.log(chalk.white('✅ Successfully demonstrated:'));
        console.log(chalk.gray('  🔍 BeerQA corpus data verification'));
        console.log(chalk.gray('  🔄 String-to-URI parameter conversion'));
        console.log(chalk.gray('  🛠️  RDF navigation session creation'));
        console.log(chalk.gray('  📋 ZPT navigation view creation'));
        console.log(chalk.gray('  📊 SPARQL metadata queries'));

        console.log(chalk.bold.green('\n🚀 Simple ZPT Demo Complete!'));
        console.log(chalk.white('The ZPT ontology integration is working with real data.'));
    }
}

/**
 * Main execution
 */
async function main() {
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🗺️  SIMPLE ZPT ONTOLOGY DEMO               ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('         Direct SPARQL with real BeerQA data             ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));

    const demo = new SimpleZPTDemo();

    try {
        // Check data availability
        const corpuscleCount = await demo.checkBeerQAData();
        if (corpuscleCount === 0) {
            console.log(chalk.red('\n❌ No BeerQA data found. Please run BeerETLDemo.js first.'));
            process.exit(1);
        }

        // Get sample data
        await demo.getSampleCorpuscles();

        // Demonstrate conversion
        const scenarios = demo.demonstrateParameterConversion();

        // Create session
        const session = await demo.createNavigationSession();

        // Create views
        await demo.createNavigationViews(scenarios, session.uri.value);

        // Query results
        await demo.queryNavigationData();

        // Show summary
        demo.displaySummary();

    } catch (error) {
        console.log(chalk.red('❌ Demo failed:'), error.message);
        console.log(chalk.gray('Stack trace:'), error.stack);
        process.exit(1);
    }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error(chalk.red('Fatal error:'), error.message);
        process.exit(1);
    });
}

export { SimpleZPTDemo };