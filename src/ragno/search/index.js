/**
 * search/index.js - Ragno Search System Integration Module
 * 
 * This module provides a unified interface to the complete Ragno search system,
 * integrating vector indexing, dual search capabilities, and REST API endpoints.
 * It serves as the main entry point for search functionality within the Ragno
 * knowledge graph system.
 * 
 * Components:
 * - VectorIndex: HNSW-based vector similarity search
 * - DualSearch: Combined exact match + vector similarity + PPR traversal
 * - SearchAPI: REST endpoints for HTTP access
 * 
 * Usage:
 * ```javascript
 * import RagnoSearch from './search/index.js'
 * 
 * const search = new RagnoSearch(config)
 * await search.initialize()
 * const results = await search.search("query text")
 * ```
 */

import VectorIndex from './VectorIndex.js'
import DualSearch from './DualSearch.js'
import SearchAPI from './SearchAPI.js'
import { logger } from '../../Utils.js'

export default class RagnoSearch {
    constructor(options = {}) {
        this.options = {
            // Vector index configuration
            vectorIndex: {
                dimension: options.dimension || 1536,
                maxElements: options.maxElements || 100000,
                efConstruction: options.efConstruction || 200,
                mMax: options.mMax || 16,
                efSearch: options.efSearch || 100,
                ...options.vectorIndex
            },
            
            // Dual search configuration
            dualSearch: {
                exactMatchTypes: ['ragno:Entity', 'ragno:Attribute'],
                vectorSimilarityTypes: [
                    'ragno:Unit', 
                    'ragno:Attribute', 
                    'ragno:CommunityElement',
                    'ragno:TextElement'
                ],
                vectorSimilarityK: 10,
                similarityThreshold: 0.7,
                pprAlpha: 0.15,
                pprIterations: 2,
                topKPerType: 5,
                ...options.dualSearch
            },
            
            // API configuration
            api: {
                enableCORS: true,
                maxQueryLength: 1000,
                defaultResultLimit: 20,
                maxResultLimit: 100,
                enableCache: true,
                cacheTimeout: 300000, // 5 minutes
                ...options.api
            },
            
            // System configuration
            autoIndex: options.autoIndex !== false,
            indexPersistence: options.indexPersistence !== false,
            indexPath: options.indexPath || './data/ragno-vector.index',
            metadataPath: options.metadataPath || './data/ragno-metadata.json',
            
            ...options
        }
        
        // Initialize components
        this.vectorIndex = null
        this.dualSearch = null
        this.searchAPI = null
        
        // External dependencies (set via setters)
        this.sparqlEndpoint = options.sparqlEndpoint || null
        this.llmHandler = options.llmHandler || null
        this.embeddingHandler = options.embeddingHandler || null
        
        // System state
        this.initialized = false
        this.indexLoaded = false
        
        // Statistics
        this.stats = {
            initializationTime: null,
            totalSearches: 0,
            systemUptime: new Date(),
            lastUpdate: null
        }
        
        logger.info('RagnoSearch system created')
    }
    
    /**
     * Initialize the complete search system
     * @param {Object} [options] - Initialization options
     */
    async initialize(options = {}) {
        const startTime = Date.now()
        logger.info('Initializing Ragno search system...')
        
        try {
            // Phase 1: Initialize vector index
            logger.info('Phase 1: Initializing vector index...')
            this.vectorIndex = new VectorIndex(this.options.vectorIndex)
            
            // Phase 2: Initialize dual search system
            logger.info('Phase 2: Initializing dual search...')
            this.dualSearch = new DualSearch({
                ...this.options.dualSearch,
                vectorIndex: this.vectorIndex,
                sparqlEndpoint: this.sparqlEndpoint,
                llmHandler: this.llmHandler,
                embeddingHandler: this.embeddingHandler
            })
            
            // Phase 3: Initialize search API
            logger.info('Phase 3: Initializing search API...')
            this.searchAPI = new SearchAPI({
                ...this.options.api,
                dualSearch: this.options.dualSearch,
                vectorIndex: this.vectorIndex
            })
            
            // Configure API dependencies
            this.searchAPI.setVectorIndex(this.vectorIndex)
            if (this.sparqlEndpoint) {
                this.searchAPI.setSPARQLEndpoint(this.sparqlEndpoint)
            }
            if (this.llmHandler) {
                this.searchAPI.setLLMHandler(this.llmHandler)
            }
            if (this.embeddingHandler) {
                this.searchAPI.setEmbeddingHandler(this.embeddingHandler)
            }
            
            // Phase 4: Load existing index if available
            if (this.options.indexPersistence && options.loadIndex !== false) {
                await this.loadVectorIndex()
            }
            
            // Mark as initialized
            this.initialized = true
            this.stats.initializationTime = Date.now() - startTime
            this.stats.lastUpdate = new Date()
            
            logger.info(`Ragno search system initialized in ${this.stats.initializationTime}ms`)
            
        } catch (error) {
            logger.error('Failed to initialize Ragno search system:', error)
            throw error
        }
    }
    
