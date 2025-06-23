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
    async initialize(dependencies = {}) {
        const { ragnoCorpus, sparqlStore, embeddingHandler, llmHandler } = dependencies;

        // Validate required dependencies
        await this.validateDependencies(dependencies);

        try {
            // Initialize components in sequence to avoid race conditions
            logger.info('Initializing NavigationEndpoint components in sequence...');

            // Initialize CorpuscleSelector first (core component)
            logger.debug('Initializing CorpuscleSelector...');
            this.corpuscleSelector = new CorpuscleSelector(ragnoCorpus, {
                sparqlStore,
                embeddingHandler,
                enableCaching: this.config.enableCaching
            });

            // Verify CorpuscleSelector is ready before proceeding
            if (typeof this.corpuscleSelector.initialize === 'function') {
                await this.corpuscleSelector.initialize();
            }

            // Initialize TiltProjector (depends on handlers)
            logger.debug('Initializing TiltProjector...');
            this.tiltProjector = new TiltProjector({
                embeddingHandler,
                textAnalyzer: llmHandler,
                graphAnalyzer: dependencies.graphAnalyzer,
                temporalAnalyzer: dependencies.temporalAnalyzer
            });

            // Initialize Transformer last (depends on others)
            logger.debug('Initializing CorpuscleTransformer...');
            this.transformer = new CorpuscleTransformer({
                enableCaching: this.config.enableCaching,
                enableMetrics: this.config.enableMetrics
            });

            // Verify all components are ready
            await this.verifyComponentsReady();

            logger.info('NavigationEndpoint initialized successfully');
        } catch (error) {
            logger.error('NavigationEndpoint initialization failed:', error);
            await this.cleanupPartialInitialization();
            throw new Error(`NavigationEndpoint initialization failed: ${error.message}`);
        }
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
            transformer: null,
            sparqlStore: null,
            embeddingHandler: null,
            llmHandler: null
        };

        // Check component health with timeout
        const checkPromises = [];

        // Check CorpuscleSelector
        if (this.corpuscleSelector) {
            checkPromises.push(
                this.performHealthCheck('corpuscleSelector', async () => {
                    const metrics = this.corpuscleSelector.getMetrics();
                    return {
                        status: 'healthy',
                        metrics: {
                            totalSelections: metrics.totalSelections,
                            avgSelectionTime: metrics.avgSelectionTime,
                            cacheHitRate: metrics.cacheHitRate
                        }
                    };
                })
            );
        }

        // Check Transformer
        if (this.transformer) {
            checkPromises.push(
                this.performHealthCheck('transformer', async () => {
                    const health = await this.transformer.healthCheck();
                    return {
                        status: health.healthy ? 'healthy' : 'degraded',
                        issues: health.issues
                    };
                })
            );
        }

        // Check TiltProjector
        if (this.tiltProjector) {
            checkPromises.push(
                this.performHealthCheck('tiltProjector', async () => {
                    // Simple check - verify it has required methods
                    const hasRequiredMethods = typeof this.tiltProjector.project === 'function';
                    return {
                        status: hasRequiredMethods ? 'healthy' : 'unhealthy',
                        capabilities: ['project']
                    };
                })
            );
        }

        // Check external services via stored references
        if (this.corpuscleSelector?.sparqlStore) {
            checkPromises.push(
                this.performHealthCheck('sparqlStore', async () => {
                    const health = await this.corpuscleSelector.sparqlStore.healthCheck();
                    return {
                        status: health.healthy ? 'healthy' : 'unhealthy',
                        endpoint: health.endpoint,
                        error: health.error
                    };
                })
            );
        }

        if (this.corpuscleSelector?.embeddingHandler) {
            checkPromises.push(
                this.performHealthCheck('embeddingHandler', async () => {
                    // Test with simple embedding generation
                    try {
                        await this.corpuscleSelector.embeddingHandler.generateEmbedding('test', { enableFallbacks: false });
                        return { status: 'healthy', provider: 'available' };
                    } catch (error) {
                        return { status: 'unhealthy', error: error.message };
                    }
                })
            );
        }

        if (this.tiltProjector?.textAnalyzer) {
            checkPromises.push(
                this.performHealthCheck('llmHandler', async () => {
                    // Test with simple concept extraction
                    try {
                        await this.tiltProjector.textAnalyzer.extractConcepts('test text', { timeoutMs: 5000 });
                        return { status: 'healthy', provider: 'available' };
                    } catch (error) {
                        return { status: 'unhealthy', error: error.message };
                    }
                })
            );
        }

        // Execute all health checks concurrently
        const results = await Promise.allSettled(checkPromises);
        
        // Process results
        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                const { name, health } = result.value;
                healthChecks[name] = health;
            }
        });

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

    /**
     * Validate dependencies before initialization
     */
    async validateDependencies(dependencies) {
        const required = ['ragnoCorpus', 'sparqlStore', 'embeddingHandler', 'llmHandler'];
        const missing = required.filter(dep => !dependencies[dep]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required dependencies: ${missing.join(', ')}`);
        }

        // Check if dependencies are healthy/ready
        const healthChecks = await Promise.allSettled([
            this.checkDependencyHealth('sparqlStore', dependencies.sparqlStore),
            this.checkDependencyHealth('embeddingHandler', dependencies.embeddingHandler),
            this.checkDependencyHealth('llmHandler', dependencies.llmHandler)
        ]);

        const failures = healthChecks
            .map((result, index) => ({ dep: ['sparqlStore', 'embeddingHandler', 'llmHandler'][index], result }))
            .filter(({ result }) => result.status === 'rejected');

        if (failures.length > 0) {
            logger.warn('Some dependencies failed health checks:', failures.map(f => f.dep));
            // Don't fail initialization, but log warnings
        }
    }

    /**
     * Check if a dependency is healthy
     */
    async checkDependencyHealth(name, dependency) {
        try {
            if (typeof dependency.healthCheck === 'function') {
                const health = await Promise.race([
                    dependency.healthCheck(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Health check timeout')), 5000))
                ]);
                
                if (health && !health.healthy) {
                    throw new Error(`${name} is not healthy: ${health.error}`);
                }
            }
            return { healthy: true };
        } catch (error) {
            logger.warn(`Health check failed for ${name}:`, error.message);
            throw error;
        }
    }

    /**
     * Perform a health check with timeout
     */
    async performHealthCheck(name, healthCheckFn) {
        try {
            const health = await Promise.race([
                healthCheckFn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Health check timeout')), 5000)
                )
            ]);
            
            return { name, health };
        } catch (error) {
            return { 
                name, 
                health: { 
                    status: 'unhealthy', 
                    error: error.message 
                } 
            };
        }
    }

    /**
     * Verify all components are ready after initialization
     */
    async verifyComponentsReady() {
        const components = [
            { name: 'corpuscleSelector', instance: this.corpuscleSelector },
            { name: 'tiltProjector', instance: this.tiltProjector },
            { name: 'transformer', instance: this.transformer }
        ];

        for (const { name, instance } of components) {
            if (!instance) {
                throw new Error(`Component ${name} was not initialized`);
            }

            // Check if component has a ready check method
            if (typeof instance.isReady === 'function') {
                const ready = await instance.isReady();
                if (!ready) {
                    throw new Error(`Component ${name} is not ready`);
                }
            }
        }

        logger.debug('All components verified ready');
    }

    /**
     * Cleanup partial initialization on failure
     */
    async cleanupPartialInitialization() {
        logger.debug('Cleaning up partial initialization...');

        const components = [
            { name: 'transformer', instance: this.transformer },
            { name: 'tiltProjector', instance: this.tiltProjector },
            { name: 'corpuscleSelector', instance: this.corpuscleSelector }
        ];

        for (const { name, instance } of components) {
            if (instance && typeof instance.dispose === 'function') {
                try {
                    await instance.dispose();
                    logger.debug(`Cleaned up ${name}`);
                } catch (error) {
                    logger.warn(`Failed to cleanup ${name}:`, error.message);
                }
            }
        }

        // Reset component references
        this.corpuscleSelector = null;
        this.tiltProjector = null;
        this.transformer = null;
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

        // Cleanup components in reverse order of initialization
        logger.debug('Cleaning up components...');
        
        const components = [
            { name: 'transformer', instance: this.transformer },
            { name: 'tiltProjector', instance: this.tiltProjector },
            { name: 'corpuscleSelector', instance: this.corpuscleSelector }
        ];

        for (const { name, instance } of components) {
            if (instance) {
                try {
                    if (typeof instance.dispose === 'function') {
                        await instance.dispose();
                        logger.debug(`Disposed ${name}`);
                    } else if (typeof instance.shutdown === 'function') {
                        await instance.shutdown();
                        logger.debug(`Shutdown ${name}`);
                    } else {
                        logger.debug(`${name} has no cleanup method, skipping`);
                    }
                } catch (error) {
                    logger.warn(`Failed to cleanup ${name}:`, error.message);
                }
            }
        }

        // Clean up resources
        logger.debug('Cleaning up internal resources...');
        this.rateLimitStore.clear();
        this.activeRequests.clear();
        
        // Reset component references
        this.corpuscleSelector = null;
        this.tiltProjector = null;
        this.transformer = null;
        
        logger.info('NavigationEndpoint shutdown complete');
    }
}