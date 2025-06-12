/**
 * APIEndpoints.js - Complete ZPT API Demonstrations
 * 
 * This example showcases the full RESTful API capabilities for ZPT navigation:
 * 
 * 1. **Navigation API**: Main /api/navigate endpoint with full pipeline
 * 2. **Preview API**: Quick /api/navigate/preview for result estimation
 * 3. **Options API**: /api/navigate/options for parameter discovery
 * 4. **Schema API**: /api/navigate/schema for documentation
 * 5. **Health API**: /api/navigate/health for system monitoring
 * 6. **Metrics API**: /api/navigate/metrics for performance analysis
 * 7. **Error Handling**: Comprehensive error responses and recovery
 * 8. **Rate Limiting**: Request throttling and client management
 * 
 * API Architecture:
 * ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
 * │   CLIENT    │───▶│  ENDPOINT   │───▶│  PIPELINE   │───▶│  RESPONSE   │
 * │  REQUEST    │    │  ROUTING    │    │ EXECUTION   │    │ FORMATTING  │
 * └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
 *       │                    │                    │                    │
 *       ▼                    ▼                    ▼                    ▼
 * ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
 * │ Parameter   │    │ Rate Limit  │    │ Error       │    │ HATEOAS     │
 * │ Validation  │    │ Checking    │    │ Recovery    │    │ Links       │
 * └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
 * 
 * This example demonstrates:
 * - Complete API endpoint testing with realistic requests
 * - Error handling scenarios and recovery strategies
 * - Rate limiting behavior and client management
 * - Performance monitoring and metrics collection
 * 
 * Prerequisites:
 * - ZPT NavigationEndpoint server running
 * - All ZPT pipeline components initialized
 * - HTTP client capabilities (fetch/axios equivalent)
 */

import dotenv from 'dotenv'
dotenv.config()

import { logger } from '../../src/Utils.js'
import Config from '../../src/Config.js'
import NavigationEndpoint from '../../src/zpt/api/NavigationEndpoint.js'

// Configure logging
logger.info('Starting ZPT API Endpoints Demo')

let config = null
let navigationEndpoint = null
let mockServer = null

/**
 * Initialize API components and mock server
 */
async function initializeAPI() {
    logger.info('🔧 Initializing ZPT API components...')
    
    config = new Config()
    await config.init()
    
    // Initialize NavigationEndpoint
    navigationEndpoint = new NavigationEndpoint({
        maxConcurrentRequests: 5,
        enableRateLimit: true,
        rateLimit: { requests: 10, windowMs: 60000 }, // 10 req/min for demo
        enableMetrics: true,
        corsEnabled: true
    })
    
    // Initialize with mock dependencies for demo
    const mockDependencies = {
        ragnoCorpus: createMockRagnoCorpus(),
        sparqlStore: createMockSparqlStore(),
        embeddingHandler: createMockEmbeddingHandler(),
        llmHandler: createMockLLMHandler()
    }
    
    navigationEndpoint.initialize(mockDependencies)
    
    // Start mock HTTP server
    mockServer = createMockServer()
    
    logger.info('✅ ZPT API components initialized')
    logger.info('🌐 Mock server started on http://localhost:3001')
}

/**
 * Demonstrate main navigation API endpoint
 */
