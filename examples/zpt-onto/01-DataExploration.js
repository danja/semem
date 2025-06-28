#!/usr/bin/env node

/**
 * 01-DataExploration-Fixed.js - Working Data Explorer using Direct SPARQL
 * 
 * This script examines what data is available in the SPARQL store using 
 * direct fetch requests (same approach as working demos).
 */

import chalk from 'chalk';
import fetch from 'node-fetch';
import Config from '../../src/Config.js';
import { getSPARQLPrefixes } from '../../src/zpt/ontology/ZPTNamespaces.js';

/**
 * Working data exploration utility using direct SPARQL
 */
class WorkingDataExplorer {
    constructor() {
        this.config = null;
        this.queryEndpoint = null;
        this.updateEndpoint = null;
        this.stats = {
            beerQACorpuscles: 0,
            ragnoEntities: 0,
            zptViews: 0,
            totalGraphs: 0
        };
    }

    /**
     * Initialize configuration and endpoints
     */
    async initialize() {
        console.log(chalk.yellow('⚙️  Initializing data exploration...'));

        // Load configuration
        this.config = new Config('config/config.json');
        await this.config.init();

        // Setup endpoints from config
        const sparqlEndpoints = this.config.get('sparqlEndpoints');
        if (!sparqlEndpoints || sparqlEndpoints.length === 0) {
            throw new Error('No SPARQL endpoints configured. Please check your config.');
        }

        const endpoint = sparqlEndpoints[0];
        this.queryEndpoint = `${endpoint.urlBase}${endpoint.query}`;
        this.updateEndpoint = `${endpoint.urlBase}${endpoint.update}`;

        console.log(chalk.gray(`   Query endpoint: ${this.queryEndpoint}`));
        console.log(chalk.green('✅ Endpoints configured'));
    }

    /**
     * Execute SPARQL query with proper error handling
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
                console.log(chalk.green(`   ✅ ${description} completed`));
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
     * Explore available named graphs
     */
    async exploreAvailableGraphs() {
        console.log(chalk.bold.cyan('\n📊 Available Named Graphs'));
        console.log('='.repeat(60));

        const query = `
SELECT DISTINCT ?graph WHERE {
    GRAPH ?graph {
        ?s ?p ?o .
    }
}
ORDER BY ?graph`;

        const result = await this.executeSPARQLQuery(query, 'Discovering named graphs');
        const graphs = result.results.bindings;
        this.stats.totalGraphs = graphs.length;

        if (graphs.length > 0) {
            console.log(chalk.green(`✅ Found ${graphs.length} named graphs:`));
            graphs.forEach((graph, index) => {
                console.log(chalk.gray(`  ${index + 1}.`), chalk.cyan(graph.graph.value));
            });
        } else {
            console.log(chalk.yellow('⚠️  No named graphs found'));
        }

        return graphs;
    }

    /**
     * Explore BeerQA graph structure
     */
    async exploreBeerQAGraph() {
        console.log(chalk.bold.cyan('\n📊 BeerQA Graph Structure'));
        console.log('='.repeat(60));

        // Count total corpuscles
        const countQuery = getSPARQLPrefixes(['ragno']) + `
SELECT (COUNT(DISTINCT ?corpuscle) AS ?count) WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle .
    }
}`;

        const countResult = await this.executeSPARQLQuery(countQuery, 'Counting BeerQA corpuscles');
        const corpuscleCount = parseInt(countResult.results.bindings[0]?.count?.value || '0');
        this.stats.beerQACorpuscles = corpuscleCount;

        console.log(chalk.white(`🔍 Corpuscle Count: ${chalk.green(corpuscleCount)}`));

        if (corpuscleCount > 0) {
            // Get sample corpuscles
            const sampleQuery = getSPARQLPrefixes(['ragno']) + `
SELECT ?corpuscle ?content 
       (SUBSTR(?content, 1, 120) AS ?preview)
       (STRLEN(?content) AS ?length) WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:content ?content .
    }
}
ORDER BY ?corpuscle
LIMIT 3`;

            const sampleResult = await this.executeSPARQLQuery(sampleQuery, 'Getting sample corpuscles');
            const samples = sampleResult.results.bindings;

            if (samples.length > 0) {
                console.log(chalk.white('\n📄 Sample Corpuscles:'));
                samples.forEach((sample, index) => {
                    console.log(chalk.gray(`  ${index + 1}.`), chalk.cyan(sample.corpuscle.value));
                    console.log(chalk.gray(`     Length: ${sample.length.value} chars`));
                    console.log(chalk.gray(`     Preview: ${sample.preview.value}...`));
                });
            }

            // Count corpuscles with embeddings
            const embeddingQuery = getSPARQLPrefixes(['ragno']) + `
SELECT (COUNT(DISTINCT ?corpuscle) AS ?count) WHERE {
    GRAPH <http://purl.org/stuff/beerqa> {
        ?corpuscle a ragno:Corpuscle ;
                   ragno:hasEmbedding ?embedding .
    }
}`;

            const embeddingResult = await this.executeSPARQLQuery(embeddingQuery, 'Counting corpuscles with embeddings');
            const embeddingCount = parseInt(embeddingResult.results.bindings[0]?.count?.value || '0');
            console.log(chalk.white(`🔍 Corpuscles with Embeddings: ${chalk.green(embeddingCount)}`));

        } else {
            console.log(chalk.yellow('⚠️  No BeerQA data found. Run BeerETLDemo.js to load data.'));
        }

        return corpuscleCount;
    }

