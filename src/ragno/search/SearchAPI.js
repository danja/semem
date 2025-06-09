/**
 * SearchAPI.js - REST API for Ragno Knowledge Graph Search
 * 
 * This module provides HTTP endpoints for accessing the dual search system,
 * integrating exact matching, vector similarity, and PPR traversal. It offers
 * both simple search interfaces and advanced graph exploration capabilities.
 * 
 * Endpoints:
 * - POST /ragno/search - Main dual search interface
 * - GET /ragno/search/status - Search system status
 * - POST /ragno/search/exact - Exact matching only
 * - POST /ragno/search/similarity - Vector similarity only
 * - POST /ragno/search/traverse - PPR graph traversal
 * - GET /ragno/entities/{uri} - Entity details with relationships
 * - GET /ragno/graph/stats - Graph statistics
 */

import DualSearch from './DualSearch.js'
import VectorIndex from './VectorIndex.js'
import SPARQLHelpers from '../../utils/SPARQLHelpers.js'
import { logger } from '../../Utils.js'

export default class SearchAPI {
    constructor(options = {}) {
        this.options = {
            // API configuration
            enableCORS: options.enableCORS !== false,
            maxQueryLength: options.maxQueryLength || 1000,
            defaultResultLimit: options.defaultResultLimit || 20,
            maxResultLimit: options.maxResultLimit || 100,
            
            // Rate limiting
            rateLimitWindow: options.rateLimitWindow || 60000, // 1 minute
            rateLimitRequests: options.rateLimitRequests || 100,
            
            // Cache configuration
            enableCache: options.enableCache !== false,
            cacheTimeout: options.cacheTimeout || 300000, // 5 minutes
            
            // Authentication
            requireAuth: options.requireAuth || false,
            apiKeys: options.apiKeys || [],
            
            ...options
        }
        
        // Initialize search system
        this.dualSearch = new DualSearch(this.options.dualSearch || {})
        this.vectorIndex = options.vectorIndex || null
        
        // Request tracking
        this.requestStats = {
            totalRequests: 0,
            searchRequests: 0,
            errorCount: 0,
            averageResponseTime: 0,
            lastRequest: null
        }
        
        // Rate limiting storage
        this.rateLimitStore = new Map()
        
        // Response cache
        this.responseCache = new Map()
        
        logger.info('SearchAPI initialized')
    }
    
    /**
     * Get Express.js route handlers
     * @returns {Object} Route handlers for Express app
     */
    getRouteHandlers() {
        return {
            // Main dual search endpoint
            'POST /ragno/search': this.handleDualSearch.bind(this),
            
            // Individual search methods
            'POST /ragno/search/exact': this.handleExactSearch.bind(this),
            'POST /ragno/search/similarity': this.handleSimilaritySearch.bind(this),
            'POST /ragno/search/traverse': this.handleTraversalSearch.bind(this),
            
            // Entity and graph endpoints
            'GET /ragno/entities/:uri': this.handleEntityDetails.bind(this),
            'GET /ragno/graph/stats': this.handleGraphStats.bind(this),
            
            // System status
            'GET /ragno/search/status': this.handleSearchStatus.bind(this),
            'GET /ragno/search/stats': this.handleSearchStats.bind(this)
        }
    }
    