async function demonstrateNavigationAPI() {
    logger.info('\n🧭 === Navigation API Demonstrations ===')
    
    const navigationRequests = [
        {
            name: 'Basic Navigation Request',
            request: {
                zoom: 'unit',
                tilt: 'keywords',
                transform: {
                    maxTokens: 4000,
                    format: 'structured'
                }
            },
            description: 'Simple navigation with default parameters'
        },
        {
            name: 'Advanced Filtered Navigation',
            request: {
                zoom: 'entity',
                pan: {
                    topic: {
                        value: 'machine-learning',
                        pattern: 'semantic',
                        expandSynonyms: true
                    },
                    temporal: {
                        start: '2023-01-01',
                        end: '2023-12-31'
                    }
                },
                tilt: 'embedding',
                transform: {
                    maxTokens: 8000,
                    format: 'markdown',
                    chunkStrategy: 'semantic',
                    includeMetadata: true
                }
            },
            description: 'Complex navigation with topic and temporal filtering'
        },
        {
            name: 'Geographic + Entity Navigation',
            request: {
                zoom: 'community',
                pan: {
                    geographic: {
                        bbox: {
                            minLon: -122.5,
                            minLat: 37.2,
                            maxLon: -121.9,
                            maxLat: 37.6
                        }
                    },
                    entity: {
                        type: 'http://purl.org/stuff/ragno/Organization',
                        properties: {
                            'ragno:importance': { min: 0.7 }
                        }
                    }
                },
                tilt: 'graph',
                transform: {
                    maxTokens: 6000,
                    format: 'json',
                    tokenizer: 'claude'
                }
            },
            description: 'Geographic and entity-based navigation with graph projection'
        }
    ]
    
    for (const example of navigationRequests) {
        logger.info(`\n${example.name}:`)
        logger.info('Description:', example.description)
        logger.info('Request payload:', JSON.stringify(example.request, null, 2))
        
        try {
            // Simulate API request
            const response = await simulateAPIRequest('POST', '/api/navigate', example.request)
            
            logger.info('Response status:', response.status)
            logger.info('Response time:', `${response.responseTime}ms`)
            
            if (response.success) {
                logger.info('Navigation result:')
                logger.info(`  Content chunks: ${response.data.content?.chunks || 1}`)
                logger.info(`  Processing time: ${response.data.metadata?.pipeline?.totalTime}ms`)
                logger.info(`  Corpuscles selected: ${response.data.metadata?.selection?.corpuscleCount}`)
                logger.info(`  Cache hits: ${response.data.metadata?.selection?.fromCache ? 'Yes' : 'No'}`)
                
                if (response.data.diagnostics) {
                    logger.info('Performance diagnostics:')
                    logger.info(`  Selection time: ${response.data.diagnostics.performance?.selectionTime}ms`)
                    logger.info(`  Projection time: ${response.data.diagnostics.performance?.projectionTime}ms`)
                    logger.info(`  Transform time: ${response.data.diagnostics.performance?.transformTime}ms`)
                }
            } else {
                logger.warn('Navigation failed:', response.error)
            }
            
        } catch (error) {
            logger.error('API request failed:', error.message)
        }
    }
}

/**
 * Demonstrate preview API for quick estimations
 */
async function demonstratePreviewAPI() {
    logger.info('\n👁️ === Preview API Demonstrations ===')
    
    const previewRequests = [
        {
            name: 'Quick Preview',
            request: {
                zoom: 'text',
                pan: { topic: 'artificial-intelligence' },
                tilt: 'keywords'
            }
        },
        {
            name: 'Complex Preview',
            request: {
                zoom: 'entity',
                pan: {
                    topic: 'neural-networks',
                    temporal: { relative: 'last-6-months' },
                    entity: { type: 'http://purl.org/stuff/ragno/ResearchPaper' }
                },
                tilt: 'embedding'
            }
        }
    ]
    
    for (const example of previewRequests) {
        logger.info(`\n${example.name}:`)
        logger.info('Request:', JSON.stringify(example.request, null, 2))
        
        try {
            const response = await simulateAPIRequest('POST', '/api/navigate/preview', example.request)
            
            if (response.success) {
                logger.info('Preview result:')
                logger.info(`  Estimated corpuscles: ${response.data.summary?.corpuscleCount}`)
                logger.info(`  Estimated tokens: ${response.data.summary?.estimatedTokens}`)
                logger.info(`  Complexity score: ${response.data.summary?.complexity}`)
                logger.info(`  Selection time: ${response.data.summary?.selectionTime}ms`)
                
                logger.info('Sample corpuscles:')
                response.data.corpuscles?.slice(0, 3).forEach((corpuscle, i) => {
                    logger.info(`  ${i + 1}. ${corpuscle.id} (score: ${corpuscle.score?.toFixed(3)})`)
                })
                
                if (response.data.recommendations?.length > 0) {
                    logger.info('Recommendations:')
                    response.data.recommendations.forEach(rec => {
                        logger.info(`  - ${rec.message}`)
                    })
                }
            }
            
        } catch (error) {
            logger.error('Preview request failed:', error.message)
        }
    }
}

/**
 * Demonstrate options API for parameter discovery
 */
