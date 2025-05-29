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
import Config from '../src/Config.js';
import MemoryManager from '../src/MemoryManager.js';
import OllamaConnector from '../src/connectors/OllamaConnector.js';
import LLMHandler from '../src/handlers/LLMHandler.js';
import EmbeddingHandler from '../src/handlers/EmbeddingHandler.js';
import CacheManager from '../src/handlers/CacheManager.js';
import APIRegistry from '../src/api/common/APIRegistry.js';
import { authenticateRequest } from '../src/api/http/middleware/auth.js';
import { errorHandler, NotFoundError } from '../src/api/http/middleware/error.js';
import { requestLogger } from '../src/api/http/middleware/logging.js';
import MemoryAPI from '../src/api/features/MemoryAPI.js';
import ChatAPI from '../src/api/features/ChatAPI.js';
import SearchAPI from '../src/api/features/SearchAPI.js';

// Load environment variables
dotenv.config();

// Configure logging
logger.setLevel(process.env.LOG_LEVEL || 'info');

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(path.dirname(__filename)); // Go up one level to project root

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
        // Create LLM provider
        const ollamaBaseUrl = process.env.OLLAMA_API_BASE || 'http://localhost:11434';
        const llmProvider = new OllamaConnector(ollamaBaseUrl);

        // Define models to use
        const embeddingModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
        const chatModel = process.env.CHAT_MODEL || 'qwen3:0.6b';

        // Initialize cache manager
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });

        // Initialize handlers
        const embeddingHandler = new EmbeddingHandler(
            llmProvider,
            embeddingModel,
            1536, // Default dimension
            cacheManager
        );

        const llmHandler = new LLMHandler(llmProvider, chatModel);

        // Initialize memory manager
        const memoryManager = new MemoryManager({
            llmProvider,
            chatModel,
            embeddingModel
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
                throw new Error(`Unknown component: ${key}`);
            }
        };

        return { memoryManager, embeddingHandler, llmHandler };
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

        // Store API handlers
        this.apiContext.apis = {
            'memory-api': memoryApi,
            'chat-api': chatApi,
            'search-api': searchApi
        };

        return { memoryApi, chatApi, searchApi };
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
                        sparqlEndpoints: config.get('sparqlEndpoints') ? 
                            config.get('sparqlEndpoints').map(ep => ({
                                label: ep.label,
                                urlBase: ep.urlBase,
                                dataset: ep.dataset
                            })) : [],
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