    /**
     * Main search interface
     * @param {string} query - Search query
     * @param {Object} [options] - Search options
     * @returns {Object} Search results
     */
    async search(query, options = {}) {
        this.ensureInitialized()
        
        try {
            const results = await this.dualSearch.search(query, options)
            this.stats.totalSearches++
            return results
        } catch (error) {
            logger.error(`Search failed for query "${query}":`, error)
            throw error
        }
    }
    
    /**
     * Exact match search only
     * @param {string} query - Search query
     * @param {Object} [options] - Search options
     * @returns {Array} Exact match results
     */
    async searchExact(query, options = {}) {
        this.ensureInitialized()
        
        const queryData = await this.dualSearch.processQuery(query, options)
        return await this.dualSearch.performExactMatch(queryData, options)
    }
    
    /**
     * Vector similarity search only
     * @param {string} query - Search query
     * @param {Object} [options] - Search options
     * @returns {Array} Vector similarity results
     */
    async searchSimilarity(query, options = {}) {
        this.ensureInitialized()
        
        const queryData = await this.dualSearch.processQuery(query, options)
        return await this.dualSearch.performVectorSimilarity(queryData, options)
    }
    
    /**
     * PPR traversal search
     * @param {Array} entityUris - Starting entity URIs
     * @param {Object} [options] - Traversal options
     * @returns {Object} PPR traversal results
     */
    async searchTraversal(entityUris, options = {}) {
        this.ensureInitialized()
        
        return await this.dualSearch.performPPRTraversal(entityUris, options)
    }
    
    /**
     * Add nodes to vector index
     * @param {Array} nodes - Array of {uri, embedding, metadata} objects
     * @returns {Array} Array of node IDs added
     */
    addNodesToIndex(nodes) {
        this.ensureInitialized()
        
        const nodeIds = this.vectorIndex.addNodesBatch(nodes)
        this.stats.lastUpdate = new Date()
        
        logger.info(`Added ${nodeIds.length} nodes to vector index`)
        return nodeIds
    }
    
    /**
     * Add single node to vector index
     * @param {string} uri - Node URI
     * @param {Array} embedding - Vector embedding
     * @param {Object} [metadata] - Node metadata
     * @returns {number} Node ID
     */
    addNodeToIndex(uri, embedding, metadata = {}) {
        this.ensureInitialized()
        
        const nodeId = this.vectorIndex.addNode(uri, embedding, metadata)
        this.stats.lastUpdate = new Date()
        
        return nodeId
    }
    
    /**
     * Remove node from vector index
     * @param {string} uri - Node URI
     * @returns {boolean} True if removed
     */
    removeNodeFromIndex(uri) {
        this.ensureInitialized()
        
        const removed = this.vectorIndex.removeNode(uri)
        if (removed) {
            this.stats.lastUpdate = new Date()
        }
        
        return removed
    }
    
    /**
     * Check if node exists in index
     * @param {string} uri - Node URI
     * @returns {boolean} True if node exists
     */
    hasNode(uri) {
        this.ensureInitialized()
        return this.vectorIndex.hasNode(uri)
    }
    
    /**
     * Get node metadata
     * @param {string} uri - Node URI
     * @returns {Object|null} Node metadata
     */
    getNodeMetadata(uri) {
        this.ensureInitialized()
        return this.vectorIndex.getNodeMetadata(uri)
    }
    
    /**
     * Find similar nodes
     * @param {string} uri - Reference node URI
     * @param {number} [k=10] - Number of similar nodes
     * @param {Object} [options] - Search options
     * @returns {Array} Similar nodes
     */
    findSimilarNodes(uri, k = 10, options = {}) {
        this.ensureInitialized()
        return this.vectorIndex.findSimilarNodes(uri, k, options)
    }
    
    /**
     * Get nodes by type
     * @param {string} type - Ragno type
     * @param {number} [limit] - Maximum number of nodes
     * @returns {Array} Nodes of specified type
     */
    getNodesByType(type, limit) {
        this.ensureInitialized()
        return this.vectorIndex.getNodesByType(type, limit)
    }
    
    /**
     * Save vector index to disk
     */
    async saveVectorIndex() {
        this.ensureInitialized()
        
        if (!this.options.indexPersistence) {
            logger.warn('Index persistence is disabled')
            return
        }
        
        try {
            await this.vectorIndex.saveIndex(this.options.indexPath, this.options.metadataPath)
            logger.info('Vector index saved successfully')
        } catch (error) {
            logger.error('Failed to save vector index:', error)
            throw error
        }
    }
    
    /**
     * Load vector index from disk
     */
    async loadVectorIndex() {
        this.ensureInitialized()
        
        if (!this.options.indexPersistence) {
            logger.debug('Index persistence disabled, skipping load')
            return
        }
        
        try {
            // Check if files exist
            const fs = await import('fs/promises')
            await fs.access(this.options.indexPath)
            await fs.access(this.options.metadataPath)
            
            await this.vectorIndex.loadIndex(this.options.indexPath, this.options.metadataPath)
            this.indexLoaded = true
            logger.info('Vector index loaded successfully')
            
        } catch (error) {
            if (error.code === 'ENOENT') {
                logger.info('No existing vector index found, starting fresh')
            } else {
                logger.error('Failed to load vector index:', error)
                throw error
            }
        }
    }
    
