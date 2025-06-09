/**
 * Ragno: Enhanced Search API - Production Search Endpoints
 * 
 * This module provides comprehensive search endpoints that build upon the existing
 * SearchAPI to provide production-ready search functionality with advanced filtering,
 * faceting, and result processing capabilities.
 */

import express from 'express'
import { DualSearch, VectorIndex } from '../search/index.js'
import { PersonalizedPageRank } from '../algorithms/index.js'
import GraphCache from '../cache/GraphCache.js'
import GraphMetrics from '../monitoring/GraphMetrics.js'
import SPARQLHelpers from '../../utils/SPARQLHelpers.js'
import { logger } from '../../Utils.js'

/**
 * Enhanced Search API with advanced search capabilities
 */
export class SearchAPIEnhanced {
  constructor(options = {}) {
    this.options = {
      // Core dependencies
      sparqlEndpoint: options.sparqlEndpoint,
      llmHandler: options.llmHandler,
      embeddingHandler: options.embeddingHandler,
      vectorIndex: options.vectorIndex,
      
      // Search configuration
      defaultLimit: options.defaultLimit || 10,
      maxLimit: options.maxLimit || 100,
      searchTimeout: options.searchTimeout || 30000,
      
      // Caching and metrics
      enableCaching: options.enableCaching !== false,
      enableMetrics: options.enableMetrics !== false,
      cacheTimeouts: {
        entitySearch: 300,
        semanticSearch: 600,
        facets: 900,
        stats: 300
      },
      
      // Search types and weights
      searchTypes: options.searchTypes || {
        'ragno:Entity': { weight: 1.0, exactMatchBoost: 2.0 },
        'ragno:Unit': { weight: 0.8, vectorSearchBoost: 1.5 },
        'ragno:Attribute': { weight: 0.9, contextBoost: 1.2 },
        'ragno:CommunityElement': { weight: 0.7, summaryBoost: 1.3 }
      },
      
      ...options
    }
    
    // Initialize components
    this.cache = this.options.enableCaching ? new GraphCache(options.cacheOptions) : null
    this.metrics = this.options.enableMetrics ? new GraphMetrics(options.metricsOptions) : null
    this.dualSearch = new DualSearch(this.options)
    
    // Create Express router
    this.router = express.Router()
    this._setupRoutes()
    this._setupMiddleware()
  }
  
  /**
   * Setup search API routes
   */
  _setupRoutes() {
    // Core Search Operations
    this.router.post('/unified', this._handleUnifiedSearch.bind(this))
    this.router.post('/semantic', this._handleSemanticSearch.bind(this))
    this.router.post('/entities', this._handleEntitySearch.bind(this))
    this.router.post('/similarity', this._handleSimilaritySearch.bind(this))
    this.router.post('/graph-traversal', this._handleGraphTraversal.bind(this))
    
    // Advanced Search Operations
    this.router.post('/faceted', this._handleFacetedSearch.bind(this))
    this.router.post('/contextual', this._handleContextualSearch.bind(this))
    this.router.post('/temporal', this._handleTemporalSearch.bind(this))
    this.router.post('/batch', this._handleBatchSearch.bind(this))
    
    // Search Analytics
    this.router.get('/facets', this._handleGetFacets.bind(this))
    this.router.get('/suggestions', this._handleGetSuggestions.bind(this))
    this.router.get('/stats', this._handleGetSearchStats.bind(this))
    this.router.post('/explain', this._handleExplainQuery.bind(this))
    
    // Search Management
    this.router.post('/index/rebuild', this._handleRebuildIndex.bind(this))
    this.router.get('/index/status', this._handleGetIndexStatus.bind(this))
    this.router.post('/cache/warm', this._handleWarmSearchCache.bind(this))
  }
  
  /**
   * Setup middleware for search endpoints
   */
  _setupMiddleware() {
    // Search request logging
    this.router.use((req, res, next) => {
      const start = Date.now()
      
      if (this.metrics) {
        this.metrics.recordSearchRequest(req.path, req.body?.query)
      }
      
      res.on('finish', () => {
        const duration = Date.now() - start
        logger.debug(`Search ${req.path}: ${duration}ms`)
        
        if (this.metrics) {
          this.metrics.recordSearchResponse(req.path, res.statusCode, duration, res.locals.resultCount)
        }
      })
      
      next()
    })
    
    // Search timeout
    this.router.use((req, res, next) => {
      req.setTimeout(this.options.searchTimeout, () => {
        res.status(408).json({
          error: 'Search timeout',
          message: `Search exceeded ${this.options.searchTimeout}ms timeout`
        })
      })
      next()
    })
  }
  
