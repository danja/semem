/**
 * GraphAnalytics.js - Core graph algorithms for Ragno knowledge graphs
 * 
 * This module provides fundamental graph analysis algorithms optimized for
 * RDF-based knowledge graphs following the ragno ontology. It includes
 * implementations of key algorithms from the ragno reference specification.
 * 
 * Key Algorithms:
 * - K-core decomposition for node importance ranking
 * - Betweenness centrality for identifying bridge nodes
 * - Graph connectivity and traversal utilities
 * - RDF-aware graph construction from datasets
 */

import rdf from 'rdf-ext'
import { logger } from '../../Utils.js'

export default class GraphAnalytics {
    constructor(options = {}) {
        this.options = {
            maxIterations: options.maxIterations || 1000,
            convergenceThreshold: options.convergenceThreshold || 1e-6,
            logProgress: options.logProgress || false,
            ...options
        }
        
        this.stats = {
            lastAnalysis: null,
            nodeCount: 0,
            edgeCount: 0,
            components: 0
        }
        
        logger.debug('GraphAnalytics initialized')
    }
    
    /**
     * Build adjacency representation from RDF dataset
     * @param {Dataset} dataset - RDF-Ext dataset
     * @param {Object} [options] - Graph construction options
     * @returns {Object} Graph representation with nodes and edges
     */
    buildGraphFromRDF(dataset, options = {}) {
        const graph = {
            nodes: new Map(), // node URI -> { uri, type, properties }
            edges: new Map(), // edge key -> { source, target, weight, properties }
            adjacency: new Map(), // node URI -> Set of connected node URIs
            inDegree: new Map(), // node URI -> number
            outDegree: new Map() // node URI -> number
        }
        
        // Extract nodes (entities only, not relationships)
        for (const quad of dataset) {
            if (quad.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
                const nodeUri = quad.subject.value
                const nodeType = quad.object.value
                
                // Only include Entity types, not Relationship types
                if (nodeType === 'http://purl.org/stuff/ragno/Entity' && !graph.nodes.has(nodeUri)) {
                    graph.nodes.set(nodeUri, {
                        uri: nodeUri,
                        type: nodeType,
                        properties: new Map()
                    })
                    graph.adjacency.set(nodeUri, new Set())
                    graph.inDegree.set(nodeUri, 0)
                    graph.outDegree.set(nodeUri, 0)
                }
            }
        }
        
        // Extract edges from relationships
        for (const quad of dataset) {
            if (quad.predicate.value === 'http://purl.org/stuff/ragno/hasSourceEntity') {
                const relationshipUri = quad.subject.value
                const sourceUri = quad.object.value
                
                // Find target entity for this relationship
                const targetQuads = [...dataset.match(quad.subject, rdf.namedNode('http://purl.org/stuff/ragno/hasTargetEntity'))]
                if (targetQuads.length > 0) {
                    const targetUri = targetQuads[0].object.value
                    
                    // Get weight if available
                    let weight = 1.0
                    const weightQuads = [...dataset.match(quad.subject, rdf.namedNode('http://purl.org/stuff/ragno/hasWeight'))]
                    if (weightQuads.length > 0) {
                        weight = parseFloat(weightQuads[0].object.value) || 1.0
                    }
                    
                    // Create edge
                    const edgeKey = `${sourceUri}->${targetUri}`
                    graph.edges.set(edgeKey, {
                        source: sourceUri,
                        target: targetUri,
                        weight,
                        relationshipUri,
                        properties: new Map()
                    })
                    
                    // Update adjacency and degree information
                    if (graph.adjacency.has(sourceUri)) {
                        graph.adjacency.get(sourceUri).add(targetUri)
                        graph.outDegree.set(sourceUri, graph.outDegree.get(sourceUri) + 1)
                    }
                    
                    if (graph.adjacency.has(targetUri)) {
                        graph.inDegree.set(targetUri, graph.inDegree.get(targetUri) + 1)
                    }
                    
                    // Add reverse edge for undirected analysis if needed
                    if (options.undirected) {
                        if (graph.adjacency.has(targetUri)) {
                            graph.adjacency.get(targetUri).add(sourceUri)
                        }
                    }
                }
            }
        }
        
        // Update statistics
        this.stats.nodeCount = graph.nodes.size
        this.stats.edgeCount = graph.edges.size
        this.stats.lastAnalysis = new Date()
        
        logger.info(`Built graph with ${graph.nodes.size} nodes and ${graph.edges.size} edges`)
        return graph
    }
    
