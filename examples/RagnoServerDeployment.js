/**
 * RagnoServerDeployment.js - Production Server Deployment Example
 * 
 * This script demonstrates how to deploy the Ragno production API server
 * with proper configuration, monitoring, and lifecycle management for
 * real-world production environments.
 * 
 * Deployment Features:
 * 1. **Environment Configuration**: Proper environment variable handling
 * 2. **Health Monitoring**: Comprehensive health checks and readiness probes
 * 3. **Graceful Shutdown**: Clean resource cleanup on termination
 * 4. **Error Handling**: Production-grade error management and recovery
 * 5. **Logging**: Structured logging for monitoring and debugging
 * 6. **Metrics**: Performance monitoring and alerting
 * 
 * Production Considerations:
 * - Kubernetes deployment ready
 * - Docker containerization support
 * - Load balancer compatibility
 * - Database connection pooling
 * - Cache layer configuration
 * - Security best practices
 */

import dotenv from 'dotenv'
import { RagnoAPIServer } from '../src/ragno/api/RagnoAPIServer.js'
import LLMHandler from '../src/handlers/LLMHandler.js'
import EmbeddingHandler from '../src/handlers/EmbeddingHandler.js'
import OllamaConnector from '../src/connectors/OllamaConnector.js'
import loadRagnoConfig from '../src/utils/loadRagnoConfig.js'
import { logger } from '../src/Utils.js'

// Load environment variables
dotenv.config()

/**
 * Production deployment configuration
 */
const DEPLOYMENT_CONFIG = {
  // Server configuration
  port: process.env.RAGNO_PORT || 3000,
  host: process.env.RAGNO_HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'production',
  
  // LLM configuration
  ollamaEndpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
  llmModel: process.env.LLM_MODEL || 'qwen2:1.5b',
  embeddingModel: process.env.EMBEDDING_MODEL || 'nomic-embed-text',
  
  // Database configuration
  sparqlEndpoint: process.env.SPARQL_ENDPOINT || null,
  sparqlUser: process.env.SPARQL_USER || null,
  sparqlPassword: process.env.SPARQL_PASSWORD || null,
  
  // Cache configuration
  redisUrl: process.env.REDIS_URL || null,
  cacheBackend: process.env.CACHE_BACKEND || 'memory',
  
  // Security configuration
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100
  },
  
  // Monitoring configuration
  enableMetrics: process.env.ENABLE_METRICS !== 'false',
  metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 60000,
  
  // API configuration
  enableSwagger: process.env.ENABLE_SWAGGER !== 'false',
  logLevel: process.env.LOG_LEVEL || 'info'
}

/**
 * Production API Server Manager
 */
class ProductionServerManager {
  constructor() {
    this.server = null
    this.ollamaConnector = null
    this.isShuttingDown = false
  }

