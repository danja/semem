/**
 * RESTful navigation handler for ZPT corpus navigation API
 */
import ParameterValidator from '../parameters/ParameterValidator.js';
import ParameterNormalizer from '../parameters/ParameterNormalizer.js';
import CorpuscleSelector from '../selection/CorpuscleSelector.js';
import TiltProjector from '../selection/TiltProjector.js';
import CorpuscleTransformer from '../transform/CorpuscleTransformer.js';
import RequestParser from './RequestParser.js';
import ResponseFormatter from './ResponseFormatter.js';
import ErrorHandler from './ErrorHandler.js';
import { logger } from '../../Utils.js';

export default class NavigationEndpoint {
    constructor(options = {}) {
        this.config = {
            maxConcurrentRequests: options.maxConcurrentRequests || 10,
            requestTimeoutMs: options.requestTimeoutMs || 120000, // 2 minutes
            enableRateLimit: options.enableRateLimit !== false,
            rateLimit: options.rateLimit || { requests: 100, windowMs: 60000 }, // 100 req/min
            enableCaching: options.enableCaching !== false,
            enableMetrics: options.enableMetrics !== false,
            corsEnabled: options.corsEnabled !== false,
            ...options
        };

        // Initialize components
        this.validator = new ParameterValidator();
        this.normalizer = new ParameterNormalizer();
        this.requestParser = new RequestParser();
        this.responseFormatter = new ResponseFormatter();
        this.errorHandler = new ErrorHandler();

        // Navigation components (injected via dependencies)
        this.corpuscleSelector = null;
        this.tiltProjector = null;
        this.transformer = null;

        // Request tracking and metrics
        this.activeRequests = new Map();
        this.requestMetrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            avgResponseTime: 0,
            requestsByEndpoint: new Map()
        };

        // Rate limiting
        this.rateLimitStore = new Map();

