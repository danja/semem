/**
 * Ragno: Graph API - Production REST Endpoints
 * 
 * This module provides comprehensive REST API endpoints for graph operations,
 * data export, and system monitoring. It integrates with all ragno components
 * and follows production API standards with proper error handling and validation.
 */

import express from 'express'
import rdf from 'rdf-ext'
import { GraphAnalytics, CommunityDetection, PersonalizedPageRank } from '../algorithms/index.js'
import { decomposeCorpus } from '../decomposeCorpus.js'
import { augmentWithAttributes } from '../augmentWithAttributes.js'
import { aggregateCommunities } from '../aggregateCommunities.js'
import { enrichWithEmbeddings } from '../enrichWithEmbeddings.js'
import { DualSearch } from '../search/index.js'
import GraphCache from '../cache/GraphCache.js'
import GraphMetrics from '../monitoring/GraphMetrics.js'
import RDFGraphManager from '../core/RDFGraphManager.js'
import NamespaceManager from '../core/NamespaceManager.js'
import { SPARQLHelpers } from '../../utils/SPARQLHelpers.js'
import { logger } from '../../Utils.js'

/**
 * GraphAPI class providing REST endpoints for ragno graph operations
 */
export class GraphAPI {
  constructor(options = {}) {
    this.options = {
      // Core dependencies
      llmHandler: options.llmHandler,
      embeddingHandler: options.embeddingHandler,
      sparqlEndpoint: options.sparqlEndpoint,
      
      // API configuration
      enableCaching: options.enableCaching !== false,
      enableMetrics: options.enableMetrics !== false,
      rateLimit: options.rateLimit || { windowMs: 15 * 60 * 1000, max: 100 },
      
      // Processing limits
      maxTextLength: options.maxTextLength || 50000,
      maxBatchSize: options.maxBatchSize || 10,
      requestTimeout: options.requestTimeout || 300000, // 5 minutes
      
      // Export configuration
      supportedFormats: options.supportedFormats || ['turtle', 'ntriples', 'jsonld', 'json'],
      
      ...options
    }
    
    // Initialize infrastructure
    this.namespaceManager = new NamespaceManager()
    this.rdfManager = new RDFGraphManager({ namespace: this.namespaceManager })
    this.cache = this.options.enableCaching ? new GraphCache(options.cacheOptions) : null
    this.metrics = this.options.enableMetrics ? new GraphMetrics(options.metricsOptions) : null
    this.dualSearch = null // Will be initialized when needed
    
    // Create Express router
    this.router = express.Router()
    this._setupRoutes()
    this._setupMiddleware()
  }
  
  /**
   * Setup API routes
   */
  _setupRoutes() {
    // Graph Statistics
    this.router.get('/stats', this._handleGetStats.bind(this))
    this.router.get('/stats/detailed', this._handleGetDetailedStats.bind(this))
    
    // Entity Operations
    this.router.get('/entities', this._handleGetEntities.bind(this))
    this.router.get('/entities/:id', this._handleGetEntity.bind(this))
    this.router.get('/entities/:id/relationships', this._handleGetEntityRelationships.bind(this))
    this.router.get('/entities/:id/attributes', this._handleGetEntityAttributes.bind(this))
    
    // Community Operations
    this.router.get('/communities', this._handleGetCommunities.bind(this))
    this.router.get('/communities/:id', this._handleGetCommunity.bind(this))
    this.router.get('/communities/:id/members', this._handleGetCommunityMembers.bind(this))
    
    // Search Operations
    this.router.post('/search/dual', this._handleDualSearch.bind(this))
    this.router.post('/search/entities', this._handleEntitySearch.bind(this))
    this.router.post('/search/semantic', this._handleSemanticSearch.bind(this))
    this.router.post('/search/ppr', this._handlePPRSearch.bind(this))
    
    // Pipeline Operations
    this.router.post('/decompose', this._handleDecomposeText.bind(this))
    this.router.post('/augment', this._handleAugmentGraph.bind(this))
    this.router.post('/cluster', this._handleClusterGraph.bind(this))
    this.router.post('/enrich', this._handleEnrichEmbeddings.bind(this))
    this.router.post('/pipeline/full', this._handleFullPipeline.bind(this))
    
    // Export Operations
    this.router.get('/export/:format', this._handleExportGraph.bind(this))
    this.router.post('/export/:format', this._handleExportSubgraph.bind(this))
    
    // System Operations
    this.router.get('/health', this._handleHealthCheck.bind(this))
    this.router.get('/metrics', this._handleGetMetrics.bind(this))
    this.router.post('/cache/clear', this._handleClearCache.bind(this))
    this.router.post('/cache/warm', this._handleWarmCache.bind(this))
  }
  
