/**
 * algorithms/index.js - Ragno Graph Algorithms Suite
 * 
 * This module provides a comprehensive suite of graph algorithms optimized
 * for RDF-based knowledge graphs following the ragno ontology. It integrates
 * all the core algorithms needed for advanced graph analysis and semantic search.
 * 
 * Available Algorithms:
 * - K-core decomposition for node importance ranking
 * - Betweenness centrality for identifying bridge nodes
 * - Leiden clustering for community detection
 * - Personalized PageRank for semantic search traversal
 * - Graph connectivity and statistical analysis
 * 
 * Usage:
 * ```javascript
 * import RagnoAlgorithms from './algorithms/index.js'
 * 
 * const algorithms = new RagnoAlgorithms()
 * const results = await algorithms.runFullAnalysis(rdfDataset)
 * ```
 */

import rdf from 'rdf-ext'
import GraphAnalytics from './GraphAnalytics.js'
import CommunityDetection from './CommunityDetection.js'
import PersonalizedPageRank from './PersonalizedPageRank.js'
import Hyde from './Hyde.js'
import { logger } from '../../Utils.js'

export default class RagnoAlgorithms {
    constructor(options = {}) {
        this.options = {
            // Graph analytics options
            maxIterations: options.maxIterations || 1000,
            convergenceThreshold: options.convergenceThreshold || 1e-6,
            
            // Community detection options
            resolution: options.resolution || 1.0,
            minCommunitySize: options.minCommunitySize || 3,
            
            // PPR options
            alpha: options.alpha || 0.15,
            topKPerType: options.topKPerType || 5,
            shallowIterations: options.shallowIterations || 2,
            deepIterations: options.deepIterations || 10,
            
            // General options
            logProgress: options.logProgress || false,
            exportToRDF: options.exportToRDF || false,
            ...options
        }
        
        // Initialize algorithm modules
        this.graphAnalytics = new GraphAnalytics(this.options)
        this.communityDetection = new CommunityDetection(this.options)
        this.personalizedPageRank = new PersonalizedPageRank(this.options)
        this.hyde = new Hyde(this.options)
        
        this.stats = {
            lastFullAnalysis: null,
            analysisCount: 0,
            totalProcessingTime: 0
        }
        
        logger.info('RagnoAlgorithms suite initialized')
    }
    
    /**
     * Run complete graph analysis pipeline
     * @param {Dataset} dataset - RDF-Ext dataset
     * @param {Object} [options] - Analysis options
     * @returns {Object} Complete analysis results
     */
    async runFullAnalysis(dataset, options = {}) {
        const startTime = Date.now()
        logger.info('Starting full Ragno graph analysis pipeline...')
        
        const opts = { ...this.options, ...options }
        const results = {
            timestamp: new Date(),
            options: opts,
            graph: null,
            statistics: null,
            kCore: null,
            centrality: null,
            communities: null,
            components: null,
            processingTime: 0
        }
        
        try {
            // Phase 1: Build graph representation from RDF
            logger.info('Phase 1: Building graph from RDF dataset...')
            const graph = this.graphAnalytics.buildGraphFromRDF(dataset, { undirected: true })
            results.graph = {
                nodeCount: graph.nodes.size,
                edgeCount: graph.edges.size,
                metadata: 'Graph built from RDF dataset'
            }
            
            if (graph.nodes.size === 0) {
                logger.warn('Empty graph - skipping analysis')
                return results
            }
            
            // Phase 2: Basic graph statistics
            logger.info('Phase 2: Computing graph statistics...')
            results.statistics = this.graphAnalytics.computeGraphStatistics(graph)
            
            // Phase 3: Structural analysis
            logger.info('Phase 3: Running structural analysis...')
            
            // K-core decomposition
            if (graph.nodes.size > 1) {
                results.kCore = this.graphAnalytics.computeKCore(graph)
            }
            
            // Betweenness centrality (skip for very large graphs)
            if (graph.nodes.size <= 1000) {
                results.centrality = this.graphAnalytics.computeBetweennessCentrality(graph)
            } else {
                logger.info('Skipping betweenness centrality for large graph (>1000 nodes)')
            }
            
            // Connected components
            results.components = this.graphAnalytics.findConnectedComponents(graph)
            
            // Phase 4: Community detection
            logger.info('Phase 4: Detecting communities...')
            if (graph.nodes.size > 2) {
                results.communities = this.communityDetection.detectCommunities(graph, opts)
            }
            
            // Phase 5: Export to RDF if requested
            if (opts.exportToRDF && opts.targetDataset) {
                logger.info('Phase 5: Exporting results to RDF...')
                this.exportAllResultsToRDF(results, opts.targetDataset)
            }
            
            const endTime = Date.now()
            results.processingTime = endTime - startTime
            
            // Update statistics
            this.stats.lastFullAnalysis = new Date()
            this.stats.analysisCount++
            this.stats.totalProcessingTime += results.processingTime
            
            logger.info(`Full analysis completed in ${results.processingTime}ms`)
            
            return results
            
        } catch (error) {
            logger.error('Error during full analysis:', error)
            throw error
        }
    }
    
