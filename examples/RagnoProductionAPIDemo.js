/**
 * RagnoProductionAPIDemo.js - Complete Production API Demonstration
 * 
 * This demo showcases the full Ragno Phase 6 production API infrastructure,
 * demonstrating how to deploy and use the comprehensive knowledge graph system
 * with monitoring, caching, and advanced search capabilities.
 * 
 * Features Demonstrated:
 * 1. **Production API Server**: Complete deployment with all Phase 6 components
 * 2. **Graph Operations**: Full pipeline via REST API endpoints
 * 3. **Advanced Search**: Unified, semantic, and faceted search capabilities
 * 4. **Monitoring & Metrics**: Real-time performance tracking and health checks
 * 5. **Caching System**: Multi-tier caching with Redis support
 * 6. **Export Functions**: Multiple format export (Turtle, JSON-LD, etc.)
 * 
 * Architecture Demonstrated:
 * ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
 * │   Client App    │───▶│  Production     │───▶│   Ragno Core    │
 * │   (This Demo)   │    │   API Server    │    │   Components    │
 * └─────────────────┘    └─────────────────┘    └─────────────────┘
 *                                 │                        │
 * ┌─────────────────┐    ┌───────▼─────────┐    ┌───────▼─────────┐
 * │   Monitoring    │◀───│   Metrics &     │◀───│   Cache &       │
 * │   Dashboard     │    │   Health Check  │    │   Optimization  │
 * └─────────────────┘    └─────────────────┘    └─────────────────┘
 */

import logger from 'loglevel'
import fetch from 'node-fetch'
import { RagnoAPIServer } from '../src/ragno/api/RagnoAPIServer.js'
import LLMHandler from '../src/handlers/LLMHandler.js'
import EmbeddingHandler from '../src/handlers/EmbeddingHandler.js'
import OllamaConnector from '../src/connectors/OllamaConnector.js'
import loadRagnoConfig from '../src/utils/loadRagnoConfig.js'

// Configure logging
logger.setLevel('info')

class RagnoAPIDemo {
  constructor() {
    this.apiServer = null
    this.baseURL = null
    this.ollamaConnector = null
  }

  /**
   * Initialize the production API server
   */
  async initializeAPIServer() {
    logger.info('🚀 Initializing Ragno Production API Server...')
    
    // Load configuration
    const config = await loadRagnoConfig()
    
    // Initialize Ollama connector
    this.ollamaConnector = new OllamaConnector('http://localhost:11434', 'qwen2:1.5b')
    await this.ollamaConnector.initialize()
    
    // Setup handlers
    const llmProvider = {
      generateChat: this.ollamaConnector.generateChat.bind(this.ollamaConnector),
      generateCompletion: this.ollamaConnector.generateCompletion.bind(this.ollamaConnector),
      generateEmbedding: this.ollamaConnector.generateEmbedding.bind(this.ollamaConnector)
    }

    const embeddingProvider = {
      generateEmbedding: this.ollamaConnector.generateEmbedding.bind(this.ollamaConnector)
    }

    const cacheManager = { 
      get: () => undefined, 
      set: () => {},
      has: () => false,
      delete: () => false,
      clear: () => {}
    }

    const llmHandler = new LLMHandler(llmProvider, 'qwen2:1.5b', 0.1)
    const embeddingHandler = new EmbeddingHandler(embeddingProvider, 'nomic-embed-text', 1536, cacheManager)

    // Initialize API server with production features
    this.apiServer = new RagnoAPIServer({
      port: 3001,
      host: 'localhost',
      apiVersion: 'v1',
      
      // Core dependencies
      llmHandler: llmHandler,
      embeddingHandler: embeddingHandler,
      sparqlEndpoint: null, // Could be configured for SPARQL integration
      
      // Production features
      enableMetrics: true,
      enableCaching: true,
      enableCompression: true,
      enableRateLimit: true,
      enableSwagger: true,
      
      // Cache configuration
      cacheOptions: {
        backend: 'memory', // Use 'redis' for production
        maxSize: 1000,
        defaultTTL: 300000 // 5 minutes
      },
      
      // Metrics configuration
      metricsOptions: {
        metricsInterval: 30000, // 30 seconds
        enableAlerting: true,
        alertThresholds: {
          responseTime: 2000,
          errorRate: 0.1,
          memoryUsage: 0.8
        }
      }
    })

    await this.apiServer.initialize()
    await this.apiServer.start()
    
    this.baseURL = 'http://localhost:3001/api/v1'
    logger.info(`✅ API Server running at http://localhost:3001`)
    logger.info(`📚 API Documentation: http://localhost:3001/docs`)
  }

