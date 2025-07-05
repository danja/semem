#!/usr/bin/env node

/**
 * EntityRanking.js - Apply K-core + Centrality to Rank Wikipedia Entities
 * 
 * This script applies graph analytics algorithms (K-core decomposition and betweenness
 * centrality) to rank Wikipedia corpuscles by structural importance. The rankings are
 * then exported back to the SPARQL store as ragno:Attribute nodes for use in enhanced
 * target discovery and navigation.
 * 
 * Key Features:
 * - Uses GraphBuilder to create graph from SPARQL data
 * - Applies K-core decomposition to identify structurally important nodes
 * - Calculates betweenness centrality for bridge node identification
 * - Combines multiple metrics into composite importance scores
 * - Exports rankings back to SPARQL store as ragno:Attribute nodes
 * - Supports domain/topic filtering for focused analysis
 */

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../../src/Config.js';
import RagnoAlgorithms from '../../../src/ragno/algorithms/index.js';
import { GraphBuilder } from './GraphBuilder.js';
import SPARQLHelper from '../../../src/services/sparql/SPARQLHelper.js';

// Configure logging
logger.setLevel('info');

/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              📊 ENTITY RANKING                            ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    K-core + Centrality analysis for importance ranking     ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * EntityRanking class for analyzing and ranking entities by importance
 */