    /**
     * Run semantic search using PPR
     * @param {Dataset} dataset - RDF-Ext dataset
     * @param {Array} queryEntities - Entity URIs to start search from
     * @param {Object} [options] - Search options
     * @returns {Object} Search results with ranked nodes
     */
    async runSemanticSearch(dataset, queryEntities, options = {}) {
        logger.info(`Running semantic search from ${queryEntities.length} entities...`)
        
        const opts = { ...this.options, ...options }
        
        // Build graph
        const graph = this.graphAnalytics.buildGraphFromRDF(dataset, { undirected: true })
        
        if (graph.nodes.size === 0) {
            logger.warn('Empty graph for semantic search')
            return { results: [], entryPoints: queryEntities }
        }
        
        // Run appropriate PPR based on options
        let pprResults
        if (opts.shallow) {
            pprResults = this.personalizedPageRank.runShallowPPR(graph, queryEntities, opts)
        } else if (opts.deep) {
            pprResults = this.personalizedPageRank.runDeepPPR(graph, queryEntities, opts)
        } else {
            pprResults = this.personalizedPageRank.runPPR(graph, queryEntities, opts)
        }
        
        // Enhance results with node metadata
        const enhancedResults = this.enhanceSearchResults(pprResults, graph, dataset)
        
        return enhancedResults
    }
    
    /**
     * Enhance search results with additional metadata
     * @param {Object} pprResults - PPR results
     * @param {Object} graph - Graph representation
     * @param {Dataset} dataset - Original RDF dataset
     * @returns {Object} Enhanced results
     */
    enhanceSearchResults(pprResults, graph, dataset) {
        const enhancedNodes = []
        
        for (const node of pprResults.rankedNodes) {
            const nodeData = graph.nodes.get(node.nodeUri)
            const enhanced = {
                ...node,
                metadata: {
                    type: nodeData?.type || 'unknown',
                    connections: graph.adjacency.get(node.nodeUri)?.size || 0
                }
            }
            
            // Add additional RDF properties if available
            const nodeTriples = [...dataset.match(nodeData ? rdf.namedNode(nodeData.uri) : null)]
            enhanced.metadata.tripleCount = nodeTriples.length
            
            enhancedNodes.push(enhanced)
        }
        
        return {
            ...pprResults,
            rankedNodes: enhancedNodes,
            enhanced: true
        }
    }
    
    /**
     * Run targeted analysis for specific algorithms
     * @param {Dataset} dataset - RDF-Ext dataset
     * @param {Array} algorithms - Array of algorithm names
     * @param {Object} [options] - Analysis options
     * @returns {Object} Targeted analysis results
     */
    async runTargetedAnalysis(dataset, algorithms, options = {}) {
        logger.info(`Running targeted analysis: ${algorithms.join(', ')}`)
        
        const graph = this.graphAnalytics.buildGraphFromRDF(dataset, { undirected: true })
        const results = {
            timestamp: new Date(),
            algorithms: algorithms,
            graph: { nodeCount: graph.nodes.size, edgeCount: graph.edges.size }
        }
        
        for (const algorithm of algorithms) {
            switch (algorithm.toLowerCase()) {
                case 'k-core':
                case 'kcore':
                    results.kCore = this.graphAnalytics.computeKCore(graph)
                    break
                    
                case 'centrality':
                case 'betweenness':
                    if (graph.nodes.size <= 1000) {
                        results.centrality = this.graphAnalytics.computeBetweennessCentrality(graph)
                    }
                    break
                    
                case 'communities':
                case 'leiden':
                    if (graph.nodes.size > 2) {
                        results.communities = this.communityDetection.detectCommunities(graph, options)
                    }
                    break
                    
                case 'components':
                    results.components = this.graphAnalytics.findConnectedComponents(graph)
                    break
                    
                case 'statistics':
                case 'stats':
                    results.statistics = this.graphAnalytics.computeGraphStatistics(graph)
                    break
                    
                case 'hyde':
                case 'hypothetical':
                    // Hyde requires different parameters - would need LLM handler
                    logger.info('Hyde algorithm requires LLM handler - use runHydeGeneration method')
                    break
                    
                default:
                    logger.warn(`Unknown algorithm: ${algorithm}`)
            }
        }
        
        return results
    }
    