    /**
     * Main dual search endpoint handler
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleDualSearch(req, res) {
        const startTime = Date.now()
        
        try {
            // Validate request
            const validation = this.validateSearchRequest(req)
            if (!validation.valid) {
                return this.sendError(res, 400, validation.error)
            }
            
            // Check rate limits
            if (!this.checkRateLimit(req)) {
                return this.sendError(res, 429, 'Rate limit exceeded')
            }
            
            // Extract search parameters
            const { query, options = {} } = req.body
            const searchOptions = {
                ...this.options.dualSearch,
                ...options,
                limit: Math.min(options.limit || this.options.defaultResultLimit, this.options.maxResultLimit)
            }
            
            // Check cache
            const cacheKey = this.generateCacheKey('dual', query, searchOptions)
            if (this.options.enableCache) {
                const cachedResult = this.responseCache.get(cacheKey)
                if (cachedResult && (Date.now() - cachedResult.timestamp) < this.options.cacheTimeout) {
                    logger.debug('Returning cached search result')
                    return this.sendSuccess(res, { ...cachedResult.data, cached: true })
                }
            }
            
            // Perform dual search
            const searchResults = await this.dualSearch.search(query, searchOptions)
            
            // Limit results
            if (searchResults.results.length > searchOptions.limit) {
                searchResults.results = searchResults.results.slice(0, searchOptions.limit)
                searchResults.limited = true
                searchResults.totalAvailable = searchResults.totalResults
                searchResults.totalResults = searchOptions.limit
            }
            
            // Cache result
            if (this.options.enableCache) {
                this.responseCache.set(cacheKey, {
                    data: searchResults,
                    timestamp: Date.now()
                })
            }
            
            // Update statistics
            this.updateRequestStats(Date.now() - startTime, 'search')
            
            this.sendSuccess(res, searchResults)
            
        } catch (error) {
            logger.error('Dual search API error:', error)
            this.updateRequestStats(Date.now() - startTime, 'error')
            this.sendError(res, 500, 'Search failed', error.message)
        }
    }
    
    /**
     * Exact search endpoint handler
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleExactSearch(req, res) {
        try {
            const validation = this.validateSearchRequest(req)
            if (!validation.valid) {
                return this.sendError(res, 400, validation.error)
            }
            
            const { query, options = {} } = req.body
            
            // Process query for entity extraction
            const queryData = await this.dualSearch.processQuery(query, options)
            
            // Perform only exact matching
            const exactResults = await this.dualSearch.performExactMatch(queryData, options)
            
            this.sendSuccess(res, {
                query: query,
                method: 'exact_match',
                totalResults: exactResults.length,
                results: exactResults,
                timestamp: new Date()
            })
            
        } catch (error) {
            logger.error('Exact search API error:', error)
            this.sendError(res, 500, 'Exact search failed', error.message)
        }
    }
    
    /**
     * Vector similarity search endpoint handler
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleSimilaritySearch(req, res) {
        try {
            const validation = this.validateSearchRequest(req)
            if (!validation.valid) {
                return this.sendError(res, 400, validation.error)
            }
            
            if (!this.vectorIndex) {
                return this.sendError(res, 503, 'Vector index not available')
            }
            
            const { query, options = {} } = req.body
            
            // Process query for embedding generation
            const queryData = await this.dualSearch.processQuery(query, options)
            
            if (!queryData.embedding) {
                return this.sendError(res, 400, 'Could not generate embedding for query')
            }
            
            // Perform vector similarity search
            const vectorResults = await this.dualSearch.performVectorSimilarity(queryData, options)
            
            this.sendSuccess(res, {
                query: query,
                method: 'vector_similarity',
                totalResults: vectorResults.length,
                results: vectorResults,
                timestamp: new Date()
            })
            
        } catch (error) {
            logger.error('Similarity search API error:', error)
            this.sendError(res, 500, 'Similarity search failed', error.message)
        }
    }
    
    /**
     * PPR traversal search endpoint handler
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleTraversalSearch(req, res) {
        try {
            const { entities, options = {} } = req.body
            
            if (!entities || !Array.isArray(entities) || entities.length === 0) {
                return this.sendError(res, 400, 'Entity URIs required for traversal search')
            }
            
            // Perform PPR traversal
            const pprResults = await this.dualSearch.performPPRTraversal(entities, options)
            
            if (!pprResults) {
                return this.sendSuccess(res, {
                    entities: entities,
                    method: 'ppr_traversal',
                    totalResults: 0,
                    results: [],
                    message: 'No graph structure found for traversal'
                })
            }
            
            this.sendSuccess(res, {
                entities: entities,
                method: 'ppr_traversal',
                totalResults: pprResults.rankedNodes?.length || 0,
                results: pprResults.rankedNodes || [],
                graphInfo: {
                    entryPoints: pprResults.entryPoints,
                    iterations: pprResults.iterations,
                    alpha: pprResults.alpha
                },
                timestamp: new Date()
            })
            
        } catch (error) {
            logger.error('Traversal search API error:', error)
            this.sendError(res, 500, 'Traversal search failed', error.message)
        }
    }
    
    /**
     * Entity details endpoint handler
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleEntityDetails(req, res) {
        try {
            const entityUri = decodeURIComponent(req.params.uri)
            
            if (!entityUri) {
                return this.sendError(res, 400, 'Entity URI required')
            }
            
            // Build SPARQL query for entity details
            const detailsQuery = this.buildEntityDetailsQuery(entityUri)
            const sparqlEndpoint = this.dualSearch.sparqlEndpoint
            
            if (!sparqlEndpoint) {
                return this.sendError(res, 503, 'SPARQL endpoint not configured')
            }
            
            const entityData = await SPARQLHelpers.executeSPARQLQuery(sparqlEndpoint, detailsQuery)
            
            // Get vector index metadata if available
            let vectorMetadata = null
            if (this.vectorIndex && this.vectorIndex.hasNode(entityUri)) {
                vectorMetadata = this.vectorIndex.getNodeMetadata(entityUri)
            }
            
            // Find similar entities
            let similarEntities = []
            if (this.vectorIndex && this.vectorIndex.hasNode(entityUri)) {
                try {
                    similarEntities = this.vectorIndex.findSimilarNodes(entityUri, 5)
                } catch (error) {
                    logger.warn('Could not find similar entities:', error.message)
                }
            }
            
            this.sendSuccess(res, {
                uri: entityUri,
                sparqlData: entityData,
                vectorMetadata: vectorMetadata,
                similarEntities: similarEntities,
                timestamp: new Date()
            })
            
        } catch (error) {
            logger.error('Entity details API error:', error)
            this.sendError(res, 500, 'Failed to retrieve entity details', error.message)
        }
    }
    
    /**
     * Graph statistics endpoint handler
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleGraphStats(req, res) {
        try {
            const stats = {
                vectorIndex: this.vectorIndex?.getStatistics() || null,
                dualSearch: this.dualSearch.getStatistics(),
                api: this.requestStats,
                cache: {
                    size: this.responseCache.size,
                    enabled: this.options.enableCache
                },
                timestamp: new Date()
            }
            
            // Add SPARQL endpoint stats if available
            if (this.dualSearch.sparqlEndpoint) {
                try {
                    const sparqlStatsQuery = `
                        PREFIX ragno: <http://purl.org/stuff/ragno/>
                        
                        SELECT 
                            (COUNT(DISTINCT ?entity) AS ?entityCount)
                            (COUNT(DISTINCT ?relationship) AS ?relationshipCount)
                            (COUNT(DISTINCT ?unit) AS ?unitCount)
                            (COUNT(DISTINCT ?attribute) AS ?attributeCount)
                        WHERE {
                            OPTIONAL { ?entity a ragno:Entity }
                            OPTIONAL { ?relationship a ragno:Relationship }
                            OPTIONAL { ?unit a ragno:Unit }
                            OPTIONAL { ?attribute a ragno:Attribute }
                        }
                    `
                    
                    const sparqlStats = await SPARQLHelpers.executeSPARQLQuery(
                        this.dualSearch.sparqlEndpoint, 
                        sparqlStatsQuery
                    )
                    
                    stats.sparqlStore = sparqlStats[0] || {}
                } catch (error) {
                    logger.warn('Could not retrieve SPARQL stats:', error.message)
                }
            }
            
            this.sendSuccess(res, stats)
            
        } catch (error) {
            logger.error('Graph stats API error:', error)
            this.sendError(res, 500, 'Failed to retrieve graph statistics', error.message)
        }
    }
    
    /**
     * Search status endpoint handler
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleSearchStatus(req, res) {
        const status = {
            searchSystem: 'operational',
            components: {
                dualSearch: !!this.dualSearch,
                vectorIndex: !!this.vectorIndex,
                sparqlEndpoint: !!this.dualSearch.sparqlEndpoint,
                llmHandler: !!this.dualSearch.llmHandler,
                embeddingHandler: !!this.dualSearch.embeddingHandler
            },
            capabilities: {
                exactMatch: !!this.dualSearch.sparqlEndpoint,
                vectorSimilarity: !!this.vectorIndex,
                pprTraversal: !!this.dualSearch.sparqlEndpoint,
                entityExtraction: !!this.dualSearch.llmHandler,
                embeddingGeneration: !!this.dualSearch.embeddingHandler
            },
            version: '1.0.0',
            timestamp: new Date()
        }
        
        this.sendSuccess(res, status)
    }
    
    /**
     * Search statistics endpoint handler
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async handleSearchStats(req, res) {
        this.sendSuccess(res, {
            requestStats: this.requestStats,
            searchStats: this.dualSearch.getStatistics(),
            cacheStats: {
                size: this.responseCache.size,
                hitRate: this.calculateCacheHitRate()
            },
            timestamp: new Date()
        })
    }
    
    /**
     * Validate search request
     * @param {Object} req - Express request object
     * @returns {Object} Validation result
     */
    validateSearchRequest(req) {
        const { query } = req.body
        
        if (!query || typeof query !== 'string') {
            return { valid: false, error: 'Query string required' }
        }
        
        if (query.length > this.options.maxQueryLength) {
            return { valid: false, error: `Query too long (max ${this.options.maxQueryLength} characters)` }
        }
        
        return { valid: true }
    }
    
