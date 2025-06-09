/**
 * Ragno: Production API Server
 * 
 * This module provides the main API server that integrates all ragno components
 * into a production-ready REST API service with comprehensive monitoring,
 * caching, and management capabilities.
 */

import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import compression from 'compression'
import GraphAPI from './GraphAPI.js'
import SearchAPIEnhanced from './SearchAPIEnhanced.js'
import GraphMetrics from '../monitoring/GraphMetrics.js'
import GraphCache from '../cache/GraphCache.js'
import { VectorIndex } from '../search/index.js'
import { logger } from '../../Utils.js'

/**
 * Main Ragno API Server with production features
 */
export class RagnoAPIServer {
  constructor(options = {}) {
    this.options = {
      // Server configuration
      port: options.port || 3000,
      host: options.host || '0.0.0.0',
      apiVersion: options.apiVersion || 'v1',
      
      // Core dependencies
      llmHandler: options.llmHandler,
      embeddingHandler: options.embeddingHandler,
      sparqlEndpoint: options.sparqlEndpoint,
      
      // Security
      enableCors: options.enableCors !== false,
      corsOptions: options.corsOptions || {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        credentials: true
      },
      
      // Rate limiting
      enableRateLimit: options.enableRateLimit !== false,
      rateLimitOptions: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: 'Too many requests from this IP, please try again later',
        ...options.rateLimitOptions
      },
      
      // Production features
      enableMetrics: options.enableMetrics !== false,
      enableCaching: options.enableCaching !== false,
      enableCompression: options.enableCompression !== false,
      enableHelmet: options.enableHelmet !== false,
      
      // Component options
      cacheOptions: options.cacheOptions || {},
      metricsOptions: options.metricsOptions || {},
      vectorIndexPath: options.vectorIndexPath,
      
      // API configuration
      enableSwagger: options.enableSwagger !== false,
      apiDocumentation: options.apiDocumentation !== false,
      
      ...options
    }
    
    // Express app
    this.app = express()
    this.server = null
    
    // Core components
    this.cache = null
    this.metrics = null
    this.vectorIndex = null
    this.graphAPI = null
    this.searchAPI = null
    