async function demonstrateOptionsAPI() {
    logger.info('\n⚙️ === Options API Demonstration ===')
    
    try {
        const response = await simulateAPIRequest('GET', '/api/navigate/options')
        
        if (response.success) {
            logger.info('Available navigation options:')
            
            // Zoom levels
            logger.info('\nZoom Levels:')
            response.data.options.navigation.zoom.levels.forEach(level => {
                const description = response.data.options.navigation.zoom.descriptions[level]
                logger.info(`  ${level}: ${description}`)
            })
            
            // Tilt representations
            logger.info('\nTilt Representations:')
            response.data.options.navigation.tilt.representations.forEach(tilt => {
                const description = response.data.options.navigation.tilt.descriptions[tilt]
                logger.info(`  ${tilt}: ${description}`)
            })
            
            // Output formats
            logger.info('\nOutput Formats:')
            response.data.options.output.formats.forEach(format => {
                logger.info(`  ${format}`)
            })
            
            // Token limits by model
            logger.info('\nToken Limits by Model:')
            Object.entries(response.data.options.output.tokenLimits).forEach(([model, limit]) => {
                logger.info(`  ${model}: ${limit.toLocaleString()} tokens`)
            })
            
            // Usage examples
            logger.info('\nUsage Examples:')
            Object.entries(response.data.examples).forEach(([name, example]) => {
                logger.info(`\n${example.description}:`)
                logger.info(JSON.stringify(example.request, null, 2))
            })
        }
        
    } catch (error) {
        logger.error('Options request failed:', error.message)
    }
}

/**
 * Demonstrate schema API for documentation
 */
async function demonstrateSchemaAPI() {
    logger.info('\n📖 === Schema API Demonstration ===')
    
    try {
        const response = await simulateAPIRequest('GET', '/api/navigate/schema')
        
        if (response.success) {
            logger.info('Parameter Schema Documentation:')
            
            // Required vs optional fields
            logger.info('\nRequired Parameters:')
            response.data.schema.validation.required.forEach(field => {
                logger.info(`  ${field}`)
            })
            
            logger.info('\nOptional Parameters:')
            response.data.schema.validation.optional.forEach(field => {
                logger.info(`  ${field}`)
            })
            
            // Documentation for each dimension
            logger.info('\nParameter Documentation:')
            Object.entries(response.data.documentation).forEach(([param, doc]) => {
                logger.info(`\n${param.toUpperCase()}:`)
                logger.info(`  ${doc}`)
            })
            
            // Examples from schema
            logger.info('\nSchema Examples:')
            Object.entries(response.data.examples).forEach(([name, example]) => {
                logger.info(`\n${name}:`)
                logger.info(JSON.stringify(example, null, 2))
            })
        }
        
    } catch (error) {
        logger.error('Schema request failed:', error.message)
    }
}

/**
 * Demonstrate health monitoring API
 */
async function demonstrateHealthAPI() {
    logger.info('\n🏥 === Health API Demonstration ===')
    
    try {
        const response = await simulateAPIRequest('GET', '/api/navigate/health')
        
        if (response.success) {
            logger.info('System Health Status:')
            logger.info(`Overall status: ${response.data.health.status}`)
            logger.info(`Active requests: ${response.data.health.system.activeRequests}`)
            logger.info(`Uptime: ${response.data.health.system.uptime} seconds`)
            
            logger.info('\nComponent Health:')
            Object.entries(response.data.health.checks).forEach(([component, check]) => {
                if (check) {
                    logger.info(`${component}: ${check.status}`)
                    if (check.metrics) {
                        Object.entries(check.metrics).forEach(([metric, value]) => {
                            logger.info(`  ${metric}: ${value}`)
                        })
                    }
                    if (check.error) {
                        logger.warn(`  Error: ${check.error}`)
                    }
                } else {
                    logger.info(`${component}: not initialized`)
                }
            })
        }
        
    } catch (error) {
        logger.error('Health request failed:', error.message)
    }
}

/**
 * Demonstrate metrics API for performance monitoring
 */
