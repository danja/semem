/**
 * VectorIndex.js - HNSW Vector Index for Ragno Knowledge Graphs
 * 
 * This module implements Hierarchical Navigable Small World (HNSW) indexing
 * for semantic similarity search in ragno knowledge graphs. It provides
 * efficient approximate nearest neighbor search for vector embeddings.
 * 
 * Key Features:
 * - HNSW index for fast similarity search
 * - Support for multiple embedding dimensions
 * - Type-aware indexing (by ragno ontology types)
 * - Batch insertion and search operations
 * - Integration with ragno RDF elements
 * - Persistence and loading capabilities
 */

import pkg from 'hnswlib-node'
const { HierarchicalNSW } = pkg
import rdf from 'rdf-ext'
import { logger } from '../../Utils.js'

export default class VectorIndex {
    constructor(options = {}) {
        this.options = {
            dimension: options.dimension || 1536, // Default OpenAI embedding size
            maxElements: options.maxElements || 100000,
            efConstruction: options.efConstruction || 200,
            mMax: options.mMax || 16,
            efSearch: options.efSearch || 100,
            seed: options.seed || 100,
            ...options
        }
        
        // Initialize HNSW index
        this.index = new HierarchicalNSW('cosine', this.options.dimension)
        this.index.initIndex(this.options.maxElements, this.options.mMax, this.options.efConstruction, this.options.seed)
        this.index.setEfSearch(this.options.efSearch)
        
        // Metadata storage
        this.nodeMetadata = new Map() // nodeId -> { uri, type, content, embedding }
        this.uriToNodeId = new Map() // uri -> nodeId
        this.typeToNodes = new Map() // type -> Set of nodeIds
        this.nextNodeId = 0
        
        // Index statistics
        this.stats = {
            totalNodes: 0,
            nodesByType: new Map(),
            lastIndexTime: null,
            searchCount: 0,
            averageSearchTime: 0
        }
        
        logger.debug(`VectorIndex initialized: ${this.options.dimension}D, max ${this.options.maxElements} elements`)
    }
    
    /**
     * Add a node with its embedding to the index
     * @param {string} uri - Node URI
     * @param {Array<number>} embedding - Vector embedding
     * @param {Object} metadata - Node metadata
     * @returns {number} Node ID in index
     */
    addNode(uri, embedding, metadata = {}) {
        if (this.uriToNodeId.has(uri)) {
            logger.warn(`Node ${uri} already exists in index`)
            return this.uriToNodeId.get(uri)
        }
        
        if (embedding.length !== this.options.dimension) {
            throw new Error(`Embedding dimension ${embedding.length} does not match index dimension ${this.options.dimension}`)
        }
        
        const nodeId = this.nextNodeId++
        
        // Add to HNSW index
        this.index.addPoint(embedding, nodeId)
        
        // Store metadata
        const nodeMetadata = {
            uri,
            type: metadata.type || 'unknown',
            content: metadata.content || '',
            embedding,
            timestamp: new Date(),
            ...metadata
        }
        
        this.nodeMetadata.set(nodeId, nodeMetadata)
        this.uriToNodeId.set(uri, nodeId)
        
        // Update type-based grouping
        const nodeType = nodeMetadata.type
        if (!this.typeToNodes.has(nodeType)) {
            this.typeToNodes.set(nodeType, new Set())
        }
        this.typeToNodes.get(nodeType).add(nodeId)
        
        // Update statistics
        this.stats.totalNodes++
        const typeCount = this.stats.nodesByType.get(nodeType) || 0
        this.stats.nodesByType.set(nodeType, typeCount + 1)
        this.stats.lastIndexTime = new Date()
        
        logger.debug(`Added node ${uri} as ID ${nodeId}, type: ${nodeType}`)
        return nodeId
    }
    
    /**
     * Add multiple nodes in batch
     * @param {Array} nodes - Array of {uri, embedding, metadata} objects
     * @returns {Array<number>} Array of node IDs
     */
    addNodesBatch(nodes) {
        logger.info(`Adding ${nodes.length} nodes to vector index...`)
        
        const nodeIds = []
        for (const node of nodes) {
            try {
                const nodeId = this.addNode(node.uri, node.embedding, node.metadata)
                nodeIds.push(nodeId)
            } catch (error) {
                logger.error(`Failed to add node ${node.uri}:`, error.message)
            }
        }
        
        logger.info(`Successfully added ${nodeIds.length}/${nodes.length} nodes to index`)
        return nodeIds
    }
    