    /**
     * Clear vector index
     */
    clearVectorIndex() {
        this.ensureInitialized()
        
        this.vectorIndex.clear()
        this.stats.lastUpdate = new Date()
        
        logger.info('Vector index cleared')
    }
    
    /**
     * Optimize vector index
     * @param {Object} [options] - Optimization options
     */
    optimizeVectorIndex(options = {}) {
        this.ensureInitialized()
        
        this.vectorIndex.optimizeIndex(options)
        this.stats.lastUpdate = new Date()
    }
    
    /**
     * Get Express.js route handlers for HTTP API
     * @returns {Object} Route handlers
     */
    getAPIRouteHandlers() {
        this.ensureInitialized()
        return this.searchAPI.getRouteHandlers()
    }
    
    /**
     * Get comprehensive system statistics
     * @returns {Object} System statistics
     */
    getStatistics() {
        const baseStats = {
            system: this.stats,
            initialized: this.initialized,
            indexLoaded: this.indexLoaded
        }
        
        if (this.initialized) {
            return {
                ...baseStats,
                vectorIndex: this.vectorIndex.getStatistics(),
                dualSearch: this.dualSearch.getStatistics(),
                searchAPI: this.searchAPI.getStatistics()
            }
        }
        
        return baseStats
    }
    
    /**
     * Get system status
     * @returns {Object} System status
     */
    getStatus() {
        return {
            status: this.initialized ? 'operational' : 'initializing',
            components: {
                vectorIndex: !!this.vectorIndex,
                dualSearch: !!this.dualSearch,
                searchAPI: !!this.searchAPI
            },
            dependencies: {
                sparqlEndpoint: !!this.sparqlEndpoint,
                llmHandler: !!this.llmHandler,
                embeddingHandler: !!this.embeddingHandler
            },
            capabilities: {
                exactMatch: !!this.sparqlEndpoint,
                vectorSimilarity: !!this.vectorIndex,
                pprTraversal: !!this.sparqlEndpoint,
                entityExtraction: !!this.llmHandler,
                embeddingGeneration: !!this.embeddingHandler
            },
            uptime: Date.now() - this.stats.systemUptime.getTime(),
            initialized: this.initialized,
            indexLoaded: this.indexLoaded
        }
    }
    
    /**
     * Set SPARQL endpoint
     * @param {string} sparqlEndpoint - SPARQL endpoint URL
     */
    setSPARQLEndpoint(sparqlEndpoint) {
        this.sparqlEndpoint = sparqlEndpoint
        
        if (this.dualSearch) {
            this.dualSearch.setSPARQLEndpoint(sparqlEndpoint)
        }
        if (this.searchAPI) {
            this.searchAPI.setSPARQLEndpoint(sparqlEndpoint)
        }
        
        logger.info(`SPARQL endpoint configured: ${sparqlEndpoint}`)
    }
    
    /**
     * Set LLM handler
     * @param {Object} llmHandler - LLM handler instance
     */
    setLLMHandler(llmHandler) {
        this.llmHandler = llmHandler
        
        if (this.dualSearch) {
            this.dualSearch.setLLMHandler(llmHandler)
        }
        if (this.searchAPI) {
            this.searchAPI.setLLMHandler(llmHandler)
        }
        
        logger.info('LLM handler configured')
    }
    
    /**
     * Set embedding handler
     * @param {Object} embeddingHandler - Embedding handler instance
     */
    setEmbeddingHandler(embeddingHandler) {
        this.embeddingHandler = embeddingHandler
        
        if (this.dualSearch) {
            this.dualSearch.setEmbeddingHandler(embeddingHandler)
        }
        if (this.searchAPI) {
            this.searchAPI.setEmbeddingHandler(embeddingHandler)
        }
        
        logger.info('Embedding handler configured')
    }
    
    /**
     * Ensure system is initialized
     * @throws {Error} If system is not initialized
     */
    ensureInitialized() {
        if (!this.initialized) {
            throw new Error('RagnoSearch system not initialized. Call initialize() first.')
        }
    }
    
    /**
     * Shutdown search system and cleanup resources
     */
    async shutdown() {
        logger.info('Shutting down Ragno search system...')
        
        try {
            // Save index if persistence enabled
            if (this.options.indexPersistence && this.vectorIndex) {
                await this.saveVectorIndex()
            }
            
            // Clear caches
            if (this.searchAPI) {
                this.searchAPI.clearCache()
            }
            
            // Reset state
            this.initialized = false
            this.indexLoaded = false
            
            logger.info('Ragno search system shutdown complete')
            
        } catch (error) {
            logger.error('Error during shutdown:', error)
            throw error
        }
    }
}

// Export individual components for direct use
export {
    VectorIndex,
    DualSearch,
    SearchAPI
}