async function demonstrateMetricsAPI() {
    logger.info('\n📊 === Metrics API Demonstration ===')
    
    try {
        const response = await simulateAPIRequest('GET', '/api/navigate/metrics')
        
        if (response.success) {
            logger.info('API Performance Metrics:')
            
            // Request metrics
            const requestMetrics = response.data.metrics.requests
            logger.info('\nRequest Statistics:')
            logger.info(`  Total requests: ${requestMetrics.total}`)
            logger.info(`  Successful: ${requestMetrics.successful}`)
            logger.info(`  Failed: ${requestMetrics.failed}`)
            logger.info(`  Success rate: ${requestMetrics.successRate}`)
            logger.info(`  Average response time: ${requestMetrics.avgResponseTime}ms`)
            
            // Endpoint breakdown
            logger.info('\nEndpoint Performance:')
            Object.entries(requestMetrics.endpoints).forEach(([endpoint, stats]) => {
                logger.info(`${endpoint}:`)
                logger.info(`  Total: ${stats.total}`)
                logger.info(`  Success rate: ${stats.successRate}`)
            })
            
            // Component metrics
            logger.info('\nComponent Performance:')
            Object.entries(response.data.metrics.components).forEach(([component, metrics]) => {
                if (metrics) {
                    logger.info(`${component}:`)
                    Object.entries(metrics).forEach(([metric, value]) => {
                        logger.info(`  ${metric}: ${value}`)
                    })
                }
            })
            
            // System metrics
            const systemMetrics = response.data.metrics.system
            logger.info('\nSystem Resources:')
            logger.info(`  Active requests: ${systemMetrics.activeRequests}`)
            logger.info(`  Memory usage: ${systemMetrics.memory.rss}`)
            logger.info(`  Heap used: ${systemMetrics.memory.heapUsed}`)
            logger.info(`  Uptime: ${systemMetrics.uptime.formatted}`)
        }
        
    } catch (error) {
        logger.error('Metrics request failed:', error.message)
    }
}

/**
 * Demonstrate error handling scenarios
 */
async function demonstrateErrorHandling() {
    logger.info('\n❌ === Error Handling Demonstrations ===')
    
    const errorScenarios = [
        {
            name: 'Invalid Zoom Level',
            request: {
                zoom: 'invalid-zoom',
                tilt: 'keywords'
            },
            expectedError: 'VALIDATION_ERROR'
        },
        {
            name: 'Missing Required Parameters',
            request: {
                pan: { topic: 'test' }
                // Missing zoom and tilt
            },
            expectedError: 'VALIDATION_ERROR'
        },
        {
            name: 'Invalid Token Limit',
            request: {
                zoom: 'unit',
                tilt: 'keywords',
                transform: {
                    maxTokens: -100
                }
            },
            expectedError: 'VALIDATION_ERROR'
        },
        {
            name: 'Malformed Geographic Filter',
            request: {
                zoom: 'entity',
                pan: {
                    geographic: {
                        bbox: {
                            minLon: 'invalid'
                        }
                    }
                },
                tilt: 'graph'
            },
            expectedError: 'PARAMETER_ERROR'
        }
    ]
    
    for (const scenario of errorScenarios) {
        logger.info(`\n${scenario.name}:`)
        logger.info('Invalid request:', JSON.stringify(scenario.request, null, 2))
        
        try {
            const response = await simulateAPIRequest('POST', '/api/navigate', scenario.request)
            
            if (!response.success) {
                logger.info('Error response:')
                logger.info(`  Error code: ${response.error.code}`)
                logger.info(`  Error type: ${response.error.type}`)
                logger.info(`  Error message: ${response.error.message}`)
                logger.info(`  Status code: ${response.error.statusCode}`)
                
                if (response.recovery) {
                    logger.info('Recovery information:')
                    logger.info(`  Recovered: ${response.recovery.recovered}`)
                    logger.info(`  Recovery message: ${response.recovery.message}`)
                    if (response.recovery.fallbackData) {
                        logger.info('  Fallback data provided')
                    }
                }
                
                if (response.suggestions?.length > 0) {
                    logger.info('Suggestions:')
                    response.suggestions.forEach(suggestion => {
                        logger.info(`  - ${suggestion}`)
                    })
                }
            } else {
                logger.warn('Expected error but request succeeded')
            }
            
        } catch (error) {
            logger.error('Unexpected error:', error.message)
        }
    }
}

/**
 * Demonstrate rate limiting behavior
 */
