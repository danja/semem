// src/api/http/server/HTTPServer.js
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import path from 'path';

// Set up __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { v4 as uuidv4 } from 'uuid';
import APIRegistry from '../../common/APIRegistry.js';
import BaseAPI from '../../common/BaseAPI.js';
import { authenticateRequest } from '../middleware/auth.js';
import { errorHandler, NotFoundError } from '../middleware/error.js';
import { requestLogger } from '../middleware/logging.js';
import apiSpec from './openapi-schema.js';
import WebSocketServer from './WebSocketServer.js';

// Import API handlers
import MemoryAPI from '../../features/MemoryAPI.js';
import ChatAPI from '../../features/ChatAPI.js';
import SearchAPI from '../../features/SearchAPI.js';

export default class HTTPServer extends BaseAPI {
    constructor(config = {}) {
        super(config);
        this.app = express();
        this.registry = new APIRegistry();
        this.port = config.port || 3000;
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Request ID
        this.app.use((req, res, next) => {
            req.id = uuidv4();
            next();
        });

        // Security
        this.app.use(helmet());
        this.app.use(cors(this.config.cors));

        // Performance
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

        // Logging and metrics
        this.app.use(requestLogger(this.logger));
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                this._emitMetric('http.request.duration', Date.now() - start);
                this._emitMetric('http.response.status', res.statusCode);
            });
            next();
        });
        
        // Serve static files from public directory
        const publicDir = path.join(__dirname, '..', '..', '..', '..', 'public');
        this.logger.info(`Serving static files from: ${publicDir}`);
        this.app.use(express.static(publicDir));
    }

    setupRoutes() {
        // API Documentation
        this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(apiSpec));

        // API Routes
        const apiRouter = express.Router();

        // Memory API routes
        apiRouter.post('/memory', authenticateRequest, this._createHandler('memory', 'store'));
        apiRouter.get('/memory/search', authenticateRequest, this._createHandler('memory', 'search'));
        apiRouter.post('/memory/embedding', authenticateRequest, this._createHandler('memory', 'embedding'));
        apiRouter.post('/memory/concepts', authenticateRequest, this._createHandler('memory', 'concepts'));

        // Chat API routes
        apiRouter.post('/chat', authenticateRequest, this._createHandler('chat', 'chat'));
        apiRouter.post('/chat/stream', authenticateRequest, this._createStreamHandler('chat', 'stream'));
        apiRouter.post('/completion', authenticateRequest, this._createHandler('chat', 'completion'));

        // Search API routes
        apiRouter.get('/search', authenticateRequest, this._createHandler('search', 'search'));
        apiRouter.post('/index', authenticateRequest, this._createHandler('search', 'index'));

        // Metrics and monitoring
        apiRouter.get('/metrics', authenticateRequest, async (req, res, next) => {
            try {
                // Collect metrics from all APIs
                const metrics = {
                    timestamp: Date.now(),
                    apiCount: this.registry.getAll().size
                };

                for (const [name, api] of this.registry.getAll().entries()) {
                    if (typeof api.getMetrics === 'function') {
                        metrics[name] = await api.getMetrics();
                    }
                }

                res.json({ 
                    success: true, 
                    data: metrics 
                });
            } catch (error) {
                next(error);
            }
        });

        // Health check
        apiRouter.get('/health', (req, res) => {
            const components = {};
            
            for (const [name, api] of this.registry.getAll().entries()) {
                components[name] = {
                    status: api.initialized ? 'healthy' : 'degraded'
                };
            }
            
            res.json({
                status: 'healthy',
                timestamp: Date.now(),
                uptime: process.uptime(),
                version: process.env.npm_package_version || '1.0.0',
                components
            });
        });

        this.app.use('/api', apiRouter);
        
        // Add root route for the web UI
        this.app.get('/', (req, res) => {
            // Using the publicDir from setupMiddleware
            const publicDir = path.join(__dirname, '..', '..', '..', '..', 'public');
            res.sendFile(path.join(publicDir, 'index.html'));
        });

        // Handle 404 errors
        this.app.use((req, res, next) => {
            next(new NotFoundError('Endpoint not found'));
        });
    }

    setupErrorHandling() {
        this.app.use(errorHandler(this.logger));
    }

    // Helper to create route handlers
    _createHandler(apiName, operation) {
        return async (req, res, next) => {
            try {
                const api = this.registry.get(apiName);
                
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
                next(error);
            }
        };
    }

    // Helper to create streaming handlers
    _createStreamHandler(apiName, operation) {
        return async (req, res, next) => {
            try {
                const api = this.registry.get(apiName);
                
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
                    next(error);
                });
                
                // Handle client disconnect
                req.on('close', () => {
                    if (typeof stream.destroy === 'function') {
                        stream.destroy();
                    }
                });
            } catch (error) {
                next(error);
            }
        };
    }

    async initialize() {
        await super.initialize();
        
        // Register API handlers
        await this.registry.register('memory', MemoryAPI, {
            ...this.config.memory,
            registry: this.registry
        });
        
        await this.registry.register('chat', ChatAPI, {
            ...this.config.chat,
            registry: this.registry
        });
        
        await this.registry.register('search', SearchAPI, {
            ...this.config.search,
            registry: this.registry
        });
        
        // Start HTTP server
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                // Initialize WebSocket server if needed
                if (this.config.enableWebSocket) {
                    this.wsServer = new WebSocketServer(this.server);
                    
                    // Notify clients of memory updates
                    this.registry.on('memoryUpdate', (interaction) => {
                        this.wsServer.notifyUpdate(interaction);
                    });
                }
                
                this.logger.info(`HTTP server listening on port ${this.port}`);
                resolve();
            });
        });
    }

    async shutdown() {
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve);
            });
            this.logger.info('HTTP server shut down');
        }
        
        await this.registry.shutdownAll();
        await super.shutdown();
    }
}