    // Health status
    this.healthy = false
    this.startTime = null
  }
  
  /**
   * Initialize the API server
   */
  async initialize() {
    logger.info('Initializing Ragno API Server...')
    this.startTime = Date.now()
    
    try {
      // Initialize core components
      await this._initializeComponents()
      
      // Setup Express middleware
      this._setupMiddleware()
      
      // Setup API routes
      this._setupRoutes()
      
      // Setup error handling
      this._setupErrorHandling()
      
      this.healthy = true
      logger.info('Ragno API Server initialized successfully')
      
    } catch (error) {
      logger.error('Failed to initialize Ragno API Server:', error)
      throw error
    }
  }
  
  /**
   * Start the server
   */
  async start() {
    if (!this.healthy) {
      throw new Error('Server not initialized')
    }
    
    return new Promise((resolve, reject) => {
      this.server = this.app.listen(this.options.port, this.options.host, (error) => {
        if (error) {
          logger.error('Failed to start server:', error)
          reject(error)
        } else {
          logger.info(`Ragno API Server listening on ${this.options.host}:${this.options.port}`)
          logger.info(`API documentation available at http://${this.options.host}:${this.options.port}/docs`)
          resolve()
        }
      })
    })
  }
  
  /**
   * Stop the server
   */
  async stop() {
    logger.info('Stopping Ragno API Server...')
    
    if (this.server) {
      await new Promise((resolve) => {
        this.server.close(resolve)
      })
    }
    
    // Cleanup components
    await this._cleanupComponents()
    
    this.healthy = false
    logger.info('Ragno API Server stopped')
  }
  
  /**
   * Initialize core components
   */
  async _initializeComponents() {
    // Initialize cache
    if (this.options.enableCaching) {
      this.cache = new GraphCache(this.options.cacheOptions)
      await this.cache.initialize()
    }
    
    // Initialize metrics
    if (this.options.enableMetrics) {
      this.metrics = new GraphMetrics(this.options.metricsOptions)
      await this.metrics.initialize()
    }
    
    // Initialize vector index
    if (this.options.vectorIndexPath) {
      try {
        this.vectorIndex = new VectorIndex()
        await this.vectorIndex.load(this.options.vectorIndexPath)
        logger.info('Vector index loaded successfully')
      } catch (error) {
        logger.warn('Failed to load vector index:', error.message)
      }
    }
    
    // Initialize Graph API
    this.graphAPI = new GraphAPI({
      llmHandler: this.options.llmHandler,
      embeddingHandler: this.options.embeddingHandler,
      sparqlEndpoint: this.options.sparqlEndpoint,
      cache: this.cache,
      metrics: this.metrics,
      enableCaching: this.options.enableCaching,
      enableMetrics: this.options.enableMetrics
    })
    await this.graphAPI.initialize()
    
    // Initialize Enhanced Search API
    this.searchAPI = new SearchAPIEnhanced({
      sparqlEndpoint: this.options.sparqlEndpoint,
      llmHandler: this.options.llmHandler,
      embeddingHandler: this.options.embeddingHandler,
      vectorIndex: this.vectorIndex,
      cache: this.cache,
      metrics: this.metrics,
      enableCaching: this.options.enableCaching,
      enableMetrics: this.options.enableMetrics
    })
    await this.searchAPI.initialize()
  }
  
  /**
   * Setup Express middleware
   */
  _setupMiddleware() {
    // Security headers
    if (this.options.enableHelmet) {
      this.app.use(helmet())
    }
    
    // CORS
    if (this.options.enableCors) {
      this.app.use(cors(this.options.corsOptions))
    }
    
    // Compression
    if (this.options.enableCompression) {
      this.app.use(compression())
    }
    
    // Rate limiting
    if (this.options.enableRateLimit) {
      const limiter = rateLimit(this.options.rateLimitOptions)
      this.app.use(limiter)
    }
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }))
    
    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now()
      
      res.on('finish', () => {
        const duration = Date.now() - start
        logger.info(`${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`)
      })
      
      next()
    })
    
    // Request ID and timing
    this.app.use((req, res, next) => {
      req.id = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      req.startTime = Date.now()
      res.setHeader('X-Request-ID', req.id)
      next()
    })
  }
  
  /**
   * Setup API routes
   */
  _setupRoutes() {
    const apiPrefix = `/api/${this.options.apiVersion}`
    
    // Health check
    this.app.get('/health', this._handleHealthCheck.bind(this))
    this.app.get('/ready', this._handleReadinessCheck.bind(this))
    
    // Root endpoint
    this.app.get('/', this._handleRoot.bind(this))
    
    // API Info
    this.app.get(apiPrefix, this._handleAPIInfo.bind(this))
    
    // Mount Graph API
    this.app.use(`${apiPrefix}/graph`, this.graphAPI.getRouter())
    
    // Mount Search API
    this.app.use(`${apiPrefix}/search`, this.searchAPI.getRouter())
    
    // System endpoints
    this.app.get(`${apiPrefix}/system/info`, this._handleSystemInfo.bind(this))
    this.app.get(`${apiPrefix}/system/metrics`, this._handleSystemMetrics.bind(this))
    this.app.post(`${apiPrefix}/system/cache/clear`, this._handleClearCache.bind(this))
    
    // API Documentation
    if (this.options.enableSwagger) {
      this._setupSwagger(apiPrefix)
    }
  }
  
  /**
   * Setup error handling
   */
  _setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `The requested resource ${req.originalUrl} was not found`,
        timestamp: new Date().toISOString()
      })
    })
    
    // Global error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error:', error)
      
      if (this.metrics) {
        this.metrics.recordError(error, { requestId: req.id, url: req.url })
      }
      
      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development'
      
      res.status(error.status || 500).json({
        error: 'Internal Server Error',
        message: isDevelopment ? error.message : 'An unexpected error occurred',
        requestId: req.id,
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { stack: error.stack })
      })
    })
  }
  
  /**
   * Handle root endpoint
   */
  _handleRoot(req, res) {
    res.json({
      name: 'Ragno Knowledge Graph API',
      version: this.options.apiVersion,
      description: 'Production-ready REST API for ragno knowledge graph operations',
      endpoints: {
        health: '/health',
        api: `/api/${this.options.apiVersion}`,
        docs: this.options.enableSwagger ? '/docs' : null
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    })
  }
  
  /**
   * Handle API info endpoint
   */
  _handleAPIInfo(req, res) {
    res.json({
      version: this.options.apiVersion,
      endpoints: {
        graph: {
          stats: 'GET /graph/stats',
          entities: 'GET /graph/entities',
          export: 'GET /graph/export/{format}',
          decompose: 'POST /graph/decompose',
          pipeline: 'POST /graph/pipeline/full'
        },
        search: {
          unified: 'POST /search/unified',
          semantic: 'POST /search/semantic',
          entities: 'POST /search/entities',
          faceted: 'POST /search/faceted'
        },
        system: {
          info: 'GET /system/info',
          metrics: 'GET /system/metrics',
          clearCache: 'POST /system/cache/clear'
        }
      },
      capabilities: {
        caching: this.options.enableCaching,
        metrics: this.options.enableMetrics,
        vectorSearch: !!this.vectorIndex,
        sparqlIntegration: !!this.options.sparqlEndpoint
      }
    })
  }
  
  /**
   * Handle health check
   */
  _handleHealthCheck(req, res) {
    const health = {
      status: this.healthy ? 'healthy' : 'unhealthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      version: this.options.apiVersion,
      components: {
        cache: this.cache ? 'initialized' : 'disabled',
        metrics: this.metrics ? 'initialized' : 'disabled',
        vectorIndex: this.vectorIndex ? 'loaded' : 'not_loaded',
        graphAPI: this.graphAPI ? 'ready' : 'not_ready',
        searchAPI: this.searchAPI ? 'ready' : 'not_ready'
      }
    }
    
    // Add detailed health info if metrics are enabled
    if (this.metrics) {
      health.systemHealth = this.metrics.getHealthStatus()
    }
    
    const statusCode = this.healthy ? 200 : 503
    res.status(statusCode).json(health)
  }
  
  /**
   * Handle readiness check
   */
  _handleReadinessCheck(req, res) {
    const ready = this.healthy && 
                  this.graphAPI && 
                  this.searchAPI &&
                  (!this.options.sparqlEndpoint || this._checkSPARQLConnection())
    
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString()
    })
  }
  
  /**
   * Handle system info
   */
  _handleSystemInfo(req, res) {
    const info = {
      server: {
        name: 'Ragno API Server',
        version: this.options.apiVersion,
        uptime: process.uptime(),
        startTime: new Date(this.startTime).toISOString(),
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      },
      memory: process.memoryUsage(),
      configuration: {
        caching: this.options.enableCaching,
        metrics: this.options.enableMetrics,
        rateLimit: this.options.enableRateLimit,
        compression: this.options.enableCompression,
        vectorIndex: !!this.vectorIndex,
        sparqlEndpoint: !!this.options.sparqlEndpoint
      },
      components: {
        cache: this.cache ? 'enabled' : 'disabled',
        metrics: this.metrics ? 'enabled' : 'disabled',
        vectorIndex: this.vectorIndex ? 'loaded' : 'not_loaded'
      }
    }
    
    res.json(info)
  }
  
  /**
   * Handle system metrics
   */
  async _handleSystemMetrics(req, res) {
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        }
      }
      
      if (this.metrics) {
        metrics.application = await this.metrics.getMetricsSummary()
        metrics.search = await this.metrics.getSearchMetrics()
      }
      
      if (this.cache) {
        metrics.cache = await this.cache.getStatistics()
      }
      
      if (this.vectorIndex) {
        metrics.vectorIndex = await this.vectorIndex.getStatistics()
      }
      
      res.json(metrics)
      
    } catch (error) {
      logger.error('Failed to get system metrics:', error)
      res.status(500).json({
        error: 'Failed to retrieve system metrics',
        timestamp: new Date().toISOString()
      })
    }
  }
  
  /**
   * Handle cache clear
   */
  async _handleClearCache(req, res) {
    try {
      if (!this.cache) {
        return res.status(400).json({
          error: 'Cache not enabled',
          message: 'Caching is not enabled on this server'
        })
      }
      
      await this.cache.clear()
      
      res.json({
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString()
      })
      
    } catch (error) {
      logger.error('Failed to clear cache:', error)
      res.status(500).json({
        error: 'Failed to clear cache',
        message: error.message
      })
    }
  }
  
  /**
   * Setup Swagger documentation
   */
  _setupSwagger(apiPrefix) {
    try {
      // Import swagger modules dynamically
      import('swagger-jsdoc').then(swaggerJSDoc => {
        import('swagger-ui-express').then(swaggerUi => {
          const swaggerOptions = {
            definition: {
              openapi: '3.0.0',
              info: {
                title: 'Ragno Knowledge Graph API',
                version: this.options.apiVersion,
                description: 'Production-ready REST API for ragno knowledge graph operations',
                contact: {
                  name: 'Ragno API Support'
                }
              },
              servers: [{
                url: `http://${this.options.host}:${this.options.port}${apiPrefix}`,
                description: 'Development server'
              }]
            },
            apis: ['./src/ragno/api/*.js'] // Paths to files containing OpenAPI definitions
          }
          
          const swaggerSpec = swaggerJSDoc.default(swaggerOptions)
          
          this.app.use('/docs', swaggerUi.default.serve)
          this.app.get('/docs', swaggerUi.default.setup(swaggerSpec))
          this.app.get('/docs.json', (req, res) => {
            res.json(swaggerSpec)
          })
          
          logger.info('Swagger documentation setup complete')
        })
      })
    } catch (error) {
      logger.warn('Failed to setup Swagger documentation:', error.message)
    }
  }
  
  /**
   * Check SPARQL connection
   */
  async _checkSPARQLConnection() {
    if (!this.options.sparqlEndpoint) return true
    
    try {
      // Simple SPARQL query to test connection
      const { SPARQLHelpers } = await import('../../utils/SPARQLHelpers.js')
      await SPARQLHelpers.executeSPARQLQuery(
        this.options.sparqlEndpoint,
        'SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o } LIMIT 1'
      )
      return true
    } catch (error) {
      logger.warn('SPARQL connection check failed:', error.message)
      return false
    }
  }
  
  /**
   * Cleanup components
   */
  async _cleanupComponents() {
    if (this.searchAPI) {
      await this.searchAPI.shutdown()
    }
    
    if (this.graphAPI) {
      await this.graphAPI.shutdown()
    }
    
    if (this.metrics) {
      await this.metrics.shutdown()
    }
    
    if (this.cache) {
      await this.cache.shutdown()
    }
  }
  
  /**
   * Get the Express app instance
   */
  getApp() {
    return this.app
  }
  
  /**
   * Get server status
   */
  getStatus() {
    return {
      healthy: this.healthy,
      uptime: process.uptime(),
      startTime: this.startTime,
      components: {
        cache: !!this.cache,
        metrics: !!this.metrics,
        vectorIndex: !!this.vectorIndex,
        graphAPI: !!this.graphAPI,
        searchAPI: !!this.searchAPI
      }
    }
  }
}

export default RagnoAPIServer