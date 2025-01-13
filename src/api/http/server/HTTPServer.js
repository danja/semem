import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import BaseAPI from '../../common/BaseAPI.js';
import { APIRegistry } from '../../common/APIRegistry.js';

export default class HTTPServer extends BaseAPI {
    constructor(config = {}) {
        super(config);
        this.app = express();
        this.registry = new APIRegistry();
        this.port = config.port || 3000;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Security and optimization middleware
        this.app.use(helmet());
        this.app.use(cors());
        this.app.use(compression());
        this.app.use(express.json());
        
        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false
        });
        this.app.use(limiter);

        // Request logging
        this.app.use((req, res, next) => {
            this.logger.debug(`${req.method} ${req.path}`);
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                this._emitMetric('http.request.duration', duration);
                this._emitMetric('http.request.status', res.statusCode);
            });
            next();
        });

        // Error handling
        this.app.use((err, req, res, next) => {
            this.logger.error('Server error:', err);
            res.status(500).json({
                success: false,
                error: err.message,
                metadata: {
                    timestamp: Date.now(),
                    path: req.path
                }
            });
        });
    }

    setupRoutes() {
        // API Documentation
        if (this.config.openapi) {
            this.app.use('/docs', swaggerUi.serve, 
                swaggerUi.setup(this.config.openapi));
        }

        // Chat endpoints
        this.app.post('/api/chat', async (req, res) => {
            try {
                const api = this.registry.get('chat');
                const response = await api.executeOperation('chat', req.body);
                res.json({
                    success: true,
                    data: response
                });
            } catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Storage endpoints
        this.app.post('/api/store', async (req, res) => {
            try {
                const api = this.registry.get('storage');
                await api.storeInteraction(req.body);
                res.json({ success: true });
            } catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Query endpoints
        this.app.get('/api/query', async (req, res) => {
            try {
                const api = this.registry.get('storage');
                const results = await api.retrieveInteractions(req.query);
                res.json({
                    success: true,
                    data: results
                });
            } catch (error) {
                res.status(400).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Metrics endpoint
        this.app.get('/api/metrics', async (req, res) => {
            try {
                const metrics = await this.getMetrics();
                res.json({
                    success: true,
                    data: metrics
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: Date.now(),
                uptime: process.uptime()
            });
        });
    }

    async initialize() {
        await super.initialize();
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
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
        await super.shutdown();
    }
}
