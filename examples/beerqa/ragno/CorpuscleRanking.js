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
import { createQueryService } from '../../../src/services/sparql/index.js';
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

        // Initialize SPARQL services
        this.sparqlHelper = new SPARQLHelper(this.options.sparqlEndpoint, {
            auth: this.options.sparqlAuth,
            timeout: this.options.timeout
        });
        
        this.queryService = createQueryService({
            queryPath: path.join(process.cwd(), 'sparql/queries'),
            templatePath: path.join(process.cwd(), 'sparql/templates'),
            cacheOptions: {
                maxSize: 50,
                ttl: 1800000, // 30 minutes
                enableFileWatch: true
            }
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

        // Query for corpuscles using SPARQL service
        const corpuscleQuery = await this.createCorpuscleQuery({
            beerqaGraphURI: this.options.beerqaGraphURI,
            wikipediaGraphURI: this.options.wikipediaGraphURI
        });

        const corpuscleResult = await this.sparqlHelper.executeSelect(corpuscleQuery);

        if (!corpuscleResult.success) {
            const errorMsg = corpuscleResult.error || corpuscleResult.statusText || 'Unknown SPARQL error';
            console.log(chalk.red(`   ❌ Corpuscle query failed (${corpuscleResult.status}): ${errorMsg}`));
            throw new Error(`Failed to extract corpuscles: ${errorMsg}`);
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
        
        // Debug: Show sample nodes
        const nodeEntries = Array.from(graph.nodes.entries()).slice(0, 3);
        console.log(chalk.gray('   Sample nodes:'));
        nodeEntries.forEach(([uri, node]) => {
            const shortUri = uri.split('/').pop();
            console.log(chalk.gray(`     ${shortUri}: ${node.label?.substring(0, 50)}...`));
        });

        // Query for existing relationships between corpuscles
        const relationshipQuery = await this.createRelationshipQuery({
            beerqaGraphURI: this.options.beerqaGraphURI,
            wikipediaGraphURI: this.options.wikipediaGraphURI
        });

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

                    // CRITICAL FIX: Ensure adjacency sets exist before adding
                    if (!graph.adjacency.has(sourceURI)) {
                        console.log(chalk.yellow(`   ⚠️  Missing adjacency for source: ${sourceURI.split('/').pop()}`));
                        graph.adjacency.set(sourceURI, new Set());
                    }
                    if (!graph.adjacency.has(targetURI)) {
                        console.log(chalk.yellow(`   ⚠️  Missing adjacency for target: ${targetURI.split('/').pop()}`));
                        graph.adjacency.set(targetURI, new Set());
                    }

                    // Update adjacency (treat as undirected)
                    graph.adjacency.get(sourceURI).add(targetURI);
                    graph.adjacency.get(targetURI).add(sourceURI);

                    // Update degrees
                    graph.outDegree.set(sourceURI, graph.outDegree.get(sourceURI) + 1);
                    graph.inDegree.set(targetURI, graph.inDegree.get(targetURI) + 1);
                    graph.outDegree.set(targetURI, graph.outDegree.get(targetURI) + 1);
                    graph.inDegree.set(sourceURI, graph.inDegree.get(sourceURI) + 1);

                    this.stats.relationshipsFound++;
                } else {
                    // Debug: Log when relationships reference non-existent nodes
                    if (!graph.nodes.has(sourceURI)) {
                        console.log(chalk.yellow(`   ⚠️  Relationship references unknown source: ${sourceURI.split('/').pop()}`));
                    }
                    if (!graph.nodes.has(targetURI)) {
                        console.log(chalk.yellow(`   ⚠️  Relationship references unknown target: ${targetURI.split('/').pop()}`));
                    }
                }
            }
        }

        console.log(chalk.gray(`   ✓ Found ${this.stats.relationshipsFound} existing relationships`));
        
        // Debug: Show sample relationships if they exist
        if (this.stats.relationshipsFound > 0) {
            const relationshipEntries = Array.from(graph.edges.entries()).slice(0, 3);
            console.log(chalk.gray('   Sample relationships:'));
            relationshipEntries.forEach(([edgeKey, edge]) => {
                const sourceShort = edge.source.split('/').pop();
                const targetShort = edge.target.split('/').pop();
                console.log(chalk.gray(`     ${sourceShort} -> ${targetShort} (weight: ${edge.weight.toFixed(3)}, type: ${edge.relationshipType})`));
            });
        }
        
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
        
        // Critical Debug: Verify graph structure consistency
        console.log(chalk.gray('   ✓ Graph structure validation:'));
        console.log(chalk.gray(`     Nodes: ${graph.nodes.size}, Edges: ${graph.edges.size}`));
        console.log(chalk.gray(`     Adjacency entries: ${graph.adjacency.size}`));
        
        // Check for nodes with actual adjacencies
        let nodesWithConnections = 0;
        let totalConnections = 0;
        for (const [nodeUri, adjacencies] of graph.adjacency) {
            if (adjacencies.size > 0) {
                nodesWithConnections++;
                totalConnections += adjacencies.size;
            }
        }
        
        console.log(chalk.gray(`     Nodes with connections: ${nodesWithConnections}/${graph.nodes.size}`));
        console.log(chalk.gray(`     Total adjacency connections: ${totalConnections}`));
        
        if (nodesWithConnections === 0 && graph.edges.size > 0) {
            console.log(chalk.red('   ❌ CRITICAL ERROR: Edges exist but no adjacencies built!'));
            console.log(chalk.red('   ❌ This will cause incorrect k-core and centrality calculations'));
        }

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
            this.analyzeGraphStructure(graph);
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
                queryTemplate: this.createCountQuery('beerqa-questions'),
                parameters: { 
                    graphURI: this.options.beerqaGraphURI,
                    corpuscleType: 'test-question'
                },
                minimum: 1
            },
            {
                name: 'Wikipedia corpuscles',
                queryTemplate: this.createCountQuery('wikipedia-corpuscles'),
                parameters: { 
                    graphURI: this.options.wikipediaGraphURI
                },
                minimum: 1
            },
            {
                name: 'Relationships',
                queryTemplate: this.createCountQuery('relationships'),
                parameters: { 
                    beerqaGraphURI: this.options.beerqaGraphURI,
                    wikipediaGraphURI: this.options.wikipediaGraphURI
                },
                minimum: 1
            },
            {
                name: 'Embeddings',
                queryTemplate: this.createCountQuery('embeddings'),
                parameters: { 
                    beerqaGraphURI: this.options.beerqaGraphURI,
                    wikipediaGraphURI: this.options.wikipediaGraphURI
                },
                minimum: 0 // Optional but helpful
            }
        ];
        
        const results = {};
        let canProceed = true;
        const recommendations = [];
        
        for (const check of checks) {
            try {
                // Use SPARQL service with proper prefix handling
                const prefixes = await this.queryService.loadPrefixes();
                const query = prefixes + this.substituteParameters(check.queryTemplate, check.parameters);
                
                const result = await this.sparqlHelper.executeSelect(query);
                
                if (!result.success) {
                    throw new Error(result.error || result.statusText);
                }
                
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
     * Analyze graph structure for k-core debugging
     * @param {Object} graph - Graph structure
     */
    analyzeGraphStructure(graph) {
        console.log(chalk.gray('   Analyzing graph structure for k-core calculation...'));
        
        // Analyze degree distribution
        const degrees = new Map();
        for (const [nodeUri, adjacencies] of graph.adjacency) {
            const degree = adjacencies.size;
            degrees.set(nodeUri, degree);
        }
        
        const degreeValues = Array.from(degrees.values());
        const degreeStats = {
            min: Math.min(...degreeValues),
            max: Math.max(...degreeValues),
            mean: degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length,
            median: degreeValues.sort((a, b) => a - b)[Math.floor(degreeValues.length / 2)]
        };
        
        console.log(chalk.gray(`   ✓ Degree distribution: min=${degreeStats.min}, max=${degreeStats.max}, mean=${degreeStats.mean.toFixed(1)}, median=${degreeStats.median}`));
        
        // Check for uniform degrees (k-core problem indicator)
        const uniqueDegrees = new Set(degreeValues);
        if (uniqueDegrees.size === 1) {
            console.log(chalk.yellow('   ⚠️  All nodes have identical degree - k-core will be uniform'));
            console.log(chalk.yellow(`   ⚠️  All nodes have degree ${degreeValues[0]} - this creates k-core = ${degreeValues[0]}`));
        } else if (uniqueDegrees.size <= 3) {
            console.log(chalk.yellow(`   ⚠️  Low degree diversity (${uniqueDegrees.size} unique values) - k-core may not be discriminative`));
            console.log(chalk.gray(`   Unique degrees: ${[...uniqueDegrees].sort((a, b) => a - b).join(', ')}`));
        }
        
        // Store degree information for improved ranking
        graph.degreeStats = degreeStats;
        graph.nodeDegrees = degrees;
    }

    /**
     * Create a filtered graph for better k-core calculation
     * @param {Object} graph - Original graph
     * @returns {Object|null} Filtered graph or null if no filtering needed
     */
    createFilteredGraph(graph) {
        // Check if all nodes have the same degree (uniform k-core problem)
        const degrees = Array.from(graph.nodeDegrees.values());
        const uniqueDegrees = new Set(degrees);
        
        if (uniqueDegrees.size === 1) {
            console.log(chalk.gray('   Creating weight-filtered graph to break k-core uniformity...'));
            
            // Create filtered graph based on edge weights
            const filteredGraph = {
                nodes: new Map(graph.nodes),
                edges: new Map(),
                adjacency: new Map(),
                inDegree: new Map(),
                outDegree: new Map()
            };
            
            // Initialize adjacency for all nodes
            for (const nodeUri of graph.nodes.keys()) {
                filteredGraph.adjacency.set(nodeUri, new Set());
                filteredGraph.inDegree.set(nodeUri, 0);
                filteredGraph.outDegree.set(nodeUri, 0);
            }
            
            // Filter edges by weight - only keep above-average weights
            const weights = [];
            for (const edge of graph.edges.values()) {
                weights.push(edge.weight);
            }
            
            if (weights.length > 0) {
                const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
                const threshold = Math.max(avgWeight, 0.3); // Minimum threshold of 0.3
                
                console.log(chalk.gray(`   Weight threshold: ${threshold.toFixed(3)} (avg: ${avgWeight.toFixed(3)})`));
                
                let filteredEdgeCount = 0;
                for (const [edgeKey, edge] of graph.edges) {
                    if (edge.weight >= threshold) {
                        filteredGraph.edges.set(edgeKey, edge);
                        
                        // Update adjacency
                        filteredGraph.adjacency.get(edge.source).add(edge.target);
                        filteredGraph.adjacency.get(edge.target).add(edge.source);
                        
                        // Update degrees
                        filteredGraph.outDegree.set(edge.source, filteredGraph.outDegree.get(edge.source) + 1);
                        filteredGraph.inDegree.set(edge.target, filteredGraph.inDegree.get(edge.target) + 1);
                        
                        filteredEdgeCount++;
                    }
                }
                
                console.log(chalk.gray(`   Filtered graph: ${filteredEdgeCount}/${graph.edges.size} edges retained`));
                
                // Only return filtered graph if it has sufficient structure
                if (filteredEdgeCount > graph.nodes.size / 2) {
                    return filteredGraph;
                }
            }
        }
        
        return null; // No filtering needed or filtering not beneficial
    }

    /**
     * Analyze k-core diversity and provide insights
     * @param {Object} kCoreResult - K-core computation result
     */
    analyzeKCoreDiversity(kCoreResult) {
        if (!kCoreResult.coreNumbers) return;
        
        const coreValues = Array.from(kCoreResult.coreNumbers.values());
        const uniqueCores = new Set(coreValues);
        
        console.log(chalk.gray(`   K-core diversity: ${uniqueCores.size} unique values from ${coreValues.length} nodes`));
        
        if (uniqueCores.size === 1) {
            console.log(chalk.yellow(`   ⚠️  Uniform k-core detected: all nodes have k-core = ${coreValues[0]}`));
            console.log(chalk.yellow('   ⚠️  Consider using alternative metrics for ranking'));
        } else {
            const coreDistribution = {};
            coreValues.forEach(core => {
                coreDistribution[core] = (coreDistribution[core] || 0) + 1;
            });
            
            console.log(chalk.gray('   K-core distribution:'));
            Object.entries(coreDistribution)
                .sort(([a], [b]) => parseInt(b) - parseInt(a))
                .forEach(([core, count]) => {
                    console.log(chalk.gray(`     k=${core}: ${count} nodes`));
                });
        }
    }

    /**
     * Add alternative structural metrics when k-core is uniform
     * @param {Object} analysisResults - Analysis results
     * @param {Map} corpuscleScores - Corpuscle scores map
     */
    addAlternativeStructuralMetrics(analysisResults, corpuscleScores) {
        const graph = analysisResults.graph;
        if (!graph) return;
        
        console.log(chalk.gray('   Computing weighted degree and local clustering...'));
        
        // Calculate weighted degree and local clustering coefficient
        for (const [nodeUri, adjacencies] of graph.adjacency) {
            if (!corpuscleScores.has(nodeUri)) {
                corpuscleScores.set(nodeUri, { kCore: 0, centrality: 0, composite: 0 });
            }
            
            const scores = corpuscleScores.get(nodeUri);
            
            // Calculate weighted degree (sum of edge weights)
            let weightedDegree = 0;
            let totalWeight = 0;
            
            for (const neighborUri of adjacencies) {
                // Find edge weight
                const edgeKey1 = `${nodeUri}->${neighborUri}`;
                const edgeKey2 = `${neighborUri}->${nodeUri}`;
                const edge = graph.edges.get(edgeKey1) || graph.edges.get(edgeKey2);
                
                if (edge) {
                    weightedDegree += edge.weight;
                    totalWeight += edge.weight;
                }
            }
            
            // Normalize weighted degree
            const normalizedWeightedDegree = adjacencies.size > 0 ? 
                (weightedDegree / adjacencies.size) : 0;
            
            // Calculate local clustering coefficient
            let triangles = 0;
            const neighbors = Array.from(adjacencies);
            
            for (let i = 0; i < neighbors.length; i++) {
                for (let j = i + 1; j < neighbors.length; j++) {
                    const neighbor1 = neighbors[i];
                    const neighbor2 = neighbors[j];
                    
                    // Check if neighbors are connected
                    if (graph.adjacency.get(neighbor1)?.has(neighbor2)) {
                        triangles++;
                    }
                }
            }
            
            const maxTriangles = (neighbors.length * (neighbors.length - 1)) / 2;
            const clusteringCoeff = maxTriangles > 0 ? triangles / maxTriangles : 0;
            
            // Store alternative metrics
            scores.weightedDegree = normalizedWeightedDegree;
            scores.clustering = clusteringCoeff;
            scores.degree = adjacencies.size;
            
            // Create composite alternative score
            // Weighted degree (50%) + clustering (30%) + raw degree (20%)
            const altStructuralScore = 
                (normalizedWeightedDegree * 0.5) + 
                (clusteringCoeff * 0.3) + 
                (adjacencies.size * 0.2);
            
            scores.alternativeStructural = altStructuralScore;
        }
        
        console.log(chalk.gray('   ✓ Alternative structural metrics computed'));
    }

    /**
     * Debug graph structure before k-core calculation
     * @param {Object} graph - Graph to debug
     * @param {string} type - Graph type for logging
     */
    debugGraphForKCore(graph, type) {
        console.log(chalk.gray(`   ✓ Debugging ${type} graph for k-core:`))
        console.log(chalk.gray(`     Nodes: ${graph.nodes.size}, Adjacency entries: ${graph.adjacency.size}`));
        
        // Sample a few nodes to verify adjacency structure
        let connectedNodes = 0;
        let totalDegree = 0;
        const sampleNodes = Array.from(graph.adjacency.entries()).slice(0, 5);
        
        sampleNodes.forEach(([nodeUri, adjacencies]) => {
            const degree = adjacencies.size;
            if (degree > 0) connectedNodes++;
            totalDegree += degree;
            
            const shortUri = nodeUri.split('/').pop();
            console.log(chalk.gray(`     ${shortUri}: degree=${degree}, adjacencies=[${Array.from(adjacencies).slice(0, 3).map(uri => uri.split('/').pop()).join(', ')}${adjacencies.size > 3 ? '...' : ''}]`));
        });
        
        console.log(chalk.gray(`     Connected nodes in sample: ${connectedNodes}/${sampleNodes.length}`));
        console.log(chalk.gray(`     Average degree in sample: ${sampleNodes.length > 0 ? (totalDegree / sampleNodes.length).toFixed(2) : 0}`));
        
        // Verify that adjacency and edges are consistent
        let adjacencyEdges = 0;
        for (const adjacencies of graph.adjacency.values()) {
            adjacencyEdges += adjacencies.size;
        }
        
        console.log(chalk.gray(`     Adjacency edges: ${adjacencyEdges}, Stored edges: ${graph.edges.size * 2} (should match for undirected)`));
        
        if (adjacencyEdges === 0 && graph.edges.size > 0) {
            console.log(chalk.red('     ❌ CRITICAL: Graph has edges but no adjacencies - k-core will fail!'));
        }
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
            statistics: null,
            graph: graph // CRITICAL FIX: Store graph reference for ranking explanations
        };

        // Run improved K-core decomposition if enabled
        if (this.options.enableKCore && graph.nodes.size > 1) {
            console.log(chalk.gray('   Running improved K-core decomposition...'));
            try {
                // Check if we need to apply filtering for better k-core results
                const filteredGraph = this.createFilteredGraph(graph);
                
                if (filteredGraph && filteredGraph.nodes.size > 1) {
                    console.log(chalk.gray(`   Using filtered graph: ${filteredGraph.nodes.size} nodes, ${filteredGraph.edges.size} edges`));
                    
                    // Debug filtered graph structure before k-core
                    this.debugGraphForKCore(filteredGraph, 'filtered');
                    
                    analysisResults.kCore = this.graphAnalytics.computeKCore(filteredGraph);
                    analysisResults.filteredGraph = filteredGraph;
                } else {
                    console.log(chalk.gray('   Using original graph for k-core'));
                    
                    // Debug original graph structure before k-core
                    this.debugGraphForKCore(graph, 'original');
                    
                    analysisResults.kCore = this.graphAnalytics.computeKCore(graph);
                }
                
                this.stats.kCoreResults = analysisResults.kCore ? analysisResults.kCore.coreNumbers.size : 0;
                
                // Add k-core diversity analysis
                if (analysisResults.kCore) {
                    this.analyzeKCoreDiversity(analysisResults.kCore);
                }
                
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

        // Process K-core results with alternative metrics
        if (analysisResults.kCore?.coreNumbers) {
            const kCoreValues = Array.from(analysisResults.kCore.coreNumbers.values());
            const uniqueKCores = new Set(kCoreValues);
            
            // If k-core is uniform, use alternative structural metrics
            const useAlternativeMetrics = uniqueKCores.size === 1;
            
            if (useAlternativeMetrics) {
                console.log(chalk.gray('   K-core uniform - using alternative structural metrics...'));
                this.addAlternativeStructuralMetrics(analysisResults, corpuscleScores);
            }
            
            for (const [nodeUri, coreNumber] of analysisResults.kCore.coreNumbers) {
                if (!corpuscleScores.has(nodeUri)) {
                    corpuscleScores.set(nodeUri, { kCore: 0, centrality: 0, composite: 0 });
                }
                
                if (useAlternativeMetrics) {
                    // Use weighted degree as k-core alternative
                    const altScore = corpuscleScores.get(nodeUri).weightedDegree || coreNumber;
                    corpuscleScores.get(nodeUri).kCore = altScore;
                } else {
                    corpuscleScores.get(nodeUri).kCore = coreNumber;
                }
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
            // CRITICAL FIX: Pass graphData.graph to explanation generator
            const explanationData = {
                ...analysisResults,
                graph: analysisResults.graph || analysisResults.graphData?.graph
            };
            ranking.explanation = this.generateRankingExplanation(ranking, explanationData);
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
        // CRITICAL FIX: Get graph from the right location
        const graph = analysisResults.graph || analysisResults.graphData?.graph || {};
        const node = graph.nodes?.get(ranking.nodeUri);
        const connections = graph.adjacency?.get(ranking.nodeUri)?.size || 0;
        
        const nodeType = node?.source || 'unknown';
        const nodeLabel = node?.label || ranking.nodeUri.split('/').pop();
        
        // Debug: Log if we're missing critical data
        if (!graph.nodes || graph.nodes.size === 0) {
            console.log(chalk.yellow(`   ⚠️  generateRankingExplanation: No graph.nodes available`));
        }
        if (!graph.adjacency || graph.adjacency.size === 0) {
            console.log(chalk.yellow(`   ⚠️  generateRankingExplanation: No graph.adjacency available`));
        }
        
        let explanation = `${nodeType} corpuscle with ${connections} connections`;
        
        // Add k-core explanation (or alternative metric explanation)
        if (ranking.kCoreScore > 0) {
            // Check if this looks like an alternative metric (non-integer values)
            const isAlternativeMetric = !Number.isInteger(ranking.kCoreScore) || 
                                      (ranking.kCoreScore < 1 && ranking.kCoreScore > 0);
            
            if (isAlternativeMetric) {
                explanation += `, structural score ${ranking.kCoreScore.toFixed(2)}`;
                if (ranking.kCoreScore >= 0.7) {
                    explanation += ' (high structural importance)';
                } else if (ranking.kCoreScore >= 0.4) {
                    explanation += ' (moderate structural importance)';
                } else {
                    explanation += ' (low structural importance)';
                }
            } else {
                explanation += `, k-core ${ranking.kCoreScore.toFixed(1)}`;
                if (ranking.kCoreScore >= 3) {
                    explanation += ' (highly connected)';
                } else if (ranking.kCoreScore >= 2) {
                    explanation += ' (moderately connected)';
                } else {
                    explanation += ' (lightly connected)';
                }
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
     * Create count queries for data validation
     * @param {string} type - Type of count query
     * @returns {string} Query template
     */
    createCountQuery(type) {
        switch (type) {
            case 'beerqa-questions':
                return `
SELECT (COUNT(*) as ?count) WHERE {
    GRAPH <\${graphURI}> {
        ?s a ragno:Corpuscle ;
           ragno:corpuscleType "\${corpuscleType}" .
    }
}`;
            case 'wikipedia-corpuscles':
                return `
SELECT (COUNT(*) as ?count) WHERE {
    GRAPH <\${graphURI}> {
        ?s a ragno:Corpuscle .
    }
}`;
            case 'relationships':
                return `
SELECT (COUNT(*) as ?count) WHERE {
    {
        GRAPH <\${beerqaGraphURI}> {
            ?s a ragno:Relationship .
        }
    } UNION {
        GRAPH <\${wikipediaGraphURI}> {
            ?s a ragno:Relationship .
        }
    }
}`;
            case 'embeddings':
                return `
SELECT (COUNT(*) as ?count) WHERE {
    {
        GRAPH <\${beerqaGraphURI}> {
            ?s ragno:hasAttribute ?attr .
            ?attr a ragno:VectorEmbedding .
        }
    } UNION {
        GRAPH <\${wikipediaGraphURI}> {
            ?s ragno:hasAttribute ?attr .
            ?attr a ragno:VectorEmbedding .
        }
    }
}`;
            default:
                throw new Error(`Unknown count query type: ${type}`);
        }
    }

    /**
     * Substitute parameters in query template
     * @param {string} template - Query template with ${param} placeholders
     * @param {Object} parameters - Parameters to substitute
     * @returns {string} Query with substituted parameters
     */
    substituteParameters(template, parameters) {
        let query = template;
        for (const [key, value] of Object.entries(parameters)) {
            const placeholder = `\${${key}}`;
            query = query.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
        }
        return query;
    }

    /**
     * Create corpuscle query using SPARQL service
     * @param {Object} parameters - Query parameters
     * @returns {Promise<string>} Formatted query
     */
    async createCorpuscleQuery(parameters) {
        const template = `
SELECT ?corpuscle ?label ?source
WHERE {
    {
        GRAPH <\${beerqaGraphURI}> {
            ?corpuscle a ragno:Corpuscle ;
                      rdfs:label ?label .
            BIND("beerqa" as ?source)
        }
    } UNION {
        GRAPH <\${wikipediaGraphURI}> {
            ?corpuscle a ragno:Corpuscle ;
                      rdfs:label ?label .
            BIND("wikipedia" as ?source)
        }
    }
}
ORDER BY ?corpuscle
`;
        
        const prefixes = await this.queryService.loadPrefixes();
        return prefixes + this.substituteParameters(template, parameters);
    }

    /**
     * Create relationship query using SPARQL service
     * @param {Object} parameters - Query parameters
     * @returns {Promise<string>} Formatted query
     */
    async createRelationshipQuery(parameters) {
        const template = `
SELECT ?sourceCorpuscle ?targetCorpuscle ?weight ?relType
WHERE {
    {
        GRAPH <\${beerqaGraphURI}> {
            ?relationship a ragno:Relationship ;
                         ragno:hasSourceEntity ?sourceCorpuscle ;
                         ragno:hasTargetEntity ?targetCorpuscle .
            OPTIONAL { ?relationship ragno:weight ?weight }
            OPTIONAL { ?relationship ragno:relationshipType ?relType }
        }
    } UNION {
        GRAPH <\${wikipediaGraphURI}> {
            ?relationship a ragno:Relationship ;
                         ragno:hasSourceEntity ?sourceCorpuscle ;
                         ragno:hasTargetEntity ?targetCorpuscle .
            OPTIONAL { ?relationship ragno:weight ?weight }
            OPTIONAL { ?relationship ragno:relationshipType ?relType }
        }
    }
}
`;
        
        const prefixes = await this.queryService.loadPrefixes();
        return prefixes + this.substituteParameters(template, parameters);
    }

    /**
     * Add content-based ranking metrics for sparse graphs
     * @param {Object} graph - Graph structure
     * @param {Object} analysisResults - Analysis results to augment
     */
    async addContentBasedRanking(graph, analysisResults) {
        console.log(chalk.gray('   Computing content-based metrics for sparse graph...'));
        
        try {
            // Query for corpuscles with text content using SPARQL service
            const contentQuery = await this.createCorpuscleQuery({
                beerqaGraphURI: this.options.beerqaGraphURI,
                wikipediaGraphURI: this.options.wikipediaGraphURI
            });
            
            const result = await this.sparqlHelper.executeSelect(contentQuery);
            
            if (!result.success) {
                const errorMsg = result.error || result.statusText || 'Unknown SPARQL error';
                console.log(chalk.yellow(`   ⚠️  Failed to load content for content-based ranking (${result.status}): ${errorMsg}`));
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
                
                // Show appropriate metric label
                const isAlternativeMetric = !Number.isInteger(ranking.kCoreScore) || 
                                          (ranking.kCoreScore < 1 && ranking.kCoreScore > 0);
                const kCoreLabel = isAlternativeMetric ? 'Structural:' : 'K-core:';
                console.log(`      ${chalk.gray(kCoreLabel)} ${chalk.white(ranking.kCoreScore.toFixed(4))}`);
                
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

    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.queryService) {
            this.queryService.cleanup();
        }
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
        console.log(`   ${chalk.cyan('Query Service:')} ${chalk.white('Enabled (with caching and prefix management)')}`);
        console.log(`   ${chalk.cyan('Similarity Threshold:')} ${chalk.white(options.similarityThreshold)}`);
        console.log(`   ${chalk.cyan('Top-K Results:')} ${chalk.white(options.topKResults)}`);
        console.log(`   ${chalk.cyan('Export to SPARQL:')} ${chalk.white(options.exportToSPARQL ? 'Yes' : 'No')}`);
        console.log('');

        const ranker = new CorpuscleRanking(config, options);
        
        try {
            const result = await ranker.runCorpuscleRanking();
            return result;
        } finally {
            // Cleanup resources
            await ranker.cleanup();
        }

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

    } catch (error) {
        console.log(chalk.red('❌ Corpuscle ranking failed:', error.message));
        
        // Enhanced error reporting for SPARQL issues
        if (error.message.includes('Parse error') || error.message.includes('Unresolved prefixed name')) {
            console.log('');
            console.log(chalk.bold.yellow('💡 SPARQL Error Troubleshooting:'));
            console.log(chalk.yellow('  • Check that SPARQL endpoint is accessible'));
            console.log(chalk.yellow('  • Verify namespace prefixes are properly defined'));
            console.log(chalk.yellow('  • Ensure graph URIs exist and contain expected data'));
        }
        
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