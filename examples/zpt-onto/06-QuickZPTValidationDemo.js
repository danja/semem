#!/usr/bin/env node

/**
 * 06-QuickZPTValidationDemo.js - Fast ZPT Navigation Validation
 * 
 * This demo quickly validates that the ZPT navigation system works
 * without the time-consuming LLM concept extraction process.
 * Uses pre-existing data and focuses on navigation functionality.
 */

import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import { ZPTDataFactory } from '../../src/zpt/ontology/ZPTDataFactory.js';
import { NamespaceUtils, getSPARQLPrefixes } from '../../src/zpt/ontology/ZPTNamespaces.js';

class QuickZPTValidationDemo {
    constructor() {
        this.config = null;
        this.queryEndpoint = null;
        this.updateEndpoint = null;
        this.dataFactory = null;
        this.sessionURI = null;
    }

    async initialize() {
        console.log(chalk.yellow('⚙️  Initializing Quick ZPT Validation...'));

        // Load configuration
        this.config = new Config('config/config.json');
        await this.config.init();

        // Setup endpoints
        const sparqlEndpoints = this.config.get('sparqlEndpoints');
        const endpoint = sparqlEndpoints[0];
        this.queryEndpoint = `${endpoint.urlBase}${endpoint.query}`;
        this.updateEndpoint = `${endpoint.urlBase}${endpoint.update}`;

        // Initialize ZPT data factory
        this.dataFactory = new ZPTDataFactory({
            navigationGraph: 'http://purl.org/stuff/navigation'
        });

        console.log(chalk.green('✅ Quick ZPT validation system initialized'));
    }

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

            return await response.json();
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  ${description} failed: ${error.message}`));
            return { results: { bindings: [] } };
        }
    }

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
            console.log(chalk.yellow(`   ⚠️  ${description} failed: ${error.message}`));
            return null;
        }
    }

    /**
     * Quick validation of BeerQA data availability
     */
    async validateBeerQAData() {
        console.log(chalk.bold.cyan('\n📊 Validating BeerQA Data'));
        console.log('='.repeat(50));

        const corpuscleQuery = getSPARQLPrefixes(['ragno']) + `
SELECT (COUNT(?corpuscle) AS ?count) WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle .
    }
}`;

        const result = await this.executeSPARQLQuery(corpuscleQuery, 'Counting BeerQA corpuscles');
        const count = parseInt(result.results.bindings[0]?.count?.value || '0');

        if (count > 0) {
            console.log(chalk.green(`✅ Found ${count} corpuscles in BeerQA graph`));
            return true;
        } else {
            console.log(chalk.red('❌ No BeerQA data found'));
            return false;
        }
    }

    /**
     * Test ZPT parameter conversion
     */
    testParameterConversion() {
        console.log(chalk.bold.cyan('\n🔄 Testing ZPT Parameter Conversion'));
        console.log('='.repeat(50));

        const testParams = [
            { type: 'zoom', value: 'entity' },
            { type: 'zoom', value: 'unit' },
            { type: 'tilt', value: 'keywords' },
            { type: 'tilt', value: 'embedding' },
            { type: 'pan', value: 'topic' }
        ];

        let allPassed = true;

        testParams.forEach((param, index) => {
            const uri = NamespaceUtils.resolveStringToURI(param.type, param.value);
            if (uri) {
                console.log(chalk.green(`  ✅ ${param.type}:${param.value} → ${uri.value}`));
            } else {
                console.log(chalk.red(`  ❌ ${param.type}:${param.value} → FAILED`));
                allPassed = false;
            }
        });

        return allPassed;
    }

    /**
     * Create and store navigation session
     */
    async createNavigationSession() {
        console.log(chalk.bold.cyan('\n🛠️  Creating Navigation Session'));
        console.log('='.repeat(50));

        const sessionConfig = {
            agentURI: 'http://example.org/agents/quick_zpt_validator',
            startTime: new Date(),
            purpose: 'Quick ZPT navigation validation demo'
        };

        const session = this.dataFactory.createNavigationSession(sessionConfig);
        this.sessionURI = session.uri.value;

        // Store session
        const sessionTriples = this.generateTriplesFromQuads(session.quads);
        const sessionInsert = getSPARQLPrefixes(['zpt', 'prov']) + `
INSERT DATA {
    GRAPH <http://purl.org/stuff/navigation> {
${sessionTriples}
    }
}`;

        await this.executeSPARQLUpdate(sessionInsert, 'Storing navigation session');
        console.log(chalk.green(`✅ Created session: ${session.uri.value}`));
        return session;
    }

    /**
     * Test navigation view creation
     */
    async testNavigationViews() {
        console.log(chalk.bold.cyan('\n📋 Testing Navigation Views'));
        console.log('='.repeat(50));

        const testScenarios = [
            {
                name: 'Simple Entity Navigation',
                query: 'test query',
                zoom: 'entity',
                tilt: 'keywords',
                pan: ['topic']
            },
            {
                name: 'Unit Level Embedding',
                query: 'another test',
                zoom: 'unit', 
                tilt: 'embedding',
                pan: ['entity']
            }
        ];

        let viewsCreated = 0;

        for (const scenario of testScenarios) {
            console.log(chalk.white(`\nCreating view: ${scenario.name}`));
            
            const viewConfig = {
                query: scenario.query,
                zoom: NamespaceUtils.resolveStringToURI('zoom', scenario.zoom).value,
                tilt: NamespaceUtils.resolveStringToURI('tilt', scenario.tilt).value,
                pan: { domains: scenario.pan.map(d => NamespaceUtils.resolveStringToURI('pan', d).value) },
                sessionURI: this.sessionURI,
                selectedCorpuscles: []
            };

            const view = this.dataFactory.createNavigationView(viewConfig);
            
            // Store view
            const viewTriples = this.generateTriplesFromQuads(view.quads);
            const viewInsert = getSPARQLPrefixes(['zpt']) + `