    /**
     * Search for similar nodes
     * @param {Array<number>} queryEmbedding - Query vector
     * @param {number} [k=10] - Number of results to return
     * @param {Object} [options] - Search options
     * @returns {Array} Search results with scores and metadata
     */
    search(queryEmbedding, k = 10, options = {}) {
        const startTime = Date.now()
        
        if (queryEmbedding.length !== this.options.dimension) {
            throw new Error(`Query embedding dimension ${queryEmbedding.length} does not match index dimension ${this.options.dimension}`)
        }
        
        if (this.stats.totalNodes === 0) {
            logger.warn('Vector index is empty')
            return []
        }
        
        // Set search parameters
        const originalEf = this.index.getEfSearch()
        if (options.efSearch) {
            this.index.setEfSearch(options.efSearch)
        }
        
        try {
            // Perform HNSW search
            const results = this.index.searchKnn(queryEmbedding, k)
            
            // Enhance results with metadata
            const enhancedResults = []
            for (let i = 0; i < results.neighbors.length; i++) {
                const nodeId = results.neighbors[i]
                const distance = results.distances[i]
                const similarity = 1 - distance // Convert distance to similarity
                
                const metadata = this.nodeMetadata.get(nodeId)
                if (metadata) {
                    enhancedResults.push({
                        nodeId,
                        uri: metadata.uri,
                        type: metadata.type,
                        content: metadata.content,
                        similarity,
                        distance,
                        metadata: {
                            ...metadata,
                            embedding: undefined // Don't include full embedding in results
                        }
                    })
                }
            }
            
            // Filter by type if specified
            let filteredResults = enhancedResults
            if (options.filterByTypes && options.filterByTypes.length > 0) {
                filteredResults = enhancedResults.filter(result => 
                    options.filterByTypes.includes(result.type)
                )
            }
            
            // Update statistics
            const searchTime = Date.now() - startTime
            this.stats.searchCount++
            this.stats.averageSearchTime = (this.stats.averageSearchTime * (this.stats.searchCount - 1) + searchTime) / this.stats.searchCount
            
            logger.debug(`Vector search completed: ${filteredResults.length} results in ${searchTime}ms`)
            return filteredResults
            
        } finally {
            // Restore original ef parameter
            this.index.setEfSearch(originalEf)
        }
    }
    
    /**
     * Search within specific ragno types
     * @param {Array<number>} queryEmbedding - Query vector
     * @param {Array<string>} types - Ragno types to search within
     * @param {number} [k=10] - Number of results per type
     * @returns {Object} Results grouped by type
     */
    searchByTypes(queryEmbedding, types, k = 10) {
        const resultsByType = new Map()
        
        for (const type of types) {
            const typeResults = this.search(queryEmbedding, k * 2, { // Get more to account for filtering
                filterByTypes: [type]
            })
            
            resultsByType.set(type, typeResults.slice(0, k))
        }
        
        return Object.fromEntries(resultsByType)
    }
    
    /**
     * Find nodes similar to a given node in the index
     * @param {string} uri - URI of the reference node
     * @param {number} [k=10] - Number of similar nodes to return
     * @param {Object} [options] - Search options
     * @returns {Array} Similar nodes (excluding the reference node)
     */
    findSimilarNodes(uri, k = 10, options = {}) {
        const nodeId = this.uriToNodeId.get(uri)
        if (!nodeId) {
            throw new Error(`Node ${uri} not found in vector index`)
        }
        
        const metadata = this.nodeMetadata.get(nodeId)
        if (!metadata || !metadata.embedding) {
            throw new Error(`No embedding found for node ${uri}`)
        }
        
        // Search for similar nodes
        const results = this.search(metadata.embedding, k + 1, options) // +1 to account for self
        
        // Filter out the reference node itself
        return results.filter(result => result.uri !== uri)
    }
    
    /**
     * Get nodes by type
     * @param {string} type - Ragno type
     * @param {number} [limit] - Maximum number of nodes to return
     * @returns {Array} Nodes of the specified type
     */
    getNodesByType(type, limit) {
        const nodeIds = this.typeToNodes.get(type)
        if (!nodeIds) {
            return []
        }
        
        const nodes = []
        let count = 0
        
        for (const nodeId of nodeIds) {
            if (limit && count >= limit) break
            
            const metadata = this.nodeMetadata.get(nodeId)
            if (metadata) {
                nodes.push({
                    nodeId,
                    uri: metadata.uri,
                    type: metadata.type,
                    content: metadata.content,
                    metadata: {
                        ...metadata,
                        embedding: undefined
                    }
                })
                count++
            }
        }
        
        return nodes
    }
    
    /**
     * Remove a node from the index
     * @param {string} uri - URI of the node to remove
     * @returns {boolean} True if node was removed
     */
    removeNode(uri) {
        const nodeId = this.uriToNodeId.get(uri)
        if (!nodeId) {
            logger.warn(`Node ${uri} not found in index`)
            return false
        }
        
        const metadata = this.nodeMetadata.get(nodeId)
        if (metadata) {
            // Remove from type grouping
            const nodeType = metadata.type
            if (this.typeToNodes.has(nodeType)) {
                this.typeToNodes.get(nodeType).delete(nodeId)
                if (this.typeToNodes.get(nodeType).size === 0) {
                    this.typeToNodes.delete(nodeType)
                }
            }
            
            // Update statistics
            this.stats.totalNodes--
            const typeCount = this.stats.nodesByType.get(nodeType) || 0
            if (typeCount > 1) {
                this.stats.nodesByType.set(nodeType, typeCount - 1)
            } else {
                this.stats.nodesByType.delete(nodeType)
            }
        }
        
        // Remove from metadata storage
        this.nodeMetadata.delete(nodeId)
        this.uriToNodeId.delete(uri)
        
        // Note: HNSW doesn't support deletion, so the point remains in the index
        // This is a limitation we need to document
        
        logger.debug(`Removed node ${uri} from metadata (HNSW point remains)`)
        return true
    }
    