    /**
     * Compute K-core decomposition
     * K-core of a graph is the maximal subgraph where each vertex has at least k neighbors
     * @param {Object} graph - Graph representation from buildGraphFromRDF
     * @returns {Object} K-core decomposition results
     */
    computeKCore(graph) {
        logger.info('Computing K-core decomposition...')
        
        const coreNumbers = new Map() // node -> core number
        const nodeDegrees = new Map() // current degrees during algorithm
        const remainingNodes = new Set(graph.nodes.keys())
        
        // Initialize degrees
        for (const [nodeUri, _] of graph.nodes) {
            const degree = graph.adjacency.get(nodeUri)?.size || 0
            nodeDegrees.set(nodeUri, degree)
        }
        
        let currentK = 0
        
        while (remainingNodes.size > 0) {
            // Find minimum degree among remaining nodes
            let minDegree = Infinity
            for (const nodeUri of remainingNodes) {
                const degree = nodeDegrees.get(nodeUri)
                if (degree < minDegree) {
                    minDegree = degree
                }
            }
            
            currentK = Math.max(currentK, minDegree)
            
            // Remove all nodes with degree <= currentK
            const toRemove = []
            for (const nodeUri of remainingNodes) {
                if (nodeDegrees.get(nodeUri) <= currentK) {
                    toRemove.push(nodeUri)
                }
            }
            
            for (const nodeUri of toRemove) {
                coreNumbers.set(nodeUri, currentK)
                remainingNodes.delete(nodeUri)
                
                // Update degrees of neighbors
                const neighbors = graph.adjacency.get(nodeUri) || new Set()
                for (const neighborUri of neighbors) {
                    if (remainingNodes.has(neighborUri)) {
                        const currentDegree = nodeDegrees.get(neighborUri)
                        nodeDegrees.set(neighborUri, currentDegree - 1)
                    }
                }
            }
        }
        
        // Compute statistics
        const coreStats = new Map()
        for (const [nodeUri, coreNumber] of coreNumbers) {
            if (!coreStats.has(coreNumber)) {
                coreStats.set(coreNumber, 0)
            }
            coreStats.set(coreNumber, coreStats.get(coreNumber) + 1)
        }
        
        const maxCore = Math.max(...coreNumbers.values())
        
        logger.info(`K-core decomposition complete. Max core: ${maxCore}`)
        
        return {
            coreNumbers,
            coreStats,
            maxCore,
            algorithm: 'k-core',
            timestamp: new Date()
        }
    }
    
