
/**
 * CommunityDetection.js - Leiden algorithm implementation for Ragno knowledge graphs
 * 
 * This module implements the Leiden algorithm for community detection in
 * RDF-based knowledge graphs. The Leiden algorithm is an improvement over
 * the Louvain algorithm that guarantees well-connected communities.
 * 
 * Key Features:
 * - Leiden algorithm implementation
 * - Modularity optimization
 * - Community quality metrics
 * - RDF-aware community export
 * - Integration with ragno ontology
 */

import { logger } from '../../Utils.js'
import rdf from 'rdf-ext'

export default class CommunityDetection {
    constructor(options = {}) {
        this.options = {
            resolution: options.resolution || 1.0,
            minCommunitySize: options.minCommunitySize || 3,
            maxIterations: options.maxIterations || 100,
            convergenceThreshold: options.convergenceThreshold || 1e-6,
            randomSeed: options.randomSeed || Math.random(),
            logProgress: options.logProgress || false,
            ...options
        }

        this.stats = {
            lastClustering: null,
            communityCount: 0,
            modularity: 0,
            iterations: 0
        }

        // Initialize random number generator with seed for reproducibility
        this.random = this.seededRandom(this.options.randomSeed)

        logger.debug('CommunityDetection initialized with Leiden algorithm')
    }

    /**
     * Compute Leiden clustering (alias for detectCommunities for pipeline compatibility)
     * @param {Object} graph - Graph representation from GraphAnalytics
     * @param {Object} [options] - Algorithm options
     * @returns {Object} Community detection results
     */
    computeLeidenClustering(graph, options = {}) {
        return this.detectCommunities(graph, options);
    }

    /**
     * Compute Leiden clustering (alias for detectCommunities for pipeline compatibility)
     * @param {Object} graph - Graph representation from GraphAnalytics
     * @param {Object} [options] - Algorithm options
     * @returns {Object} Community detection results
     */
    computeLeidenClustering(graph, options = {}) {
        return this.detectCommunities(graph, options);
    }

    /**
     * Seeded random number generator for reproducible results
     * @param {number} seed - Random seed
     * @returns {Function} Random number generator function
     */
    seededRandom(seed) {
        let m = 0x80000000 // 2**31
        let a = 1103515245
        let c = 12345

        seed = (seed % (m - 1)) + 1
        return function () {
            seed = (a * seed + c) % m
            return seed / m
        }
    }

    /**
     * Run Leiden algorithm for community detection
     * @param {Object} graph - Graph representation from GraphAnalytics
     * @param {Object} [options] - Algorithm options
     * @returns {Object} Community detection results
     */
    detectCommunities(graph, options = {}) {
        logger.info('Starting Leiden community detection...')

        const opts = { ...this.options, ...options }
        const nodes = Array.from(graph.nodes.keys())
        const edges = Array.from(graph.edges.values())

        // Initialize each node in its own community
        let communities = new Map()
        let nodeToCommId = new Map()

        for (let i = 0; i < nodes.length; i++) {
            communities.set(i, new Set([nodes[i]]))
            nodeToCommId.set(nodes[i], i)
        }

        let currentModularity = this.calculateModularity(graph, nodeToCommId)
        let iteration = 0
        let improved = true

        while (improved && iteration < opts.maxIterations) {
            iteration++

            if (opts.logProgress && iteration % 10 === 0) {
                logger.info(`Leiden iteration ${iteration}, modularity: ${currentModularity.toFixed(4)}`)
            }

            // Phase 1: Local moving phase
            const localResult = this.localMovingPhase(graph, nodeToCommId, opts)
            nodeToCommId = localResult.nodeToCommId

            // Phase 2: Refinement phase
            const refinedResult = this.refinementPhase(graph, nodeToCommId, opts)
            nodeToCommId = refinedResult.nodeToCommId

            // Phase 3: Aggregation phase
            const aggregatedGraph = this.aggregationPhase(graph, nodeToCommId)

            // Calculate new modularity
            const newModularity = this.calculateModularity(graph, nodeToCommId)

            if (newModularity - currentModularity < opts.convergenceThreshold) {
                improved = false
            } else {
                currentModularity = newModularity
                graph = aggregatedGraph.graph
                nodes = aggregatedGraph.nodeMapping
            }
        }

        // Build final communities
        communities = this.buildCommunities(nodeToCommId)

        // Filter small communities
        const filteredCommunities = this.filterSmallCommunities(communities, opts.minCommunitySize)

        // Compute community statistics
        const stats = this.computeCommunityStatistics(filteredCommunities, graph)

        // Update internal statistics
        this.stats.lastClustering = new Date()
        this.stats.communityCount = filteredCommunities.size
        this.stats.modularity = currentModularity
        this.stats.iterations = iteration

        logger.info(`Leiden algorithm completed: ${filteredCommunities.size} communities, modularity: ${currentModularity.toFixed(4)}`)

        return {
            communities: Array.from(filteredCommunities.values()),
            nodeToCommId,
            modularity: currentModularity,
            iterations: iteration,
            statistics: stats,
            algorithm: 'leiden',
            timestamp: new Date()
        }
    }