    /**
     * Check if a node exists in the index
     * @param {string} uri - Node URI
     * @returns {boolean} True if node exists
     */
    hasNode(uri) {
        return this.uriToNodeId.has(uri)
    }
    
    /**
     * Get metadata for a node
     * @param {string} uri - Node URI
     * @returns {Object|null} Node metadata
     */
    getNodeMetadata(uri) {
        const nodeId = this.uriToNodeId.get(uri)
        if (!nodeId) {
            return null
        }
        
        const metadata = this.nodeMetadata.get(nodeId)
        return metadata ? { ...metadata, embedding: undefined } : null
    }
    
    /**
     * Save index to file
     * @param {string} indexPath - Path to save HNSW index
     * @param {string} metadataPath - Path to save metadata
     */
    async saveIndex(indexPath, metadataPath) {
        logger.info(`Saving vector index to ${indexPath}...`)
        
        try {
            // Save HNSW index
            this.index.writeIndex(indexPath)
            
            // Save metadata
            const metadataObj = {
                options: this.options,
                nodeMetadata: Object.fromEntries(this.nodeMetadata),
                uriToNodeId: Object.fromEntries(this.uriToNodeId),
                typeToNodes: Object.fromEntries(
                    Array.from(this.typeToNodes.entries()).map(([type, nodeSet]) => [type, Array.from(nodeSet)])
                ),
                nextNodeId: this.nextNodeId,
                stats: this.stats
            }
            
            await require('fs/promises').writeFile(metadataPath, JSON.stringify(metadataObj, null, 2))
            
            logger.info('Vector index saved successfully')
        } catch (error) {
            logger.error('Failed to save vector index:', error)
            throw error
        }
    }
    
    /**
     * Load index from file
     * @param {string} indexPath - Path to HNSW index file
     * @param {string} metadataPath - Path to metadata file
     */
    async loadIndex(indexPath, metadataPath) {
        logger.info(`Loading vector index from ${indexPath}...`)
        
        try {
            // Load HNSW index
            this.index.readIndex(indexPath)
            
            // Load metadata
            const metadataContent = await require('fs/promises').readFile(metadataPath, 'utf-8')
            const metadataObj = JSON.parse(metadataContent)
            
            // Restore state
            this.options = { ...this.options, ...metadataObj.options }
            this.nodeMetadata = new Map(Object.entries(metadataObj.nodeMetadata).map(([k, v]) => [parseInt(k), v]))
            this.uriToNodeId = new Map(Object.entries(metadataObj.uriToNodeId))
            this.typeToNodes = new Map(
                Object.entries(metadataObj.typeToNodes).map(([type, nodeArray]) => [type, new Set(nodeArray)])
            )
            this.nextNodeId = metadataObj.nextNodeId
            this.stats = metadataObj.stats
            
            logger.info(`Vector index loaded: ${this.stats.totalNodes} nodes`)
        } catch (error) {
            logger.error('Failed to load vector index:', error)
            throw error
        }
    }
    
    /**
     * Clear the entire index
     */
    clear() {
        this.index = new HierarchicalNSW('cosine', this.options.dimension)
        this.index.initIndex(this.options.maxElements, this.options.mMax, this.options.efConstruction, this.options.seed)
        this.index.setEfSearch(this.options.efSearch)
        
        this.nodeMetadata.clear()
        this.uriToNodeId.clear()
        this.typeToNodes.clear()
        this.nextNodeId = 0
        
        this.stats = {
            totalNodes: 0,
            nodesByType: new Map(),
            lastIndexTime: null,
            searchCount: 0,
            averageSearchTime: 0
        }
        
        logger.info('Vector index cleared')
    }
    
    /**
     * Get index statistics
     * @returns {Object} Index statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            nodesByType: Object.fromEntries(this.stats.nodesByType),
            availableTypes: Array.from(this.typeToNodes.keys()),
            indexSize: this.stats.totalNodes,
            dimension: this.options.dimension,
            maxElements: this.options.maxElements
        }
    }
    
    /**
     * Optimize index performance
     * @param {Object} [options] - Optimization options
     */
    optimizeIndex(options = {}) {
        logger.info('Optimizing vector index...')
        
        // Adjust ef parameter based on index size
        const optimalEf = Math.max(this.options.efSearch, Math.min(200, this.stats.totalNodes / 10))
        this.index.setEfSearch(optimalEf)
        
        logger.info(`Index optimized: ef set to ${optimalEf}`)
    }
}