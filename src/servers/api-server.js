#!/usr/bin/env node

import logger from 'loglevel';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import Config from '../Config.js';
import MemoryManager from '../MemoryManager.js';
import EmbeddingConnectorFactory from '../connectors/EmbeddingConnectorFactory.js';
import OllamaConnector from '../connectors/OllamaConnector.js';
import ClaudeConnector from '../connectors/ClaudeConnector.js';
import MistralConnector from '../connectors/MistralConnector.js';
import LLMHandler from '../handlers/LLMHandler.js';
import EmbeddingHandler from '../handlers/EmbeddingHandler.js';
import CacheManager from '../handlers/CacheManager.js';
import APIRegistry from '../api/common/APIRegistry.js';
import InMemoryStore from '../stores/InMemoryStore.js';
import { authenticateRequest } from '../api/http/middleware/auth.js';
import { errorHandler, NotFoundError } from '../api/http/middleware/error.js';
import { requestLogger } from '../api/http/middleware/logging.js';
import MemoryAPI from '../api/features/MemoryAPI.js';
import ChatAPI from '../api/features/ChatAPI.js';
import SearchAPI from '../api/features/SearchAPI.js';
import RagnoAPI from '../api/features/RagnoAPI.js';
import ZptAPI from '../api/features/ZptAPI.js';
import UnifiedSearchAPI from '../api/features/UnifiedSearchAPI.js';

// Load environment variables
dotenv.config();

// Configure logging
logger.setLevel(process.env.LOG_LEVEL || 'info');

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(path.dirname(__filename))); // Go up two levels to project root

/**
 * APIServer class that encapsulates the entire API server functionality
 */
class APIServer {
    constructor() {
        this.port = process.env.PORT || 4100; // Updated port to 4100
        this.publicDir = path.join(__dirname, '../public');
        this.distDir = path.join(__dirname, '../public/dist');
        this.app = express();
        this.server = null;
        this.apiContext = {};
        this.registry = new APIRegistry();
        this.initializeMiddleware();
    }

    /**
     * Initialize all middleware
     */
    initializeMiddleware() {
        // Request ID middleware
        this.app.use((req, res, next) => {
            req.id = uuidv4();
            next();
        });

        // Security and performance middleware
        this.app.use(helmet({
            contentSecurityPolicy: false // Disable for development
        }));

        this.app.use(cors({
            origin: '*', // For development
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
        }));

        this.app.use(compression());
        this.app.use(express.json({ limit: '1mb' }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
            message: 'Too many requests, please try again later.'
        });
        this.app.use('/api/', limiter);

        // Request logging
        this.app.use(requestLogger(logger));
    }