    /**
     * Compute betweenness centrality using Brandes' algorithm
     * @param {Object} graph - Graph representation from buildGraphFromRDF
     * @param {Object} [options] - Algorithm options
     * @returns {Object} Betweenness centrality results
     */
    computeBetweennessCentrality(graph, options = {}) {
        logger.info('Computing betweenness centrality...')
        
        const centrality = new Map()
        const nodes = Array.from(graph.nodes.keys())
        
        // Initialize centrality scores
        for (const nodeUri of nodes) {
            centrality.set(nodeUri, 0.0)
        }
        
        // Brandes' algorithm
        for (const source of nodes) {
            // BFS from source
            const stack = []
            const predecessors = new Map()
            const distances = new Map()
            const numPaths = new Map()
            const delta = new Map()
            
            // Initialize
            for (const node of nodes) {
                predecessors.set(node, [])
                distances.set(node, -1)
                numPaths.set(node, 0)
                delta.set(node, 0)
            }
            
            distances.set(source, 0)
            numPaths.set(source, 1)
            
            const queue = [source]
            
            // BFS
            while (queue.length > 0) {
                const current = queue.shift()
                stack.push(current)
                
                const neighbors = graph.adjacency.get(current) || new Set()
                for (const neighbor of neighbors) {
                    // First time we reach this neighbor?
                    if (distances.get(neighbor) < 0) {
                        queue.push(neighbor)
                        distances.set(neighbor, distances.get(current) + 1)
                    }
                    
                    // Shortest path to neighbor via current?
                    if (distances.get(neighbor) === distances.get(current) + 1) {
                        numPaths.set(neighbor, numPaths.get(neighbor) + numPaths.get(current))
                        predecessors.get(neighbor).push(current)
                    }
                }
            }
            
            // Accumulation phase
            while (stack.length > 0) {
                const w = stack.pop()
                for (const predecessor of predecessors.get(w)) {
                    const contribution = (numPaths.get(predecessor) / numPaths.get(w)) * (1 + delta.get(w))
                    delta.set(predecessor, delta.get(predecessor) + contribution)
                }
                
                if (w !== source) {
                    centrality.set(w, centrality.get(w) + delta.get(w))
                }
            }
        }
        
        // Normalize for undirected graph
        const n = nodes.length
        const normalizationFactor = n > 2 ? 2.0 / ((n - 1) * (n - 2)) : 1.0
        
        for (const [nodeUri, score] of centrality) {
            centrality.set(nodeUri, score * normalizationFactor)
        }
        
        // Compute statistics
        const scores = Array.from(centrality.values())
        const maxCentrality = Math.max(...scores)
        const minCentrality = Math.min(...scores)
        const avgCentrality = scores.reduce((a, b) => a + b, 0) / scores.length
        
        logger.info(`Betweenness centrality complete. Max: ${maxCentrality.toFixed(4)}`)
        
        return {
            centrality,
            maxCentrality,
            minCentrality,
            avgCentrality,
            algorithm: 'betweenness-centrality',
            timestamp: new Date()
        }
    }
    
    /**
     * Find connected components using DFS
     * @param {Object} graph - Graph representation from buildGraphFromRDF
     * @returns {Object} Connected components information
     */
    findConnectedComponents(graph) {
        logger.info('Finding connected components...')
        
        const visited = new Set()
        const components = []
        const nodeToComponent = new Map()
        
        const dfs = (startNode, componentId) => {
            const stack = [startNode]
            const component = new Set()
            
            while (stack.length > 0) {
                const node = stack.pop()
                
                if (visited.has(node)) continue
                
                visited.add(node)
                component.add(node)
                nodeToComponent.set(node, componentId)
                
                const neighbors = graph.adjacency.get(node) || new Set()
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        stack.push(neighbor)
                    }
                }
            }
            
