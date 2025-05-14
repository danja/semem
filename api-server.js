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
import MemoryManager from './src/MemoryManager.js';
import OllamaConnector from './src/connectors/OllamaConnector.js';
import LLMHandler from './src/handlers/LLMHandler.js';
import EmbeddingHandler from './src/handlers/EmbeddingHandler.js';
import CacheManager from './src/handlers/CacheManager.js';
import APIRegistry from './src/api/common/APIRegistry.js';
import { authenticateRequest } from './src/api/http/middleware/auth.js';
import { errorHandler, NotFoundError } from './src/api/http/middleware/error.js';
import { requestLogger } from './src/api/http/middleware/logging.js';
import MemoryAPI from './src/api/features/MemoryAPI.js';
import ChatAPI from './src/api/features/ChatAPI.js';
import SearchAPI from './src/api/features/SearchAPI.js';

// Load environment variables
dotenv.config();

// Configure logging
logger.setLevel(process.env.LOG_LEVEL || 'info');

// Get directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port configuration
const PORT = process.env.PORT || 3000;

// Initialize API Registry
const registry = new APIRegistry();

// Define apiContext globally so it can be accessed by handler functions
let apiContext = {};

/**
 * Main function to start the server
 */
async function startServer() {
    try {
        logger.info('Initializing Semem API Server...');
        
        // Create Express app
        const app = express();
        const publicDir = path.join(__dirname, 'public');
        
        // Basic middleware
        app.use((req, res, next) => {
            req.id = uuidv4();
            next();
        });
        
        // Security and performance middleware
        app.use(helmet({
            contentSecurityPolicy: false // Disable for development
        }));
        app.use(cors({
            origin: '*', // For development
            methods: ['GET', 'POST', 'PUT', 'DELETE'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
        }));
        app.use(compression());
        app.use(express.json({ limit: '1mb' }));
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
            message: 'Too many requests, please try again later.'
        });
        app.use('/api/', limiter);
        
        // Logging
        app.use(requestLogger(logger));
        
        // Serve static files
        logger.info(`Serving static files from: ${publicDir}`);
        app.use(express.static(publicDir));
        
        // Create LLM provider
        const ollamaBaseUrl = process.env.OLLAMA_API_BASE || 'http://localhost:11434';
        const llmProvider = new OllamaConnector(ollamaBaseUrl);
        
        // Define models to use
        const embeddingModel = process.env.EMBEDDING_MODEL || 'nomic-embed-text';
        const chatModel = process.env.CHAT_MODEL || 'qwen3:0.6b'; // Updated to use available model
        
        // Initialize components
        const cacheManager = new CacheManager({
            maxSize: 1000,
            ttl: 3600000 // 1 hour
        });
        
        // Initialize handlers directly
        const embeddingHandler = new EmbeddingHandler(
            llmProvider,
            embeddingModel,
            1536, // Default dimension
            cacheManager
        );
        
        const llmHandler = new LLMHandler(
            llmProvider,
            chatModel
        );
        
        // Initialize memory manager
        const memoryManager = new MemoryManager({
            llmProvider,
            chatModel,
            embeddingModel
        });
        
        // We'll use simple objects to store core components rather than the registry
        // Update the global apiContext instead of redefining it
        apiContext.memory = memoryManager;
        apiContext.embedding = embeddingHandler;
        apiContext.llm = llmHandler;
        
        // Create custom registry for compatibility with the API handlers
        const apiRegistry = {
            get: (key) => {
                if (key === 'memory') return apiContext.memory;
                if (key === 'embedding') return apiContext.embedding;
                if (key === 'llm') return apiContext.llm;
                throw new Error(`Unknown component: ${key}`);
            }
        };
        
        // Register API handlers
        const memoryApi = new MemoryAPI({
            registry: apiRegistry,
            logger: logger,
            similarityThreshold: 0.7,
            defaultLimit: 10
        });
        await memoryApi.initialize();
        
        const chatApi = new ChatAPI({
            registry: apiRegistry,
            logger: logger,
            similarityThreshold: 0.7,
            contextWindow: 5
        });
        await chatApi.initialize();
        
        const searchApi = new SearchAPI({
            registry: apiRegistry,
            logger: logger,
            similarityThreshold: 0.7,
            defaultLimit: 5
        });
        await searchApi.initialize();
        
        // Store API handlers for route handling
        apiContext.apis = {
            'memory-api': memoryApi,
            'chat-api': chatApi,
            'search-api': searchApi
        };
        
        // Set up API routes
        const apiRouter = express.Router();
        
        // Memory API routes
        apiRouter.post('/memory', authenticateRequest, createHandler('memory-api', 'store'));
        apiRouter.get('/memory/search', authenticateRequest, createHandler('memory-api', 'search'));
        apiRouter.post('/memory/embedding', authenticateRequest, createHandler('memory-api', 'embedding'));
        apiRouter.post('/memory/concepts', authenticateRequest, createHandler('memory-api', 'concepts'));

        // Chat API routes
        apiRouter.post('/chat', authenticateRequest, createHandler('chat-api', 'chat'));
        apiRouter.post('/chat/stream', authenticateRequest, createStreamHandler('chat-api', 'stream'));
        apiRouter.post('/completion', authenticateRequest, createHandler('chat-api', 'completion'));

        // Search API routes
        apiRouter.get('/search', authenticateRequest, createHandler('search-api', 'search'));
        apiRouter.post('/index', authenticateRequest, createHandler('search-api', 'index'));
        
        // Health check
        apiRouter.get('/health', (req, res) => {
            const components = {
                memory: { status: 'healthy' },
                embedding: { status: 'healthy' },
                llm: { status: 'healthy' }
            };
            
            // Add API handlers
            Object.entries(apiContext.apis).forEach(([name, api]) => {
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
        
        // API metrics
        apiRouter.get('/metrics', authenticateRequest, async (req, res, next) => {
            try {
                const metrics = {
                    timestamp: Date.now(),
                    apiCount: Object.keys(apiContext.apis).length
                };

                // Get metrics from API handlers
                for (const [name, api] of Object.entries(apiContext.apis)) {
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
        app.use('/api', apiRouter);
        
        // Root route for web UI
        app.get('/', (req, res) => {
            res.sendFile(path.join(publicDir, 'index.html'));
        });
        
        // Handle 404 errors
        app.use((req, res, next) => {
            next(new NotFoundError('Endpoint not found'));
        });
        
        // Error handling
        app.use(errorHandler(logger));
        
        // Start the server
        const server = app.listen(PORT, () => {
            logger.info(`Semem API Server is running at http://localhost:${PORT}`);
        });
        
        // Handle server shutdown
        process.on('SIGTERM', async () => {
            logger.info('Received SIGTERM, shutting down...');
            server.close(() => {
                logger.info('HTTP server shut down');
            });
            
            // Shutdown API handlers
            for (const api of Object.values(apiContext.apis)) {
                if (typeof api.shutdown === 'function') {
                    try {
                        await api.shutdown();
                    } catch (error) {
                        logger.error('Error shutting down API:', error);
                    }
                }
            }
            
            // Dispose memory manager
            if (memoryManager && typeof memoryManager.dispose === 'function') {
                try {
                    await memoryManager.dispose();
                    logger.info('Memory manager disposed');
                } catch (error) {
                    logger.error('Error disposing memory manager:', error);
                }
            }
            
            process.exit(0);
        });
        
        process.on('SIGINT', async () => {
            logger.info('Received SIGINT, shutting down...');
            server.close(() => {
                logger.info('HTTP server shut down');
            });
            
            // Shutdown API handlers
            for (const api of Object.values(apiContext.apis)) {
                if (typeof api.shutdown === 'function') {
                    try {
                        await api.shutdown();
                    } catch (error) {
                        logger.error('Error shutting down API:', error);
                    }
                }
            }
            
            // Dispose memory manager
            if (memoryManager && typeof memoryManager.dispose === 'function') {
                try {
                    await memoryManager.dispose();
                    logger.info('Memory manager disposed');
                } catch (error) {
                    logger.error('Error disposing memory manager:', error);
                }
            }
            
            process.exit(0);
        });
        
    } catch (error) {
        logger.error('Failed to start Semem API Server:', error);
        process.exit(1);
    }
}

// Helper function to create route handlers
function createHandler(apiName, operation) {
    return async (req, res, next) => {
        try {
            const api = apiContext.apis[apiName];
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

// Helper function to create streaming route handlers
function createStreamHandler(apiName, operation) {
    return async (req, res, next) => {
        try {
            const api = apiContext.apis[apiName];
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

// Start the server
startServer();