        this.initializeEndpoints();
    }

    /**
     * Initialize endpoint configurations
     */
    initializeEndpoints() {
        this.endpoints = {
            '/api/navigate': {
                methods: ['POST'],
                handler: this.handleNavigate.bind(this),
                description: 'Main navigation endpoint',
                rateLimit: true,
                timeout: this.config.requestTimeoutMs
            },
            '/api/navigate/preview': {
                methods: ['POST'],
                handler: this.handlePreview.bind(this),
                description: 'Preview navigation without full processing',
                rateLimit: true,
                timeout: 30000
            },
            '/api/navigate/options': {
                methods: ['GET'],
                handler: this.handleOptions.bind(this),
                description: 'Get available navigation options',
                rateLimit: false,
                timeout: 5000
            },
            '/api/navigate/schema': {
                methods: ['GET'],
                handler: this.handleSchema.bind(this),
                description: 'Get parameter schema documentation',
                rateLimit: false,
                timeout: 5000
            },
            '/api/navigate/health': {
                methods: ['GET'],
                handler: this.handleHealth.bind(this),
                description: 'Health check endpoint',
                rateLimit: false,
                timeout: 10000
            },
            '/api/navigate/metrics': {
                methods: ['GET'],
                handler: this.handleMetrics.bind(this),
                description: 'Get API metrics',
                rateLimit: false,
                timeout: 5000
            }
        };
    }

    /**
     * Initialize dependencies
     * @param {Object} dependencies - Required components
     */
    initialize(dependencies = {}) {
        const { ragnoCorpus, sparqlStore, embeddingHandler, llmHandler } = dependencies;

        if (!ragnoCorpus) {
            throw new Error('NavigationEndpoint requires ragnoCorpus dependency');
        }

        // Initialize navigation pipeline components
        this.corpuscleSelector = new CorpuscleSelector(ragnoCorpus, {
            sparqlStore,
            embeddingHandler,
            enableCaching: this.config.enableCaching
        });

        this.tiltProjector = new TiltProjector({
            embeddingHandler,
            textAnalyzer: llmHandler,
            graphAnalyzer: dependencies.graphAnalyzer,
            temporalAnalyzer: dependencies.temporalAnalyzer
        });

        this.transformer = new CorpuscleTransformer({
            enableCaching: this.config.enableCaching,
            enableMetrics: this.config.enableMetrics
        });

        logger.info('NavigationEndpoint initialized with dependencies');
    }

    /**
     * Main request handler - routes requests to appropriate endpoints
     * @param {Object} req - HTTP request object
     * @param {Object} res - HTTP response object
     */
    async handleRequest(req, res) {
        const requestId = this.generateRequestId();
        const startTime = Date.now();

        try {
            // Add CORS headers if enabled
            if (this.config.corsEnabled) {
                this.addCorsHeaders(res);
            }

            // Parse and validate request
            const parsedRequest = await this.requestParser.parse(req);
            const endpoint = this.matchEndpoint(parsedRequest.path, parsedRequest.method);

            if (!endpoint) {
                return this.errorHandler.handleError(
                    new Error('Endpoint not found'), 
                    req, 
                    res, 
                    { requestId, statusCode: 404 }
                );
            }

            // Check rate limits
            if (endpoint.rateLimit && this.config.enableRateLimit) {
                const rateLimitResult = this.checkRateLimit(parsedRequest.clientIp);
                if (!rateLimitResult.allowed) {
                    return this.errorHandler.handleError(
                        new Error('Rate limit exceeded'),
                        req,
                        res,
                        { requestId, statusCode: 429, rateLimitInfo: rateLimitResult }
                    );
                }
            }

            // Track active request
            this.trackActiveRequest(requestId, parsedRequest, startTime);

            // Execute endpoint handler with timeout
            const result = await this.executeWithTimeout(
                endpoint.handler,
                [parsedRequest, requestId],
                endpoint.timeout
            );

            // Format and send response
            const formattedResponse = await this.responseFormatter.format(result, {
                requestId,
                endpoint: parsedRequest.path,
                processingTime: Date.now() - startTime
            });

            this.sendSuccessResponse(res, formattedResponse);

            // Update metrics
            this.updateMetrics(parsedRequest.path, true, Date.now() - startTime);

        } catch (error) {
            logger.error('Request handling failed', { requestId, error: error.message });
            
            this.errorHandler.handleError(error, req, res, { requestId });
            this.updateMetrics(req.path || 'unknown', false, Date.now() - startTime);
        } finally {
            this.untrackActiveRequest(requestId);
        }
    }

    /**
     * Handle main navigation requests
     */
    async handleNavigate(parsedRequest, requestId) {
        logger.info('Processing navigation request', { requestId, params: parsedRequest.body });

        // Validate parameters
        const validationResult = this.validator.validate(parsedRequest.body);
        if (!validationResult.valid) {
            throw new Error(`Parameter validation failed: ${validationResult.message}`);
        }

        // Normalize parameters
        const normalizedParams = this.normalizer.normalize(parsedRequest.body);
        
        // Execute navigation pipeline
        const pipelineResult = await this.executeNavigationPipeline(
            normalizedParams, 
            requestId
        );

        return {
            success: true,
            requestId,
            navigation: pipelineResult.navigation,
            content: pipelineResult.content,
            metadata: pipelineResult.metadata,
            diagnostics: this.config.enableMetrics ? pipelineResult.diagnostics : undefined
        };
    }

    /**
     * Handle preview requests (limited processing)
     */
    async handlePreview(parsedRequest, requestId) {
        logger.info('Processing preview request', { requestId });

        // Validate parameters
        const validationResult = this.validator.validate(parsedRequest.body);
        if (!validationResult.valid) {
            throw new Error(`Parameter validation failed: ${validationResult.message}`);
        }

        // Normalize parameters
        const normalizedParams = this.normalizer.normalize(parsedRequest.body);

        // Execute selection only (no transformation)
        const selectionResult = await this.corpuscleSelector.select(normalizedParams);

        return {
            success: true,
            requestId,
            preview: true,
            navigation: normalizedParams,
            summary: {
                corpuscleCount: selectionResult.corpuscles.length,
                selectionTime: selectionResult.metadata.selectionTime,
                estimatedTokens: this.estimateTokensForCorpuscles(selectionResult.corpuscles),
                complexity: selectionResult.metadata.complexity
            },
            corpuscles: selectionResult.corpuscles.slice(0, 5) // Preview first 5
        };
    }

    /**
     * Handle options requests
     */
    async handleOptions(parsedRequest, requestId) {
        return {
            success: true,
            requestId,
            options: {
                zoomLevels: ['entity', 'unit', 'text', 'community', 'corpus'],
                tiltRepresentations: ['embedding', 'keywords', 'graph', 'temporal'],
                outputFormats: this.transformer ? 
                    Object.keys(this.transformer.promptFormatter.formats) : 
                    ['json', 'markdown', 'structured'],
                encodingStrategies: this.transformer ? 
                    Object.keys(this.transformer.metadataEncoder.encodingStrategies) : 
                    ['structured', 'compact', 'inline'],
                maxTokenLimits: {
                    'gpt-4': 128000,
                    'gpt-3.5-turbo': 16385,
                    'claude-3-opus': 200000,
                    'claude-3-sonnet': 200000
                },
                supportedTokenizers: ['cl100k_base', 'p50k_base', 'claude', 'llama']
            }
        };
    }

    /**
     * Handle schema requests
     */
    async handleSchema(parsedRequest, requestId) {
        return {
            success: true,
            requestId,
            schema: this.validator.getSchema(),
            examples: {
                basic: {
                    zoom: 'unit',
                    tilt: 'keywords',
                    transform: { maxTokens: 4000, format: 'structured' }
                },
                advanced: {
                    zoom: 'entity',
                    pan: {
                        topic: 'machine-learning',
                        temporal: {
                            start: '2024-01-01',
                            end: '2024-12-31'
                        }
                    },
                    tilt: 'embedding',
                    transform: {
                        maxTokens: 8000,
                        format: 'json',
                        includeMetadata: true,
                        chunkStrategy: 'semantic'
                    }
                }
            },
            documentation: {
                zoom: 'Abstraction level: entity (specific elements), unit (semantic chunks), text (full content), community (summaries), corpus (overview)',
                pan: 'Domain filtering: topic (subject constraints), entity (specific scope), temporal (time bounds), geographic (location limits)',
                tilt: 'Representation format: embedding (vectors), keywords (terms), graph (relationships), temporal (sequences)',
                transform: 'Output options: maxTokens (budget), format (structure), tokenizer (model), metadata (context)'
            }
        };
    }

    /**
     * Handle health check requests
     */
    async handleHealth(parsedRequest, requestId) {
        const healthChecks = {
            api: { status: 'healthy', timestamp: new Date().toISOString() },
            corpuscleSelector: null,
            tiltProjector: null,
            transformer: null
        };

        // Check component health
        if (this.corpuscleSelector) {
            try {
                const metrics = this.corpuscleSelector.getMetrics();
                healthChecks.corpuscleSelector = {
                    status: 'healthy',
                    metrics: {
                        totalSelections: metrics.totalSelections,
                        avgSelectionTime: metrics.avgSelectionTime,
                        cacheHitRate: metrics.cacheHitRate
                    }
                };
            } catch (error) {
                healthChecks.corpuscleSelector = {
                    status: 'unhealthy',
                    error: error.message
                };
            }
        }

        if (this.transformer) {
            try {
                const health = await this.transformer.healthCheck();
                healthChecks.transformer = {
                    status: health.healthy ? 'healthy' : 'degraded',
                    issues: health.issues
                };
            } catch (error) {
                healthChecks.transformer = {
                    status: 'unhealthy',
                    error: error.message
                };
            }
        }

        const overallHealthy = Object.values(healthChecks)
            .filter(check => check !== null)
            .every(check => check.status === 'healthy');

        return {
            success: true,
            requestId,
            status: overallHealthy ? 'healthy' : 'degraded',
            checks: healthChecks,
            activeRequests: this.activeRequests.size,
            uptime: process.uptime()
        };
    }

    /**
     * Handle metrics requests
     */
    async handleMetrics(parsedRequest, requestId) {
        if (!this.config.enableMetrics) {
            throw new Error('Metrics collection is disabled');
        }

        return {
            success: true,
            requestId,
            metrics: {
                requests: this.requestMetrics,
                components: {
                    corpuscleSelector: this.corpuscleSelector?.getMetrics(),
                    transformer: this.transformer?.getMetrics()
                },
                system: {
                    activeRequests: this.activeRequests.size,
                    memoryUsage: process.memoryUsage(),
                    uptime: process.uptime()
                }
            }
        };
    }

    /**
     * Execute complete navigation pipeline
     */
    async executeNavigationPipeline(normalizedParams, requestId) {
        logger.debug('Executing navigation pipeline', { requestId });

        // Stage 1: Corpuscle Selection
        const selectionStart = Date.now();
        const selectionResult = await this.corpuscleSelector.select(normalizedParams);
        const selectionTime = Date.now() - selectionStart;

        logger.debug('Selection completed', { 
            requestId, 
            corpuscleCount: selectionResult.corpuscles.length,
            selectionTime 
        });

        // Stage 2: Tilt Projection
        const projectionStart = Date.now();
        const projectionResult = await this.tiltProjector.project(
            selectionResult.corpuscles,
            normalizedParams.tilt,
            {
                embeddingHandler: this.embeddingHandler,
                textAnalyzer: this.textAnalyzer
            }
        );
        const projectionTime = Date.now() - projectionStart;

        logger.debug('Projection completed', { 
            requestId, 
            representation: projectionResult.representation,
            projectionTime 
        });

        // Stage 3: Transformation
        const transformStart = Date.now();
        const transformResult = await this.transformer.transform(
            projectionResult,
            selectionResult,
            normalizedParams.transform
        );
        const transformTime = Date.now() - transformStart;

        logger.debug('Transformation completed', { 
            requestId, 
            format: transformResult.metadata?.output?.format,
            transformTime 
        });

        return {
            navigation: normalizedParams,
            content: transformResult.content,
            metadata: {
                pipeline: {
                    selectionTime,
                    projectionTime,
                    transformTime,
                    totalTime: selectionTime + projectionTime + transformTime
                },
                selection: selectionResult.metadata,
                projection: projectionResult.metadata,
                transformation: transformResult.metadata
            },
            diagnostics: {
                requestId,
                stages: ['selection', 'projection', 'transformation'],
                performance: {
                    selectionTime,
                    projectionTime,
                    transformTime
                },
                cacheUsage: {
                    selectionCached: selectionResult.metadata.fromCache,
                    transformationCached: transformResult.diagnostics?.cacheUsed
                }
            }
        };
    }

    /**
     * Request routing and validation
     */
    matchEndpoint(path, method) {
        const endpoint = this.endpoints[path];
        if (!endpoint) return null;
        
        if (!endpoint.methods.includes(method.toUpperCase())) return null;
        
        return endpoint;
    }

    /**
     * Rate limiting
     */
    checkRateLimit(clientIp) {
        const now = Date.now();
        const windowMs = this.config.rateLimit.windowMs;
        const maxRequests = this.config.rateLimit.requests;

        if (!this.rateLimitStore.has(clientIp)) {
            this.rateLimitStore.set(clientIp, {
                requests: 1,
                resetTime: now + windowMs
            });
            return { allowed: true, remaining: maxRequests - 1 };
        }

        const clientData = this.rateLimitStore.get(clientIp);
        
        if (now > clientData.resetTime) {
            // Reset window
            clientData.requests = 1;
            clientData.resetTime = now + windowMs;
            return { allowed: true, remaining: maxRequests - 1 };
        }

        if (clientData.requests >= maxRequests) {
            return { 
                allowed: false, 
                remaining: 0,
                resetTime: clientData.resetTime 
            };
        }

        clientData.requests++;
        return { 
            allowed: true, 
            remaining: maxRequests - clientData.requests 
        };
    }

    /**
     * Request tracking
     */
    trackActiveRequest(requestId, parsedRequest, startTime) {
        this.activeRequests.set(requestId, {
            path: parsedRequest.path,
            method: parsedRequest.method,
            startTime,
            clientIp: parsedRequest.clientIp
        });

        // Cleanup old requests periodically
        if (this.activeRequests.size % 50 === 0) {
            this.cleanupOldRequests();
        }
    }

    untrackActiveRequest(requestId) {
        this.activeRequests.delete(requestId);
    }

    cleanupOldRequests() {
        const now = Date.now();
        const timeout = this.config.requestTimeoutMs;

        for (const [requestId, request] of this.activeRequests.entries()) {
            if (now - request.startTime > timeout) {
                this.activeRequests.delete(requestId);
            }
        }
    }

    /**
     * Metrics tracking
     */
    updateMetrics(endpoint, success, responseTime) {
        this.requestMetrics.totalRequests++;
        
        if (success) {
            this.requestMetrics.successfulRequests++;
        } else {
            this.requestMetrics.failedRequests++;
        }

        // Update average response time
        const totalRequests = this.requestMetrics.totalRequests;
        this.requestMetrics.avgResponseTime = 
            (this.requestMetrics.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

        // Track by endpoint
        if (!this.requestMetrics.requestsByEndpoint.has(endpoint)) {
            this.requestMetrics.requestsByEndpoint.set(endpoint, { total: 0, successful: 0 });
        }
        
        const endpointStats = this.requestMetrics.requestsByEndpoint.get(endpoint);
        endpointStats.total++;
        if (success) endpointStats.successful++;
    }

    /**
     * Utility methods
     */
    executeWithTimeout(handler, args, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error(`Request timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            handler(...args)
                .then(result => {
                    clearTimeout(timeout);
                    resolve(result);
                })
                .catch(error => {
                    clearTimeout(timeout);
                    reject(error);
                });
        });
    }

    addCorsHeaders(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Max-Age', '86400');
    }

    sendSuccessResponse(res, data) {
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify(data, null, 2));
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    estimateTokensForCorpuscles(corpuscles) {
        // Simple estimation for preview
        return corpuscles.reduce((total, corpuscle) => {
            const content = Object.values(corpuscle.content || {}).join(' ');
            return total + Math.ceil(content.length / 4); // Rough 4 chars per token
        }, 0);
    }

    /**
     * Configuration and management
     */
    getEndpointInfo() {
        return Object.entries(this.endpoints).map(([path, config]) => ({
            path,
            methods: config.methods,
            description: config.description,
            rateLimit: config.rateLimit,
            timeout: config.timeout
        }));
    }

    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        logger.info('NavigationEndpoint configuration updated');
    }

    async shutdown() {
        logger.info('Shutting down NavigationEndpoint');
        
        // Wait for active requests to complete (with timeout)
        const shutdownTimeout = 30000; // 30 seconds
        const startTime = Date.now();
        
        while (this.activeRequests.size > 0 && Date.now() - startTime < shutdownTimeout) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        if (this.activeRequests.size > 0) {
            logger.warn(`Forced shutdown with ${this.activeRequests.size} active requests`);
        }

        // Cleanup components
        if (this.corpuscleSelector) {
            this.corpuscleSelector.dispose();
        }
        
        if (this.transformer) {
            this.transformer.dispose();
        }

        this.rateLimitStore.clear();
        this.activeRequests.clear();
        
        logger.info('NavigationEndpoint shutdown complete');
    }
}