    /**
     * Check rate limiting for request
     * @param {Object} req - Express request object
     * @returns {boolean} True if request is allowed
     */
    checkRateLimit(req) {
        const clientId = req.ip || 'unknown'
        const now = Date.now()
        
        // Clean old entries
        for (const [id, data] of this.rateLimitStore.entries()) {
            if (now - data.windowStart > this.options.rateLimitWindow) {
                this.rateLimitStore.delete(id)
            }
        }
        
        // Check current client
        const clientData = this.rateLimitStore.get(clientId) || {
            requests: 0,
            windowStart: now
        }
        
        // Reset window if needed
        if (now - clientData.windowStart > this.options.rateLimitWindow) {
            clientData.requests = 0
            clientData.windowStart = now
        }
        
        // Check limit
        if (clientData.requests >= this.options.rateLimitRequests) {
            return false
        }
        
        // Update count
        clientData.requests++
        this.rateLimitStore.set(clientId, clientData)
        
        return true
    }
    
    /**
     * Generate cache key for request
     * @param {string} method - Search method
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @returns {string} Cache key
     */
    generateCacheKey(method, query, options) {
        const optionsHash = this.hashObject(options)
        return `${method}:${query}:${optionsHash}`
    }
    
    /**
     * Build SPARQL query for entity details
     * @param {string} entityUri - Entity URI
     * @returns {string} SPARQL query
     */
    buildEntityDetailsQuery(entityUri) {
        return `
            PREFIX ragno: <http://purl.org/stuff/ragno/>
            PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            
            SELECT ?predicate ?object ?objectType
            WHERE {
                <${entityUri}> ?predicate ?object .
                OPTIONAL {
                    ?object a ?objectType .
                }
            }
            ORDER BY ?predicate
        `
    }
    