    /**
     * Explore Ragno graph structure  
     */
    async exploreRagnoGraph() {
        console.log(chalk.bold.cyan('\n📊 Ragno Graph Structure'));
        console.log('='.repeat(60));

        // Count entities
        const entityQuery = getSPARQLPrefixes(['ragno']) + `
SELECT (COUNT(DISTINCT ?entity) AS ?count) WHERE {
    GRAPH <http://purl.org/stuff/ragno> {
        ?entity a ragno:Entity .
    }
}`;

        const entityResult = await this.executeSPARQLQuery(entityQuery, 'Counting Ragno entities');
        const entityCount = parseInt(entityResult.results.bindings[0]?.count?.value || '0');
        this.stats.ragnoEntities = entityCount;

        console.log(chalk.white(`🔍 Entity Count: ${chalk.green(entityCount)}`));

        // Count units
        const unitQuery = getSPARQLPrefixes(['ragno']) + `
SELECT (COUNT(DISTINCT ?unit) AS ?count) WHERE {
    GRAPH <http://purl.org/stuff/ragno> {
        ?unit a ragno:Unit .
    }
}`;

        const unitResult = await this.executeSPARQLQuery(unitQuery, 'Counting Ragno units');
        const unitCount = parseInt(unitResult.results.bindings[0]?.count?.value || '0');

        console.log(chalk.white(`🔍 Unit Count: ${chalk.green(unitCount)}`));

        // Count relationships
        const relationshipQuery = getSPARQLPrefixes(['ragno']) + `
SELECT (COUNT(DISTINCT ?relationship) AS ?count) WHERE {
    GRAPH <http://purl.org/stuff/ragno> {
        ?relationship a ragno:Relationship .
    }
}`;

        const relationshipResult = await this.executeSPARQLQuery(relationshipQuery, 'Counting Ragno relationships');
        const relationshipCount = parseInt(relationshipResult.results.bindings[0]?.count?.value || '0');

        console.log(chalk.white(`🔍 Relationship Count: ${chalk.green(relationshipCount)}`));

        if (entityCount > 0) {
            // Get sample entities
            const sampleEntityQuery = getSPARQLPrefixes(['ragno']) + `
SELECT ?entity ?label ?type WHERE {
    GRAPH <http://purl.org/stuff/ragno> {
        ?entity a ragno:Entity ;
                rdfs:label ?label .
        OPTIONAL { ?entity rdf:type ?type }
    }
}
LIMIT 3`;

            const sampleEntityResult = await this.executeSPARQLQuery(sampleEntityQuery, 'Getting sample entities');
            const sampleEntities = sampleEntityResult.results.bindings;

            if (sampleEntities.length > 0) {
                console.log(chalk.white('\n📄 Sample Entities:'));
                sampleEntities.forEach((entity, index) => {
                    console.log(chalk.gray(`  ${index + 1}.`), chalk.cyan(entity.entity.value));
                    console.log(chalk.gray(`     Label: ${entity.label.value}`));
                    if (entity.type) {
                        console.log(chalk.gray(`     Type: ${entity.type.value}`));
                    }
                });
            }
        } else {
            console.log(chalk.yellow('⚠️  No Ragno entities found. Run Ragno examples to create entities.'));
        }

        return { entityCount, unitCount, relationshipCount };
    }