async function demonstrateRateLimiting() {
    logger.info('\n🚦 === Rate Limiting Demonstration ===')
    
    const rapidRequests = Array(15).fill(null).map((_, i) => ({
        zoom: 'unit',
        tilt: 'keywords',
        requestId: i + 1
    }))
    
    logger.info(`Sending ${rapidRequests.length} rapid requests (limit: 10/min)...`)
    
    let successCount = 0
    let rateLimitedCount = 0
    
    for (const request of rapidRequests) {
        try {
            const response = await simulateAPIRequest('POST', '/api/navigate', request)
            
            if (response.success) {
                successCount++
                logger.info(`Request ${request.requestId}: Success`)
            } else if (response.error?.statusCode === 429) {
                rateLimitedCount++
                logger.warn(`Request ${request.requestId}: Rate limited`)
                
                if (response.rateLimit) {
                    logger.warn(`  Remaining: ${response.rateLimit.remaining}`)
                    logger.warn(`  Reset time: ${new Date(response.rateLimit.resetTime)}`)
                }
            } else {
                logger.error(`Request ${request.requestId}: Other error - ${response.error?.message}`)
            }
            
        } catch (error) {
            logger.error(`Request ${request.requestId}: Failed - ${error.message}`)
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    logger.info('\nRate limiting results:')
    logger.info(`  Successful requests: ${successCount}`)
    logger.info(`  Rate limited requests: ${rateLimitedCount}`)
    logger.info(`  Total requests: ${rapidRequests.length}`)
    logger.info(`  Rate limit effectiveness: ${(rateLimitedCount / rapidRequests.length * 100).toFixed(1)}%`)
}

/**
 * Demonstrate concurrent request handling
 */
async function demonstrateConcurrency() {
    logger.info('\n🔄 === Concurrent Request Handling ===')
    
    const concurrentRequests = [
        { zoom: 'entity', tilt: 'keywords', id: 'req_1' },
        { zoom: 'unit', tilt: 'embedding', id: 'req_2' },
        { zoom: 'text', tilt: 'graph', id: 'req_3' },
        { zoom: 'community', tilt: 'temporal', id: 'req_4' },
        { zoom: 'corpus', tilt: 'keywords', id: 'req_5' }
    ]
    
    logger.info(`Sending ${concurrentRequests.length} concurrent requests...`)
    
    const startTime = Date.now()
    
    const promises = concurrentRequests.map(async (request) => {
        const requestStart = Date.now()
        try {
            const response = await simulateAPIRequest('POST', '/api/navigate', request)
            const duration = Date.now() - requestStart
            
            return {
                id: request.id,
                success: response.success,
                duration,
                error: response.error?.message
            }
        } catch (error) {
            return {
                id: request.id,
                success: false,
                duration: Date.now() - requestStart,
                error: error.message
            }
        }
    })
    
    const results = await Promise.all(promises)
    const totalTime = Date.now() - startTime
    
    logger.info('Concurrent request results:')
    results.forEach(result => {
        logger.info(`  ${result.id}: ${result.success ? 'Success' : 'Failed'} (${result.duration}ms)`)
        if (!result.success) {
            logger.warn(`    Error: ${result.error}`)
        }
    })
    
    const successCount = results.filter(r => r.success).length
    const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length
    
    logger.info('\nConcurrency analysis:')
    logger.info(`  Total processing time: ${totalTime}ms`)
    logger.info(`  Average request time: ${avgDuration.toFixed(0)}ms`)
    logger.info(`  Success rate: ${(successCount / results.length * 100).toFixed(1)}%`)
    logger.info(`  Concurrency efficiency: ${((results.length * avgDuration) / totalTime).toFixed(2)}x`)
}

/**
 * Helper functions for simulation
 */
function createMockRagnoCorpus() {
    return {
        entities: new Map(),
        units: new Map(),
        relationships: new Map(),
        query: async () => ({ corpuscles: [] })
    }
}

function createMockSparqlStore() {
    return {
        search: async () => ({ results: [] }),
        store: async () => ({ success: true })
    }
}

function createMockEmbeddingHandler() {
    return {
        generateEmbedding: async () => Array(1536).fill(0).map(() => Math.random())
    }
}

function createMockLLMHandler() {
    return {
        generateResponse: async () => 'Mock LLM response'
    }
}

function createMockServer() {
    // Simulate server startup
    return {
        port: 3001,
        status: 'running',
        stop: () => logger.info('Mock server stopped')
    }
}

async function simulateAPIRequest(method, endpoint, data = null) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50))
    
    const startTime = Date.now()
    
    try {
        // Simulate different response types based on endpoint
        let response
        
        if (endpoint === '/api/navigate') {
            response = simulateNavigationResponse(data)
        } else if (endpoint === '/api/navigate/preview') {
            response = simulatePreviewResponse(data)
        } else if (endpoint === '/api/navigate/options') {
            response = simulateOptionsResponse()
        } else if (endpoint === '/api/navigate/schema') {
            response = simulateSchemaResponse()
        } else if (endpoint === '/api/navigate/health') {
            response = simulateHealthResponse()
        } else if (endpoint === '/api/navigate/metrics') {
            response = simulateMetricsResponse()
        } else {
            response = { success: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found', statusCode: 404 } }
        }
        
        response.responseTime = Date.now() - startTime
        response.status = response.success ? 200 : (response.error?.statusCode || 500)
        
        return response
        
    } catch (error) {
        return {
            success: false,
            error: { code: 'INTERNAL_ERROR', message: error.message, statusCode: 500 },
            responseTime: Date.now() - startTime,
            status: 500
        }
    }
}