INSERT DATA {
    GRAPH <http://purl.org/stuff/navigation> {
${viewTriples}
    }
}`;

            await this.executeSPARQLUpdate(viewInsert, `Storing view: ${scenario.name}`);
            console.log(chalk.gray(`  View URI: ${view.uri.value}`));
            viewsCreated++;
        }

        return viewsCreated;
    }

    /**
     * Validate stored navigation data
     */
    async validateNavigationData() {
        console.log(chalk.bold.cyan('\n📊 Validating Navigation Data'));
        console.log('='.repeat(50));

        // Check sessions
        const sessionQuery = getSPARQLPrefixes(['zpt']) + `
SELECT (COUNT(?session) AS ?sessionCount) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?session a zpt:NavigationSession .
    }
}`;

        const sessionResult = await this.executeSPARQLQuery(sessionQuery, 'Counting navigation sessions');
        const sessionCount = parseInt(sessionResult.results.bindings[0]?.sessionCount?.value || '0');

        // Check views
        const viewQuery = getSPARQLPrefixes(['zpt']) + `
SELECT (COUNT(?view) AS ?viewCount) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView .
    }
}`;

        const viewResult = await this.executeSPARQLQuery(viewQuery, 'Counting navigation views');
        const viewCount = parseInt(viewResult.results.bindings[0]?.viewCount?.value || '0');

        console.log(chalk.white(`📊 Results:`));
        console.log(chalk.gray(`  Sessions: ${sessionCount}`));
        console.log(chalk.gray(`  Views: ${viewCount}`));

        return { sessions: sessionCount, views: viewCount };
    }

    /**
     * Display validation summary
     */
    displayValidationSummary(results) {
        console.log(chalk.bold.cyan('\n🎉 Quick ZPT Validation Summary'));
        console.log('='.repeat(50));

        console.log(chalk.bold.green('✅ Components Validated:'));
        console.log(chalk.white('🔧 Import System'), 
            results.importsWorking ? chalk.green('WORKING') : chalk.red('FAILED'));
        console.log(chalk.white('📊 BeerQA Data'), 
            results.beerqaAvailable ? chalk.green('AVAILABLE') : chalk.red('MISSING'));
        console.log(chalk.white('🔄 Parameter Conversion'), 
            results.parameterConversion ? chalk.green('WORKING') : chalk.red('FAILED'));
        console.log(chalk.white('🛠️  Session Creation'), 
            results.sessionCreated ? chalk.green('WORKING') : chalk.red('FAILED'));
        console.log(chalk.white('📋 View Creation'), 
            results.viewsCreated > 0 ? chalk.green('WORKING') : chalk.red('FAILED'));
        console.log(chalk.white('📊 Data Storage'), 
            results.dataStored ? chalk.green('WORKING') : chalk.red('FAILED'));

        const allWorking = results.importsWorking && results.beerqaAvailable && 
                          results.parameterConversion && results.sessionCreated &&
                          results.viewsCreated > 0 && results.dataStored;

        if (allWorking) {
            console.log(chalk.bold.green('\n🚀 ZPT Navigation System: FULLY FUNCTIONAL'));
            console.log(chalk.white('All core components are working correctly.'));
        } else {
            console.log(chalk.bold.yellow('\n⚠️  ZPT Navigation System: PARTIAL FUNCTIONALITY'));
            console.log(chalk.white('Some components need attention.'));
        }
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
    console.log(chalk.bold.blue('║') + chalk.bold.white('           ⚡ QUICK ZPT VALIDATION DEMO              ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('      Fast validation of ZPT navigation components     ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));

    const demo = new QuickZPTValidationDemo();
    const results = {
        importsWorking: false,
        beerqaAvailable: false,
        parameterConversion: false,
        sessionCreated: false,
        viewsCreated: 0,
        dataStored: false
    };

    try {
        console.log(chalk.white('🚀 Starting quick ZPT validation...\n'));

        // Test imports and initialization
        await demo.initialize();
        results.importsWorking = true;

        // Validate data availability
        results.beerqaAvailable = await demo.validateBeerQAData();
        
        // Test parameter conversion
        results.parameterConversion = demo.testParameterConversion();
        
        // Create navigation session
        await demo.createNavigationSession();
        results.sessionCreated = true;
        
        // Test navigation views
        results.viewsCreated = await demo.testNavigationViews();
        
        // Validate stored data
        const storedData = await demo.validateNavigationData();
        results.dataStored = storedData.sessions > 0 && storedData.views > 0;

        demo.displayValidationSummary(results);

        console.log(chalk.green('\n🎯 Quick ZPT validation completed!'));

    } catch (error) {
        console.log(chalk.red('\n❌ Quick ZPT validation failed:'), error.message);
        console.log(chalk.gray('Stack trace:'), error.stack);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Quick validation interrupted by user'));
    process.exit(0);
});

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error(chalk.red('Fatal error:'), error.message);
        process.exit(1);
    });
}

export { QuickZPTValidationDemo };