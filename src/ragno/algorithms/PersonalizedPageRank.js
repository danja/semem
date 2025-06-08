/**
 * PersonalizedPageRank.js - PPR algorithm for Ragno semantic search
 * 
 * This module implements Personalized PageRank for the ragno knowledge graph
 * system. PPR is used for semantic search traversal, allowing the system to
 * discover related nodes through graph structure while maintaining relevance
 * to query entry points.
 * 
 * Key Features:
 * - Personalized PageRank with teleportation
 * - Multi-entry point support for complex queries
 * - Type-aware traversal (respecting ragno ontology types)
 * - Shallow vs deep traversal modes
 * - Cross-node type discovery
 * - Integration with search systems
 */

import { logger } from '../../Utils.js'
import rdf from 'rdf-ext'

export default class PersonalizedPageRank {
    constructor(options = {}) {
        this.options = {
            alpha: options.alpha || 0.15, // Teleportation probability
            maxIterations: options.maxIterations || 50,
            convergenceThreshold: options.convergenceThreshold || 1e-6,
            shallowIterations: options.shallowIterations || 2,
            deepIterations: options.deepIterations || 10,
            topKPerType: options.topKPerType || 5,
            logProgress: options.logProgress || false,
            ...options
        }
        
        this.stats = {
            lastRun: null,
            iterations: 0,
            convergence: 0,
            entryPointCount: 0,
            resultCount: 0
        }
        
        logger.debug('PersonalizedPageRank initialized')
    }
    
    /**
     * Run Personalized PageRank from entry points
     * @param {Object} graph - Graph representation from GraphAnalytics
     * @param {Array} entryPoints - Array of entry point node URIs
     * @param {Object} [options] - Algorithm options
     * @returns {Object} PPR results with scores and rankings
     */
    runPPR(graph, entryPoints, options = {}) {
        logger.info(`Running Personalized PageRank from ${entryPoints.length} entry points...`)
        
        const opts = { ...this.options, ...options }
        const nodes = Array.from(graph.nodes.keys())
        const n = nodes.length
        
        if (n === 0) {
            logger.warn('Empty graph provided to PPR')
            return this.createEmptyResults()
        }
        
        // Validate entry points
        const validEntryPoints = entryPoints.filter(ep => graph.nodes.has(ep))
        if (validEntryPoints.length === 0) {
            logger.warn('No valid entry points found in graph')
            return this.createEmptyResults()
        }
        
        // Initialize probability vectors
        let currentVector = new Map()
        const teleportVector = new Map()
        
        // Initialize all nodes with zero probability
        for (const node of nodes) {
            currentVector.set(node, 0.0)
            teleportVector.set(node, 0.0)
        }
        
        // Set uniform probability for entry points in teleport vector
        const entryProb = 1.0 / validEntryPoints.length
        for (const entryPoint of validEntryPoints) {
            teleportVector.set(entryPoint, entryProb)
            currentVector.set(entryPoint, entryProb / nodes.length)
        }
        
        // Build transition matrix (as adjacency with weights)
        const transitions = this.buildTransitionMatrix(graph)
        
        // Power iteration
        let iteration = 0
        let converged = false
        
        while (!converged && iteration < opts.maxIterations) {
            iteration++
            
            const nextVector = new Map()
            
            // Initialize next vector
            for (const node of nodes) {
                nextVector.set(node, 0.0)
            }
            
            // Apply transition matrix
            for (const sourceNode of nodes) {
                const sourceProb = currentVector.get(sourceNode)
                const neighbors = transitions.get(sourceNode) || new Map()
                
                if (neighbors.size > 0) {
                    // Distribute probability to neighbors
                    for (const [targetNode, weight] of neighbors) {
                        const currentTarget = nextVector.get(targetNode) || 0.0
                        nextVector.set(targetNode, currentTarget + sourceProb * weight)
                    }
                } else {
                    // Dangling node: distribute to all nodes uniformly
                    const uniformProb = sourceProb / nodes.length
                    for (const node of nodes) {
                        const current = nextVector.get(node)
                        nextVector.set(node, current + uniformProb)
                    }
                }
            }
            
            // Apply teleportation
            for (const node of nodes) {
                const randomWalk = (1.0 - opts.alpha) * nextVector.get(node)
                const teleport = opts.alpha * teleportVector.get(node)
                nextVector.set(node, randomWalk + teleport)
            }
            
            // Check convergence
            let diff = 0.0
            for (const node of nodes) {
                const delta = Math.abs(nextVector.get(node) - currentVector.get(node))
                diff = Math.max(diff, delta)
            }
            
            if (diff < opts.convergenceThreshold) {
                converged = true
            }
            
            currentVector = nextVector
            
            if (opts.logProgress && iteration % 10 === 0) {
                logger.info(`PPR iteration ${iteration}, max change: ${diff.toFixed(6)}`)
            }
        }
        
        // Normalize final vector
        const totalProb = Array.from(currentVector.values()).reduce((sum, prob) => sum + prob, 0)
        if (totalProb > 0) {
            for (const [node, prob] of currentVector) {
                currentVector.set(node, prob / totalProb)
            }
        }
        
        // Generate results
        const results = this.processResults(graph, currentVector, validEntryPoints, opts)
        
        // Update statistics
        this.stats.lastRun = new Date()
        this.stats.iterations = iteration
        this.stats.convergence = converged
        this.stats.entryPointCount = validEntryPoints.length
        this.stats.resultCount = results.rankedNodes.length
        
        logger.info(`PPR completed in ${iteration} iterations, converged: ${converged}`)
        
        return results
    }
    