    /**
     * Local moving phase of Leiden algorithm
     * @param {Object} graph - Graph representation
     * @param {Map} nodeToCommId - Current node to community mapping
     * @param {Object} options - Algorithm options
     * @returns {Object} Updated node to community mapping
     */
    localMovingPhase(graph, nodeToCommId, options) {
        const nodes = Array.from(graph.nodes.keys())
        let improved = true
        let localIterations = 0

        while (improved && localIterations < 50) {
            improved = false
            localIterations++

            // Shuffle nodes for random order processing
            const shuffledNodes = this.shuffleArray([...nodes])

            for (const node of shuffledNodes) {
                const currentComm = nodeToCommId.get(node)
                const neighbors = Array.from(graph.adjacency.get(node) || [])

                // Find neighboring communities
                const neighborComms = new Set()
                for (const neighbor of neighbors) {
                    neighborComms.add(nodeToCommId.get(neighbor))
                }

                let bestComm = currentComm
                let bestGain = 0

                // Try moving to each neighboring community
                for (const targetComm of neighborComms) {
                    if (targetComm === currentComm) continue

                    const gain = this.calculateModularityGain(graph, node, currentComm, targetComm, nodeToCommId)

                    if (gain > bestGain) {
                        bestGain = gain
                        bestComm = targetComm
                    }
                }

                // Move node if beneficial
                if (bestComm !== currentComm && bestGain > 0) {
                    nodeToCommId.set(node, bestComm)
                    improved = true
                }
            }
        }

        return { nodeToCommId }
    }

    /**
     * Refinement phase to ensure well-connected communities
     * @param {Object} graph - Graph representation
     * @param {Map} nodeToCommId - Current node to community mapping
     * @param {Object} options - Algorithm options
     * @returns {Object} Refined node to community mapping
     */
    refinementPhase(graph, nodeToCommId, options) {
        const communities = this.buildCommunities(nodeToCommId)
        const newNodeToCommId = new Map(nodeToCommId)
        let nextCommId = Math.max(...nodeToCommId.values()) + 1

        for (const [commId, nodes] of communities) {
            if (nodes.size <= 1) continue

            // Check if community is well-connected
            const subgraph = this.extractSubgraph(graph, nodes)
            const components = this.findConnectedComponents(subgraph)

            if (components.length > 1) {
                // Split into separate communities
                for (let i = 1; i < components.length; i++) {
                    const component = components[i]
                    for (const node of component) {
                        newNodeToCommId.set(node, nextCommId)
                    }
                    nextCommId++
                }
            }
        }

        return { nodeToCommId: newNodeToCommId }
    }

    /**
     * Aggregation phase to create meta-graph
     * @param {Object} graph - Graph representation
     * @param {Map} nodeToCommId - Current node to community mapping
     * @returns {Object} Aggregated graph
     */
    aggregationPhase(graph, nodeToCommId) {
        const communities = this.buildCommunities(nodeToCommId)
        const metaGraph = {
            nodes: new Map(),
            edges: new Map(),
            adjacency: new Map()
        }

        const communityNodes = []

        // Create meta-nodes for communities
        for (const [commId, nodes] of communities) {
            const metaNodeUri = `meta_community_${commId}`
            metaGraph.nodes.set(metaNodeUri, {
                uri: metaNodeUri,
                type: 'meta_community',
                originalNodes: nodes,
                properties: new Map()
            })
            metaGraph.adjacency.set(metaNodeUri, new Set())
            communityNodes.push(metaNodeUri)
        }

        // Create meta-edges between communities
        const communityEdges = new Map()

        for (const [edgeKey, edge] of graph.edges) {
            const sourceComm = nodeToCommId.get(edge.source)
            const targetComm = nodeToCommId.get(edge.target)

            if (sourceComm !== targetComm) {
                const metaEdgeKey = `meta_community_${sourceComm}->meta_community_${targetComm}`

                if (!communityEdges.has(metaEdgeKey)) {
                    communityEdges.set(metaEdgeKey, {
                        source: `meta_community_${sourceComm}`,
                        target: `meta_community_${targetComm}`,
                        weight: 0,
                        originalEdges: []
                    })
                }

                const metaEdge = communityEdges.get(metaEdgeKey)
                metaEdge.weight += edge.weight
                metaEdge.originalEdges.push(edge)

                metaGraph.adjacency.get(`meta_community_${sourceComm}`).add(`meta_community_${targetComm}`)
            }
        }

        metaGraph.edges = communityEdges

        return {
            graph: metaGraph,
            nodeMapping: communityNodes
        }
    }