  /**
   * Unified search combining all search strategies
   */
  async _handleUnifiedSearch(req, res) {
    try {
      const {
        query,
        limit = this.options.defaultLimit,
        offset = 0,
        searchTypes = Object.keys(this.options.searchTypes),
        includeScores = true,
        includeExplanation = false,
        filters = {},
        sortBy = 'relevance'
      } = req.body
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: 'Invalid query',
          message: 'Query parameter is required and must be a non-empty string'
        })
      }
      
      const searchOptions = {
        limit: Math.min(parseInt(limit), this.options.maxLimit),
        offset: parseInt(offset),
        searchTypes,
        includeScores,
        includeExplanation,
        filters,
        sortBy
      }
      
      // Check cache first
      const cacheKey = this._generateCacheKey('unified', query, searchOptions)
      if (this.cache) {
        const cached = await this.cache.get(cacheKey)
        if (cached) {
          res.locals.resultCount = cached.results.length
          return res.json(cached)
        }
      }
      
      // Perform unified search
      const results = await this._performUnifiedSearch(query, searchOptions)
      
      // Cache results
      if (this.cache) {
        await this.cache.set(cacheKey, results, this.options.cacheTimeouts.entitySearch)
      }
      
      res.locals.resultCount = results.results.length
      res.json(results)
      
    } catch (error) {
      logger.error('Unified search failed:', error)
      res.status(500).json({
        error: 'Search failed',
        message: 'Failed to perform unified search'
      })
    }
  }
  
  /**
   * Semantic similarity search using vector embeddings
   */
  async _handleSemanticSearch(req, res) {
    try {
      const {
        query,
        limit = this.options.defaultLimit,
        threshold = 0.7,
        nodeTypes = ['ragno:Unit', 'ragno:Attribute', 'ragno:CommunityElement'],
        includeMetadata = true
      } = req.body
      
      if (!query) {
        return res.status(400).json({
          error: 'Invalid query',
          message: 'Query parameter is required'
        })
      }
      
      // Generate query embedding
      const queryEmbedding = await this.options.embeddingHandler.generateEmbedding(query)
      
      if (!queryEmbedding) {
        return res.status(500).json({
          error: 'Embedding failed',
          message: 'Failed to generate query embedding'
        })
      }
      
      // Perform vector search
      const vectorResults = await this.options.vectorIndex.search(
        queryEmbedding,
        Math.min(parseInt(limit), this.options.maxLimit),
        threshold
      )
      
      // Filter by node types and enhance with metadata
      const results = []
      for (const result of vectorResults) {
        if (nodeTypes.includes(result.metadata?.nodeType)) {
          const enhancedResult = {
            id: result.id,
            similarity: result.distance,
            type: result.metadata.nodeType,
            ...result.metadata
          }
          
          if (includeMetadata) {
            enhancedResult.details = await this._getNodeDetails(result.id)
          }
          
          results.push(enhancedResult)
        }
      }
      
      res.json({
        query,
        results,
        metadata: {
          totalFound: results.length,
          threshold,
          searchTypes: nodeTypes,
          executionTime: Date.now() - req.startTime
        }
      })
      
    } catch (error) {
      logger.error('Semantic search failed:', error)
      res.status(500).json({
        error: 'Search failed',
        message: 'Failed to perform semantic search'
      })
    }
  }
  
  /**
   * Entity-focused search with relationship traversal
   */
  async _handleEntitySearch(req, res) {
    try {
      const {
        query,
        limit = this.options.defaultLimit,
        includeRelationships = true,
        includeAttributes = true,
        traversalDepth = 1,
        entityTypes = []
      } = req.body
      
      if (!query) {
        return res.status(400).json({
          error: 'Invalid query',
          message: 'Query parameter is required'
        })
      }
      
      const entities = await this._searchEntities(query, {
        limit: Math.min(parseInt(limit), this.options.maxLimit),
        entityTypes
      })
      
      // Enhance with relationships and attributes
      const enhancedEntities = []
      for (const entity of entities) {
        const enhanced = { ...entity }
        
        if (includeRelationships) {
          enhanced.relationships = await this._getEntityRelationships(entity.id, traversalDepth)
        }
        
        if (includeAttributes) {
          enhanced.attributes = await this._getEntityAttributes(entity.id)
        }
        
        enhancedEntities.push(enhanced)
      }
      
      res.json({
        query,
        results: enhancedEntities,
        metadata: {
          totalFound: enhancedEntities.length,
          includeRelationships,
          includeAttributes,
          traversalDepth
        }
      })
      
    } catch (error) {
      logger.error('Entity search failed:', error)
      res.status(500).json({
        error: 'Search failed',
        message: 'Failed to perform entity search'
      })
    }
  }
  
  /**
   * Graph traversal search using Personalized PageRank
   */
  async _handleGraphTraversal(req, res) {
    try {
      const {
        seedEntities,
        limit = this.options.defaultLimit,
        alpha = 0.5,
        iterations = 3,
        nodeTypes = Object.keys(this.options.searchTypes),
        includeScores = true
      } = req.body
      
      if (!seedEntities || !Array.isArray(seedEntities) || seedEntities.length === 0) {
        return res.status(400).json({
          error: 'Invalid seed entities',
          message: 'seedEntities parameter is required and must be a non-empty array'
        })
      }
      
      // Use PersonalizedPageRank for graph traversal
      const ppr = new PersonalizedPageRank()
      const dataset = await this._getCurrentDataset()
      
      const traversalResults = await ppr.computePersonalizedPageRank(dataset, {
        seedEntities,
        alpha,
        iterations,
        topK: Math.min(parseInt(limit), this.options.maxLimit)
      })
      
      // Filter by node types and enhance results
      const results = []
      for (const [nodeUri, score] of traversalResults.scores) {
        const nodeType = await this._getNodeType(nodeUri)
        
        if (nodeTypes.includes(nodeType)) {
          const result = {
            id: nodeUri,
            type: nodeType,
            pprScore: score
          }
          
          if (includeScores) {
            result.details = await this._getNodeDetails(nodeUri)
          }
          
          results.push(result)
        }
      }
      
      res.json({
        seedEntities,
        results,
        metadata: {
          algorithm: 'PersonalizedPageRank',
          parameters: { alpha, iterations },
          nodeTypes,
          totalFound: results.length
        }
      })
      
    } catch (error) {
      logger.error('Graph traversal search failed:', error)
      res.status(500).json({
        error: 'Search failed',
        message: 'Failed to perform graph traversal search'
      })
    }
  }
  
  /**
   * Faceted search with dynamic facet generation
   */
  async _handleFacetedSearch(req, res) {
    try {
      const {
        query,
        facets = ['type', 'confidence', 'timestamp'],
        filters = {},
        limit = this.options.defaultLimit
      } = req.body
      
      if (!query) {
        return res.status(400).json({
          error: 'Invalid query',
          message: 'Query parameter is required'
        })
      }
      
      // Perform base search
      const baseResults = await this._performUnifiedSearch(query, {
        limit: Math.min(parseInt(limit) * 2, this.options.maxLimit * 2), // Get more for faceting
        filters
      })
      
      // Generate facets
      const facetResults = {}
      for (const facetName of facets) {
        facetResults[facetName] = await this._generateFacet(baseResults.results, facetName)
      }
      
      // Apply facet filters
      const filteredResults = this._applyFacetFilters(baseResults.results, filters)
      
      res.json({
        query,
        results: filteredResults.slice(0, parseInt(limit)),
        facets: facetResults,
        metadata: {
          totalFound: filteredResults.length,
          facetsGenerated: facets,
          filtersApplied: Object.keys(filters)
        }
      })
      
    } catch (error) {
      logger.error('Faceted search failed:', error)
      res.status(500).json({
        error: 'Search failed',
        message: 'Failed to perform faceted search'
      })
    }
  }
  
  /**
   * Get available search facets
   */
  async _handleGetFacets(req, res) {
    try {
      const cacheKey = 'search-facets-available'
      
      if (this.cache) {
        const cached = await this.cache.get(cacheKey)
        if (cached) {
          return res.json(cached)
        }
      }
      
      const facets = await this._getAvailableFacets()
      
      if (this.cache) {
        await this.cache.set(cacheKey, facets, this.options.cacheTimeouts.facets)
      }
      
      res.json(facets)
      
    } catch (error) {
      logger.error('Failed to get facets:', error)
      res.status(500).json({
        error: 'Failed to retrieve facets',
        message: 'Unable to get available search facets'
      })
    }
  }
  
  /**
   * Get search suggestions for query completion
   */
  async _handleGetSuggestions(req, res) {
    try {
      const { partial, limit = 10, types = ['entity'] } = req.query
      
      if (!partial || partial.length < 2) {
        return res.json({ suggestions: [] })
      }
      
      const suggestions = await this._getSearchSuggestions(partial, {
        limit: Math.min(parseInt(limit), 50),
        types
      })
      
      res.json({ suggestions })
      
    } catch (error) {
      logger.error('Failed to get suggestions:', error)
      res.status(500).json({
        error: 'Failed to get suggestions',
        message: 'Unable to generate search suggestions'
      })
    }
  }
  
  /**
   * Get search analytics and statistics
   */
  async _handleGetSearchStats(req, res) {
    try {
      const stats = {
        timestamp: new Date().toISOString(),
        searchMetrics: this.metrics ? await this.metrics.getSearchMetrics() : null,
        indexStatus: this.options.vectorIndex ? await this.options.vectorIndex.getStatistics() : null,
        cacheStats: this.cache ? await this.cache.getStatistics() : null
      }
      
      res.json(stats)
      
    } catch (error) {
      logger.error('Failed to get search stats:', error)
      res.status(500).json({
        error: 'Failed to get statistics',
        message: 'Unable to retrieve search statistics'
      })
    }
  }
  
  /**
   * Helper method to perform unified search
   */
  async _performUnifiedSearch(query, options) {
    const startTime = Date.now()
    
    // Use DualSearch for comprehensive search
    const dualResults = await this.dualSearch.search(query, {
      limit: options.limit,
      searchTypes: options.searchTypes,
      includeScores: options.includeScores
    })
    
    // Apply additional filtering and sorting
    let results = dualResults.results || []
    
    if (options.filters) {
      results = this._applyFilters(results, options.filters)
    }
    
    if (options.sortBy && options.sortBy !== 'relevance') {
      results = this._sortResults(results, options.sortBy)
    }
    
    // Apply pagination
    const paginatedResults = results.slice(options.offset, options.offset + options.limit)
    
    return {
      query,
      results: paginatedResults,
      metadata: {
        totalFound: results.length,
        executionTime: Date.now() - startTime,
        searchStrategies: dualResults.metadata?.searchStrategies || [],
        offset: options.offset,
        limit: options.limit
      }
    }
  }
  
  /**
   * Generate cache key for search requests
   */
  _generateCacheKey(type, query, options) {
    const keyData = {
      type,
      query: query.toLowerCase().trim(),
      ...options
    }
    
    return `search:${type}:${Buffer.from(JSON.stringify(keyData)).toString('base64')}`
  }
  
  /**
   * Get the Express router
   */
  getRouter() {
    return this.router
  }
  
  /**
   * Initialize the search API
   */
  async initialize() {
    logger.info('Initializing Enhanced Search API...')
    
    if (this.cache) {
      await this.cache.initialize()
    }
    
    if (this.metrics) {
      await this.metrics.initialize()
    }
    
    await this.dualSearch.initialize()
    
    logger.info('Enhanced Search API initialized successfully')
  }
  
  /**
   * Cleanup resources
   */
  async shutdown() {
    logger.info('Shutting down Enhanced Search API...')
    
    if (this.cache) {
      await this.cache.shutdown()
    }
    
    if (this.metrics) {
      await this.metrics.shutdown()
    }
    
    await this.dualSearch.shutdown()
    
    logger.info('Enhanced Search API shutdown complete')
  }
}

export default SearchAPIEnhanced