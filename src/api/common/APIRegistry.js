// src/api/common/APIRegistry.js
import logger from 'loglevel'
import BaseAPI from './BaseAPI.js'

/**
 * Centralized registry for managing API instances with lifecycle control
 */
export default class APIRegistry {
    constructor() {
        if (APIRegistry.instance) {
            return APIRegistry.instance
        }
        APIRegistry.instance = this
        this.apis = new Map()
        this.metrics = new Map()
    }

    /**
     * Register and initialize a new API implementation
     */
    async register(name, apiClass, config = {}) {
        if (this.apis.has(name)) {
            throw new Error(`API ${name} already registered`)
        }

        if (!(apiClass.prototype instanceof BaseAPI)) {
            throw new Error('API must extend BaseAPI')
        }

        // Create instance but don't store until fully initialized
        const api = new apiClass(config)

        try {
            // Initialize and handle metric collection
            await api.initialize()
            this.apis.set(name, api)

            api.on('metric', (metric) => {
                this.metrics.set(`${name}.${metric.name}`, {
                    value: metric.value,
                    timestamp: metric.timestamp,
                    labels: metric.labels || {}
                })
            })

            return api
        } catch (error) {
            api.removeAllListeners()
            throw error
        }
    }

    /**
     * Remove and cleanup an API instance
     */
    async unregister(name) {
        const api = this.apis.get(name)
        if (!api) return

        try {
            await api.shutdown()
        } finally {
            api.removeAllListeners()
            this.apis.delete(name)
            // Clean up related metrics
            for (const key of this.metrics.keys()) {
                if (key.startsWith(`${name}.`)) {
                    this.metrics.delete(key)
                }
            }
        }
    }

    /**
     * Retrieve an API instance by name
     */
    get(name) {
        const api = this.apis.get(name)
        if (!api) {
            throw new Error(`API ${name} not found`)
        }
        return api
    }

    /**
     * Get all registered API instances
     */
    getAll() {
        return new Map(this.apis)
    }

    /**
     * Get collected metrics with timestamps
     */
    getMetrics() {
        return {
            timestamp: Date.now(),
            apiCount: this.apis.size,
            apis: Object.fromEntries(
                Array.from(this.apis.entries()).map(([name, api]) => [
                    name,
                    {
                        status: api.initialized ? 'active' : 'inactive',
                        metrics: Object.fromEntries(
                            Array.from(this.metrics.entries())
                                .filter(([key]) => key.startsWith(name))
                                .map(([key, value]) => [
                                    key.split('.')[1],
                                    value
                                ])
                        )
                    }
                ])
            )
        }
    }

    /**
     * Shutdown all registered APIs
     */
    async shutdownAll() {
        const errors = []
        for (const [name, api] of this.apis.entries()) {
            try {
                await this.unregister(name)
            } catch (error) {
                logger.error(`Error shutting down ${name}:`, error)
                errors.push({ name, error })
            }
        }
        if (errors.length > 0) {
            throw new Error('Shutdown errors occurred')
        }
    }
}