function simulateNavigationResponse(data) {
    // Simulate validation errors
    if (!data?.zoom) {
        return {
            success: false,
            error: {
                code: 'MISSING_REQUIRED_PARAM',
                type: 'VALIDATION_ERROR',
                message: 'Missing required parameter: zoom',
                statusCode: 400
            },
            suggestions: ['Include zoom parameter (entity, unit, text, community, corpus)']
        }
    }
    
    if (data.zoom === 'invalid-zoom') {
        return {
            success: false,
            error: {
                code: 'INVALID_ZOOM_LEVEL',
                type: 'VALIDATION_ERROR',
                message: 'Invalid zoom level: invalid-zoom',
                statusCode: 400
            },
            recovery: {
                recovered: true,
                message: 'Suggested valid zoom levels',
                fallbackData: {
                    validZoomLevels: ['entity', 'unit', 'text', 'community', 'corpus'],
                    suggestion: 'unit'
                }
            },
            suggestions: ['Use one of: entity, unit, text, community, corpus']
        }
    }
    
    if (data.transform?.maxTokens < 0) {
        return {
            success: false,
            error: {
                code: 'INVALID_TOKEN_LIMIT',
                type: 'VALIDATION_ERROR',
                message: 'Token limit must be positive',
                statusCode: 400
            }
        }
    }
    
    // Simulate rate limiting (every 12th request)
    if (Math.random() < 0.08) { // ~8% chance for demo purposes
        return {
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                type: 'RATE_LIMIT_ERROR',
                message: 'Rate limit exceeded',
                statusCode: 429
            },
            rateLimit: {
                remaining: 0,
                resetTime: Date.now() + 60000
            },
            suggestions: ['Wait before retrying', 'Implement exponential backoff']
        }
    }
    
    // Simulate successful response
    return {
        success: true,
        requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        navigation: data,
        content: {
            chunks: Math.floor(Math.random() * 3) + 1,
            format: data.transform?.format || 'structured',
            size: Math.floor(Math.random() * 5000) + 1000
        },
        metadata: {
            pipeline: {
                selectionTime: Math.floor(Math.random() * 200) + 100,
                projectionTime: Math.floor(Math.random() * 150) + 50,
                transformTime: Math.floor(Math.random() * 100) + 30,
                totalTime: Math.floor(Math.random() * 400) + 200
            },
            selection: {
                corpuscleCount: Math.floor(Math.random() * 30) + 10,
                fromCache: Math.random() > 0.7,
                complexity: Math.random() * 3 + 5
            }
        },
        diagnostics: {
            performance: {
                selectionTime: Math.floor(Math.random() * 200) + 100,
                projectionTime: Math.floor(Math.random() * 150) + 50,
                transformTime: Math.floor(Math.random() * 100) + 30
            },
            cacheUsage: {
                selectionCached: Math.random() > 0.7,
                transformationCached: Math.random() > 0.8
            }
        }
    }
}