    /**
     * Initialize API components
     */
    async initializeComponents() {
        // Load configuration
        const config = new Config();
        await config.init();
        
        // Use new configuration-driven provider selection (like MCP server)
        logger.info('Creating providers using configuration-driven selection...');
        
        // Create LLM connector for chat operations
        const llmProvider = await this.createLLMConnector(config);
        
        // Create embedding connector for embedding operations  
        const embeddingProvider = await this.createEmbeddingConnector(config);
        
        // Get model configuration
        const modelConfig = await this.getModelConfig(config);
        logger.info('Using model configuration:', modelConfig);
        
        const dimension = config.get('memory.dimension') || 1536;

        // Initialize cache manager
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });

        // Initialize handlers
        const embeddingHandler = new EmbeddingHandler(
            embeddingProvider,
            modelConfig.embeddingModel,
            dimension,
            cacheManager
        );

        const llmHandler = new LLMHandler(llmProvider, modelConfig.chatModel);

        // Initialize storage based on config
        let storage;
        const storageConfig = config.get('storage');
        
        if (storageConfig.type === 'sparql') {
            const { default: SPARQLStore } = await import('../stores/SPARQLStore.js');
            storage = new SPARQLStore(storageConfig.options.endpoint, {
                user: storageConfig.options.user,
                password: storageConfig.options.password,
                graphName: storageConfig.options.graphName,
                dimension: dimension
            });
            logger.info(`Initialized SPARQL store with endpoint: ${storageConfig.options.endpoint}`);
        } else if (storageConfig.type === 'json') {
            const { default: JSONStore } = await import('../stores/JSONStore.js');
            storage = new JSONStore(storageConfig.options.path);
            logger.info(`Initialized JSON store at path: ${storageConfig.options.path}`);
        } else {
            // Default to in-memory
            storage = new InMemoryStore();
            logger.info('Initialized in-memory store');
        }

        // Initialize memory manager with the configured storage
        const memoryManager = new MemoryManager({
            llmProvider,
            embeddingProvider,
            chatModel: modelConfig.chatModel,
            embeddingModel: modelConfig.embeddingModel,
            dimension,
            storage
        });

        // Store components in context
        this.apiContext = {
            memory: memoryManager,
            embedding: embeddingHandler,
            llm: llmHandler,
            apis: {}
        };

        // Create API registry
        this.apiRegistry = {
            get: (key) => {
                if (key in this.apiContext) {
                    return this.apiContext[key];
                }
                if (key === 'apis') {
                    return this.apiContext.apis;
                }
                throw new Error(`Unknown component: ${key}`);
            }
        };

        return { memoryManager, embeddingHandler, llmHandler };
    }

    /**
     * Create LLM connector based on configuration priority
     */
    async createLLMConnector(config) {
        try {
            // Get llmProviders with priority ordering
            const llmProviders = config.get('llmProviders') || [];
            
            // Sort by priority (lower number = higher priority)
            const sortedProviders = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            logger.info('Available chat providers by priority:', sortedProviders.map(p => `${p.type} (priority: ${p.priority})`));
            
            // Try providers in priority order
            for (const provider of sortedProviders) {
                logger.info(`Trying LLM provider: ${provider.type} (priority: ${provider.priority})`);
                
                if (provider.type === 'mistral' && provider.apiKey) {
                    logger.info('✅ Creating Mistral connector (highest priority)...');
                    return new MistralConnector();
                } else if (provider.type === 'claude' && provider.apiKey) {
                    logger.info('✅ Creating Claude connector...');
                    return new ClaudeConnector();
                } else if (provider.type === 'ollama') {
                    logger.info('✅ Creating Ollama connector (fallback)...');
                    return new OllamaConnector();
                } else {
                    logger.info(`❌ Provider ${provider.type} not available (missing API key or implementation)`);
                }
            }
            
            logger.info('⚠️ No configured providers available, defaulting to Ollama');
            return new OllamaConnector();
            
        } catch (error) {
            logger.warn('Failed to load provider configuration, defaulting to Ollama:', error.message);
            return new OllamaConnector();
        }
    }

    /**
     * Create embedding connector using configuration-driven factory pattern
     */
    async createEmbeddingConnector(config) {
        try {
            // Get llmProviders with priority ordering for embeddings
            const llmProviders = config.get('llmProviders') || [];
            
            // Sort by priority (lower number = higher priority)
            const sortedProviders = llmProviders
                .filter(p => p.capabilities?.includes('embedding'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999));
            
            logger.info('Available embedding providers by priority:', sortedProviders.map(p => `${p.type} (priority: ${p.priority})`));
            
            // Try providers in priority order
            for (const provider of sortedProviders) {
                logger.info(`Trying embedding provider: ${provider.type} (priority: ${provider.priority})`);
                
                if (provider.type === 'nomic' && provider.apiKey) {
                    logger.info('✅ Creating Nomic embedding connector (highest priority)...');
                    return EmbeddingConnectorFactory.createConnector({
                        provider: 'nomic',
                        apiKey: provider.apiKey,
                        model: provider.embeddingModel || 'nomic-embed-text-v1.5'
                    });
                } else if (provider.type === 'ollama') {
                    logger.info('✅ Creating Ollama embedding connector (fallback)...');
                    const ollamaBaseUrl = process.env.OLLAMA_HOST || 'http://localhost:11434';
                    return EmbeddingConnectorFactory.createConnector({
                        provider: 'ollama',
                        baseUrl: ollamaBaseUrl,
                        model: provider.embeddingModel || 'nomic-embed-text'
                    });
                } else {
                    logger.info(`❌ Embedding provider ${provider.type} not available (missing API key or implementation)`);
                }
            }
            
            logger.info('⚠️ No configured embedding providers available, defaulting to Ollama');
            return EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
                model: 'nomic-embed-text'
            });
            
        } catch (error) {
            logger.warn('Failed to create configured embedding connector, falling back to Ollama:', error.message);
            // Fallback to Ollama for embeddings
            return EmbeddingConnectorFactory.createConnector({
                provider: 'ollama',
                baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
                model: 'nomic-embed-text'
            });
        }
    }

    /**
     * Get working model names from configuration
     */
    async getModelConfig(config) {
        try {
            // Get highest priority providers
            const llmProviders = config.get('llmProviders') || [];
            const chatProvider = llmProviders
                .filter(p => p.capabilities?.includes('chat'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
            const embeddingProvider = llmProviders
                .filter(p => p.capabilities?.includes('embedding'))
                .sort((a, b) => (a.priority || 999) - (b.priority || 999))[0];
            
            return {
                chatModel: chatProvider?.chatModel || 'qwen2:1.5b',
                embeddingModel: embeddingProvider?.embeddingModel || 'nomic-embed-text'
            };
        } catch (error) {
            logger.warn('Failed to get model config from configuration, using defaults:', error.message);
            return {
                chatModel: 'qwen2:1.5b',
                embeddingModel: 'nomic-embed-text'
            };
        }
    }

    /**
     * Initialize API endpoints
     */
    async initializeAPIs() {
        // Initialize Memory API
        const memoryApi = new MemoryAPI({
            registry: this.apiRegistry,
            logger: logger,
            similarityThreshold: 0.7,
            defaultLimit: 10
        });
        await memoryApi.initialize();

        // Initialize Chat API
        const chatApi = new ChatAPI({
            registry: this.apiRegistry,
            logger: logger,
            similarityThreshold: 0.7,
            contextWindow: 5
        });
        await chatApi.initialize();

        // Initialize Search API
        const searchApi = new SearchAPI({
            registry: this.apiRegistry,
            logger: logger,
            similarityThreshold: 0.7,
            defaultLimit: 5
        });
        await searchApi.initialize();

        // Initialize Ragno API
        const ragnoApi = new RagnoAPI({
            registry: this.apiRegistry,
            logger: logger,
            maxTextLength: 50000,
            maxBatchSize: 10,
            requestTimeout: 300000
        });
        await ragnoApi.initialize();

        // Initialize ZPT API
        const zptApi = new ZptAPI({
            registry: this.apiRegistry,
            logger: logger,
            maxConcurrentRequests: 10,
            requestTimeoutMs: 120000,
            defaultMaxTokens: 4000
        });
        await zptApi.initialize();

        // Store API handlers first
        this.apiContext.apis = {
            'memory-api': memoryApi,
            'chat-api': chatApi,
            'search-api': searchApi,
            'ragno-api': ragnoApi,
            'zpt-api': zptApi
        };

        // Initialize Unified Search API (depends on other APIs being available)
        const unifiedSearchApi = new UnifiedSearchAPI({
            registry: this.apiRegistry,
            logger: logger,
            defaultLimit: 20,
            enableParallelSearch: true,
            enableResultRanking: true,
            searchTimeout: 30000
        });
        await unifiedSearchApi.initialize();

        // Update API handlers with unified search
        this.apiContext.apis['unified-search-api'] = unifiedSearchApi;

        return { memoryApi, chatApi, searchApi, ragnoApi, zptApi, unifiedSearchApi };
    }

    /**
     * Set up API routes
     */
    setupRoutes() {
        const apiRouter = express.Router();

        // Memory API routes
        apiRouter.post('/memory', authenticateRequest, this.createHandler('memory-api', 'store'));
        apiRouter.get('/memory/search', authenticateRequest, this.createHandler('memory-api', 'search'));
        apiRouter.post('/memory/embedding', authenticateRequest, this.createHandler('memory-api', 'embedding'));
        apiRouter.post('/memory/concepts', authenticateRequest, this.createHandler('memory-api', 'concepts'));

        // Chat API routes
        apiRouter.post('/chat', authenticateRequest, this.createHandler('chat-api', 'chat'));
        apiRouter.post('/chat/stream', authenticateRequest, this.createStreamHandler('chat-api', 'stream'));
        apiRouter.post('/completion', authenticateRequest, this.createHandler('chat-api', 'completion'));

        // Search API routes
        apiRouter.get('/search', authenticateRequest, this.createHandler('search-api', 'search'));
        apiRouter.post('/index', authenticateRequest, this.createHandler('search-api', 'index'));

        // Ragno API routes
        apiRouter.post('/graph/decompose', authenticateRequest, this.createHandler('ragno-api', 'decompose'));
        apiRouter.get('/graph/stats', authenticateRequest, this.createHandler('ragno-api', 'stats'));
        apiRouter.get('/graph/entities', authenticateRequest, this.createHandler('ragno-api', 'entities'));
        apiRouter.post('/graph/search', authenticateRequest, this.createHandler('ragno-api', 'search'));
        apiRouter.get('/graph/export/:format', authenticateRequest, this.createHandler('ragno-api', 'export'));
        apiRouter.post('/graph/enrich', authenticateRequest, this.createHandler('ragno-api', 'enrich'));
        apiRouter.get('/graph/communities', authenticateRequest, this.createHandler('ragno-api', 'communities'));
        apiRouter.post('/graph/pipeline', authenticateRequest, this.createHandler('ragno-api', 'pipeline'));

        // ZPT API routes
        apiRouter.post('/navigate', authenticateRequest, this.createHandler('zpt-api', 'navigate'));
        apiRouter.post('/navigate/preview', authenticateRequest, this.createHandler('zpt-api', 'preview'));
        apiRouter.get('/navigate/options', this.createHandler('zpt-api', 'options'));
        apiRouter.get('/navigate/schema', this.createHandler('zpt-api', 'schema'));
        apiRouter.get('/navigate/health', this.createHandler('zpt-api', 'health'));

        // Unified Search API routes
        apiRouter.post('/search/unified', authenticateRequest, this.createHandler('unified-search-api', 'unified'));
        apiRouter.post('/search/analyze', authenticateRequest, this.createHandler('unified-search-api', 'analyze'));
        apiRouter.get('/search/services', this.createHandler('unified-search-api', 'services'));
        apiRouter.get('/search/strategies', this.createHandler('unified-search-api', 'strategies'));

        // Service Discovery endpoint
        apiRouter.get('/services', (req, res) => {
            try {
                const services = {
                    basic: {
                        memory: {
                            name: 'Memory API',
                            description: 'Semantic memory management and retrieval',
                            endpoints: [
                                'POST /api/memory - Store interactions',
                                'GET /api/memory/search - Search memories',
                                'POST /api/memory/embedding - Generate embeddings',
                                'POST /api/memory/concepts - Extract concepts'
                            ],
                            status: this.apiContext.apis['memory-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        chat: {
                            name: 'Chat API', 
                            description: 'Conversational AI and completion',
                            endpoints: [
                                'POST /api/chat - Chat completion',
                                'POST /api/chat/stream - Streaming chat',
                                'POST /api/completion - Text completion'
                            ],
                            status: this.apiContext.apis['chat-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        search: {
                            name: 'Search API',
                            description: 'Content search and indexing',
                            endpoints: [
                                'GET /api/search - Search content',
                                'POST /api/index - Index content'
                            ],
                            status: this.apiContext.apis['search-api']?.initialized ? 'healthy' : 'unavailable'
                        }
                    },
                    advanced: {
                        ragno: {
                            name: 'Ragno Knowledge Graph API',
                            description: 'Knowledge graph operations and entity management',
                            endpoints: [
                                'POST /api/graph/decompose - Decompose text to entities',
                                'GET /api/graph/stats - Graph statistics',
                                'GET /api/graph/entities - Get entities',
                                'POST /api/graph/search - Search knowledge graph',
                                'GET /api/graph/export/{format} - Export graph data',
                                'POST /api/graph/enrich - Enrich graph with embeddings',
                                'GET /api/graph/communities - Get communities',
                                'POST /api/graph/pipeline - Full ragno pipeline'
                            ],
                            status: this.apiContext.apis['ragno-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        zpt: {
                            name: 'ZPT Navigation API',
                            description: 'Zero-Point Traversal corpus navigation',
                            endpoints: [
                                'POST /api/navigate - Main navigation',
                                'POST /api/navigate/preview - Navigation preview',
                                'GET /api/navigate/options - Navigation options',
                                'GET /api/navigate/schema - Parameter schema',
                                'GET /api/navigate/health - ZPT health check'
                            ],
                            status: this.apiContext.apis['zpt-api']?.initialized ? 'healthy' : 'unavailable'
                        },
                        unified: {
                            name: 'Unified Search API',
                            description: 'Cross-service intelligent search',
                            endpoints: [
                                'POST /api/search/unified - Unified search across all services',
                                'POST /api/search/analyze - Analyze search query',
                                'GET /api/search/services - Get available services',
                                'GET /api/search/strategies - Get search strategies'
                            ],
                            status: this.apiContext.apis['unified-search-api']?.initialized ? 'healthy' : 'unavailable'
                        }
                    },
                    system: {
                        config: 'GET /api/config - Get system configuration',
                        health: 'GET /api/health - System health check',
                        metrics: 'GET /api/metrics - System metrics',
                        services: 'GET /api/services - This service discovery endpoint'
                    }
                };

                const summary = {
                    totalServices: Object.keys(services.basic).length + Object.keys(services.advanced).length,
                    healthyServices: Object.values({...services.basic, ...services.advanced})
                        .filter(service => service.status === 'healthy').length,
                    totalEndpoints: Object.values({...services.basic, ...services.advanced})
                        .reduce((total, service) => total + service.endpoints.length, 0) + 4 // system endpoints
                };

                res.json({
                    success: true,
                    summary,
                    services,
                    timestamp: new Date().toISOString(),
                    serverVersion: process.env.npm_package_version || '1.0.0'
                });
            } catch (error) {
                logger.error('Service discovery error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Failed to retrieve service information'
                });
            }
        });

        // Config endpoint
        apiRouter.get('/config', (req, res) => {
            try {
                const config = Config.createFromFile();
                config.init().then(() => {
                    // Send sanitized config (no passwords)
                    const safeConfig = {
                        storage: {
                            availableTypes: ['memory', 'json', 'sparql', 'inmemory'],
                            current: config.get('storage.type') || 'memory'
                        },
                        models: {
                            chat: config.get('models.chat') || {},
                            embedding: config.get('models.embedding') || {}
                        },
                        sparqlEndpoints: (() => {
                            const endpoints = [];
                            
                            // Add endpoints from Config.js defaults (urlBase format)
                            const configEndpoints = config.get('sparqlEndpoints');
                            if (configEndpoints && configEndpoints.length > 0) {
                                configEndpoints.forEach(ep => {
                                    if (ep.urlBase) {
                                        endpoints.push({
                                            label: ep.label,
                                            urlBase: ep.urlBase,
                                            dataset: ep.dataset,
                                            queryEndpoint: `${ep.urlBase}${ep.query}`,
                                            updateEndpoint: `${ep.urlBase}${ep.update}`
                                        });
                                    }
                                });
                            }
                            
                            // Add endpoints from config.json (queryEndpoint format)
                            const fileEndpoints = config.config.sparqlEndpoints;
                            if (fileEndpoints && fileEndpoints.length > 0) {
                                fileEndpoints.forEach((ep, index) => {
                                    if (ep.queryEndpoint) {
                                        const urlBase = ep.queryEndpoint.replace('/semem/query', '');
                                        endpoints.push({
                                            label: `JSON Config Endpoint ${index + 1}`,
                                            urlBase: urlBase,
                                            dataset: 'semem',
                                            queryEndpoint: ep.queryEndpoint,
                                            updateEndpoint: ep.updateEndpoint,
                                            auth: ep.auth ? {
                                                user: ep.auth.user
                                            } : null
                                        });
                                    }
                                });
                            }
                            
                            return endpoints;
                        })(),
                        llmProviders: config.config.llmProviders ? 
                            config.config.llmProviders.map(p => ({
                                type: p.type,
                                implementation: p.implementation,
                                capabilities: p.capabilities,
                                description: p.description,
                                priority: p.priority,
                                chatModel: p.chatModel,
                                embeddingModel: p.embeddingModel
                            })) : [],
                        // Add top-level model defaults from file config
                        defaultChatModel: config.config.chatModel,
                        defaultEmbeddingModel: config.config.embeddingModel
                    };
                    
                    res.json({
                        success: true,
                        data: safeConfig
                    });
                }).catch(error => {
                    logger.error('Config initialization error:', error);
                    res.status(500).json({
                        success: false,
                        error: 'Failed to load configuration'
                    });
                });
            } catch (error) {
                logger.error('Config endpoint error:', error);
                res.status(500).json({
                    success: false,
                    error: 'Internal server error'
                });
            }
        });

        // Health check endpoint
        apiRouter.get('/health', (req, res) => {
            const components = {
                memory: { status: 'healthy' },
                embedding: { status: 'healthy' },
                llm: { status: 'healthy' }
            };

            // Add API handlers status
            Object.entries(this.apiContext.apis).forEach(([name, api]) => {
                components[name] = {
                    status: api.initialized ? 'healthy' : 'degraded'
                };
            });

            res.json({
                status: 'healthy',
                timestamp: Date.now(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                components
            });
        });

        // Metrics endpoint
        apiRouter.get('/metrics', authenticateRequest, async (req, res, next) => {
            try {
                const metrics = {
                    timestamp: Date.now(),
                    apiCount: Object.keys(this.apiContext.apis).length
                };

                // Get metrics from API handlers
                for (const [name, api] of Object.entries(this.apiContext.apis)) {
                    if (typeof api.getMetrics === 'function') {
                        metrics[name] = await api.getMetrics();
                    }
                }

                res.json({
                    success: true,
                    data: metrics
                });
            } catch (error) {
                logger.error('Error fetching metrics:', error);
                next(error);
            }
        });

        // Mount API router
        this.app.use('/api', apiRouter);

        // Serve webpack-built static files
        logger.info(`Serving static files from: ${this.distDir}`);
        this.app.use(express.static(this.distDir));

        // Root route for web UI (webpack-built index.html)
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(this.distDir, 'index.html'));
        });

        // Handle 404 errors
        this.app.use((req, res, next) => {
            next(new NotFoundError('Endpoint not found'));
        });

        // Error handling
        this.app.use(errorHandler(logger));
    }

    /**
     * Helper function to create route handlers
     */
    createHandler(apiName, operation) {
        return async (req, res, next) => {
            try {
                const api = this.apiContext.apis[apiName];
                if (!api) {
                    throw new Error(`API handler not found: ${apiName}`);
                }

                // Get parameters from appropriate source
                const params = req.method === 'GET' ? req.query : req.body;
                
                // Include route parameters if they exist
                if (req.params && Object.keys(req.params).length > 0) {
                    Object.assign(params, req.params);
                }

                // Execute operation
                const result = await api.executeOperation(operation, params);

                // Determine status code based on operation
                let statusCode = 200;
                if (operation === 'store' || operation === 'index') {
                    statusCode = 201; // Created
                }

                res.status(statusCode).json({
                    success: true,
                    ...result
                });
            } catch (error) {
                logger.error(`Error in ${apiName}.${operation}:`, error);
                next(error);
            }
        };
    }

    /**
     * Helper function to create streaming route handlers
     */
    createStreamHandler(apiName, operation) {
        return async (req, res, next) => {
            try {
                const api = this.apiContext.apis[apiName];
                if (!api) {
                    throw new Error(`API handler not found: ${apiName}`);
                }

                // Set response headers for streaming
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');

                // Execute streaming operation
                const stream = await api.executeOperation(operation, req.body);

                // Handle stream events
                stream.on('data', chunk => {
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
                });

                stream.on('end', () => {
                    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                    res.end();
                });

                stream.on('error', error => {
                    logger.error(`Stream error in ${apiName}.${operation}:`, error);
                    next(error);
                });

                // Handle client disconnect
                req.on('close', () => {
                    if (typeof stream.destroy === 'function') {
                        stream.destroy();
                    }
                });
            } catch (error) {
                logger.error(`Error in ${apiName}.${operation}:`, error);
                next(error);
            }
        };
    }

    /**
     * Setup signal handlers for graceful shutdown
     */
    setupSignalHandlers() {
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}, shutting down...`);

            // Close the HTTP server
            if (this.server) {
                this.server.close(() => {
                    logger.info('HTTP server shut down');
                });
            }

            // Shutdown API handlers
            if (this.apiContext.apis) {
                for (const api of Object.values(this.apiContext.apis)) {
                    if (typeof api.shutdown === 'function') {
                        try {
                            await api.shutdown();
                        } catch (error) {
                            logger.error('Error shutting down API:', error);
                        }
                    }
                }
            }

            // Dispose memory manager if it exists
            if (this.apiContext.memory && typeof this.apiContext.memory.dispose === 'function') {
                try {
                    await this.apiContext.memory.dispose();
                    logger.info('Memory manager disposed');
                } catch (error) {
                    logger.error('Error disposing memory manager:', error);
                }
            }

            process.exit(0);
        };

        // Register signal handlers
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }

    /**
     * Start the API server
     */
    async start() {
        try {
            logger.info('Initializing Semem API Server...');

            // Initialize components and APIs
            await this.initializeComponents();
            await this.initializeAPIs();

            // Set up routes
            await this.setupRoutes();

            // Set up signal handlers for graceful shutdown
            this.setupSignalHandlers();

            // Start the server
            this.server = this.app.listen(this.port, () => {
                logger.info(`Semem API Server is running at http://localhost:${this.port}`);
            });

            return this.server;
        } catch (error) {
            logger.error('Failed to start Semem API Server:', error);
            process.exit(1);
        }
    }
}

// Create and start the server
const apiServer = new APIServer();
apiServer.start().catch(error => {
    logger.error('Failed to start server:', error);
    process.exit(1);
});