    /**
     * Run shallow PPR for quick traversal (2-3 iterations)
     * @param {Object} graph - Graph representation
     * @param {Array} entryPoints - Entry point node URIs
     * @param {Object} [options] - Algorithm options
     * @returns {Object} Shallow PPR results
     */
    runShallowPPR(graph, entryPoints, options = {}) {
        return this.runPPR(graph, entryPoints, {
            ...options,
            maxIterations: this.options.shallowIterations,
            shallow: true
        })
    }
    
    /**
     * Run deep PPR for comprehensive traversal
     * @param {Object} graph - Graph representation
     * @param {Array} entryPoints - Entry point node URIs
     * @param {Object} [options] - Algorithm options
     * @returns {Object} Deep PPR results
     */
    runDeepPPR(graph, entryPoints, options = {}) {
        return this.runPPR(graph, entryPoints, {
            ...options,
            maxIterations: this.options.deepIterations,
            deep: true
        })
    }
    
    /**
     * Build transition matrix from graph adjacency
     * @param {Object} graph - Graph representation
     * @returns {Map} Transition probabilities
     */
    buildTransitionMatrix(graph) {
        const transitions = new Map()
        
        for (const [sourceNode, neighbors] of graph.adjacency) {
            const outLinks = new Map()
            let totalWeight = 0
            
            // Calculate total outgoing weight
            for (const targetNode of neighbors) {
                const edgeKey = `${sourceNode}->${targetNode}`
                const reverseEdgeKey = `${targetNode}->${sourceNode}`
                
                const edge = graph.edges.get(edgeKey) || graph.edges.get(reverseEdgeKey)
                const weight = edge ? edge.weight : 1.0
                
                outLinks.set(targetNode, weight)
                totalWeight += weight
            }
            
            // Normalize to probabilities
            if (totalWeight > 0) {
                const normalizedLinks = new Map()
                for (const [targetNode, weight] of outLinks) {
                    normalizedLinks.set(targetNode, weight / totalWeight)
                }
                transitions.set(sourceNode, normalizedLinks)
            } else {
                transitions.set(sourceNode, new Map())
            }
        }
        
        return transitions
    }
    
