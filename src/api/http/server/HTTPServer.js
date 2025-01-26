// src/api/http/server/HTTPServer.js
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import compression from 'compression'
import swaggerUi from 'swagger-ui-express'
import APIRegistry from '../../common/APIRegistry.js'
import BaseAPI from '../../common/BaseAPI.js'
import { authenticateRequest } from '../middleware/auth.js'
import { errorHandler } from '../middleware/error.js'
import { requestLogger } from '../middleware/logging.js'
import apiSpec from './openapi-schema.js'

export default class HTTPServer extends BaseAPI {
    constructor(config = {}) {
        super(config)
        this.app = express()
        this.registry = new APIRegistry()
        this.port = config.port || 3000
        this.setupMiddleware()
        this.setupRoutes()
        this.setupErrorHandling()
    }

    setupMiddleware() {
        // Security
        this.app.use(helmet())
        this.app.use(cors(this.config.cors))

        // Performance
        this.app.use(compression())
        this.app.use(express.json({ limit: '1mb' }))

        // Rate limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 100,
            standardHeaders: true,
            legacyHeaders: false,
            message: 'Too many requests, please try again later.'
        })
        this.app.use('/api/', limiter)

        // Logging and metrics
        this.app.use(requestLogger(this.logger))
        this.app.use((req, res, next) => {
            const start = Date.now()
            res.on('finish', () => {
                this._emitMetric('http.request.duration', Date.now() - start)
                this._emitMetric('http.response.status', res.statusCode)
            })
            next()
        })
    }

    setupRoutes() {
        // API Documentation
        this.app.use('/docs', swaggerUi.serve, swaggerUi.setup(apiSpec))

        // API Routes
        const apiRouter = express.Router()

        // Memory operations
        apiRouter.post('/memory', authenticateRequest, async (req, res, next) => {
            try {
                const memoryAPI = this.registry.get('memory')
                const result = await memoryAPI.storeInteraction(req.body)
                res.json({ success: true, data: result })
            } catch (error) {
                next(error)
            }
        })

        apiRouter.get('/memory/search', authenticateRequest, async (req, res, next) => {
            try {
                const memoryAPI = this.registry.get('memory')
                const results = await memoryAPI.retrieveInteractions(req.query)
                res.json({ success: true, data: results })
            } catch (error) {
                next(error)
            }
        })

        // Chat operations
        apiRouter.post('/chat', authenticateRequest, async (req, res, next) => {
            try {
                const chatAPI = this.registry.get('chat')
                const response = await chatAPI.executeOperation('chat', req.body)
                res.json({ success: true, data: response })
            } catch (error) {
                next(error)
            }
        })

        // Streaming chat
        apiRouter.post('/chat/stream', authenticateRequest, async (req, res, next) => {
            try {
                const chatAPI = this.registry.get('chat')
                res.setHeader('Content-Type', 'text/event-stream')
                res.setHeader('Cache-Control', 'no-cache')
                res.setHeader('Connection', 'keep-alive')

                const stream = await chatAPI.executeOperation('stream', req.body)
                stream.on('data', chunk => {
                    res.write(`data: ${JSON.stringify(chunk)}\n\n`)
                })
                stream.on('end', () => res.end())
                stream.on('error', error => next(error))
            } catch (error) {
                next(error)
            }
        })

        // Metrics and monitoring
        apiRouter.get('/metrics', authenticateRequest, async (req, res, next) => {
            try {
                const metrics = await this.getMetrics()
                res.json({ success: true, data: metrics })
            } catch (error) {
                next(error)
            }
        })

        // Health check
        apiRouter.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: Date.now(),
                uptime: process.uptime()
            })
        })

        this.app.use('/api', apiRouter)
    }

    setupErrorHandling() {
        this.app.use(errorHandler(this.logger))
    }

    async initialize() {
        await super.initialize()
        return new Promise((resolve) => {
            this.server = this.app.listen(this.port, () => {
                this.wsServer = new MemoryWebSocketServer(this.server)

                // Notify clients of memory updates
                this.registry.on('memoryUpdate', (interaction) => {
                    this.wsServer.notifyUpdate(interaction)
                })

                this.logger.info(`HTTP server listening on port ${this.port}`)
                resolve()
            })
        })
    }

    async shutdown() {
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve)
            })
            this.logger.info('HTTP server shut down')
        }
        await super.shutdown()
    }
}