    /**
     * Send successful response
     * @param {Object} res - Express response object
     * @param {Object} data - Response data
     */
    sendSuccess(res, data) {
        if (this.options.enableCORS) {
            res.header('Access-Control-Allow-Origin', '*')
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        }
        
        res.status(200).json({
            success: true,
            data: data
        })
    }
    
    /**
     * Send error response
     * @param {Object} res - Express response object
     * @param {number} status - HTTP status code
     * @param {string} message - Error message
     * @param {string} [detail] - Error detail
     */
    sendError(res, status, message, detail = null) {
        if (this.options.enableCORS) {
            res.header('Access-Control-Allow-Origin', '*')
        }
        
        const errorResponse = {
            success: false,
            error: {
                message: message,
                code: status,
                timestamp: new Date()
            }
        }
        
        if (detail) {
            errorResponse.error.detail = detail
        }
        
        res.status(status).json(errorResponse)
        
        // Update error statistics
        this.requestStats.errorCount++
    }
    
    /**
     * Update request statistics
     * @param {number} responseTime - Response time in ms
     * @param {string} type - Request type
     */
    updateRequestStats(responseTime, type = 'general') {
        this.requestStats.totalRequests++
        if (type === 'search') {
            this.requestStats.searchRequests++
        }
        
        this.requestStats.averageResponseTime = (
            this.requestStats.averageResponseTime * (this.requestStats.totalRequests - 1) + responseTime
        ) / this.requestStats.totalRequests
        
        this.requestStats.lastRequest = new Date()
    }
    
    /**
     * Calculate cache hit rate
     * @returns {number} Cache hit rate percentage
     */
    calculateCacheHitRate() {
        // This would need to be tracked more precisely in a production system
        return this.responseCache.size > 0 ? 0.75 : 0 // Placeholder
    }
    
    /**
     * Hash object for cache key generation
     * @param {Object} obj - Object to hash
     * @returns {string} Hash string
     */
    hashObject(obj) {
        return JSON.stringify(obj, Object.keys(obj).sort()).slice(0, 32)
    }
    
    /**
     * Set vector index
     * @param {VectorIndex} vectorIndex - Vector index instance
     */
    setVectorIndex(vectorIndex) {
        this.vectorIndex = vectorIndex
        this.dualSearch.setVectorIndex(vectorIndex)
        logger.info('Vector index configured for SearchAPI')
    }
    
    /**
     * Set SPARQL endpoint
     * @param {string} sparqlEndpoint - SPARQL endpoint URL
     */
    setSPARQLEndpoint(sparqlEndpoint) {
        this.dualSearch.setSPARQLEndpoint(sparqlEndpoint)
        logger.info('SPARQL endpoint configured for SearchAPI')
    }
    
    /**
     * Set LLM handler
     * @param {Object} llmHandler - LLM handler instance
     */
    setLLMHandler(llmHandler) {
        this.dualSearch.setLLMHandler(llmHandler)
        logger.info('LLM handler configured for SearchAPI')
    }
    
    /**
     * Set embedding handler
     * @param {Object} embeddingHandler - Embedding handler instance
     */
    setEmbeddingHandler(embeddingHandler) {
        this.dualSearch.setEmbeddingHandler(embeddingHandler)
        logger.info('Embedding handler configured for SearchAPI')
    }
    
    /**
     * Clear response cache
     */
    clearCache() {
        this.responseCache.clear()
        logger.info('Response cache cleared')
    }
    
    /**
     * Get API statistics
     * @returns {Object} API statistics
     */
    getStatistics() {
        return {
            requests: this.requestStats,
            cache: {
                size: this.responseCache.size,
                hitRate: this.calculateCacheHitRate()
            },
            rateLimiting: {
                activeClients: this.rateLimitStore.size,
                window: this.options.rateLimitWindow,
                limit: this.options.rateLimitRequests
            }
        }
    }
}