  /**
   * Setup middleware
   */
  _setupMiddleware() {
    // Request logging and metrics
    this.router.use((req, res, next) => {
      const start = Date.now()
      
      if (this.metrics) {
        this.metrics.recordRequest(req.method, req.path)
      }
      
      res.on('finish', () => {
        const duration = Date.now() - start
        logger.info(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`)
        
        if (this.metrics) {
          this.metrics.recordResponse(req.method, req.path, res.statusCode, duration)
        }
      })
      
      next()
    })
    
    // Request timeout
    this.router.use((req, res, next) => {
      req.setTimeout(this.options.requestTimeout, () => {
        res.status(408).json({
          error: 'Request timeout',
          message: `Request exceeded ${this.options.requestTimeout}ms timeout`
        })
      })
      next()
    })
  }
  
  /**
   * Get basic graph statistics
   */
  async _handleGetStats(req, res) {
    try {
      const cacheKey = 'graph-stats-basic'
      
      if (this.cache) {
        const cached = await this.cache.get(cacheKey)
        if (cached) {
          return res.json(cached)
        }
      }
      
      const stats = await this._computeBasicStats()
      
      if (this.cache) {
        await this.cache.set(cacheKey, stats, 300) // Cache for 5 minutes
      }
      
      res.json(stats)
      
    } catch (error) {
      logger.error('Failed to get graph stats:', error)
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to compute graph statistics'
      })
    }
  }
  
  /**
   * Get detailed graph statistics with algorithms
   */
  async _handleGetDetailedStats(req, res) {
    try {
      const cacheKey = 'graph-stats-detailed'
      
      if (this.cache) {
        const cached = await this.cache.get(cacheKey)
        if (cached) {
          return res.json(cached)
        }
      }
      
      const stats = await this._computeDetailedStats()
      
      if (this.cache) {
        await this.cache.set(cacheKey, stats, 600) // Cache for 10 minutes
      }
      
      res.json(stats)
      
    } catch (error) {
      logger.error('Failed to get detailed graph stats:', error)
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to compute detailed statistics'
      })
    }
  }
  
  /**
   * Get entities with pagination and filtering
   */
  async _handleGetEntities(req, res) {
    try {
      const {
        limit = 50,
        offset = 0,
        type,
        isEntryPoint,
        minFrequency,
        search
      } = req.query
      
      const entities = await this._queryEntities({
        limit: Math.min(parseInt(limit), 1000),
        offset: parseInt(offset),
        type,
        isEntryPoint: isEntryPoint === 'true',
        minFrequency: minFrequency ? parseInt(minFrequency) : undefined,
        search
      })
      
      res.json(entities)
      
    } catch (error) {
      logger.error('Failed to get entities:', error)
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve entities'
      })
    }
  }
  
  /**
   * Get specific entity with relationships and attributes
   */
  async _handleGetEntity(req, res) {
    try {
      const { id } = req.params
      const { includeRelationships = true, includeAttributes = true } = req.query
      
      const entity = await this._getEntityDetails(id, {
        includeRelationships: includeRelationships === 'true',
        includeAttributes: includeAttributes === 'true'
      })
      
      if (!entity) {
        return res.status(404).json({
          error: 'Entity not found',
          message: `Entity with id ${id} does not exist`
        })
      }
      
      res.json(entity)
      
    } catch (error) {
      logger.error('Failed to get entity:', error)
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to retrieve entity'
      })
    }
  }
  
  /**
   * Perform dual search (exact + vector + PPR)
   */
  async _handleDualSearch(req, res) {
    try {
      const {
        query,
        limit = 10,
        searchTypes = ['entity', 'unit', 'attribute', 'community'],
        includeScores = true,
        pprDepth = 2
      } = req.body
      
      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Query parameter is required and must be a string'
        })
      }
      
      if (!this.dualSearch) {
        this.dualSearch = new DualSearch({
          sparqlEndpoint: this.options.sparqlEndpoint,
          llmHandler: this.options.llmHandler,
          embeddingHandler: this.options.embeddingHandler
        })
      }
      
      const results = await this.dualSearch.search(query, {
        limit: Math.min(parseInt(limit), 100),
        searchTypes,
        includeScores,
        pprDepth: parseInt(pprDepth)
      })
      
      res.json(results)
      
    } catch (error) {
      logger.error('Dual search failed:', error)
      res.status(500).json({
        error: 'Search failed',
        message: 'Failed to perform dual search'
      })
    }
  }
  
  /**
   * Decompose text into knowledge graph components
   */
  async _handleDecomposeText(req, res) {
    try {
      const {
        textChunks,
        options = {}
      } = req.body
      
      if (!textChunks || !Array.isArray(textChunks)) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'textChunks parameter is required and must be an array'
        })
      }
      
      // Validate text length
      const totalLength = textChunks.reduce((sum, chunk) => sum + (chunk.content || '').length, 0)
      if (totalLength > this.options.maxTextLength) {
        return res.status(400).json({
          error: 'Request too large',
          message: `Total text length exceeds ${this.options.maxTextLength} characters`
        })
      }
      
      const results = await decomposeCorpus(textChunks, this.options.llmHandler, options)
      
      res.json({
        success: true,
        statistics: results.statistics,
        entities: results.entities.length,
        units: results.units.length,
        relationships: results.relationships.length,
        exportInfo: {
          datasetSize: results.dataset.size,
          message: 'Use /export endpoints to retrieve RDF data'
        }
      })
      
    } catch (error) {
      logger.error('Text decomposition failed:', error)
      res.status(500).json({
        error: 'Processing failed',
        message: 'Failed to decompose text'
      })
    }
  }
  
  /**
   * Run full ragno pipeline
   */
  async _handleFullPipeline(req, res) {
    try {
      const {
        textChunks,
        options = {}
      } = req.body
      
      if (!textChunks || !Array.isArray(textChunks)) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'textChunks parameter is required and must be an array'
        })
      }
      
      const pipelineStart = Date.now()
      const results = {
        phases: {},
        statistics: {},
        errors: []
      }
      
      try {
        // Phase 1: Decomposition
        logger.info('Pipeline Phase 1: Text decomposition')
        const decomposition = await decomposeCorpus(textChunks, this.options.llmHandler, options.decomposition)
        results.phases.decomposition = {
          success: true,
          statistics: decomposition.statistics
        }
        
        // Phase 2: Augmentation  
        logger.info('Pipeline Phase 2: Entity augmentation')
        const augmentation = await augmentWithAttributes(decomposition, this.options.llmHandler, options.augmentation)
        results.phases.augmentation = {
          success: true,
          statistics: augmentation.statistics
        }
        
        // Phase 3: Community Detection
        logger.info('Pipeline Phase 3: Community detection')
        const communities = await aggregateCommunities(augmentation, this.options.llmHandler, options.communities)
        results.phases.communities = {
          success: true,
          statistics: communities.statistics
        }
        
        // Phase 4: Vector Enrichment
        logger.info('Pipeline Phase 4: Vector enrichment')
        const enrichment = await enrichWithEmbeddings(communities, this.options.embeddingHandler, options.enrichment)
        results.phases.enrichment = {
          success: true,
          statistics: enrichment.statistics
        }
        
        // Final statistics
        results.statistics = {
          totalProcessingTime: Date.now() - pipelineStart,
          finalDatasetSize: enrichment.dataset.size,
          totalEntities: decomposition.entities.length,
          totalUnits: decomposition.units.length,
          totalRelationships: decomposition.relationships.length,
          totalAttributes: augmentation.attributes.length,
          totalCommunities: communities.communities.length,
          vectorsIndexed: enrichment.statistics.vectorsIndexed
        }
        
        res.json({
          success: true,
          message: 'Full pipeline completed successfully',
          results: results
        })
        
      } catch (phaseError) {
        results.errors.push({
          phase: 'unknown',
          error: phaseError.message
        })
        throw phaseError
      }
      
    } catch (error) {
      logger.error('Full pipeline failed:', error)
      res.status(500).json({
        error: 'Pipeline failed',
        message: 'Failed to complete full pipeline',
        partialResults: results
      })
    }
  }
  
  /**
   * Export graph in specified format
   */
  async _handleExportGraph(req, res) {
    try {
      const { format } = req.params
      const { graphFilter, includeMetadata = true } = req.query
      
      if (!this.options.supportedFormats.includes(format)) {
        return res.status(400).json({
          error: 'Unsupported format',
          message: `Supported formats: ${this.options.supportedFormats.join(', ')}`
        })
      }
      
      const exportData = await this._exportGraphData(format, {
        graphFilter,
        includeMetadata: includeMetadata === 'true'
      })
      
      // Set appropriate content type
      const contentTypes = {
        turtle: 'text/turtle',
        ntriples: 'application/n-triples',
        jsonld: 'application/ld+json',
        json: 'application/json'
      }
      
      res.setHeader('Content-Type', contentTypes[format] || 'text/plain')
      res.setHeader('Content-Disposition', `attachment; filename="ragno-graph.${format}"`)
      
      res.send(exportData)
      
    } catch (error) {
      logger.error('Graph export failed:', error)
      res.status(500).json({
        error: 'Export failed',
        message: 'Failed to export graph data'
      })
    }
  }
  
  /**
   * Health check endpoint
   */
  async _handleHealthCheck(req, res) {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '0.3.0',
        dependencies: {
          llmHandler: !!this.options.llmHandler,
          embeddingHandler: !!this.options.embeddingHandler,
          sparqlEndpoint: !!this.options.sparqlEndpoint,
          cache: !!this.cache,
          metrics: !!this.metrics
        }
      }
      
      // Test SPARQL connection if available
      if (this.options.sparqlEndpoint) {
        try {
          await SPARQLHelpers.executeSPARQLQuery(
            this.options.sparqlEndpoint,
            'SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o } LIMIT 1'
          )
          health.dependencies.sparqlConnection = true
        } catch (sparqlError) {
          health.dependencies.sparqlConnection = false
          health.warnings = ['SPARQL endpoint unreachable']
        }
      }
      
      res.json(health)
      
    } catch (error) {
      logger.error('Health check failed:', error)
      res.status(500).json({
        status: 'unhealthy',
        error: error.message
      })
    }
  }
  
  /**
   * Compute basic graph statistics
   */
  async _computeBasicStats() {
    if (!this.options.sparqlEndpoint) {
      return { error: 'No SPARQL endpoint configured' }
    }
    
    const queries = {
      entities: 'SELECT (COUNT(*) as ?count) WHERE { ?s a ragno:Entity }',
      units: 'SELECT (COUNT(*) as ?count) WHERE { ?s a ragno:Unit }',
      relationships: 'SELECT (COUNT(*) as ?count) WHERE { ?s a ragno:Relationship }',
      attributes: 'SELECT (COUNT(*) as ?count) WHERE { ?s a ragno:Attribute }',
      communities: 'SELECT (COUNT(*) as ?count) WHERE { ?s a ragno:CommunityElement }'
    }
    
    const stats = { timestamp: new Date().toISOString() }
    
    for (const [key, query] of Object.entries(queries)) {
      try {
        const results = await SPARQLHelpers.executeSPARQLQuery(this.options.sparqlEndpoint, query)
        stats[key] = results.length > 0 ? parseInt(results[0].count.value) : 0
      } catch (error) {
        logger.warn(`Failed to get ${key} count:`, error.message)
        stats[key] = 0
      }
    }
    
    return stats
  }
  
  /**
   * Compute detailed statistics with graph algorithms
   */
  async _computeDetailedStats() {
    const basicStats = await this._computeBasicStats()
    
    try {
      // Build graph for analysis
      const graphAnalytics = new GraphAnalytics()
      const dataset = await this._getCurrentDataset()
      const graph = graphAnalytics.buildGraphFromRDF(dataset)
      
      // Compute graph metrics
      const graphStats = graphAnalytics.computeGraphStatistics(graph)
      const kCoreResults = graph.nodes.size > 2 ? graphAnalytics.computeKCore(graph) : null
      
      return {
        ...basicStats,
        graph: {
          nodes: graph.nodes.size,
          edges: graph.edges.size,
          density: graphStats.density,
          averageDegree: graphStats.averageDegree,
          maxDegree: Math.max(...Array.from(graphStats.degreeDistribution.values())),
          connectedComponents: graphStats.connectedComponents,
          maxCoreNumber: kCoreResults ? Math.max(...Array.from(kCoreResults.coreNumbers.values())) : 0
        },
        timestamp: new Date().toISOString()
      }
      
    } catch (error) {
      logger.warn('Failed to compute detailed stats:', error.message)
      return {
        ...basicStats,
        error: 'Failed to compute graph analysis metrics'
      }
    }
  }
  
  /**
   * Get current RDF dataset from SPARQL endpoint
   */
  async _getCurrentDataset() {
    // This would query the SPARQL endpoint and construct an RDF dataset
    // Implementation depends on the specific SPARQL endpoint capabilities
    const dataset = rdf.dataset()
    
    // For now, return empty dataset - in production this would fetch from SPARQL
    logger.debug('getCurrentDataset: Using empty dataset placeholder')
    
    return dataset
  }
  
  /**
   * Get the Express router
   */
  getRouter() {
    return this.router
  }
  
  /**
   * Initialize the API with required dependencies
   */
  async initialize() {
    logger.info('Initializing Ragno Graph API...')
    
    if (this.cache) {
      await this.cache.initialize()
    }
    
    if (this.metrics) {
      await this.metrics.initialize()
    }
    
    logger.info('Ragno Graph API initialized successfully')
  }
  
  /**
   * Cleanup resources
   */
  async shutdown() {
    logger.info('Shutting down Ragno Graph API...')
    
    if (this.cache) {
      await this.cache.shutdown()
    }
    
    if (this.metrics) {
      await this.metrics.shutdown()
    }
    
    logger.info('Ragno Graph API shutdown complete')
  }
}

export default GraphAPI