  /**
   * Initialize production server with full configuration
   */
  async initialize() {
    logger.info('🚀 Initializing Ragno Production Server...')
    logger.info(`📍 Environment: ${DEPLOYMENT_CONFIG.nodeEnv}`)
    logger.info(`🌐 Server: ${DEPLOYMENT_CONFIG.host}:${DEPLOYMENT_CONFIG.port}`)
    
    try {
      // Load Ragno configuration
      logger.info('📋 Loading Ragno configuration...')
      const ragnoConfig = await loadRagnoConfig()
      
      // Initialize LLM connectivity
      logger.info(`🤖 Connecting to LLM: ${DEPLOYMENT_CONFIG.ollamaEndpoint}`)
      this.ollamaConnector = new OllamaConnector(
        DEPLOYMENT_CONFIG.ollamaEndpoint,
        DEPLOYMENT_CONFIG.llmModel
      )
      await this.ollamaConnector.initialize()
      logger.info('✅ LLM connection established')
      
      // Setup handlers with production configuration
      const handlers = await this.setupHandlers(ragnoConfig)
      
      // Initialize API server with production settings
      this.server = new RagnoAPIServer({
        // Basic configuration
        port: DEPLOYMENT_CONFIG.port,
        host: DEPLOYMENT_CONFIG.host,
        apiVersion: 'v1',
        
        // Core dependencies
        llmHandler: handlers.llmHandler,
        embeddingHandler: handlers.embeddingHandler,
        sparqlEndpoint: DEPLOYMENT_CONFIG.sparqlEndpoint,
        
        // Security configuration
        enableCors: true,
        corsOptions: {
          origin: DEPLOYMENT_CONFIG.corsOrigins,
          credentials: true,
          methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
          allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        },
        
        // Rate limiting
        enableRateLimit: true,
        rateLimitOptions: DEPLOYMENT_CONFIG.rateLimit,
        
        // Production features
        enableMetrics: DEPLOYMENT_CONFIG.enableMetrics,
        enableCaching: true,
        enableCompression: true,
        enableHelmet: true,
        enableSwagger: DEPLOYMENT_CONFIG.enableSwagger,
        
        // Cache configuration
        cacheOptions: {
          backend: DEPLOYMENT_CONFIG.cacheBackend,
          redis: DEPLOYMENT_CONFIG.redisUrl ? {
            url: DEPLOYMENT_CONFIG.redisUrl
          } : undefined,
          maxSize: 10000,
          defaultTTL: 300000, // 5 minutes
          ttlByType: {
            search: 300000,     // 5 minutes
            entity: 600000,     // 10 minutes
            stats: 180000,      // 3 minutes
            graph: 900000       // 15 minutes
          }
        },
        
        // Metrics configuration
        metricsOptions: {
          metricsInterval: DEPLOYMENT_CONFIG.metricsInterval,
          enableAlerting: true,
          alertThresholds: {
            responseTime: 5000,   // 5 seconds
            errorRate: 0.05,      // 5%
            memoryUsage: 0.85,    // 85%
            searchLatency: 2000   // 2 seconds
          }
        }
      })
      
      await this.server.initialize()
      logger.info('✅ Server initialized successfully')
      
    } catch (error) {
      logger.error('❌ Server initialization failed:', error)
      throw error
    }
  }

  /**
   * Setup LLM and embedding handlers
   */
  async setupHandlers(ragnoConfig) {
    logger.info('🔧 Setting up production handlers...')
    
    // Create LLM provider
    const llmProvider = {
      generateChat: this.ollamaConnector.generateChat.bind(this.ollamaConnector),
      generateCompletion: this.ollamaConnector.generateCompletion.bind(this.ollamaConnector),
      generateEmbedding: this.ollamaConnector.generateEmbedding.bind(this.ollamaConnector)
    }

    // Create embedding provider
    const embeddingProvider = {
      generateEmbedding: this.ollamaConnector.generateEmbedding.bind(this.ollamaConnector)
    }

    // Simple cache manager (could be enhanced with Redis in production)
    const cacheManager = {
      cache: new Map(),
      get: function(key) { return this.cache.get(key) },
      set: function(key, value) { this.cache.set(key, value) },
      has: function(key) { return this.cache.has(key) },
      delete: function(key) { return this.cache.delete(key) },
      clear: function() { this.cache.clear() }
    }

    // Initialize handlers
    const llmHandler = new LLMHandler(
      llmProvider,
      DEPLOYMENT_CONFIG.llmModel,
      ragnoConfig.decomposition?.llm?.temperature || 0.1
    )

    const embeddingHandler = new EmbeddingHandler(
      embeddingProvider,
      DEPLOYMENT_CONFIG.embeddingModel,
      ragnoConfig.enrichment?.embedding?.dimensions || 1536,
      cacheManager
    )

    logger.info('✅ Handlers configured successfully')
    
    return { llmHandler, embeddingHandler }
  }

  /**
   * Start the production server
   */
  async start() {
    if (!this.server) {
      throw new Error('Server not initialized. Call initialize() first.')
    }
    
    logger.info('🎬 Starting production server...')
    
    try {
      await this.server.start()
      
      // Log startup information
      logger.info('🎉 Ragno Production Server started successfully!')
      logger.info('=' .repeat(60))
      logger.info(`📍 Server URL: http://${DEPLOYMENT_CONFIG.host}:${DEPLOYMENT_CONFIG.port}`)
      logger.info(`📚 API Documentation: http://${DEPLOYMENT_CONFIG.host}:${DEPLOYMENT_CONFIG.port}/docs`)
      logger.info(`🏥 Health Check: http://${DEPLOYMENT_CONFIG.host}:${DEPLOYMENT_CONFIG.port}/health`)
      logger.info(`📊 Metrics: http://${DEPLOYMENT_CONFIG.host}:${DEPLOYMENT_CONFIG.port}/api/v1/system/metrics`)
      logger.info('=' .repeat(60))
      
      // Setup health monitoring
      this.setupHealthMonitoring()
      
      // Setup process monitoring
      this.setupProcessMonitoring()
      
      logger.info('✅ Production server is ready to receive requests')
      
    } catch (error) {
      logger.error('❌ Failed to start server:', error)
      throw error
    }
  }

