import { EventEmitter } from 'events'
import log from 'loglevel'
import APIRegistry from '../common/APIRegistry.js'
import BaseAPI from '../common/BaseAPI.js'

export default class SelfieHandler extends BaseAPI {
    constructor(config = {}) {
        super(config)
        this.registry = new APIRegistry()
        this.metrics = new Map()
        this.errors = new Map()
        this.interval = config.interval || 60000
        this.eventBus = new EventEmitter()
        this.setupMetricCollectors()
    }

    setupMetricCollectors() {
        this.collectors = {
            storage: {
                collect: async () => {
                    const api = this.registry.get('storage')
                    const metrics = await api.getMetrics()
                    return {
                        size: metrics.size || 0,
                        operations: metrics.operations || 0,
                        latency: metrics.latency || 0
                    }
                },
                labels: ['size', 'operations', 'latency']
            },
            performance: {
                collect: () => ({
                    memory: process.memoryUsage(),
                    cpu: process.cpuUsage(),
                    uptime: process.uptime()
                }),
                labels: ['memory', 'cpu', 'uptime']
            },
            api: {
                collect: async () => {
                    const apis = this.registry.getAll()
                    const metrics = {}
                    for (const [name, api] of apis) {
                        metrics[name] = await api.getMetrics()
                    }
                    return metrics
                },
                labels: ['status', 'requests', 'errors']
            }
        }
    }

    async initialize() {
        await super.initialize()

        // Start metric collection
        this.collectionTimer = setInterval(
            () => this.collectMetrics(),
            this.interval
        )

        // Error event listeners
        process.on('uncaughtException', (error) => {
            this.trackError('uncaughtException', error)
        })

        process.on('unhandledRejection', (error) => {
            this.trackError('unhandledRejection', error)
        })

        // Set up OpenTelemetry if configured
        if (this.config.openTelemetry) {
            await this.setupOpenTelemetry()
        }

        this.logger.info('SelfieHandler initialized')
    }

    async setupOpenTelemetry() {
        // Basic OpenTelemetry setup - extend as needed
        const { trace, metrics } = await import('@opentelemetry/api')
        const { Resource } = await import('@opentelemetry/resources')
        const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions')

        const resource = new Resource({
            [SemanticResourceAttributes.SERVICE_NAME]: 'semem'
        })

        // Set up metrics export if configured
        if (this.config.openTelemetry.metrics) {
            const meter = metrics.getMeter('semem-metrics')
            this.setupMetricInstruments(meter)
        }
    }

    setupMetricInstruments(meter) {
        this.instruments = {
            memoryUsage: meter.createHistogram('memory_usage', {
                description: 'Memory usage statistics'
            }),
            apiLatency: meter.createHistogram('api_latency', {
                description: 'API request latency'
            }),
            storageOperations: meter.createCounter('storage_operations', {
                description: 'Storage operation count'
            })
        }
    }

    async collectMetrics() {
        try {
            for (const [name, collector] of Object.entries(this.collectors)) {
                const metrics = await collector.collect()
                this.metrics.set(name, {
                    timestamp: Date.now(),
                    values: metrics
                })

                // Emit metric events
                this.eventBus.emit('metrics', {
                    name,
                    metrics,
                    timestamp: Date.now()
                })

                // Update OpenTelemetry if configured
                if (this.instruments) {
                    this.updateOpenTelemetryMetrics(name, metrics)
                }
            }

            // Store metrics if configured
            if (this.config.storageEndpoint) {
                await this.storeMetrics()
            }
        } catch (error) {
            this.logger.error('Error collecting metrics:', error)
            this.trackError('metricCollection', error)
        }
    }

    updateOpenTelemetryMetrics(name, metrics) {
        switch (name) {
            case 'performance':
                this.instruments.memoryUsage.record(
                    metrics.memory.heapUsed,
                    { type: 'heap_used' }
                )
                break
            case 'api':
                Object.entries(metrics).forEach(([api, apiMetrics]) => {
                    this.instruments.apiLatency.record(
                        apiMetrics.latency || 0,
                        { api }
                    )
                })
                break
            case 'storage':
                this.instruments.storageOperations.add(
                    metrics.operations,
                    { type: 'total' }
                )
                break
        }
    }

    async storeMetrics() {
        try {
            const metricsData = this.formatMetricsForStorage()
            const response = await fetch(this.config.storageEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metricsData)
            })

            if (!response.ok) {
                throw new Error(`Failed to store metrics: ${response.status}`)
            }
        } catch (error) {
            this.logger.error('Error storing metrics:', error)
            this.trackError('metricStorage', error)
        }
    }

    formatMetricsForStorage() {
        return {
            timestamp: Date.now(),
            metrics: Object.fromEntries(this.metrics),
            errors: Array.from(this.errors.values())
        }
    }

    trackError(type, error) {
        const errorKey = `${type}:${error.message}`
        const existing = this.errors.get(errorKey) || {
            type,
            message: error.message,
            count: 0,
            firstOccurred: Date.now(),
            lastOccurred: Date.now()
        }

        existing.count++
        existing.lastOccurred = Date.now()
        this.errors.set(errorKey, existing)

        this.eventBus.emit('error', {
            type,
            error,
            count: existing.count
        })
    }

    getMetrics() {
        return {
            timestamp: Date.now(),
            collectors: Object.fromEntries(this.metrics),
            errors: Array.from(this.errors.values())
        }
    }

    onMetrics(callback) {
        this.eventBus.on('metrics', callback)
    }

    onError(callback) {
        this.eventBus.on('error', callback)
    }

    async shutdown() {
        if (this.collectionTimer) {
            clearInterval(this.collectionTimer)
        }

        // Store final metrics if configured
        if (this.config.storageEndpoint) {
            await this.storeMetrics()
        }

        this.eventBus.removeAllListeners()
        await super.shutdown()
    }
}