class EntityRanking {
    constructor(config, options = {}) {
        // Get SPARQL configuration from Config instance
        const storageOptions = config.get('storage.options');
        
        this.options = {
            sparqlEndpoint: storageOptions.update,
            sparqlAuth: { 
                user: storageOptions.user, 
                password: storageOptions.password 
            },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/test',
            timeout: options.timeout || 30000,

            // Algorithm options
            maxGraphSize: options.maxGraphSize || 1000,
            enableKCore: options.enableKCore !== false,
            enableCentrality: options.enableCentrality !== false,
            topKResults: options.topKResults || 20,

            // Export options
            exportToSPARQL: options.exportToSPARQL !== false,
            updateExisting: options.updateExisting !== false,

            ...options
        };

        // Initialize components
        this.graphBuilder = new GraphBuilder(this.options);
        this.algorithms = new RagnoAlgorithms({
            logProgress: false,
            maxIterations: 1000,
            convergenceThreshold: 1e-6
        });

        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });

        this.stats = {
            corpusclesAnalyzed: 0,
            kCoreResults: 0,
            centralityResults: 0,
            rankingsGenerated: 0,
            rankingsExported: 0,
            processingTime: 0,
            errors: []
        };
    }

    /**
     * Run complete entity ranking analysis
     * @returns {Object} Ranking results and statistics
     */
    async runEntityRanking() {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting entity ranking analysis...'));

        try {
            // Phase 1: Build graph from SPARQL data
            console.log(chalk.white('📊 Building graph from SPARQL store...'));
            const graphResult = await this.graphBuilder.buildCompleteGraph();

            if (graphResult.dataset.size === 0) {
                console.log(chalk.yellow('⚠️  Empty dataset - no ranking to perform'));
                return { success: false, message: 'Empty dataset' };
            }

            // Phase 2: Run graph analytics
            console.log(chalk.white('🧮 Running graph analytics algorithms...'));
            const analysisResults = await this.algorithms.runFullAnalysis(graphResult.dataset, {
                exportToRDF: false
            });

            // Phase 3: Extract and process ranking results
            console.log(chalk.white('📈 Processing ranking results...'));
            const rankings = this.processAnalysisResults(analysisResults);

            // Phase 4: Export rankings to SPARQL store
            if (this.options.exportToSPARQL && rankings.length > 0) {
                console.log(chalk.white('💾 Exporting rankings to SPARQL store...'));
                await this.exportRankingsToSPARQL(rankings);
            }

            // Calculate final statistics
            this.stats.processingTime = Date.now() - startTime;

            console.log(chalk.green('✅ Entity ranking completed successfully'));
            this.displayResults(rankings);

            return {
                success: true,
                rankings: rankings,
                analysisResults: analysisResults,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Entity ranking failed: ${error.message}`);
            console.log(chalk.red('❌ Entity ranking failed:', error.message));
            throw error;
        }
    }

    /**
     * Process analysis results to generate entity rankings
     * @param {Object} analysisResults - Results from graph analytics
     * @returns {Array} Array of ranked entities with scores
     */
    processAnalysisResults(analysisResults) {
        console.log(chalk.gray('   Processing K-core and centrality results...'));

        const rankings = [];
        const entityScores = new Map();

        // Process K-core results
        if (this.options.enableKCore && analysisResults.kCore?.coreNumbers) {
            console.log(chalk.gray(`   ✓ Processing ${analysisResults.kCore.coreNumbers.size} K-core results`));

            for (const [nodeUri, coreNumber] of analysisResults.kCore.coreNumbers) {
                if (!entityScores.has(nodeUri)) {
                    entityScores.set(nodeUri, { kCore: 0, centrality: 0, composite: 0 });
                }
                entityScores.get(nodeUri).kCore = coreNumber;
                this.stats.kCoreResults++;
            }
        }

        // Process centrality results (if available for smaller graphs)
        if (this.options.enableCentrality && analysisResults.centrality?.centrality) {
            console.log(chalk.gray(`   ✓ Processing ${analysisResults.centrality.centrality.size} centrality results`));

            for (const [nodeUri, centralityScore] of analysisResults.centrality.centrality) {
                if (!entityScores.has(nodeUri)) {
                    entityScores.set(nodeUri, { kCore: 0, centrality: 0, composite: 0 });
                }
                entityScores.get(nodeUri).centrality = centralityScore;
                this.stats.centralityResults++;
            }
        }

        // Calculate composite scores and create rankings
        for (const [nodeUri, scores] of entityScores) {
            // Weighted composite score (K-core: 60%, Centrality: 40%)
            const compositeScore = (scores.kCore * 0.6) + (scores.centrality * 0.4);
            scores.composite = compositeScore;

            rankings.push({
                nodeUri: nodeUri,
                kCoreScore: scores.kCore,
                centralityScore: scores.centrality,
                compositeScore: compositeScore,
                rank: 0 // Will be assigned after sorting
            });
        }

        // Sort by composite score and assign ranks
        rankings.sort((a, b) => b.compositeScore - a.compositeScore);
        rankings.forEach((ranking, index) => {
            ranking.rank = index + 1;
        });

        this.stats.corpusclesAnalyzed = entityScores.size;
        this.stats.rankingsGenerated = rankings.length;

        console.log(chalk.gray(`   ✓ Generated ${rankings.length} entity rankings`));

        // Return top-K results if requested
        if (this.options.topKResults > 0) {
            return rankings.slice(0, this.options.topKResults);
        }

        return rankings;
    }

    /**
     * Export rankings to SPARQL store as ragno:Attribute nodes
     * @param {Array} rankings - Array of entity rankings
     */
    async exportRankingsToSPARQL(rankings) {
        console.log(chalk.gray(`   Exporting ${rankings.length} rankings to SPARQL store...`));

        const timestamp = new Date().toISOString();
        const batchSize = 10;
        let exported = 0;

        try {
            // Process rankings in batches
            for (let i = 0; i < rankings.length; i += batchSize) {
                const batch = rankings.slice(i, i + batchSize);
                const triples = [];

                for (const ranking of batch) {
                    const attributeURI = `${ranking.nodeUri}_importance_ranking_${Date.now()}_${Math.random().toString(36).substring(7)}`;

                    // Create ranking attribute triples
                    triples.push(`<${attributeURI}> rdf:type ragno:Attribute .`);
                    triples.push(`<${attributeURI}> rdfs:label "importance-ranking" .`);
                    triples.push(`<${attributeURI}> ragno:attributeType "importance-ranking" .`);
                    triples.push(`<${attributeURI}> ragno:attributeValue "${ranking.compositeScore.toFixed(6)}" .`);
                    triples.push(`<${attributeURI}> ragno:rank "${ranking.rank}"^^xsd:integer .`);
                    triples.push(`<${attributeURI}> ragno:kCoreScore "${ranking.kCoreScore.toFixed(6)}" .`);
                    triples.push(`<${attributeURI}> ragno:centralityScore "${ranking.centralityScore.toFixed(6)}" .`);
                    triples.push(`<${attributeURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
                    triples.push(`<${attributeURI}> prov:wasGeneratedBy "entity-ranking-analysis" .`);

                    // Link to the entity
                    triples.push(`<${ranking.nodeUri}> ragno:hasAttribute <${attributeURI}> .`);
                    triples.push(`<${attributeURI}> ragno:describesCorpuscle <${ranking.nodeUri}> .`);
                }

                // Execute batch update
                const updateQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
PREFIX dcterms: <http://purl.org/dc/terms/>
PREFIX prov: <http://www.w3.org/ns/prov#>

INSERT DATA {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ${triples.join('\n        ')}
    }
}`;

                const result = await this.sparqlHelper.executeUpdate(updateQuery);

                if (result.success) {
                    exported += batch.length;
                    console.log(chalk.gray(`   ✓ Exported batch ${Math.ceil((i + batchSize) / batchSize)}/${Math.ceil(rankings.length / batchSize)} (${exported}/${rankings.length})`));
                } else {
                    this.stats.errors.push(`Failed to export batch: ${result.error}`);
                    console.log(chalk.red(`   ❌ Failed to export batch: ${result.error}`));
                }

                // Small delay between batches
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.stats.rankingsExported = exported;
            console.log(chalk.gray(`   ✅ Successfully exported ${exported} entity rankings`));

        } catch (error) {
            this.stats.errors.push(`SPARQL export failed: ${error.message}`);
            console.log(chalk.red(`   ❌ SPARQL export failed: ${error.message}`));
            throw error;
        }
    }

    /**
     * Query existing rankings from SPARQL store
     * @returns {Array} Existing rankings
     */
    async queryExistingRankings() {
        console.log(chalk.white('🔍 Querying existing rankings...'));

        const query = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?ranking ?rank ?compositeScore ?kCoreScore ?centralityScore
WHERE {
    GRAPH <${this.options.wikipediaGraphURI}> {
        ?corpuscle ragno:hasAttribute ?ranking .
        ?ranking ragno:attributeType "importance-ranking" ;
                ragno:attributeValue ?compositeScore ;
                ragno:rank ?rank .
        
        OPTIONAL { ?ranking ragno:kCoreScore ?kCoreScore }
        OPTIONAL { ?ranking ragno:centralityScore ?centralityScore }
    }
}
ORDER BY ?rank
`;

        const result = await this.sparqlHelper.executeSelect(query);

        if (!result.success) {
            console.log(chalk.yellow(`⚠️  Could not query existing rankings: ${result.error}`));
            return [];
        }

        const rankings = result.data.results.bindings.map(binding => ({
            nodeUri: binding.corpuscle.value,
            rank: parseInt(binding.rank.value),
            compositeScore: parseFloat(binding.compositeScore.value),
            kCoreScore: binding.kCoreScore ? parseFloat(binding.kCoreScore.value) : 0,
            centralityScore: binding.centralityScore ? parseFloat(binding.centralityScore.value) : 0
        }));

        console.log(`   ✓ Found ${rankings.length} existing rankings`);
        return rankings;
    }

    /**
     * Display ranking results
     * @param {Array} rankings - Array of entity rankings
     */
    displayResults(rankings) {
        console.log('');
        console.log(chalk.bold.white('📊 Entity Ranking Results:'));
        console.log(`   ${chalk.cyan('Entities Analyzed:')} ${chalk.white(this.stats.corpusclesAnalyzed)}`);
        console.log(`   ${chalk.cyan('Rankings Generated:')} ${chalk.white(this.stats.rankingsGenerated)}`);
        console.log(`   ${chalk.cyan('Rankings Exported:')} ${chalk.white(this.stats.rankingsExported)}`);
        console.log(`   ${chalk.cyan('K-core Results:')} ${chalk.white(this.stats.kCoreResults)}`);
        console.log(`   ${chalk.cyan('Centrality Results:')} ${chalk.white(this.stats.centralityResults)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);

        if (this.stats.errors.length > 0) {
            console.log(`   ${chalk.cyan('Errors:')} ${chalk.red(this.stats.errors.length)}`);
            this.stats.errors.forEach(error => {
                console.log(`     ${chalk.red('•')} ${error}`);
            });
        }

        console.log('');

        // Display top rankings
        if (rankings.length > 0) {
            console.log(chalk.bold.white('🏆 Top Entity Rankings:'));
            const topRankings = rankings.slice(0, Math.min(10, rankings.length));

            for (let i = 0; i < topRankings.length; i++) {
                const ranking = topRankings[i];
                const shortUri = ranking.nodeUri.split('/').pop();
                console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(shortUri)} `);
                console.log(`      ${chalk.gray('Composite:')} ${chalk.white(ranking.compositeScore.toFixed(4))} `);
                console.log(`      ${chalk.gray('K-core:')} ${chalk.white(ranking.kCoreScore.toFixed(4))} `);
                console.log(`      ${chalk.gray('Centrality:')} ${chalk.white(ranking.centralityScore.toFixed(4))}`);
            }
        }

        console.log('');
    }
}