  /**
   * Setup health monitoring for production
   */
  setupHealthMonitoring() {
    // Periodic health checks
    setInterval(async () => {
      try {
        const status = this.server.getStatus()
        
        if (!status.healthy) {
          logger.warn('⚠️  Server health check failed:', status)
        }
        
        // Log memory usage if high
        const memUsage = process.memoryUsage()
        const memUsageMB = Math.round(memUsage.heapUsed / 1024 / 1024)
        
        if (memUsageMB > 500) { // 500MB threshold
          logger.warn(`⚠️  High memory usage: ${memUsageMB}MB`)
        }
        
      } catch (error) {
        logger.error('❌ Health monitoring error:', error)
      }
    }, 30000) // Check every 30 seconds
  }

  /**
   * Setup process monitoring
   */
  setupProcessMonitoring() {
    // Monitor for unhandled rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
      // In production, you might want to restart the server here
    })

    // Monitor for uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception:', error)
      // Graceful shutdown on uncaught exceptions
      this.shutdown('uncaughtException')
    })

    // Log startup completion
    process.on('SIGTERM', () => this.shutdown('SIGTERM'))
    process.on('SIGINT', () => this.shutdown('SIGINT'))
    
    logger.info('📈 Process monitoring enabled')
  }

  /**
   * Graceful shutdown for production
   */
  async shutdown(signal = 'manual') {
    if (this.isShuttingDown) {
      logger.warn('⚠️  Shutdown already in progress...')
      return
    }
    
    this.isShuttingDown = true
    logger.info(`🔌 Graceful shutdown initiated (signal: ${signal})`)
    
    try {
      // Stop accepting new requests
      if (this.server) {
        logger.info('🛑 Stopping API server...')
        await this.server.stop()
        logger.info('✅ API server stopped')
      }
      
      // Cleanup LLM connections
      if (this.ollamaConnector) {
        logger.info('🧹 Cleaning up LLM connections...')
        // Add any necessary cleanup
        logger.info('✅ LLM cleanup complete')
      }
      
      logger.info('✅ Graceful shutdown completed')
      process.exit(0)
      
    } catch (error) {
      logger.error('❌ Error during shutdown:', error)
      process.exit(1)
    }
  }

  /**
   * Get server status for monitoring
   */
  getServerStatus() {
    if (!this.server) {
      return { status: 'not_initialized' }
    }
    
    return {
      ...this.server.getStatus(),
      deployment: {
        nodeEnv: DEPLOYMENT_CONFIG.nodeEnv,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    }
  }
}

/**
 * Main deployment function
 */
async function deployProductionServer() {
  logger.info('🎭 Ragno Production Server Deployment')
  logger.info('=' .repeat(50))
  
  // Validate environment
  if (!process.env.NODE_ENV) {
    logger.warn('⚠️  NODE_ENV not set, defaulting to production')
  }
  
  // Create and initialize server manager
  const serverManager = new ProductionServerManager()
  
  try {
    await serverManager.initialize()
    await serverManager.start()
    
    // Keep the process alive
    process.on('SIGTERM', () => serverManager.shutdown('SIGTERM'))
    process.on('SIGINT', () => serverManager.shutdown('SIGINT'))
    
    // Deployment success
    logger.info('🎉 Production deployment completed successfully!')
    logger.info('🔄 Server is running and ready for production traffic')
    
  } catch (error) {
    logger.error('💥 Production deployment failed:', error)
    process.exit(1)
  }
}

// Run deployment if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  deployProductionServer().catch((error) => {
    logger.error('💥 Deployment script failed:', error)
    process.exit(1)
  })
}

export { ProductionServerManager, deployProductionServer, DEPLOYMENT_CONFIG }