    /**
     * Get top-k important nodes across all metrics
     * @param {Object} analysisResults - Results from runFullAnalysis
     * @param {number} [k=10] - Number of top nodes to return
     * @returns {Object} Top-k nodes with scores from different algorithms
     */
    getTopKNodes(analysisResults, k = 10) {
        const nodeScores = new Map()
        
        // Collect scores from different algorithms
        if (analysisResults.kCore?.coreNumbers) {
            for (const [nodeUri, coreNumber] of analysisResults.kCore.coreNumbers) {
                if (!nodeScores.has(nodeUri)) {
                    nodeScores.set(nodeUri, {})
                }
                nodeScores.get(nodeUri).coreNumber = coreNumber
            }
        }
        
        if (analysisResults.centrality?.centrality) {
            for (const [nodeUri, centrality] of analysisResults.centrality.centrality) {
                if (!nodeScores.has(nodeUri)) {
                    nodeScores.set(nodeUri, {})
                }
                nodeScores.get(nodeUri).centrality = centrality
            }
        }
        
        // Calculate composite score
        const scoredNodes = []
        for (const [nodeUri, scores] of nodeScores) {
            const coreScore = scores.coreNumber || 0
            const centralityScore = scores.centrality || 0
            
            // Weighted composite score
            const compositeScore = coreScore * 0.6 + centralityScore * 0.4
            
            scoredNodes.push({
                nodeUri,
                compositeScore,
                coreNumber: coreScore,
                centrality: centralityScore
            })
        }
        
        // Sort by composite score and return top-k
        return scoredNodes
            .sort((a, b) => b.compositeScore - a.compositeScore)
            .slice(0, k)
    }
    
    /**
     * Export all analysis results to RDF
     * @param {Object} results - Analysis results
     * @param {Dataset} targetDataset - Target RDF dataset
     */
    exportAllResultsToRDF(results, targetDataset) {
        logger.info('Exporting all analysis results to RDF...')
        
        // Export individual algorithm results
        if (results.kCore) {
            this.graphAnalytics.exportResultsToRDF(results.kCore, targetDataset)
        }
        
        if (results.centrality) {
            this.graphAnalytics.exportResultsToRDF(results.centrality, targetDataset)
        }
        
        if (results.communities) {
            this.communityDetection.exportCommunitiesToRDF(results.communities, targetDataset)
        }
        
        logger.info('All results exported to RDF')
    }
    
    /**
     * Run HyDE hypothesis generation
     * @param {Array|string} inputs - Query strings or entity URIs
     * @param {Object} llmHandler - LLM handler instance
     * @param {Dataset} targetDataset - RDF dataset to augment
     * @param {Object} [options] - Hyde options
     * @returns {Object} Hyde generation results
     */
    async runHydeGeneration(inputs, llmHandler, targetDataset, options = {}) {
        logger.info('Running HyDE hypothesis generation...')
        
        const opts = { ...this.options, ...options }
        return await this.hyde.generateHypotheses(inputs, llmHandler, targetDataset, opts)
    }

    /**
     * Query hypothetical content from dataset
     * @param {Dataset} dataset - RDF dataset to query
     * @param {Object} [filters] - Query filters
     * @returns {Array} Hypothetical content matching filters
     */
    queryHypotheticalContent(dataset, filters = {}) {
        return this.hyde.queryHypotheticalContent(dataset, filters)
    }

    /**
     * Get comprehensive statistics from all algorithm modules
     * @returns {Object} Combined statistics
     */
    getAllStatistics() {
        return {
            suite: this.stats,
            graphAnalytics: this.graphAnalytics.getStatistics(),
            communityDetection: this.communityDetection.getStatistics(),
            personalizedPageRank: this.personalizedPageRank.getStatistics(),
            hyde: this.hyde.getStatistics()
        }
    }
    
    /**
     * Reset all statistics
     */
    resetStatistics() {
        this.stats = {
            lastFullAnalysis: null,
            analysisCount: 0,
            totalProcessingTime: 0
        }
        
        logger.info('Algorithm statistics reset')
    }
}

// Export individual algorithm classes for direct use
export {
    GraphAnalytics,
    CommunityDetection,
    PersonalizedPageRank,
    Hyde
}