function simulatePreviewResponse(data) {
    if (!data?.zoom) {
        return {
            success: false,
            error: { code: 'MISSING_REQUIRED_PARAM', message: 'Missing zoom parameter', statusCode: 400 }
        }
    }
    
    const corpuscleCount = Math.floor(Math.random() * 50) + 10
    
    return {
        success: true,
        requestId: `preview_${Date.now()}`,
        preview: true,
        navigation: data,
        summary: {
            corpuscleCount,
            selectionTime: Math.floor(Math.random() * 100) + 50,
            estimatedTokens: corpuscleCount * (Math.floor(Math.random() * 100) + 50),
            complexity: Math.random() * 5 + 3
        },
        corpuscles: Array(Math.min(corpuscleCount, 5)).fill(null).map((_, i) => ({
            id: `corpuscle_${i}`,
            type: data.zoom,
            score: Math.random()
        })),
        recommendations: corpuscleCount > 100 ? [
            { type: 'scope_reduction', message: 'Consider adding filters to reduce scope' }
        ] : []
    }
}

function simulateOptionsResponse() {
    return {
        success: true,
        requestId: `options_${Date.now()}`,
        options: {
            navigation: {
                zoom: {
                    levels: ['entity', 'unit', 'text', 'community', 'corpus'],
                    descriptions: {
                        entity: 'Individual entities and concepts',
                        unit: 'Semantic units and meaningful segments',
                        text: 'Full text elements and documents',
                        community: 'Thematic communities and clusters',
                        corpus: 'Entire corpus overview and metadata'
                    }
                },
                tilt: {
                    representations: ['embedding', 'keywords', 'graph', 'temporal'],
                    descriptions: {
                        embedding: 'Vector embeddings and similarity analysis',
                        keywords: 'Keyword extraction and term analysis',
                        graph: 'Graph structure and relationship analysis',
                        temporal: 'Temporal sequences and chronological analysis'
                    }
                }
            },
            output: {
                formats: ['json', 'markdown', 'structured', 'conversational', 'analytical'],
                encodingStrategies: ['structured', 'compact', 'inline', 'header', 'semantic', 'minimal'],
                tokenLimits: {
                    'gpt-4': 128000,
                    'gpt-3.5-turbo': 16385,
                    'claude-3-opus': 200000,
                    'claude-3-sonnet': 200000
                }
            }
        },
        examples: {
            basic: {
                description: 'Basic navigation request',
                request: { zoom: 'unit', tilt: 'keywords' }
            },
            advanced: {
                description: 'Advanced filtered navigation',
                request: {
                    zoom: 'entity',
                    pan: { topic: 'machine-learning' },
                    tilt: 'embedding',
                    transform: { maxTokens: 8000, format: 'markdown' }
                }
            }
        }
    }
}

function simulateSchemaResponse() {
    return {
        success: true,
        requestId: `schema_${Date.now()}`,
        schema: {
            zoom: { type: 'string', enum: ['entity', 'unit', 'text', 'community', 'corpus'], required: true },
            tilt: { type: 'string', enum: ['embedding', 'keywords', 'graph', 'temporal'], required: true },
            pan: { type: 'object', required: false },
            transform: { type: 'object', required: false }
        },
        validation: {
            required: ['zoom', 'tilt'],
            optional: ['pan', 'transform']
        },
        examples: {
            basic: { zoom: 'unit', tilt: 'keywords' },
            advanced: {
                zoom: 'entity',
                pan: { topic: 'ai', temporal: { start: '2023-01-01' } },
                tilt: 'embedding',
                transform: { maxTokens: 8000, format: 'markdown' }
            }
        },
        documentation: {
            zoom: 'Abstraction level for content selection',
            pan: 'Domain filtering constraints',
            tilt: 'Content representation format',
            transform: 'Output transformation options'
        }
    }
}