    /**
     * Process PPR results and generate rankings
     * @param {Object} graph - Graph representation
     * @param {Map} scores - PPR probability scores
     * @param {Array} entryPoints - Original entry points
     * @param {Object} options - Algorithm options
     * @returns {Object} Processed results
     */
    processResults(graph, scores, entryPoints, options) {
        // Filter out entry points from results (they have high scores by design)
        const entryPointSet = new Set(entryPoints)
        const filteredScores = new Map()
        
        for (const [node, score] of scores) {
            if (!entryPointSet.has(node) && score > 0) {
                filteredScores.set(node, score)
            }
        }
        
        // Group by node type
        const typeGroups = this.groupNodesByType(graph, filteredScores)
        
        // Get top-k per type
        const topKPerType = new Map()
        for (const [nodeType, nodeScores] of typeGroups) {
            const topK = Array.from(nodeScores.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, options.topKPerType || this.options.topKPerType)
            
            topKPerType.set(nodeType, topK.map(([node, score]) => ({
                nodeUri: node,
                score,
                type: nodeType
            })))
        }
        
        // Overall ranking
        const rankedNodes = Array.from(filteredScores.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([node, score]) => ({
                nodeUri: node,
                score,
                type: this.getNodeType(graph, node)
            }))
        
        // Cross-type discovery (nodes that connect different types)
        const crossTypeNodes = this.findCrossTypeNodes(graph, rankedNodes.slice(0, 50))
        
        return {
            scores: filteredScores,
            rankedNodes,
            topKPerType,
            crossTypeNodes,
            entryPoints,
            algorithm: 'personalized-pagerank',
            options: {
                alpha: options.alpha,
                iterations: this.stats.iterations,
                shallow: options.shallow || false,
                deep: options.deep || false
            },
            timestamp: new Date()
        }
    }
    
    /**
     * Group nodes by their ragno ontology type
     * @param {Object} graph - Graph representation
     * @param {Map} scores - Node scores
     * @returns {Map} Type to node scores mapping
     */
    groupNodesByType(graph, scores) {
        const typeGroups = new Map()
        
        for (const [nodeUri, score] of scores) {
            const nodeType = this.getNodeType(graph, nodeUri)
            
            if (!typeGroups.has(nodeType)) {
                typeGroups.set(nodeType, new Map())
            }
            
            typeGroups.get(nodeType).set(nodeUri, score)
        }
        
        return typeGroups
    }
    
    /**
     * Get the primary ragno type for a node
     * @param {Object} graph - Graph representation
     * @param {string} nodeUri - Node URI
     * @returns {string} Node type
     */
    getNodeType(graph, nodeUri) {
        const node = graph.nodes.get(nodeUri)
        if (!node) return 'unknown'
        
        const nodeType = node.type || 'unknown'
        
        // Map to ragno types
        if (nodeType.includes('Entity')) return 'ragno:Entity'
        if (nodeType.includes('Relationship')) return 'ragno:Relationship'
        if (nodeType.includes('Unit')) return 'ragno:Unit'
        if (nodeType.includes('Attribute')) return 'ragno:Attribute'
        if (nodeType.includes('Community')) return 'ragno:CommunityElement'
        if (nodeType.includes('Text')) return 'ragno:TextElement'
        
        return nodeType
    }
    
    /**
     * Find nodes that connect different types (bridge nodes)
     * @param {Object} graph - Graph representation
     * @param {Array} topNodes - Top-ranked nodes to analyze
     * @returns {Array} Cross-type bridge nodes
     */
    findCrossTypeNodes(graph, topNodes) {
        const crossTypeNodes = []
        
        for (const node of topNodes) {
            const nodeType = node.type
            const neighbors = graph.adjacency.get(node.nodeUri) || new Set()
            
            const neighborTypes = new Set()
            for (const neighborUri of neighbors) {
                const neighborType = this.getNodeType(graph, neighborUri)
                if (neighborType !== nodeType) {
                    neighborTypes.add(neighborType)
                }
            }
            
            if (neighborTypes.size > 1) {
                crossTypeNodes.push({
                    ...node,
                    connectedTypes: Array.from(neighborTypes),
                    bridgeScore: neighborTypes.size
                })
            }
        }
        
        // Sort by bridge score (how many different types they connect)
        crossTypeNodes.sort((a, b) => b.bridgeScore - a.bridgeScore)
        
        return crossTypeNodes
    }
    
