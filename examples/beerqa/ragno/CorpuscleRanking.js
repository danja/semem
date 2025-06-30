#!/usr/bin/env node

/**
 * CorpuscleRanking.js - Rank BeerQA Corpuscles Using Graph Analytics
 * 
 * This script adapts graph analytics algorithms to work with the current BeerQA data
 * structure that uses corpuscles rather than formal entities/relationships. It creates
 * a graph based on similarity relationships between corpuscles and applies ranking
 * algorithms to identify structurally important ones.
 * 
 * Key Features:
 * - Builds graph from existing corpuscle similarity relationships
 * - Creates synthetic entity graph from corpuscle connections
 * - Applies K-core decomposition and centrality analysis
 * - Ranks corpuscles by structural importance
 * - Exports rankings back to SPARQL store
 */

import path from 'path';
import logger from 'loglevel';
import chalk from 'chalk';
import Config from '../../../src/Config.js';
import GraphAnalytics from '../../../src/ragno/algorithms/GraphAnalytics.js';
import { GraphBuilder } from './GraphBuilder.js';
import SPARQLHelper from '../SPARQLHelper.js';

// Configure logging
logger.setLevel('info');


/**
 * Display header
 */
function displayHeader() {
    console.log('');
    console.log(chalk.bold.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.bold.blue('║') + chalk.bold.white('              📊 CORPUSCLE RANKING                         ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('║') + chalk.gray('    Graph analytics adapted for BeerQA corpuscle structure   ') + chalk.bold.blue('║'));
    console.log(chalk.bold.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log('');
}

/**
 * CorpuscleRanking class for analyzing corpuscle importance
 */
class CorpuscleRanking {
    constructor(config, options = {}) {

        this.GRAPH_NODES_MAX = 1000

        // Use Config.js for SPARQL configuration
        const storageOptions = config.get('storage.options');

        this.options = {
            sparqlEndpoint: options.sparqlEndpoint || storageOptions.update,
            sparqlAuth: options.sparqlAuth || {
                user: storageOptions.user,
                password: storageOptions.password
            },
            beerqaGraphURI: options.beerqaGraphURI || 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: options.wikipediaGraphURI || 'http://purl.org/stuff/wikipedia/research',
            timeout: options.timeout || 30000,

            // Algorithm options
            enableKCore: options.enableKCore !== false,
            enableCentrality: options.enableCentrality !== false,
            similarityThreshold: options.similarityThreshold || 0.3,
            topKResults: options.topKResults || 20,

            // Export options
            exportToSPARQL: options.exportToSPARQL !== false,

            ...options
        };

        // Initialize components
        this.graphAnalytics = new GraphAnalytics({
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
            relationshipsFound: 0,
            syntheticEdgesCreated: 0,
            kCoreResults: 0,
            centralityResults: 0,
            rankingsGenerated: 0,
            rankingsExported: 0,
            processingTime: 0,
            errors: []
        };
    }

    /**
     * Run corpuscle ranking analysis
     * @returns {Object} Ranking results and statistics
     */
    async runCorpuscleRanking() {
        const startTime = Date.now();
        console.log(chalk.bold.white('🔄 Starting corpuscle ranking analysis...'));

        try {
            // Phase 1: Build corpuscle relationship graph
            console.log(chalk.white('📊 Building corpuscle relationship graph...'));
            const graphData = await this.buildCorpuscleGraph();

            if (graphData.nodeCount === 0) {
                console.log(chalk.yellow('⚠️  No corpuscles found - no ranking to perform'));
                return { success: false, message: 'No corpuscles found' };
            }

            // Phase 2: Run graph analytics
            console.log(chalk.white('🧮 Running graph analytics on corpuscle network...'));
            const analysisResults = await this.analyzeCorpuscleGraph(graphData);

            // Phase 3: Process ranking results
            console.log(chalk.white('📈 Processing corpuscle rankings...'));
            const rankings = this.processCorpuscleRankings(analysisResults);

            // Phase 4: Export rankings to SPARQL store
            if (this.options.exportToSPARQL && rankings.length > 0) {
                console.log(chalk.white('💾 Exporting rankings to SPARQL store...'));
                await this.exportRankingsToSPARQL(rankings);
            }

            // Calculate final statistics
            this.stats.processingTime = Date.now() - startTime;

            console.log(chalk.green('✅ Corpuscle ranking completed successfully'));
            this.displayResults(rankings);

            return {
                success: true,
                rankings: rankings,
                analysisResults: analysisResults,
                statistics: { ...this.stats }
            };

        } catch (error) {
            this.stats.errors.push(`Corpuscle ranking failed: ${error.message}`);
            console.log(chalk.red('❌ Corpuscle ranking failed:', error.message));
            throw error;
        }
    }

    /**
     * Build graph from corpuscle relationships
     * @returns {Object} Graph representation suitable for analytics
     */
    async buildCorpuscleGraph() {
        console.log(chalk.gray('   Extracting corpuscles and their relationships...'));

        // Query for corpuscles with embeddings (indicating importance)
        const corpuscleQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?corpuscle ?label ?source
WHERE {
    {
        GRAPH <${this.options.beerqaGraphURI}> {
            ?corpuscle a ragno:Corpuscle ;
                      rdfs:label ?label .
            BIND("beerqa" as ?source)
        }
    } UNION {
        GRAPH <${this.options.wikipediaGraphURI}> {
            ?corpuscle a ragno:Corpuscle ;
                      rdfs:label ?label .
            BIND("wikipedia" as ?source)
        }
    }
}
ORDER BY ?corpuscle
`;

        const corpuscleResult = await this.sparqlHelper.executeSelect(corpuscleQuery);

        if (!corpuscleResult.success) {
            throw new Error(`Failed to extract corpuscles: ${corpuscleResult.error}`);
        }

        // Build graph structure
        const graph = {
            nodes: new Map(),
            edges: new Map(),
            adjacency: new Map(),
            inDegree: new Map(),
            outDegree: new Map()
        };

        // Add corpuscles as nodes
        for (const binding of corpuscleResult.data.results.bindings) {
            const corpuscleURI = binding.corpuscle.value;
            const label = binding.label.value;
            const source = binding.source.value;

            graph.nodes.set(corpuscleURI, {
                uri: corpuscleURI,
                type: 'ragno:Corpuscle',
                label: label,
                source: source,
                properties: new Map()
            });

            graph.adjacency.set(corpuscleURI, new Set());
            graph.inDegree.set(corpuscleURI, 0);
            graph.outDegree.set(corpuscleURI, 0);
        }

        this.stats.corpusclesAnalyzed = graph.nodes.size;
        console.log(chalk.gray(`   ✓ Found ${graph.nodes.size} corpuscles`));

        // Query for existing relationships between corpuscles
        const relationshipQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?sourceCorpuscle ?targetCorpuscle ?weight ?relType
WHERE {
    {
        GRAPH <${this.options.beerqaGraphURI}> {
            ?relationship a ragno:Relationship ;
                         ragno:hasSourceEntity ?sourceCorpuscle ;
                         ragno:hasTargetEntity ?targetCorpuscle .
            OPTIONAL { ?relationship ragno:weight ?weight }
            OPTIONAL { ?relationship ragno:relationshipType ?relType }
        }
    } UNION {
        GRAPH <${this.options.wikipediaGraphURI}> {
            ?relationship a ragno:Relationship ;
                         ragno:hasSourceEntity ?sourceCorpuscle ;
                         ragno:hasTargetEntity ?targetCorpuscle .
            OPTIONAL { ?relationship ragno:weight ?weight }
            OPTIONAL { ?relationship ragno:relationshipType ?relType }
        }
    }
}
`;

        const relationshipResult = await this.sparqlHelper.executeSelect(relationshipQuery);

        if (relationshipResult.success) {
            for (const binding of relationshipResult.data.results.bindings) {
                const sourceURI = binding.sourceCorpuscle.value;
                const targetURI = binding.targetCorpuscle.value;
                const weight = binding.weight?.value ? parseFloat(binding.weight.value) : 1.0;
                const relType = binding.relType?.value || 'related';

                if (graph.nodes.has(sourceURI) && graph.nodes.has(targetURI)) {
                    const edgeKey = `${sourceURI}->${targetURI}`;

                    graph.edges.set(edgeKey, {
                        source: sourceURI,
                        target: targetURI,
                        weight: weight,
                        relationshipType: relType,
                        properties: new Map()
                    });

                    // Update adjacency
                    graph.adjacency.get(sourceURI).add(targetURI);
                    graph.adjacency.get(targetURI).add(sourceURI); // Treat as undirected

                    // Update degrees
                    graph.outDegree.set(sourceURI, graph.outDegree.get(sourceURI) + 1);
                    graph.inDegree.set(targetURI, graph.inDegree.get(targetURI) + 1);

                    this.stats.relationshipsFound++;
                }
            }
        }

        console.log(chalk.gray(`   ✓ Found ${this.stats.relationshipsFound} existing relationships`));

        // If no relationships exist, create synthetic edges based on content similarity
        if (this.stats.relationshipsFound === 0) {
            console.log(chalk.gray('   Creating synthetic edges from content similarity...'));
            await this.createSyntheticEdges(graph);
        }

        return {
            graph: graph,
            nodeCount: graph.nodes.size,
            edgeCount: graph.edges.size
        };
    }

    /**
     * Create synthetic edges between corpuscles for graph analysis
     * @param {Object} graph - Graph structure to modify
     */
    async createSyntheticEdges(graph) {
        // Query for corpuscles with embeddings to calculate similarity
        const embeddingQuery = `
PREFIX ragno: <http://purl.org/stuff/ragno/>

SELECT ?corpuscle ?embedding
WHERE {
    {
        GRAPH <${this.options.beerqaGraphURI}> {
            ?corpuscle ragno:hasAttribute ?attr .
            ?attr a ragno:VectorEmbedding ;
                  ragno:attributeValue ?embedding .
        }
    } UNION {
        GRAPH <${this.options.wikipediaGraphURI}> {
            ?corpuscle ragno:hasAttribute ?attr .
            ?attr a ragno:VectorEmbedding ;
                  ragno:attributeValue ?embedding .
        }
    }
}
`;

        const embeddingResult = await this.sparqlHelper.executeSelect(embeddingQuery);

        if (!embeddingResult.success || embeddingResult.data.results.bindings.length === 0) {
            console.log(chalk.gray('   ⚠️  No embeddings found - creating simple connection graph'));

            // Create simple all-to-all connections with unit weight
            const corpuscles = Array.from(graph.nodes.keys());
            for (let i = 0; i < corpuscles.length; i++) {
                for (let j = i + 1; j < corpuscles.length; j++) {
                    const sourceURI = corpuscles[i];
                    const targetURI = corpuscles[j];
                    const edgeKey = `${sourceURI}->${targetURI}`;

                    graph.edges.set(edgeKey, {
                        source: sourceURI,
                        target: targetURI,
                        weight: 1.0,
                        relationshipType: 'synthetic',
                        properties: new Map()
                    });

                    // Update adjacency (bidirectional)
                    if (!graph.adjacency.has(sourceURI)) {
                        graph.adjacency.set(sourceURI, new Set());
                    }
                    if (!graph.adjacency.has(targetURI)) {
                        graph.adjacency.set(targetURI, new Set());
                    }
                    graph.adjacency.get(sourceURI).add(targetURI);
                    graph.adjacency.get(targetURI).add(sourceURI);

                    this.stats.syntheticEdgesCreated++;
                }
            }
        } else {
            // Create edges based on embedding similarity
            const embeddings = new Map();

            for (const binding of embeddingResult.data.results.bindings) {
                const corpuscleURI = binding.corpuscle.value;
                try {
                    const embedding = JSON.parse(binding.embedding.value);
                    if (Array.isArray(embedding) && embedding.length > 0) {
                        embeddings.set(corpuscleURI, embedding);
                    }
                } catch (error) {
                    console.log(chalk.yellow(`   ⚠️  Invalid embedding for ${corpuscleURI}`));
                }
            }

            console.log(chalk.gray(`   ✓ Found ${embeddings.size} valid embeddings`));

            // Calculate pairwise similarities and create edges
            const corpuscles = Array.from(embeddings.keys());
            for (let i = 0; i < corpuscles.length; i++) {
                for (let j = i + 1; j < corpuscles.length; j++) {
                    const sourceURI = corpuscles[i];
                    const targetURI = corpuscles[j];
                    const embedding1 = embeddings.get(sourceURI);
                    const embedding2 = embeddings.get(targetURI);

                    const similarity = this.calculateCosineSimilarity(embedding1, embedding2);

                    if (similarity >= this.options.similarityThreshold) {
                        const edgeKey = `${sourceURI}->${targetURI}`;

                        graph.edges.set(edgeKey, {
                            source: sourceURI,
                            target: targetURI,
                            weight: similarity,
                            relationshipType: 'similarity',
                            properties: new Map()
                        });

                        // Update adjacency (bidirectional)
                        if (!graph.adjacency.has(sourceURI)) {
                            graph.adjacency.set(sourceURI, new Set());
                        }
                        if (!graph.adjacency.has(targetURI)) {
                            graph.adjacency.set(targetURI, new Set());
                        }
                        graph.adjacency.get(sourceURI).add(targetURI);
                        graph.adjacency.get(targetURI).add(sourceURI);

                        this.stats.syntheticEdgesCreated++;
                    }
                }
            }
        }

        console.log(chalk.gray(`   ✓ Created ${this.stats.syntheticEdgesCreated} synthetic edges`));
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {Array} a - First vector
     * @param {Array} b - Second vector
     * @returns {number} Cosine similarity
     */
    calculateCosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) return 0;

        return dotProduct / (normA * normB);
    }

    /**
     * Analyze corpuscle graph using graph analytics
     * @param {Object} graphData - Graph data structure
     * @returns {Object} Analysis results
     */
    async analyzeCorpuscleGraph(graphData) {
        const { graph } = graphData;

        const analysisResults = {
            nodeCount: graph.nodes.size,
            edgeCount: graph.edges.size,
            kCore: null,
            centrality: null,
            statistics: null
        };

        // Run K-core decomposition if enabled
        if (this.options.enableKCore && graph.nodes.size > 1) {
            console.log(chalk.gray('   Running K-core decomposition...'));
            try {
                analysisResults.kCore = this.graphAnalytics.computeKCore(graph);
                this.stats.kCoreResults = analysisResults.kCore ? analysisResults.kCore.coreNumbers.size : 0;
                console.log(chalk.gray(`   ✓ K-core completed: ${this.stats.kCoreResults} results`));
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  K-core failed: ${error.message}`));
                this.stats.errors.push(`K-core failed: ${error.message}`);
            }
        }

        // Run betweenness centrality if enabled and graph is small enough
        if (this.options.enableCentrality && graph.nodes.size <= this.GRAPH_NODES_MAX) {
            console.log(chalk.gray('   Running betweenness centrality...'));
            try {
                analysisResults.centrality = this.graphAnalytics.computeBetweennessCentrality(graph);
                this.stats.centralityResults = analysisResults.centrality ? analysisResults.centrality.centrality.size : 0;
                console.log(chalk.gray(`   ✓ Centrality completed: ${this.stats.centralityResults} results`));
            } catch (error) {
                console.log(chalk.yellow(`   ⚠️  Centrality failed: ${error.message}`));
                this.stats.errors.push(`Centrality failed: ${error.message}`);
            }
        } else if (graph.nodes.size > 100) {
            console.log(chalk.gray('   ⚠️  Skipping centrality for large graph (>100 nodes)'));
        }

        // Compute basic graph statistics
        analysisResults.statistics = this.graphAnalytics.computeGraphStatistics(graph);

        return analysisResults;
    }

    /**
     * Process analysis results to generate corpuscle rankings
     * @param {Object} analysisResults - Analysis results
     * @returns {Array} Array of ranked corpuscles
     */
    processCorpuscleRankings(analysisResults) {
        console.log(chalk.gray('   Processing analysis results into rankings...'));

        const rankings = [];
        const corpuscleScores = new Map();

        // Process K-core results
        if (analysisResults.kCore?.coreNumbers) {
            for (const [nodeUri, coreNumber] of analysisResults.kCore.coreNumbers) {
                if (!corpuscleScores.has(nodeUri)) {
                    corpuscleScores.set(nodeUri, { kCore: 0, centrality: 0, composite: 0 });
                }
                corpuscleScores.get(nodeUri).kCore = coreNumber;
            }
        }

        // Process centrality results
        if (analysisResults.centrality?.centrality) {
            for (const [nodeUri, centralityScore] of analysisResults.centrality.centrality) {
                if (!corpuscleScores.has(nodeUri)) {
                    corpuscleScores.set(nodeUri, { kCore: 0, centrality: 0, composite: 0 });
                }
                corpuscleScores.get(nodeUri).centrality = centralityScore;
            }
        }

        // Calculate composite scores and create rankings
        for (const [nodeUri, scores] of corpuscleScores) {
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

        this.stats.rankingsGenerated = rankings.length;
        console.log(chalk.gray(`   ✓ Generated ${rankings.length} corpuscle rankings`));

        // Return top-K results if requested
        if (this.options.topKResults > 0) {
            return rankings.slice(0, this.options.topKResults);
        }

        return rankings;
    }

    /**
     * Export rankings to SPARQL store
     * @param {Array} rankings - Corpuscle rankings
     */
    async exportRankingsToSPARQL(rankings) {
        console.log(chalk.gray(`   Exporting ${rankings.length} rankings to SPARQL store...`));

        const timestamp = new Date().toISOString();
        const batchSize = 10;
        let exported = 0;

        try {
            for (let i = 0; i < rankings.length; i += batchSize) {
                const batch = rankings.slice(i, i + batchSize);
                const triples = [];

                for (const ranking of batch) {
                    const attributeURI = `${ranking.nodeUri}_corpuscle_ranking_${Date.now()}_${Math.random().toString(36).substring(7)}`;

                    triples.push(`<${attributeURI}> rdf:type ragno:Attribute .`);
                    triples.push(`<${attributeURI}> rdfs:label "corpuscle-importance-ranking" .`);
                    triples.push(`<${attributeURI}> ragno:attributeType "corpuscle-importance-ranking" .`);
                    triples.push(`<${attributeURI}> ragno:attributeValue "${ranking.compositeScore.toFixed(6)}" .`);
                    triples.push(`<${attributeURI}> ragno:rank "${ranking.rank}"^^xsd:integer .`);
                    triples.push(`<${attributeURI}> ragno:kCoreScore "${ranking.kCoreScore.toFixed(6)}" .`);
                    triples.push(`<${attributeURI}> ragno:centralityScore "${ranking.centralityScore.toFixed(6)}" .`);
                    triples.push(`<${attributeURI}> dcterms:created "${timestamp}"^^xsd:dateTime .`);
                    triples.push(`<${attributeURI}> prov:wasGeneratedBy "corpuscle-ranking-analysis" .`);

                    triples.push(`<${ranking.nodeUri}> ragno:hasAttribute <${attributeURI}> .`);
                    triples.push(`<${attributeURI}> ragno:describesCorpuscle <${ranking.nodeUri}> .`);
                }

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

                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.stats.rankingsExported = exported;
            console.log(chalk.gray(`   ✅ Successfully exported ${exported} corpuscle rankings`));

        } catch (error) {
            this.stats.errors.push(`SPARQL export failed: ${error.message}`);
            console.log(chalk.red(`   ❌ SPARQL export failed: ${error.message}`));
            throw error;
        }
    }

    /**
     * Display results
     * @param {Array} rankings - Corpuscle rankings
     */
    displayResults(rankings) {
        console.log('');
        console.log(chalk.bold.white('📊 Corpuscle Ranking Results:'));
        console.log(`   ${chalk.cyan('Corpuscles Analyzed:')} ${chalk.white(this.stats.corpusclesAnalyzed)}`);
        console.log(`   ${chalk.cyan('Existing Relationships:')} ${chalk.white(this.stats.relationshipsFound)}`);
        console.log(`   ${chalk.cyan('Synthetic Edges Created:')} ${chalk.white(this.stats.syntheticEdgesCreated)}`);
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
            console.log(chalk.bold.white('🏆 Top Corpuscle Rankings:'));
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
async function rankCorpuscles() {
    displayHeader();

    try {
        // Initialize Config.js for proper configuration management
        const config = new Config('config/config.json');
        await config.init();

        const options = {
            beerqaGraphURI: 'http://purl.org/stuff/beerqa/test',
            wikipediaGraphURI: 'http://purl.org/stuff/wikipedia/research',
            timeout: 30000,

            enableKCore: true,
            enableCentrality: true,
            similarityThreshold: 0.3,
            topKResults: 20,
            exportToSPARQL: true
        };

        console.log(chalk.bold.yellow('🔧 Configuration:'));
        console.log(`   ${chalk.cyan('SPARQL Endpoint:')} ${chalk.white(config.get('storage.options.update'))}`);
        console.log(`   ${chalk.cyan('Similarity Threshold:')} ${chalk.white(options.similarityThreshold)}`);
        console.log(`   ${chalk.cyan('Top-K Results:')} ${chalk.white(options.topKResults)}`);
        console.log(`   ${chalk.cyan('Export to SPARQL:')} ${chalk.white(options.exportToSPARQL ? 'Yes' : 'No')}`);
        console.log('');

        const ranker = new CorpuscleRanking(config, options);
        const result = await ranker.runCorpuscleRanking();

        if (result.success) {
            console.log(chalk.green('🎉 Corpuscle ranking completed successfully!'));
            console.log(chalk.white('Rankings have been stored in the SPARQL store.'));
        } else {
            console.log(chalk.yellow('⚠️  Corpuscle ranking completed with issues:', result.message));
        }

        return result;

    } catch (error) {
        console.log(chalk.red('❌ Corpuscle ranking failed:', error.message));
        throw error;
    }
}

// Export for module usage
export { CorpuscleRanking };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    rankCorpuscles().catch(error => {
        console.error(chalk.red('Fatal error:', error.message));
        process.exit(1);
    });
}