function simulateHealthResponse() {
    const componentHealth = Math.random() > 0.1 // 90% chance of healthy
    
    return {
        success: true,
        requestId: `health_${Date.now()}`,
        health: {
            status: componentHealth ? 'healthy' : 'degraded',
            checks: {
                api: { status: 'healthy', timestamp: new Date().toISOString() },
                corpuscleSelector: componentHealth ? {
                    status: 'healthy',
                    metrics: {
                        totalSelections: Math.floor(Math.random() * 1000) + 100,
                        avgSelectionTime: Math.floor(Math.random() * 100) + 50,
                        cacheHitRate: Math.random() * 0.3 + 0.6
                    }
                } : {
                    status: 'degraded',
                    error: 'High response times detected'
                },
                transformer: { status: 'healthy' }
            },
            system: {
                activeRequests: Math.floor(Math.random() * 5),
                uptime: Math.floor(Math.random() * 86400) + 3600,
                timestamp: new Date().toISOString()
            }
        }
    }
}

function simulateMetricsResponse() {
    const totalRequests = Math.floor(Math.random() * 1000) + 500
    const successfulRequests = Math.floor(totalRequests * (0.85 + Math.random() * 0.1))
    
    return {
        success: true,
        requestId: `metrics_${Date.now()}`,
        metrics: {
            requests: {
                total: totalRequests,
                successful: successfulRequests,
                failed: totalRequests - successfulRequests,
                successRate: `${((successfulRequests / totalRequests) * 100).toFixed(1)}%`,
                avgResponseTime: Math.floor(Math.random() * 200) + 150,
                endpoints: {
                    '/api/navigate': { total: Math.floor(totalRequests * 0.6), successful: Math.floor(totalRequests * 0.55), successRate: '91.7%' },
                    '/api/navigate/preview': { total: Math.floor(totalRequests * 0.3), successful: Math.floor(totalRequests * 0.29), successRate: '96.7%' },
                    '/api/navigate/options': { total: Math.floor(totalRequests * 0.1), successful: Math.floor(totalRequests * 0.1), successRate: '100.0%' }
                }
            },
            components: {
                corpuscleSelector: {
                    totalSelections: Math.floor(Math.random() * 800) + 200,
                    avgSelectionTime: Math.floor(Math.random() * 100) + 80,
                    cacheHitRate: Math.random() * 0.2 + 0.7
                },
                transformer: {
                    totalTransformations: Math.floor(Math.random() * 600) + 150,
                    avgTransformTime: Math.floor(Math.random() * 80) + 40
                }
            },
            system: {
                activeRequests: Math.floor(Math.random() * 3),
                memory: {
                    rss: `${Math.floor(Math.random() * 50) + 100} MB`,
                    heapUsed: `${Math.floor(Math.random() * 30) + 60} MB`,
                    heapTotal: `${Math.floor(Math.random() * 40) + 80} MB`
                },
                uptime: {
                    seconds: Math.floor(Math.random() * 86400) + 3600,
                    formatted: `${Math.floor(Math.random() * 24) + 1}h ${Math.floor(Math.random() * 60)}m`
                }
            }
        }
    }
}

/**
 * Main execution function
 */
async function runAPIEndpointsDemo() {
    try {
        await initializeAPI()
        await demonstrateNavigationAPI()
        await demonstratePreviewAPI()
        await demonstrateOptionsAPI()
        await demonstrateSchemaAPI()
        await demonstrateHealthAPI()
        await demonstrateMetricsAPI()
        await demonstrateErrorHandling()
        await demonstrateRateLimiting()
        await demonstrateConcurrency()
        
        logger.info('\n🎉 ZPT API Endpoints Demo completed successfully!')
        logger.info('This demo showcased comprehensive API capabilities:')
        logger.info('- Complete navigation API with full pipeline execution')
        logger.info('- Preview API for quick result estimation and planning')
        logger.info('- Options and schema APIs for parameter discovery')
        logger.info('- Health and metrics APIs for system monitoring')
        logger.info('- Sophisticated error handling with recovery strategies')
        logger.info('- Rate limiting and concurrent request management')
        logger.info('- Production-ready API patterns and best practices')
        
    } catch (error) {
        logger.error('Demo failed:', error.message)
        logger.error('Stack:', error.stack)
    } finally {
        if (mockServer) {
            mockServer.stop()
        }
        if (config) {
            config = null
        }
        logger.info('🧹 Cleanup completed')
    }
}

// Execute the demo
runAPIEndpointsDemo()