    /**
     * Explore ZPT navigation graph
     */
    async exploreZPTGraph() {
        console.log(chalk.bold.cyan('\n📊 ZPT Navigation Graph'));
        console.log('='.repeat(60));

        // Count navigation views
        const viewQuery = getSPARQLPrefixes(['zpt']) + `
SELECT (COUNT(DISTINCT ?view) AS ?count) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView .
    }
}`;

        const viewResult = await this.executeSPARQLQuery(viewQuery, 'Counting navigation views');
        const viewCount = parseInt(viewResult.results.bindings[0]?.count?.value || '0');
        this.stats.zptViews = viewCount;

        console.log(chalk.white(`🔍 Navigation Views: ${chalk.green(viewCount)}`));

        // Count navigation sessions
        const sessionQuery = getSPARQLPrefixes(['zpt']) + `
SELECT (COUNT(DISTINCT ?session) AS ?count) WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?session a zpt:NavigationSession .
    }
}`;

        const sessionResult = await this.executeSPARQLQuery(sessionQuery, 'Counting navigation sessions');
        const sessionCount = parseInt(sessionResult.results.bindings[0]?.count?.value || '0');

        console.log(chalk.white(`🔍 Navigation Sessions: ${chalk.green(sessionCount)}`));

        if (viewCount > 0) {
            // Get sample navigation views
            const sampleViewQuery = getSPARQLPrefixes(['zpt']) + `
SELECT ?view ?query ?timestamp WHERE {
    GRAPH <http://purl.org/stuff/navigation> {
        ?view a zpt:NavigationView ;
              zpt:answersQuery ?query .
        OPTIONAL { ?view zpt:navigationTimestamp ?timestamp }
    }
}
ORDER BY DESC(?timestamp)
LIMIT 3`;

            const sampleViewResult = await this.executeSPARQLQuery(sampleViewQuery, 'Getting sample navigation views');
            const sampleViews = sampleViewResult.results.bindings;

            if (sampleViews.length > 0) {
                console.log(chalk.white('\n📄 Sample Navigation Views:'));
                sampleViews.forEach((view, index) => {
                    console.log(chalk.gray(`  ${index + 1}.`), chalk.cyan(view.view.value));
                    console.log(chalk.gray(`     Query: "${view.query.value}"`));
                    if (view.timestamp) {
                        console.log(chalk.gray(`     Timestamp: ${view.timestamp.value}`));
                    }
                });
            }
        } else {
            console.log(chalk.yellow('⚠️  No ZPT navigation data found. Run ZPT demos to create navigation views.'));
        }

        return { viewCount, sessionCount };
    }

    /**
     * Display comprehensive summary
     */
    displaySummary() {
        console.log(chalk.bold.cyan('\n🎉 Data Exploration Summary'));
        console.log('='.repeat(60));

        console.log(chalk.white('📊 Data Statistics:'));
        console.log(chalk.gray(`   Total Named Graphs: ${chalk.green(this.stats.totalGraphs)}`));
        console.log(chalk.gray(`   BeerQA Corpuscles: ${chalk.green(this.stats.beerQACorpuscles)}`));
        console.log(chalk.gray(`   Ragno Entities: ${chalk.green(this.stats.ragnoEntities)}`));
        console.log(chalk.gray(`   ZPT Navigation Views: ${chalk.green(this.stats.zptViews)}`));

        console.log(chalk.white('\n💡 Recommendations:'));
        
        if (this.stats.beerQACorpuscles === 0) {
            console.log(chalk.yellow('   ⚠️  Load BeerQA data: node examples/beerqa/BeerETLDemo.js'));
        } else {
            console.log(chalk.green('   ✅ BeerQA data is available for ZPT demos'));
        }

        if (this.stats.ragnoEntities === 0) {
            console.log(chalk.yellow('   ⚠️  Generate Ragno entities: node examples/ragno/RagnoPipelineDemo.js'));
        } else {
            console.log(chalk.green('   ✅ Ragno entities are available for graph analysis'));
        }

        if (this.stats.zptViews === 0) {
            console.log(chalk.yellow('   ⚠️  Create ZPT navigation data: node examples/zpt-onto/03-SimpleZPTDemo.js'));
        } else {
            console.log(chalk.green('   ✅ ZPT navigation data is available'));
        }

        console.log(chalk.white('\n🚀 Next Steps:'));
        if (this.stats.beerQACorpuscles > 0) {
            console.log(chalk.white('   • Run comprehensive ZPT demo: node examples/zpt-onto/04-ComprehensiveZPTDemo.js'));
            console.log(chalk.white('   • Explore ZPT navigation: node examples/zpt-onto/03-SimpleZPTDemo.js'));
        }
        console.log(chalk.white('   • Create additional corpus data with Ragno examples'));
        console.log(chalk.white('   • Test cross-graph queries between ZPT and corpus data'));

        console.log(chalk.bold.green('\n✅ Data Exploration Complete!'));
    }
}

/**
 * Main execution
 */
async function main() {
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              🔍 ZPT DATA EXPLORATION                     ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('           Working data explorer with direct SPARQL       ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));

    const explorer = new WorkingDataExplorer();

    try {
        await explorer.initialize();
        await explorer.exploreAvailableGraphs();
        await explorer.exploreBeerQAGraph();
        await explorer.exploreRagnoGraph();
        await explorer.exploreZPTGraph();
        explorer.displaySummary();

        console.log(chalk.green('\n🎯 Data exploration completed successfully!'));

    } catch (error) {
        console.log(chalk.red('\n❌ Data exploration failed:'), error.message);
        console.log(chalk.gray('Stack trace:'), error.stack);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log(chalk.yellow('\n🛑 Exploration interrupted by user'));
    process.exit(0);
});

// Run the exploration
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error(chalk.red('Fatal error:'), error.message);
        process.exit(1);
    });
}

export { WorkingDataExplorer };