  /**
   * Create sample data for demonstration
   */
  createSampleCorpus() {
    return [
      {
        content: "Geoffrey Hinton is often called the 'Godfather of AI' for his pioneering work in deep learning and neural networks. He developed the backpropagation algorithm which revolutionized machine learning. Hinton worked at the University of Toronto and Google, making breakthrough contributions to artificial intelligence research.",
        source: "ai_pioneers_hinton.txt",
        metadata: { author: "AI Research Journal", year: 2023, topic: "Deep Learning" }
      },
      {
        content: "Yann LeCun developed convolutional neural networks (CNNs) which became fundamental to computer vision. His work on LeNet-5 laid the groundwork for modern image recognition systems. LeCun serves as Chief AI Scientist at Meta and is a professor at NYU, continuing to advance the field of artificial intelligence.",
        source: "ai_pioneers_lecun.txt", 
        metadata: { author: "AI Research Journal", year: 2023, topic: "Computer Vision" }
      },
      {
        content: "Yoshua Bengio made significant contributions to deep learning, particularly in the areas of neural language models and representation learning. His research on attention mechanisms and generative models has influenced modern AI architectures. Bengio co-founded Element AI and leads the Montreal Institute for Learning Algorithms (MILA).",
        source: "ai_pioneers_bengio.txt",
        metadata: { author: "AI Research Journal", year: 2023, topic: "NLP" }
      },
      {
        content: "The transformer architecture, introduced in 'Attention Is All You Need', revolutionized natural language processing. Transformers use self-attention mechanisms to process sequences in parallel, enabling the development of large language models like GPT and BERT. This architecture has become the foundation for modern AI systems.",
        source: "transformer_architecture.txt",
        metadata: { author: "Google Research", year: 2017, topic: "Transformers" }
      },
      {
        content: "Large Language Models (LLMs) like GPT-4, Claude, and LLaMA represent the current state-of-the-art in natural language processing. These models demonstrate emergent capabilities including reasoning, code generation, and creative writing. They are trained on massive text corpora using transformer architectures and have billions of parameters.",
        source: "modern_llms.txt",
        metadata: { author: "AI Today", year: 2024, topic: "LLMs" }
      }
    ]
  }

  /**
   * Demonstrate API health and system status
   */
  async demonstrateHealthChecks() {
    logger.info('\n🏥 Demonstrating Health Checks and System Status...')
    
    try {
      // Health check
      const healthResponse = await fetch('http://localhost:3001/health')
      const health = await healthResponse.json()
      logger.info('✅ Health Check:', health.status)
      logger.info(`   Uptime: ${Math.floor(health.uptime)}s`)
      logger.info(`   Components: ${Object.entries(health.components).map(([k,v]) => `${k}:${v}`).join(', ')}`)

      // System info
      const systemResponse = await fetch(`${this.baseURL}/system/info`)
      const systemInfo = await systemResponse.json()
      logger.info('🖥️  System Info:')
      logger.info(`   Node: ${systemInfo.server.nodeVersion}`)
      logger.info(`   Platform: ${systemInfo.server.platform}`)
      logger.info(`   Memory: ${Math.round(systemInfo.memory.heapUsed / 1024 / 1024)}MB used`)

      // API info
      const apiResponse = await fetch(this.baseURL)
      const apiInfo = await apiResponse.json()
      logger.info('🔌 API Capabilities:')
      logger.info(`   Caching: ${apiInfo.capabilities.caching}`)
      logger.info(`   Metrics: ${apiInfo.capabilities.metrics}`)
      logger.info(`   Vector Search: ${apiInfo.capabilities.vectorSearch}`)

    } catch (error) {
      logger.error('❌ Health check failed:', error.message)
    }
  }