    /**
     * Calculate modularity gain for moving a node between communities
     * @param {Object} graph - Graph representation
     * @param {string} node - Node to move
     * @param {number} fromComm - Source community
     * @param {number} toComm - Target community
     * @param {Map} nodeToCommId - Current community assignment
     * @returns {number} Modularity gain
     */
    calculateModularityGain(graph, node, fromComm, toComm, nodeToCommId) {
        // Simplified modularity gain calculation
        // In practice, this would need full modularity computation

        const nodeConnections = graph.adjacency.get(node) || new Set()
        let toCommWeight = 0
        let fromCommWeight = 0

        for (const neighbor of nodeConnections) {
            const neighborComm = nodeToCommId.get(neighbor)
            const edge = graph.edges.get(`${node}->${neighbor}`) || graph.edges.get(`${neighbor}->${node}`)
            const weight = edge ? edge.weight : 1.0

            if (neighborComm === toComm) {
                toCommWeight += weight
            } else if (neighborComm === fromComm) {
                fromCommWeight += weight
            }
        }

        return (toCommWeight - fromCommWeight) * this.options.resolution
    }

    /**
     * Calculate modularity of current community structure
     * @param {Object} graph - Graph representation
     * @param {Map} nodeToCommId - Community assignment
     * @returns {number} Modularity value
     */
    calculateModularity(graph, nodeToCommId) {
        let modularity = 0
        const totalWeight = Array.from(graph.edges.values()).reduce((sum, edge) => sum + edge.weight, 0)

        if (totalWeight === 0) return 0

        const communities = this.buildCommunities(nodeToCommId)

        for (const [commId, nodes] of communities) {
            let internalWeight = 0
            let totalDegree = 0

            // Calculate internal edges and total degree for this community
            for (const node of nodes) {
                const neighbors = graph.adjacency.get(node) || new Set()

                for (const neighbor of neighbors) {
                    const edge = graph.edges.get(`${node}->${neighbor}`) || graph.edges.get(`${neighbor}->${node}`)
                    const weight = edge ? edge.weight : 1.0

                    totalDegree += weight

                    if (nodes.has(neighbor)) {
                        internalWeight += weight
                    }
                }
            }

            internalWeight /= 2 // Each internal edge counted twice

            const expectedInternal = (totalDegree * totalDegree) / (4 * totalWeight)
            modularity += (internalWeight / totalWeight) - this.options.resolution * expectedInternal
        }

        return modularity
    }

    /**
     * Build communities map from node assignments
     * @param {Map} nodeToCommId - Node to community mapping
     * @returns {Map} Community ID to nodes mapping
     */
    buildCommunities(nodeToCommId) {
        const communities = new Map()

        for (const [node, commId] of nodeToCommId) {
            if (!communities.has(commId)) {
                communities.set(commId, new Set())
            }
            communities.get(commId).add(node)
        }

        return communities
    }

    /**
     * Filter out communities smaller than minimum size
     * @param {Map} communities - Community mapping
     * @param {number} minSize - Minimum community size
     * @returns {Map} Filtered communities
     */
    filterSmallCommunities(communities, minSize) {
        const filtered = new Map()
        let newCommId = 0

        for (const [commId, nodes] of communities) {
            if (nodes.size >= minSize) {
                filtered.set(newCommId, nodes)
                newCommId++
            }
        }

        return filtered
    }

    /**
     * Extract subgraph containing only specified nodes
     * @param {Object} graph - Original graph
     * @param {Set} nodes - Nodes to include
     * @returns {Object} Subgraph
     */
    extractSubgraph(graph, nodes) {
        const subgraph = {
            nodes: new Map(),
            edges: new Map(),
            adjacency: new Map()
        }

        // Add nodes
        for (const node of nodes) {
            if (graph.nodes.has(node)) {
                subgraph.nodes.set(node, graph.nodes.get(node))
                subgraph.adjacency.set(node, new Set())
            }
        }

        // Add edges between included nodes
        for (const [edgeKey, edge] of graph.edges) {
            if (nodes.has(edge.source) && nodes.has(edge.target)) {
                subgraph.edges.set(edgeKey, edge)
                subgraph.adjacency.get(edge.source).add(edge.target)
            }
        }

        return subgraph
    }

