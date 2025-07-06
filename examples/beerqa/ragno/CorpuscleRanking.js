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
import SPARQLHelper from '../../../src/services/sparql/SPARQLHelper.js';

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
            relationshipTypes: new Set(),
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
            // Phase 0: Validate data prerequisites
            console.log(chalk.white('🔍 Validating data prerequisites...'));
            const validationResult = await this.validateDataPrerequisites();
            if (!validationResult.canProceed) {
                return {
                    success: false,
                    message: 'Data prerequisites not met',
                    recommendations: validationResult.recommendations,
                    validationDetails: validationResult
                };
            }

            // Phase 1: Build corpuscle relationship graph
            console.log(chalk.white('📊 Building corpuscle relationship graph...'));
            const graphData = await this.buildCorpuscleGraph();

            if (graphData.nodeCount === 0) {
                console.log(chalk.yellow('⚠️  No corpuscles found - no ranking to perform'));
                return { success: false, message: 'No corpuscles found' };
            }

            if (graphData.error) {
                return {
                    success: false,
                    message: graphData.error,
                    recommendations: graphData.recommendations || []
                };
            }

            // Phase 2: Run graph analytics
            console.log(chalk.white('🧮 Running graph analytics on corpuscle network...'));
            const analysisResults = await this.analyzeCorpuscleGraph(graphData);
            
            // Phase 2.5: Add content-based ranking for sparse graphs
            if (graphData.graph?.qualityMetrics?.sparsityWarning) {
                console.log(chalk.white('📝 Adding content-based ranking for sparse graph...'));
                await this.addContentBasedRanking(graphData.graph, analysisResults);
            }

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
        
        // Store relationship data for quality analysis
        const relationshipData = [];
        if (relationshipResult.success) {
            for (const binding of relationshipResult.data.results.bindings) {
                const weight = binding.weight?.value ? parseFloat(binding.weight.value) : 1.0;
                const relType = binding.relType?.value || 'unknown';
                relationshipData.push({ weight, type: relType });
                this.stats.relationshipTypes.add(relType);
            }
        }
        
        // Store for later analysis
        graph.relationshipData = relationshipData;

        // Check for meaningful relationships - no synthetic edges
        if (this.stats.relationshipsFound === 0) {
            console.log(chalk.yellow('   ⚠️  No relationships found in data - ranking not meaningful'));
            console.log(chalk.yellow('   ⚠️  Run RelationshipBuilder.js first to create semantic relationships'));
            return {
                graph: graph,
                nodeCount: graph.nodes.size,
                edgeCount: 0,
                error: 'No relationships found - ranking requires real semantic relationships',
                recommendations: [
                    'Run RelationshipBuilder.js to create semantic relationships between questions and Wikipedia content',
                    'Verify Wikipedia content was ingested via QuestionResearch.js',
                    'Check that embeddings exist for similarity calculations',
                    'Ensure both BeerQA questions and Wikipedia corpuscles exist in the data'
                ]
            };
        }

        // Analyze relationship quality if relationships exist
        if (this.stats.relationshipsFound > 0) {
            this.analyzeRelationshipQuality(graph);
        }

        return {
            graph: graph,
            nodeCount: graph.nodes.size,
            edgeCount: graph.edges.size
        };
    }

    /**
     * Validate data prerequisites for meaningful ranking
     * @returns {Object} Validation results
     */
    async validateDataPrerequisites() {
        console.log(chalk.gray('   Checking data prerequisites...'));
        
        const checks = [
            {
                name: 'BeerQA questions',
                query: `SELECT (COUNT(*) as ?count) WHERE {
                    GRAPH <${this.options.beerqaGraphURI}> {
                        ?s a ragno:Corpuscle ;
                           ragno:corpuscleType "test-question" .
                    }
                }`,
                minimum: 1
            },
            {
                name: 'Wikipedia corpuscles',
                query: `SELECT (COUNT(*) as ?count) WHERE {
                    GRAPH <${this.options.wikipediaGraphURI}> {
                        ?s a ragno:Corpuscle .
                    }
                }`,
                minimum: 1
            },
            {
                name: 'Relationships',
                query: `SELECT (COUNT(*) as ?count) WHERE {
                    {
                        GRAPH <${this.options.beerqaGraphURI}> {
                            ?s a ragno:Relationship .
                        }
                    } UNION {
                        GRAPH <${this.options.wikipediaGraphURI}> {
                            ?s a ragno:Relationship .
                        }
                    }
                }`,
                minimum: 1
            },
            {
                name: 'Embeddings',
                query: `SELECT (COUNT(*) as ?count) WHERE {
                    {
                        GRAPH <${this.options.beerqaGraphURI}> {
                            ?s ragno:hasAttribute ?attr .
                            ?attr a ragno:VectorEmbedding .
                        }
                    } UNION {
                        GRAPH <${this.options.wikipediaGraphURI}> {
                            ?s ragno:hasAttribute ?attr .
                            ?attr a ragno:VectorEmbedding .
                        }
                    }
                }`,
                minimum: 0 // Optional but helpful
            }
        ];
        
        const results = {};
        let canProceed = true;
        const recommendations = [];
        
        for (const check of checks) {
            try {
                const result = await this.sparqlHelper.executeSelect(check.query);
                const count = parseInt(result.data?.results?.bindings[0]?.count?.value || '0');
                results[check.name] = count;
                
                console.log(chalk.gray(`   ${check.name}: ${count}`));
                
                if (count < check.minimum) {
                    canProceed = false;
                    if (check.name === 'BeerQA questions') {
                        recommendations.push('Run BeerTestQuestions.js to create test questions');
                    } else if (check.name === 'Wikipedia corpuscles') {
                        recommendations.push('Run QuestionResearch.js to ingest Wikipedia content');
                    } else if (check.name === 'Relationships') {
                        recommendations.push('Run RelationshipBuilder.js to create semantic relationships');
                    }
                }
            } catch (error) {
                console.log(chalk.red(`   ❌ Failed to check ${check.name}: ${error.message}`));
                results[check.name] = 0;
                canProceed = false;
            }
        }
        
        if (!canProceed) {
            recommendations.push('Verify SPARQL endpoint is accessible and contains the expected data');
        }
        
        if (!canProceed) {
            console.log(chalk.red('   ❌ Prerequisites not met - cannot perform meaningful ranking'));
            console.log(chalk.yellow('   💡 Recommendations:'));
            recommendations.forEach(rec => {
                console.log(chalk.yellow(`     • ${rec}`));
            });
        }
        
        return {
            canProceed,
            results,
            recommendations,
            summary: `Found ${results['BeerQA questions'] || 0} questions, ${results['Wikipedia corpuscles'] || 0} Wikipedia corpuscles, ${results['Relationships'] || 0} relationships`
        };
    }

    /**
     * Analyze relationship quality and diversity
     * @param {Object} graph - Graph structure with relationship data
     */
    analyzeRelationshipQuality(graph) {
        console.log(chalk.gray('   Analyzing relationship quality...'));
        
        const relationshipData = graph.relationshipData || [];
        
        if (relationshipData.length === 0) {
            console.log(chalk.yellow('   ⚠️  No relationship data available for quality analysis'));
            return;
        }
        
        // Analyze weight distribution
        const weights = relationshipData.map(r => r.weight);
        const weightStats = {
            min: Math.min(...weights),
            max: Math.max(...weights),
            mean: weights.reduce((a, b) => a + b, 0) / weights.length,
            median: weights.sort((a, b) => a - b)[Math.floor(weights.length / 2)]
        };
        
        // Analyze relationship types
        const typeDistribution = {};
        relationshipData.forEach(r => {
            typeDistribution[r.type] = (typeDistribution[r.type] || 0) + 1;
        });
        
        // Report analysis
        console.log(chalk.gray(`   ✓ Relationship types (${this.stats.relationshipTypes.size}): ${[...this.stats.relationshipTypes].join(', ')}`));
        console.log(chalk.gray(`   ✓ Weight range: ${weightStats.min.toFixed(3)} - ${weightStats.max.toFixed(3)} (mean: ${weightStats.mean.toFixed(3)})`));
        
        // Quality warnings
        if (this.stats.relationshipTypes.size === 1) {
            console.log(chalk.yellow('   ⚠️  Only one relationship type found - consider running multiple relationship creation strategies'));
        }
        
        if (weightStats.max - weightStats.min < 0.1) {
            console.log(chalk.yellow('   ⚠️  Low weight variance - relationships may not be well-differentiated'));
        }
        
        // Check for graph sparsity
        const nodeCount = graph.nodes.size;
        const edgeCount = graph.edges.size;
        const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
        const density = edgeCount / maxPossibleEdges;
        
        console.log(chalk.gray(`   ✓ Graph density: ${(density * 100).toFixed(2)}% (${edgeCount}/${maxPossibleEdges} possible edges)`));
        
        if (density < 0.1) {
            console.log(chalk.yellow('   ⚠️  Sparse graph detected - rankings may not be highly differentiated'));
        }
        
        // Store quality metrics
        graph.qualityMetrics = {
            weightStats,
            typeDistribution,
            density,
            sparsityWarning: density < 0.1
        };
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

        // Include content-based metrics if available (for sparse graphs)
        const contentMetrics = analysisResults.contentMetrics;
        const hasContentMetrics = contentMetrics && contentMetrics.size > 0;
        
        // Calculate composite scores and create rankings
        for (const [nodeUri, scores] of corpuscleScores) {
            let compositeScore;
            let contentScore = 0;
            
            if (hasContentMetrics && contentMetrics.has(nodeUri)) {
                const content = contentMetrics.get(nodeUri);
                contentScore = content.contentScore / 100; // Normalize
                // For sparse graphs: Structure 40%, Centrality 30%, Content 30%
                compositeScore = (scores.kCore * 0.4) + (scores.centrality * 0.3) + (contentScore * 0.3);
            } else {
                // Standard weighting: K-core 60%, Centrality 40%
                compositeScore = (scores.kCore * 0.6) + (scores.centrality * 0.4);
            }
            
            scores.composite = compositeScore;
            scores.content = contentScore;

            rankings.push({
                nodeUri: nodeUri,
                kCoreScore: scores.kCore,
                centralityScore: scores.centrality,
                contentScore: contentScore,
                compositeScore: compositeScore,
                rank: 0, // Will be assigned after sorting
                explanation: null // Will be generated after sorting
            });
        }

        // Sort by composite score and assign ranks
        rankings.sort((a, b) => b.compositeScore - a.compositeScore);
        rankings.forEach((ranking, index) => {
            ranking.rank = index + 1;
            ranking.explanation = this.generateRankingExplanation(ranking, analysisResults);
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
     * Generate explanation for a ranking result
     * @param {Object} ranking - Ranking data
     * @param {Object} analysisResults - Analysis results with graph data
     * @returns {string} Human-readable explanation
     */
    generateRankingExplanation(ranking, analysisResults) {
        const graph = analysisResults.graph || {};
        const node = graph.nodes?.get(ranking.nodeUri);
        const connections = graph.adjacency?.get(ranking.nodeUri)?.size || 0;
        
        const nodeType = node?.source || 'unknown';
        const nodeLabel = node?.label || ranking.nodeUri.split('/').pop();
        
        let explanation = `${nodeType} corpuscle with ${connections} connections`;
        
        // Add k-core explanation
        if (ranking.kCoreScore > 0) {
            explanation += `, k-core ${ranking.kCoreScore.toFixed(1)}`;
            if (ranking.kCoreScore >= 3) {
                explanation += ' (highly connected)';
            } else if (ranking.kCoreScore >= 2) {
                explanation += ' (moderately connected)';
            } else {
                explanation += ' (lightly connected)';
            }
        }
        
        // Add centrality explanation
        if (ranking.centralityScore > 0) {
            const centralityLevel = ranking.centralityScore > 0.1 ? 'high' : 
                                  ranking.centralityScore > 0.01 ? 'moderate' : 'low';
            explanation += `, ${centralityLevel} betweenness centrality`;
        }
        
        // Add quality context if available
        if (graph.qualityMetrics?.sparsityWarning) {
            explanation += ' (sparse graph - rankings may be less differentiated)';
        }
        
        return explanation;
    }

    /**
     * Add content-based ranking metrics for sparse graphs
     * @param {Object} graph - Graph structure
     * @param {Object} analysisResults - Analysis results to augment
     */
    async addContentBasedRanking(graph, analysisResults) {
        console.log(chalk.gray('   Computing content-based metrics for sparse graph...'));
        
        try {
            // Query for corpuscles with text content
            const contentQuery = `
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
`;
            
            const result = await this.sparqlHelper.executeSelect(contentQuery);
            
            if (!result.success) {
                console.log(chalk.yellow('   ⚠️  Failed to load content for content-based ranking'));
                return;
            }
            
            // Calculate content-based metrics
            const contentMetrics = new Map();
            
            for (const binding of result.data.results.bindings) {
                const corpuscleURI = binding.corpuscle.value;
                const label = binding.label.value;
                const source = binding.source.value;
                
                // Simple content metrics
                const textLength = label.length;
                const wordCount = label.split(/\s+/).length;
                const uniqueWords = new Set(label.toLowerCase().split(/\s+/)).size;
                const lexicalDiversity = uniqueWords / wordCount;
                
                // Source-based importance (questions might be more important than general content)
                const sourceWeight = source === 'beerqa' ? 1.2 : 1.0;
                
                // Composite content score
                const contentScore = (textLength * 0.3 + wordCount * 0.4 + lexicalDiversity * 0.3) * sourceWeight;
                
                contentMetrics.set(corpuscleURI, {
                    contentScore: contentScore,
                    textLength: textLength,
                    wordCount: wordCount,
                    lexicalDiversity: lexicalDiversity,
                    source: source
                });
            }
            
            // Store content metrics in analysis results
            analysisResults.contentMetrics = contentMetrics;
            
            console.log(chalk.gray(`   ✓ Computed content metrics for ${contentMetrics.size} corpuscles`));
            
        } catch (error) {
            console.log(chalk.yellow(`   ⚠️  Content-based ranking failed: ${error.message}`));
        }
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
        console.log(`   ${chalk.cyan('Relationship Types:')} ${chalk.white(this.stats.relationshipTypes.size)} (${[...this.stats.relationshipTypes].join(', ')})`);
        console.log(`   ${chalk.cyan('Rankings Generated:')} ${chalk.white(this.stats.rankingsGenerated)}`);
        console.log(`   ${chalk.cyan('Rankings Exported:')} ${chalk.white(this.stats.rankingsExported)}`);
        console.log(`   ${chalk.cyan('K-core Results:')} ${chalk.white(this.stats.kCoreResults)}`);
        console.log(`   ${chalk.cyan('Centrality Results:')} ${chalk.white(this.stats.centralityResults)}`);
        console.log(`   ${chalk.cyan('Processing Time:')} ${chalk.white((this.stats.processingTime / 1000).toFixed(2))}s`);
        
        // Add data quality summary
        if (this.stats.relationshipsFound === 0) {
            console.log(`   ${chalk.red('Data Quality:')} ${chalk.red('No relationships found - ranking not performed')}`);
        } else if (this.stats.relationshipTypes.size === 1) {
            console.log(`   ${chalk.yellow('Data Quality:')} ${chalk.yellow('Single relationship type - limited ranking diversity')}`);
        } else {
            console.log(`   ${chalk.green('Data Quality:')} ${chalk.green('Multiple relationship types - good ranking diversity')}`);
        }

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
                console.log(`   ${chalk.bold.cyan(`${i + 1}.`)} ${chalk.white(shortUri)}`);
                console.log(`      ${chalk.gray('Composite:')} ${chalk.white(ranking.compositeScore.toFixed(4))}`);
                console.log(`      ${chalk.gray('K-core:')} ${chalk.white(ranking.kCoreScore.toFixed(4))}`);
                console.log(`      ${chalk.gray('Centrality:')} ${chalk.white(ranking.centralityScore.toFixed(4))}`);
                if (ranking.contentScore && ranking.contentScore > 0) {
                    console.log(`      ${chalk.gray('Content:')} ${chalk.white(ranking.contentScore.toFixed(4))}`);
                }
                if (ranking.explanation) {
                    console.log(`      ${chalk.gray('Analysis:')} ${chalk.white(ranking.explanation)}`);
                }
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
            console.log(chalk.red('❌ Corpuscle ranking failed:', result.message));
            if (result.recommendations && result.recommendations.length > 0) {
                console.log('');
                console.log(chalk.bold.yellow('💡 Recommendations to fix the issues:'));
                result.recommendations.forEach(rec => {
                    console.log(chalk.yellow(`  • ${rec}`));
                });
            }
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