  /**
   * Demonstrate full pipeline via API
   */
  async demonstrateFullPipeline() {
    logger.info('\n🔄 Demonstrating Full Pipeline via API...')
    
    try {
      const textChunks = this.createSampleCorpus()
      
      logger.info(`📚 Processing ${textChunks.length} documents through full pipeline...`)
      
      const pipelineResponse = await fetch(`${this.baseURL}/graph/pipeline/full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          textChunks: textChunks,
          options: {
            decomposition: { extractRelationships: true, generateSummaries: true },
            augmentation: { topK: 5, importanceMethod: 'hybrid' },
            communities: { minCommunitySize: 2, resolution: 1.0 },
            enrichment: { similarityThreshold: 0.7, batchSize: 10 }
          }
        })
      })

      if (!pipelineResponse.ok) {
        throw new Error(`Pipeline failed: ${pipelineResponse.status} ${pipelineResponse.statusText}`)
      }

      const pipelineResult = await pipelineResponse.json()
      
      logger.info('✅ Full Pipeline Completed!')
      logger.info('📊 Results Summary:')
      logger.info(`   📝 Final Dataset Size: ${pipelineResult.results.statistics.finalDatasetSize} triples`)
      logger.info(`   🏷️  Total Entities: ${pipelineResult.results.statistics.totalEntities}`)
      logger.info(`   📝 Total Units: ${pipelineResult.results.statistics.totalUnits}`)
      logger.info(`   🔗 Total Relationships: ${pipelineResult.results.statistics.totalRelationships}`)
      logger.info(`   📋 Total Attributes: ${pipelineResult.results.statistics.totalAttributes}`)
      logger.info(`   👥 Total Communities: ${pipelineResult.results.statistics.totalCommunities}`)
      logger.info(`   🧠 Vectors Indexed: ${pipelineResult.results.statistics.vectorsIndexed}`)
      logger.info(`   ⏱️  Total Time: ${pipelineResult.results.statistics.totalProcessingTime}ms`)

      // Show phase breakdown
      logger.info('\n⚙️  Phase Breakdown:')
      for (const [phase, data] of Object.entries(pipelineResult.results.phases)) {
        if (data.success) {
          logger.info(`   ✅ ${phase}: ${data.statistics.processingTime}ms`)
        } else {
          logger.info(`   ❌ ${phase}: Failed`)
        }
      }

      return pipelineResult

    } catch (error) {
      logger.error('❌ Pipeline demonstration failed:', error.message)
      throw error
    }
  }

  /**
   * Demonstrate advanced search capabilities
   */
  async demonstrateAdvancedSearch() {
    logger.info('\n🔍 Demonstrating Advanced Search Capabilities...')
    
    try {
      // Unified search
      logger.info('🔎 Testing Unified Search...')
      const unifiedResponse = await fetch(`${this.baseURL}/search/unified`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: "deep learning neural networks",
          limit: 5,
          includeScores: true,
          searchTypes: ['ragno:Entity', 'ragno:Unit', 'ragno:Attribute']
        })
      })

      if (unifiedResponse.ok) {
        const unifiedResults = await unifiedResponse.json()
        logger.info(`   ✅ Found ${unifiedResults.results.length} unified search results`)
        logger.info(`   ⏱️  Search time: ${unifiedResults.metadata.executionTime}ms`)
        
        // Show top results
        unifiedResults.results.slice(0, 3).forEach((result, i) => {
          logger.info(`   ${i+1}. ${result.type}: ${result.id} (score: ${result.score?.toFixed(3) || 'N/A'})`)
        })
      }

      // Semantic search
      logger.info('\n🧠 Testing Semantic Search...')
      const semanticResponse = await fetch(`${this.baseURL}/search/semantic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: "artificial intelligence research",
          limit: 5,
          threshold: 0.7,
          includeMetadata: true
        })
      })

      if (semanticResponse.ok) {
        const semanticResults = await semanticResponse.json()
        logger.info(`   ✅ Found ${semanticResults.results.length} semantic search results`)
        
        semanticResults.results.slice(0, 3).forEach((result, i) => {
          logger.info(`   ${i+1}. ${result.type}: ${result.id} (similarity: ${result.similarity?.toFixed(3) || 'N/A'})`)
        })
      }

      // Entity search
      logger.info('\n🏷️  Testing Entity Search...')
      const entityResponse = await fetch(`${this.baseURL}/search/entities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: "Geoffrey Hinton",
          limit: 3,
          includeRelationships: true,
          includeAttributes: true
        })
      })

      if (entityResponse.ok) {
        const entityResults = await entityResponse.json()
        logger.info(`   ✅ Found ${entityResults.results.length} entity search results`)
        
        entityResults.results.forEach((result, i) => {
          logger.info(`   ${i+1}. ${result.name || result.id}: ${result.relationships?.length || 0} relationships, ${result.attributes?.length || 0} attributes`)
        })
      }

    } catch (error) {
      logger.error('❌ Search demonstration failed:', error.message)
    }
  }

  /**
   * Demonstrate graph statistics and analytics
   */
  async demonstrateGraphAnalytics() {
    logger.info('\n📊 Demonstrating Graph Analytics...')
    
    try {
      // Basic stats
      const statsResponse = await fetch(`${this.baseURL}/graph/stats`)
      if (statsResponse.ok) {
        const stats = await statsResponse.json()
        logger.info('📈 Basic Graph Statistics:')
        logger.info(`   🏷️  Entities: ${stats.entities || 0}`)
        logger.info(`   📝 Units: ${stats.units || 0}`)
        logger.info(`   🔗 Relationships: ${stats.relationships || 0}`)
        logger.info(`   📋 Attributes: ${stats.attributes || 0}`)
        logger.info(`   👥 Communities: ${stats.communities || 0}`)
      }

      // Detailed stats with graph algorithms
      const detailedResponse = await fetch(`${this.baseURL}/graph/stats/detailed`)
      if (detailedResponse.ok) {
        const detailed = await detailedResponse.json()
        logger.info('\n🔬 Detailed Graph Analytics:')
        if (detailed.graph) {
          logger.info(`   📊 Graph Density: ${detailed.graph.density?.toFixed(3) || 'N/A'}`)
          logger.info(`   📊 Average Degree: ${detailed.graph.averageDegree?.toFixed(2) || 'N/A'}`)
          logger.info(`   📊 Max Degree: ${detailed.graph.maxDegree || 'N/A'}`)
          logger.info(`   📊 Connected Components: ${detailed.graph.connectedComponents || 'N/A'}`)
          logger.info(`   📊 Max Core Number: ${detailed.graph.maxCoreNumber || 'N/A'}`)
        }
      }

    } catch (error) {
      logger.error('❌ Analytics demonstration failed:', error.message)
    }
  }

  /**
   * Demonstrate export capabilities
   */
  async demonstrateExportCapabilities() {
    logger.info('\n📤 Demonstrating Export Capabilities...')
    
    try {
      const formats = ['json', 'turtle', 'ntriples', 'jsonld']
      
      for (const format of formats) {
        logger.info(`📄 Testing ${format.toUpperCase()} export...`)
        
        const exportResponse = await fetch(`${this.baseURL}/graph/export/${format}?includeMetadata=true`)
        
        if (exportResponse.ok) {
          const contentType = exportResponse.headers.get('content-type')
          const size = exportResponse.headers.get('content-length')
          
          logger.info(`   ✅ ${format}: ${contentType}, ${size ? `${size} bytes` : 'Size unknown'}`)
          
          // For JSON, show a sample
          if (format === 'json') {
            const data = await exportResponse.json()
            if (data && typeof data === 'object') {
              logger.info(`   📋 Sample structure: ${Object.keys(data).join(', ')}`)
            }
          }
        } else {
          logger.info(`   ❌ ${format}: Export failed (${exportResponse.status})`)
        }
      }

    } catch (error) {
      logger.error('❌ Export demonstration failed:', error.message)
    }
  }

  /**
   * Demonstrate monitoring and metrics
   */
  async demonstrateMonitoring() {
    logger.info('\n📈 Demonstrating Monitoring & Metrics...')
    
    try {
      // System metrics
      const metricsResponse = await fetch(`${this.baseURL}/system/metrics`)
      if (metricsResponse.ok) {
        const metrics = await metricsResponse.json()
        
        logger.info('📊 System Metrics:')
        logger.info(`   🖥️  Memory Usage: ${Math.round(metrics.server.memory.heapUsed / 1024 / 1024)}MB`)
        logger.info(`   ⏱️  Uptime: ${Math.floor(metrics.server.uptime)}s`)
        
        if (metrics.application) {
          logger.info('📈 Application Metrics:')
          logger.info(`   📊 Active Requests: ${metrics.application.activeRequests || 0}`)
          logger.info(`   🔍 Active Searches: ${metrics.application.activeSearches || 0}`)
          logger.info(`   📦 Total Metrics Points: ${metrics.application.totalMetricsPoints || 0}`)
        }
        
        if (metrics.cache) {
          logger.info('💾 Cache Metrics:')
          logger.info(`   📊 Hit Rate: ${(metrics.cache.hitRate * 100).toFixed(1)}%`)
          logger.info(`   📦 Memory Entries: ${metrics.cache.memoryEntries || 0}`)
          logger.info(`   💾 Memory Usage: ${Math.round((metrics.cache.memoryUsageBytes || 0) / 1024)}KB`)
        }
        
        if (metrics.search) {
          logger.info('🔍 Search Metrics:')
          logger.info(`   📊 Total Searches: ${metrics.search.totalSearches || 0}`)
          logger.info(`   ⏱️  Average Latency: ${metrics.search.avgLatency || 0}ms`)
          logger.info(`   📊 Average Results: ${metrics.search.avgResults || 0}`)
        }
      }

    } catch (error) {
      logger.error('❌ Monitoring demonstration failed:', error.message)
    }
  }

  /**
   * Run the complete demonstration
   */
  async runDemo() {
    try {
      logger.info('🎬 Starting Ragno Production API Demonstration')
      logger.info('=' .repeat(70))

      // Initialize the API server
      await this.initializeAPIServer()

      // Wait a moment for the server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Run demonstration phases
      await this.demonstrateHealthChecks()
      await this.demonstrateFullPipeline()
      await this.demonstrateAdvancedSearch()
      await this.demonstrateGraphAnalytics()
      await this.demonstrateExportCapabilities()
      await this.demonstrateMonitoring()

      logger.info('\n🎉 Production API Demonstration Complete!')
      logger.info('=' .repeat(70))
      logger.info('✅ All Phase 6 features successfully demonstrated:')
      logger.info('   🔧 Production API Server with security and monitoring')
      logger.info('   🔄 Full knowledge graph pipeline via REST API')
      logger.info('   🔍 Advanced search with multiple strategies')
      logger.info('   📊 Real-time analytics and graph metrics')
      logger.info('   📤 Multi-format export capabilities')
      logger.info('   📈 Comprehensive monitoring and health checks')
      logger.info('   💾 High-performance caching system')
      
      logger.info('\n🌐 API Server continues running at:')
      logger.info('   📍 Base URL: http://localhost:3001/api/v1')
      logger.info('   📚 Documentation: http://localhost:3001/docs')
      logger.info('   🏥 Health Check: http://localhost:3001/health')
      
      logger.info('\n💡 Try these endpoints:')
      logger.info('   GET  /api/v1/graph/stats - Graph statistics')
      logger.info('   POST /api/v1/search/unified - Unified search')
      logger.info('   GET  /api/v1/system/metrics - System metrics')
      logger.info('   GET  /api/v1/graph/export/turtle - Export as Turtle')
      
      logger.info('\n⚠️  Press Ctrl+C to stop the API server')

    } catch (error) {
      logger.error('💥 Demo failed:', error.message)
      logger.error(error.stack)
      throw error
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    logger.info('\n🔌 Shutting down Ragno Production API Demo...')
    
    if (this.apiServer) {
      await this.apiServer.stop()
    }
    
    if (this.ollamaConnector) {
      // Cleanup Ollama connector if needed
    }
    
    logger.info('✅ Shutdown complete')
    process.exit(0)
  }
}

// Setup graceful shutdown
const demo = new RagnoAPIDemo()

process.on('SIGTERM', () => demo.shutdown())
process.on('SIGINT', () => demo.shutdown())
process.on('uncaughtException', async (error) => {
  logger.error('💥 Uncaught Exception:', error)
  await demo.shutdown()
})

// Run the demonstration
demo.runDemo().catch(async (error) => {
  logger.error('💥 Demo failed:', error.message)
  await demo.shutdown()
})