    /**
     * Create empty results structure
     * @returns {Object} Empty results
     */
    createEmptyResults() {
        return {
            scores: new Map(),
            rankedNodes: [],
            topKPerType: new Map(),
            crossTypeNodes: [],
            entryPoints: [],
            algorithm: 'personalized-pagerank',
            options: {},
            timestamp: new Date()
        }
    }
    
    /**
     * Combine results from multiple PPR runs
     * @param {Array} resultsArray - Array of PPR results
     * @param {Object} [options] - Combination options
     * @returns {Object} Combined results
     */
    combineResults(resultsArray, options = {}) {
        if (resultsArray.length === 0) {
            return this.createEmptyResults()
        }
        
        if (resultsArray.length === 1) {
            return resultsArray[0]
        }
        
        logger.info(`Combining ${resultsArray.length} PPR results...`)
        
        const combinedScores = new Map()
        const allEntryPoints = new Set()
        
        // Combine scores using weighted average
        for (const results of resultsArray) {
            const weight = options.equalWeights ? 1.0 / resultsArray.length : 1.0
            
            for (const [nodeUri, score] of results.scores) {
                const currentScore = combinedScores.get(nodeUri) || 0
                combinedScores.set(nodeUri, currentScore + score * weight)
            }
            
            // Collect all entry points
            for (const ep of results.entryPoints) {
                allEntryPoints.add(ep)
            }
        }
        
        // Generate combined rankings
        const rankedNodes = Array.from(combinedScores.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([nodeUri, score]) => ({
                nodeUri,
                score,
                type: 'combined'
            }))
        
        return {
            scores: combinedScores,
            rankedNodes,
            topKPerType: new Map(),
            crossTypeNodes: [],
            entryPoints: Array.from(allEntryPoints),
            algorithm: 'combined-personalized-pagerank',
            options: { combined: true, runs: resultsArray.length },
            timestamp: new Date()
        }
    }
    
    /**
     * Export PPR results to RDF format
     * @param {Object} results - PPR results
     * @param {Dataset} targetDataset - Target RDF dataset
     */
    exportResultsToRDF(results, targetDataset) {
        logger.info('Exporting PPR results to RDF...')
        
        const analysisUri = `http://example.org/ragno/ppr-analysis/${Date.now()}`
        const analysisNode = rdf.namedNode(analysisUri)
        
        // Add analysis metadata
        targetDataset.add(rdf.quad(
            analysisNode,
            rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            rdf.namedNode('http://purl.org/stuff/ragno/PPRAnalysis')
        ))
        
        targetDataset.add(rdf.quad(
            analysisNode,
            rdf.namedNode('http://purl.org/stuff/ragno/algorithm'),
            rdf.literal(results.algorithm)
        ))
        
        targetDataset.add(rdf.quad(
            analysisNode,
            rdf.namedNode('http://purl.org/stuff/ragno/alpha'),
            rdf.literal(results.options.alpha || this.options.alpha)
        ))
        
        // Export entry points
        for (const entryPoint of results.entryPoints) {
            targetDataset.add(rdf.quad(
                analysisNode,
                rdf.namedNode('http://purl.org/stuff/ragno/hasEntryPoint'),
                rdf.namedNode(entryPoint)
            ))
        }
        
        // Export PPR scores
        for (const [nodeUri, score] of results.scores) {
            targetDataset.add(rdf.quad(
                rdf.namedNode(nodeUri),
                rdf.namedNode('http://purl.org/stuff/ragno/hasPPRScore'),
                rdf.literal(score)
            ))
        }
        
        logger.info('PPR results exported to RDF')
    }
    
    /**
     * Get current statistics
     * @returns {Object} Current PPR statistics
     */
    getStatistics() {
        return { ...this.stats }
    }
}