            return component
        }
        
        let componentId = 0
        for (const nodeUri of graph.nodes.keys()) {
            if (!visited.has(nodeUri)) {
                const component = dfs(nodeUri, componentId)
                components.push({
                    id: componentId,
                    nodes: component,
                    size: component.size
                })
                componentId++
            }
        }
        
        // Sort components by size (largest first)
        components.sort((a, b) => b.size - a.size)
        
        this.stats.components = components.length
        
        logger.info(`Found ${components.length} connected components`)
        
        return {
            components,
            nodeToComponent,
            largestComponent: components[0],
            algorithm: 'connected-components',
            timestamp: new Date()
        }
    }
    
    /**
     * Compute basic graph statistics
     * @param {Object} graph - Graph representation from buildGraphFromRDF
     * @returns {Object} Graph statistics
     */
    computeGraphStatistics(graph) {
        logger.info('Computing graph statistics...')
        
        const degrees = []
        let totalWeight = 0
        let maxWeight = 0
        let minWeight = Infinity
        
        // Degree distribution
        for (const [nodeUri, _] of graph.nodes) {
            const degree = graph.adjacency.get(nodeUri)?.size || 0
            degrees.push(degree)
        }
        
        // Edge weight statistics
        for (const [_, edge] of graph.edges) {
            totalWeight += edge.weight
            maxWeight = Math.max(maxWeight, edge.weight)
            minWeight = Math.min(minWeight, edge.weight)
        }
        
        const avgDegree = degrees.length > 0 ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0
        const maxDegree = degrees.length > 0 ? Math.max(...degrees) : 0
        const minDegree = degrees.length > 0 ? Math.min(...degrees) : 0
        const avgWeight = graph.edges.size > 0 ? totalWeight / graph.edges.size : 0
        
        // Graph density
        const nodeCount = graph.nodes.size
        const maxPossibleEdges = nodeCount * (nodeCount - 1) / 2
        const density = maxPossibleEdges > 0 ? graph.edges.size / maxPossibleEdges : 0
        
        const stats = {
            nodeCount,
            edgeCount: graph.edges.size,
            density,
            avgDegree,
            maxDegree,
            minDegree,
            avgWeight,
            maxWeight: maxWeight === -Infinity ? 0 : maxWeight,
            minWeight: minWeight === Infinity ? 0 : minWeight,
            totalWeight,
            algorithm: 'graph-statistics',
            timestamp: new Date()
        }
        
        logger.info(`Graph statistics: ${nodeCount} nodes, ${graph.edges.size} edges, density: ${density.toFixed(4)}`)
        
        return stats
    }
    
    /**
     * Get nodes with highest scores from analysis results
     * @param {Map} scores - Node URI -> score mapping
     * @param {number} [k=10] - Number of top nodes to return
     * @returns {Array} Top k nodes with scores
     */
    getTopKNodes(scores, k = 10) {
        return Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, k)
            .map(([nodeUri, score]) => ({ nodeUri, score }))
    }
    
    /**
     * Export analysis results to RDF format
     * @param {Object} results - Analysis results
     * @param {Dataset} targetDataset - Target RDF dataset
     * @param {string} [graphUri] - Optional graph context URI
     */
    exportResultsToRDF(results, targetDataset, graphUri) {
        logger.info('Exporting analysis results to RDF...')
        
        const analysisUri = `http://example.org/ragno/analysis/${Date.now()}`
        const analysisNode = rdf.namedNode(analysisUri)
        
        // Add analysis metadata
        targetDataset.add(rdf.quad(
            analysisNode,
            rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            rdf.namedNode('http://purl.org/stuff/ragno/GraphAnalysis')
        ))
        
        targetDataset.add(rdf.quad(
            analysisNode,
            rdf.namedNode('http://purl.org/stuff/ragno/algorithm'),
            rdf.literal(results.algorithm)
        ))
        
        targetDataset.add(rdf.quad(
            analysisNode,
            rdf.namedNode('http://purl.org/dc/terms/created'),
            rdf.literal(results.timestamp.toISOString(), rdf.namedNode('http://www.w3.org/2001/XMLSchema#dateTime'))
        ))
        
        // Export algorithm-specific results
        if (results.coreNumbers) {
            // K-core results
            for (const [nodeUri, coreNumber] of results.coreNumbers) {
                targetDataset.add(rdf.quad(
                    rdf.namedNode(nodeUri),
                    rdf.namedNode('http://purl.org/stuff/ragno/hasCoreNumber'),
                    rdf.literal(coreNumber)
                ))
            }
        }
        
        if (results.centrality) {
            // Centrality results
            for (const [nodeUri, score] of results.centrality) {
                targetDataset.add(rdf.quad(
                    rdf.namedNode(nodeUri),
                    rdf.namedNode('http://purl.org/stuff/ragno/hasBetweennessCentrality'),
                    rdf.literal(score)
                ))
            }
        }
        
        logger.info('Analysis results exported to RDF')
    }
    
    /**
     * Get current statistics
     * @returns {Object} Current analysis statistics
     */
    getStatistics() {
        return { ...this.stats }
    }
}