    /**
     * Find connected components in a subgraph
     * @param {Object} subgraph - Subgraph to analyze
     * @returns {Array} Array of connected components
     */
    findConnectedComponents(subgraph) {
        const visited = new Set()
        const components = []

        const dfs = (startNode) => {
            const stack = [startNode]
            const component = []

            while (stack.length > 0) {
                const node = stack.pop()
                if (visited.has(node)) continue

                visited.add(node)
                component.push(node)

                const neighbors = subgraph.adjacency.get(node) || new Set()
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        stack.push(neighbor)
                    }
                }
            }

            return component
        }

        for (const node of subgraph.nodes.keys()) {
            if (!visited.has(node)) {
                const component = dfs(node)
                if (component.length > 0) {
                    components.push(component)
                }
            }
        }

        return components
    }

    /**
     * Compute statistics for detected communities
     * @param {Map} communities - Community mapping
     * @param {Object} graph - Original graph
     * @returns {Object} Community statistics
     */
    computeCommunityStatistics(communities, graph) {
        const sizes = []
        let totalInternalEdges = 0
        let totalExternalEdges = 0

        for (const [commId, nodes] of communities) {
            sizes.push(nodes.size)

            // Count internal vs external edges for this community
            for (const node of nodes) {
                const neighbors = graph.adjacency.get(node) || new Set()
                for (const neighbor of neighbors) {
                    if (nodes.has(neighbor)) {
                        totalInternalEdges++
                    } else {
                        totalExternalEdges++
                    }
                }
            }
        }

        totalInternalEdges /= 2 // Each edge counted twice

        const avgSize = sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0
        const maxSize = sizes.length > 0 ? Math.max(...sizes) : 0
        const minSize = sizes.length > 0 ? Math.min(...sizes) : 0

        return {
            communityCount: communities.size,
            avgSize,
            maxSize,
            minSize,
            totalInternalEdges,
            totalExternalEdges,
            internalRatio: totalInternalEdges / (totalInternalEdges + totalExternalEdges)
        }
    }

    /**
     * Shuffle array in place
     * @param {Array} array - Array to shuffle
     * @returns {Array} Shuffled array
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1))
                ;[array[i], array[j]] = [array[j], array[i]]
        }
        return array
    }

    /**
     * Export communities to RDF format
     * @param {Object} results - Community detection results
     * @param {Dataset} targetDataset - Target RDF dataset
     */
    exportCommunitiesToRDF(results, targetDataset) {
        logger.info('Exporting communities to RDF...')

        const analysisUri = `http://example.org/ragno/community-analysis/${Date.now()}`
        const analysisNode = rdf.namedNode(analysisUri)

        // Add analysis metadata
        targetDataset.add(rdf.quad(
            analysisNode,
            rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            rdf.namedNode('http://purl.org/stuff/ragno/CommunityAnalysis')
        ))

        targetDataset.add(rdf.quad(
            analysisNode,
            rdf.namedNode('http://purl.org/stuff/ragno/algorithm'),
            rdf.literal(results.algorithm)
        ))

        targetDataset.add(rdf.quad(
            analysisNode,
            rdf.namedNode('http://purl.org/stuff/ragno/modularity'),
            rdf.literal(results.modularity)
        ))

        // Export communities
        for (const [commId, nodes] of results.communities) {
            const communityUri = `http://example.org/ragno/community/${commId}`
            const communityNode = rdf.namedNode(communityUri)

            targetDataset.add(rdf.quad(
                communityNode,
                rdf.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
                rdf.namedNode('http://purl.org/stuff/ragno/Community')
            ))

            targetDataset.add(rdf.quad(
                communityNode,
                rdf.namedNode('http://purl.org/stuff/ragno/hasSize'),
                rdf.literal(nodes.size)
            ))

            // Add community membership
            for (const nodeUri of nodes) {
                targetDataset.add(rdf.quad(
                    rdf.namedNode(nodeUri),
                    rdf.namedNode('http://purl.org/stuff/ragno/inCommunity'),
                    communityNode
                ))
            }
        }

        logger.info('Communities exported to RDF')
    }

    /**
     * Get current statistics
     * @returns {Object} Current clustering statistics
     */
    getStatistics() {
        return { ...this.stats }
    }

    /**
     * Build a graph from an RDF dataset (delegates to GraphAnalytics)
     * @param {Dataset} dataset - RDF-Ext dataset
     * @param {Object} [options] - Graph construction options
     * @returns {Object} Graph representation
     */
    async buildGraphFromRDF(dataset, options = {}) {
        if (!this.graphAnalytics) {
            const GraphAnalytics = (await import('./GraphAnalytics.js')).default;
            this.graphAnalytics = new GraphAnalytics(this.options);
        }
        return this.graphAnalytics.buildGraphFromRDF(dataset, options);
    }
}