/**
 * Main function for command-line usage
 */
async function rankEntities() {
    displayHeader();

    try {
        // Initialize Config.js for proper configuration management
        const config = new Config('config/config.json');
        await config.init();
        
        const options = {
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/test',
            timeout: 30000,

            // Algorithm configuration
            maxGraphSize: 1000,
            enableKCore: true,
            enableCentrality: true, // Will be skipped if graph is too large
            topKResults: 20,

            // Export configuration
            exportToSPARQL: true,
            updateExisting: false
        };

        // Display configuration with actual SPARQL endpoint from config
        const displayConfig = {
            sparqlEndpoint: config.get('storage.options.update'),
            sparqlAuth: { 
                user: config.get('storage.options.user'), 
                password: config.get('storage.options.password') 
            },
            ...options
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(displayConfig.sparqlEndpoint)}`);
        console.log(`   ${chalk.cyan('Wikipedia Graph:')} ${chalk.white(displayConfig.wikipediaGraphURI)}`);
        console.log(`   ${chalk.cyan('Max Graph Size:')} ${chalk.white(displayConfig.maxGraphSize)}`);
        console.log(`   ${chalk.cyan('Top-K Results:')} ${chalk.white(displayConfig.topKResults)}`);
        console.log(`   ${chalk.cyan('Export to SPARQL:')} ${chalk.white(displayConfig.exportToSPARQL ? 'Yes' : 'No')}`);
        console.log('');

        // Run entity ranking
        const ranker = new EntityRanking(config, options);
        const result = await ranker.runEntityRanking();

        if (result.success) {
            console.log(chalk.green('🎉 Entity ranking completed successfully!'));
            console.log(chalk.white('Rankings have been stored in the SPARQL store and are ready for use.'));
        } else {
            console.log(chalk.yellow('⚠️  Entity ranking completed with issues:', result.message));
        }

        return result;

    } catch (error) {
        console.log(chalk.red('❌ Entity ranking failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { EntityRanking };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    rankEntities().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}